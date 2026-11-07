using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Application;

public sealed class ExtraTimeService(IReservationReadStore store, BookingRules rules, TimeProvider clock,
    IBookingGate gate, BookingProfile profile)
{
    public async Task<ExtraTimeDto> ReadAsync(Guid id, CancellationToken cancellationToken)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        var original = (await store.ReadReservationsAsync(cancellationToken)).SingleOrDefault(r => r.Id == id)
            ?? throw new BookingException(BookingErrorCodes.ReservationNotFound, "This reservation could not be found.", BookingErrorKind.NotFound);
        await profile.RequireAccessAsync(original.OrganizerId, cancellationToken);
        var bookings = await store.ReadReservationsAsync(cancellationToken);
        return ExtraTimePolicy.Calculate(original, bookings, clock.GetUtcNow(), rules.MaximumDuration).ToDto();
    }
}
