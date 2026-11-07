using System.Security.Cryptography;
using System.Text.Json;
using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Application;

public sealed class ReservationService(
    IBookingStore store, BookingRules rules, TimeProvider clock, IBookingGate gate,
    BookingProfile profile)
{
    public async Task<ReservationDto> SaveAsync(
        BookingRequest request, Guid? id, CancellationToken cancellationToken, Guid? submissionKey = null)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        await RequireAccessAsync(request.OrganizerId, cancellationToken);
        if (id is not null)
            await RequireAccessAsync((await FindAsync(id.Value, cancellationToken)).OrganizerId, cancellationToken);
        var fingerprint = Fingerprint(new
        {
            Operation = id is null ? "create" : $"edit:{id}",
            request.RoomId,
            request.OrganizerId,
            Title = request.Title?.Trim(),
            StartUtc = request.StartUtc.ToUniversalTime(),
            EndUtc = request.EndUtc.ToUniversalTime(),
            request.Attendees
        });
        var replay = await ReplayAsync(submissionKey, fingerprint, cancellationToken);
        if (replay is not null) return replay;
        var now = clock.GetUtcNow();
        Reservation? existing = null;
        if (id is not null)
        {
            existing = await FindAsync(id.Value, cancellationToken);
            if (existing.StatusAt(now) != ReservationStatus.Booked || existing.StartUtc <= now)
                throw new BookingException(BookingErrorCodes.ReservationNotEditable, "Only future, booked reservations can be edited.", BookingErrorKind.Conflict);
        }

        var reservation = await ApplyBookingAsync(request, existing, now, cancellationToken);
        AddReceipt(submissionKey, fingerprint, reservation.Id);
        await store.SaveChangesAsync(cancellationToken);
        return reservation.ToDto(now);
    }

    public async Task<ReservationDto> ReserveMoreAsync(
        Guid id, ContinuationRequest request, CancellationToken cancellationToken, Guid? submissionKey = null)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        var original = await FindAsync(id, cancellationToken);
        await RequireAccessAsync(original.OrganizerId, cancellationToken);
        var fingerprint = Fingerprint(new { Operation = $"continue:{id}", request.AdditionalMinutes });
        var replay = await ReplayAsync(submissionKey, fingerprint, cancellationToken);
        if (replay is not null) return replay;
        var now = clock.GetUtcNow();
        if (original.StatusAt(now) != ReservationStatus.Booked || original.StartUtc > now)
            throw new BookingException(BookingErrorCodes.MeetingNotOngoing, "Reserve extra time while the meeting is still in progress. Otherwise, create a new future reservation.", BookingErrorKind.Conflict);
        if (request.AdditionalMinutes <= 0 || request.AdditionalMinutes > rules.MaximumDuration.TotalMinutes)
            throw new BookingException(BookingErrorCodes.InvalidAdditionalTime, "Choose a positive duration within the booking duration limit.");
        if ((await store.ReadReservationsAsync(cancellationToken)).Any(r => r.ContinuationOfId == id && r.Status != ReservationStatus.Cancelled))
            throw new BookingException(BookingErrorCodes.ContinuationAlreadyBooked, "Extra time is already reserved. Find the additional booking to edit or cancel it.", BookingErrorKind.Conflict);

        var extra = ExtraTimePolicy.Calculate(original,
            await store.ReadReservationsAsync(cancellationToken), now, rules.MaximumDuration);
        if (request.AdditionalMinutes > extra.MaximumMinutes)
            throw new BookingException(extra.ReasonCode ?? BookingErrorCodes.DurationExceeded,
                extra.Message ?? "That much additional time is not available.", BookingErrorKind.Conflict);

        var booking = new BookingRequest(original.RoomId, original.OrganizerId, original.Title,
            original.EndUtc, original.EndUtc.AddMinutes(request.AdditionalMinutes), original.Attendees);
        var continuation = await ApplyBookingAsync(booking, null, now, cancellationToken);
        continuation.ContinuationOfId = id;
        AddReceipt(submissionKey, fingerprint, continuation.Id);
        await store.SaveChangesAsync(cancellationToken);
        return continuation.ToDto(now);
    }

    public async Task<ReservationDto> RecoverAsync(Guid submissionKey, CancellationToken cancellationToken)
    {
        // Wait for any in-flight write before looking for its receipt.
        using var lease = await gate.EnterAsync(cancellationToken);
        var receipt = await store.FindSubmissionAsync(submissionKey, cancellationToken)
            ?? throw new BookingException(BookingErrorCodes.BookingRequestNotFound, "No booking confirmation was found for this request.", BookingErrorKind.NotFound);
        var reservation = await FindAsync(receipt.ReservationId, cancellationToken);
        await RequireAccessAsync(reservation.OrganizerId, cancellationToken);
        return reservation.ToDto(clock.GetUtcNow());
    }

    private async Task<Reservation> ApplyBookingAsync(
        BookingRequest request, Reservation? existing, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var room = await store.FindRoomAsync(request.RoomId, cancellationToken)
            ?? throw new BookingException(BookingErrorCodes.RoomNotFound, "Choose an existing room.", BookingErrorKind.NotFound);
        var person = await store.FindPersonAsync(request.OrganizerId, cancellationToken)
            ?? throw new BookingException(BookingErrorCodes.OrganizerNotFound, "Choose an existing organizer.", BookingErrorKind.NotFound);
        var reservations = await store.ReadReservationsAsync(cancellationToken);
        rules.Validate(request.ToDetails(), room, reservations, now, existing?.Id);

        var reservation = existing ?? new Reservation { Id = Guid.NewGuid(), Title = "" };
        reservation.RoomId = room.Id;
        reservation.Room = room;
        reservation.OrganizerId = person.Id;
        reservation.Organizer = person;
        reservation.Title = request.Title!.Trim();
        reservation.StartUtc = request.StartUtc.ToUniversalTime();
        reservation.EndUtc = request.EndUtc.ToUniversalTime();
        reservation.Attendees = request.Attendees;
        if (existing is null) store.AddReservation(reservation);
        return reservation;
    }

    private async Task<ReservationDto?> ReplayAsync(Guid? key, string fingerprint, CancellationToken cancellationToken)
    {
        if (key is null) return null;
        var receipt = await store.FindSubmissionAsync(key.Value, cancellationToken);
        if (receipt is null) return null;
        if (receipt.Fingerprint != fingerprint)
            throw new BookingException(BookingErrorCodes.IdempotencyKeyReused, "This request identifier belongs to a different booking change. Refresh the form before submitting a new change.", BookingErrorKind.Conflict);
        var reservation = await FindAsync(receipt.ReservationId, cancellationToken);
        await RequireAccessAsync(reservation.OrganizerId, cancellationToken);
        return reservation.ToDto(clock.GetUtcNow());
    }

    private void AddReceipt(Guid? key, string fingerprint, Guid reservationId)
    {
        if (key is not null)
            store.AddSubmission(new BookingSubmission { Id = key.Value, Fingerprint = fingerprint, ReservationId = reservationId });
    }

    private static string Fingerprint<T>(T value) =>
        Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(value)));

    public async Task<ReservationDto> TransitionAsync(
        Guid id, ReservationAction action, CancellationToken cancellationToken)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        var reservation = await FindAsync(id, cancellationToken);
        await RequireAccessAsync(reservation.OrganizerId, cancellationToken);
        var now = clock.GetUtcNow();
        reservation.Transition(action, now);

        await store.SaveChangesAsync(cancellationToken);
        return reservation.ToDto(now);
    }

    private Task RequireAccessAsync(Guid organizerId, CancellationToken cancellationToken) =>
        profile.RequireAccessAsync(organizerId, cancellationToken);

    private async Task<Reservation> FindAsync(Guid id, CancellationToken cancellationToken) =>
        await store.FindReservationAsync(id, cancellationToken)
        ?? throw new BookingException(BookingErrorCodes.ReservationNotFound, "This reservation could not be found.", BookingErrorKind.NotFound);
}
