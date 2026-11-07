using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Application;

public sealed class UsageReportService(IReservationReadStore store, TimeProvider clock, IBookingGate gate, BookingProfile profile)
{
    public async Task<UsageReportDto> ReadAsync(
        DateTimeOffset? from, DateTimeOffset? to, Guid? roomId, CancellationToken cancellationToken)
    {
        profile.RequireAdministrator();
        if ((from is null) != (to is null))
            throw new BookingException(BookingErrorCodes.InvalidReportRange, "Provide both the report start and end, or leave both empty.");

        // Materialize a consistent snapshot while booking mutations are excluded.
        using var lease = await gate.EnterAsync(cancellationToken);
        var now = clock.GetUtcNow();
        var rooms = await store.ReadRoomsAsync(cancellationToken);
        if (roomId is not null)
        {
            rooms = rooms.Where(r => r.Id == roomId).ToArray();
            if (rooms.Length == 0) throw new BookingException(BookingErrorCodes.RoomNotFound, "This room could not be found.", BookingErrorKind.NotFound);
        }
        var reservations = await store.ReadReservationsAsync(cancellationToken);
        return UsageReportBuilder.Build(rooms, reservations, from ?? now.AddDays(-7), to ?? now, now);
    }
}
