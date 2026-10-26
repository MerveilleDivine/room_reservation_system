using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Application;

public sealed record RoomAvailabilityDto(Guid RoomId, bool IsAvailable, string? Reason);

public sealed class RoomAvailabilityService(
    ReservationsDbContext db, BookingRules rules, TimeProvider clock, BookingWriteGate gate)
{
    public async Task<RoomAvailabilityDto[]> ReadAsync(
        DateTimeOffset startUtc, DateTimeOffset endUtc, Guid? organizerId, CancellationToken cancellationToken)
    {
        await gate.Semaphore.WaitAsync(cancellationToken);
        try
        {
            var now = clock.GetUtcNow();
            rules.ValidateTimeRange(startUtc, endUtc, now);
            if (organizerId is not null && !await db.People.AsNoTracking()
                    .AnyAsync(person => person.Id == organizerId, cancellationToken))
                throw new BookingException("ORGANIZER_NOT_FOUND", "Choose an existing organizer.", 404);

            var rooms = await db.Rooms.AsNoTracking().OrderBy(room => room.Name).ToListAsync(cancellationToken);
            var reservations = await db.Reservations.AsNoTracking().ToListAsync(cancellationToken);
            return rooms.Select(room =>
            {
                var request = new BookingRequest(room.Id, organizerId ?? Guid.Empty, "Room search", startUtc, endUtc, 1);
                try
                {
                    rules.Validate(request, room, reservations, now);
                    return new RoomAvailabilityDto(room.Id, true, null);
                }
                catch (BookingException exception)
                {
                    return new RoomAvailabilityDto(room.Id, false, exception.Message);
                }
            }).ToArray();
        }
        finally { gate.Semaphore.Release(); }
    }
}
