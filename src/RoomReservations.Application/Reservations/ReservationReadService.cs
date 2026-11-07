using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Application;

public sealed class ReservationReadService(IReservationReadStore store, TimeProvider clock,
    IBookingGate gate, BookingProfile profile)
{
    public async Task<ReservationDto[]> ReadAsync(Guid? roomId, Guid? organizerId, string? status,
        DateTimeOffset? from, DateTimeOffset? to, CancellationToken cancellationToken)
    {
        organizerId = await profile.ScopeOrganizerAsync(organizerId, cancellationToken);
        ReservationFilters.ValidateRange(from, to);
        var desiredStatus = ReservationFilters.ParseStatus(status);
        using var lease = await gate.EnterAsync(cancellationToken);
        var now = clock.GetUtcNow();
        return (await store.ReadReservationsAsync(cancellationToken)).OrderBy(reservation => reservation.StartUtc)
            .Where(reservation =>
                (roomId is null || reservation.RoomId == roomId) &&
                (organizerId is null || reservation.OrganizerId == organizerId) &&
                (desiredStatus is null || reservation.StatusAt(now) == desiredStatus) &&
                (from is null || reservation.EndUtc > from) &&
                (to is null || reservation.StartUtc < to))
            .Select(reservation => reservation.ToDto(now)).ToArray();
    }

    public async Task<ReservationDto> FindAsync(Guid id, CancellationToken cancellationToken)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        var reservation = (await store.ReadReservationsAsync(cancellationToken)).SingleOrDefault(item => item.Id == id)
            ?? throw new BookingException(BookingErrorCodes.ReservationNotFound, "This reservation could not be found.", BookingErrorKind.NotFound);
        await profile.RequireAccessAsync(reservation.OrganizerId, cancellationToken);
        return reservation.ToDto(clock.GetUtcNow());
    }
}
