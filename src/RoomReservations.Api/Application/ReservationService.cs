using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Application;

public sealed class ReservationService(
    ReservationsDbContext db, BookingRules rules, TimeProvider clock, BookingWriteGate gate,
    BookingProfile? profile = null)
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
                throw new BookingException("RESERVATION_NOT_EDITABLE", "Only future, booked reservations can be edited.", 409);
        }

        var reservation = await ApplyBookingAsync(request, existing, now, cancellationToken);
        AddReceipt(submissionKey, fingerprint, reservation.Id);
        await db.SaveChangesAsync(cancellationToken);
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
            throw new BookingException("MEETING_NOT_ONGOING", "Reserve extra time while the meeting is still in progress. Otherwise, create a new future reservation.", 409);
        if (request.AdditionalMinutes <= 0 || request.AdditionalMinutes > rules.MaximumDuration.TotalMinutes)
            throw new BookingException("INVALID_ADDITIONAL_TIME", "Choose a positive duration within the booking duration limit.");
        if (await db.Reservations.AnyAsync(r => r.ContinuationOfId == id && r.Status != ReservationStatus.Cancelled, cancellationToken))
            throw new BookingException("CONTINUATION_ALREADY_BOOKED", "Extra time is already reserved. Find the additional booking to edit or cancel it.", 409);

        var extra = ExtraTimePolicy.Calculate(original,
            await db.Reservations.AsNoTracking().ToListAsync(cancellationToken), now, rules.MaximumDuration);
        if (request.AdditionalMinutes > extra.MaximumMinutes)
            throw new BookingException(extra.ReasonCode ?? "DURATION_EXCEEDED",
                extra.Message ?? "That much additional time is not available.", 409);

        var booking = new BookingRequest(original.RoomId, original.OrganizerId, original.Title,
            original.EndUtc, original.EndUtc.AddMinutes(request.AdditionalMinutes), original.Attendees);
        var continuation = await ApplyBookingAsync(booking, null, now, cancellationToken);
        continuation.ContinuationOfId = id;
        AddReceipt(submissionKey, fingerprint, continuation.Id);
        await db.SaveChangesAsync(cancellationToken);
        return continuation.ToDto(now);
    }

    public async Task<ReservationDto> RecoverAsync(Guid submissionKey, CancellationToken cancellationToken)
    {
        // Wait for any in-flight write before looking for its receipt.
        using var lease = await gate.EnterAsync(cancellationToken);
        var receipt = await db.BookingSubmissions.FindAsync([submissionKey], cancellationToken)
            ?? throw new BookingException("BOOKING_REQUEST_NOT_FOUND", "No booking confirmation was found for this request.", 404);
        var reservation = await FindAsync(receipt.ReservationId, cancellationToken);
        await RequireAccessAsync(reservation.OrganizerId, cancellationToken);
        return reservation.ToDto(clock.GetUtcNow());
    }

    private async Task<Reservation> ApplyBookingAsync(
        BookingRequest request, Reservation? existing, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var room = await db.Rooms.FindAsync([request.RoomId], cancellationToken)
            ?? throw new BookingException("ROOM_NOT_FOUND", "Choose an existing room.", 404);
        var person = await db.People.FindAsync([request.OrganizerId], cancellationToken)
            ?? throw new BookingException("ORGANIZER_NOT_FOUND", "Choose an existing organizer.", 404);
        var reservations = await db.Reservations.AsNoTracking().ToListAsync(cancellationToken);
        rules.Validate(request, room, reservations, now, existing?.Id);

        var reservation = existing ?? new Reservation { Id = Guid.NewGuid(), Title = "" };
        reservation.RoomId = room.Id;
        reservation.Room = room;
        reservation.OrganizerId = person.Id;
        reservation.Organizer = person;
        reservation.Title = request.Title!.Trim();
        reservation.StartUtc = request.StartUtc.ToUniversalTime();
        reservation.EndUtc = request.EndUtc.ToUniversalTime();
        reservation.Attendees = request.Attendees;
        if (existing is null) db.Reservations.Add(reservation);
        return reservation;
    }

    private async Task<ReservationDto?> ReplayAsync(Guid? key, string fingerprint, CancellationToken cancellationToken)
    {
        if (key is null) return null;
        var receipt = await db.BookingSubmissions.FindAsync([key.Value], cancellationToken);
        if (receipt is null) return null;
        if (receipt.Fingerprint != fingerprint)
            throw new BookingException("IDEMPOTENCY_KEY_REUSED", "This request identifier belongs to a different booking change. Refresh the form before submitting a new change.", 409);
        var reservation = await FindAsync(receipt.ReservationId, cancellationToken);
        await RequireAccessAsync(reservation.OrganizerId, cancellationToken);
        return reservation.ToDto(clock.GetUtcNow());
    }

    private void AddReceipt(Guid? key, string fingerprint, Guid reservationId)
    {
        if (key is not null)
            db.BookingSubmissions.Add(new BookingSubmission { Id = key.Value, Fingerprint = fingerprint, ReservationId = reservationId });
    }

    private static string Fingerprint<T>(T value) =>
        Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(value)));

    public async Task<ReservationDto> TransitionAsync(
        Guid id, string action, CancellationToken cancellationToken)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        var reservation = await FindAsync(id, cancellationToken);
        await RequireAccessAsync(reservation.OrganizerId, cancellationToken);
        var now = clock.GetUtcNow();
        if (reservation.StatusAt(now) != ReservationStatus.Booked)
            throw new BookingException("RESERVATION_NOT_ACTIVE", "This reservation is no longer active.", 409);

        switch (action)
        {
            case "cancel":
                if (reservation.StartUtc <= now)
                    throw new BookingException("MEETING_ALREADY_STARTED", "End a started meeting instead of cancelling it.", 409);
                reservation.Status = ReservationStatus.Cancelled;
                break;
            case "check-in":
                if (reservation.StartUtc > now)
                    throw new BookingException("MEETING_NOT_STARTED", "Check in when the meeting starts.", 409);
                if (reservation.CheckedInAtUtc is not null)
                    throw new BookingException("ALREADY_CHECKED_IN", "This meeting is already checked in.", 409);
                reservation.CheckedInAtUtc = now;
                break;
            case "end":
                if (reservation.StartUtc > now)
                    throw new BookingException("MEETING_NOT_STARTED", "A future meeting cannot be ended early.", 409);
                reservation.ActualEndUtc = now;
                reservation.Status = ReservationStatus.Completed;
                break;
            default:
                throw new BookingException("INVALID_ACTION", "Unknown reservation action.");
        }

        await db.SaveChangesAsync(cancellationToken);
        return reservation.ToDto(now);
    }

    private Task RequireAccessAsync(Guid organizerId, CancellationToken cancellationToken) =>
        profile?.RequireAccessAsync(db, organizerId, cancellationToken) ?? Task.CompletedTask;

    private async Task<Reservation> FindAsync(Guid id, CancellationToken cancellationToken) =>
        await db.Reservations.Include(r => r.Room).Include(r => r.Organizer)
            .SingleOrDefaultAsync(r => r.Id == id, cancellationToken)
        ?? throw new BookingException("RESERVATION_NOT_FOUND", "This reservation could not be found.", 404);
}
