using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Application;

public sealed record RoomAvailabilityDto(Guid RoomId, bool IsAvailable, string? Reason);
public sealed record RoomSuggestionDto(RoomDto Room, string[] MissingEquipment);

public sealed class RoomAvailabilityService(
    ReservationsDbContext db, BookingRules rules, TimeProvider clock, BookingWriteGate gate, BookingProfile profile)
{
    public async Task<RoomAvailabilityDto[]> ReadAsync(
        DateTimeOffset startUtc, DateTimeOffset endUtc, Guid? organizerId, CancellationToken cancellationToken)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
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

    public async Task<RoomSuggestionDto[]> SuggestAsync(
        Guid roomId, Guid organizerId, int attendees, DateTimeOffset startUtc, DateTimeOffset endUtc,
        Equipment requiredEquipment, Guid? excludeReservationId,
        CancellationToken cancellationToken)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        var now = clock.GetUtcNow();
        rules.ValidateTimeRange(startUtc, endUtc, now);
        if (attendees < 1)
            throw new BookingException("INVALID_ATTENDEES", "At least one attendee is required.");
        await profile.RequireAccessAsync(db, organizerId, cancellationToken);
        if (!await db.People.AsNoTracking().AnyAsync(person => person.Id == organizerId, cancellationToken))
            throw new BookingException("ORGANIZER_NOT_FOUND", "Choose an existing organizer.", 404);

        var rooms = await db.Rooms.AsNoTracking().ToListAsync(cancellationToken);
        var selected = rooms.SingleOrDefault(room => room.Id == roomId)
            ?? throw new BookingException("ROOM_NOT_FOUND", "Choose an existing room.", 404);
        var reservations = await db.Reservations.AsNoTracking().ToListAsync(cancellationToken);
        if (excludeReservationId is not null)
        {
            var original = reservations.SingleOrDefault(reservation => reservation.Id == excludeReservationId)
                ?? throw new BookingException("RESERVATION_NOT_FOUND", "This reservation could not be found.", 404);
            await profile.RequireAccessAsync(db, original.OrganizerId, cancellationToken);
        }

        // Prefer similar equipment, then the smallest suitable room. Never change the booking automatically.
        var candidates = rooms.Where(room => room.IsActive && room.Capacity >= attendees &&
                room.Capacity < selected.Capacity && (room.Equipment & requiredEquipment) == requiredEquipment)
            .Select(room => new RoomSuggestionDto(room.ToDto(), DtoMapping.EquipmentCodes
                .Where(item => selected.Equipment.HasFlag(item.Value) && !room.Equipment.HasFlag(item.Value))
                .Select(item => item.Key).ToArray()))
            .OrderBy(candidate => candidate.MissingEquipment.Length)
            .ThenBy(candidate => candidate.Room.Capacity)
            .ThenBy(candidate => candidate.Room.Floor == selected.Floor ? 0 : 1)
            .ThenBy(candidate => candidate.Room.Name, StringComparer.Ordinal);
        foreach (var candidate in candidates)
        {
            var room = rooms.Single(room => room.Id == candidate.Room.Id);
            try
            {
                rules.Validate(new BookingRequest(room.Id, organizerId, "Room suggestion", startUtc, endUtc, attendees),
                    room, reservations, now, excludeReservationId);
                return [candidate];
            }
            catch (BookingException exception) when (exception.StatusCode == 409)
            {
                // A suggestion must be free for both the room and organizer for the entire interval.
            }
        }
        return [];
    }
}
