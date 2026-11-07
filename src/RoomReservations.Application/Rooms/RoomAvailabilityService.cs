using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Application;

public sealed class RoomAvailabilityService(
    IReservationReadStore store, BookingRules rules, TimeProvider clock, IBookingGate gate, BookingProfile profile)
{
    public async Task<RoomAvailabilityDto[]> ReadAsync(
        DateTimeOffset startUtc, DateTimeOffset endUtc, Guid? organizerId, CancellationToken cancellationToken)
    {
        if (organizerId is not null)
            organizerId = await profile.ScopeOrganizerAsync(organizerId, cancellationToken);
        using var lease = await gate.EnterAsync(cancellationToken);
        var now = clock.GetUtcNow();
        rules.ValidateTimeRange(startUtc, endUtc, now);
        if (organizerId is not null && !(await store.ReadPeopleAsync(cancellationToken)).Any(person => person.Id == organizerId))
            throw new BookingException(BookingErrorCodes.OrganizerNotFound, "Choose an existing organizer.", BookingErrorKind.NotFound);

        var rooms = (await store.ReadRoomsAsync(cancellationToken)).OrderBy(room => room.Name).ToArray();
        var reservations = await store.ReadReservationsAsync(cancellationToken);
        return rooms.Select(room =>
        {
            var request = new BookingDetails(room.Id, organizerId ?? Guid.Empty, "Room search", startUtc, endUtc, 1);
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
        EquipmentType requiredEquipment, Guid? excludeReservationId,
        CancellationToken cancellationToken)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        var now = clock.GetUtcNow();
        rules.ValidateTimeRange(startUtc, endUtc, now);
        if (attendees < 1)
            throw new BookingException(BookingErrorCodes.InvalidAttendees, "At least one attendee is required.");
        await profile.RequireAccessAsync(organizerId, cancellationToken);
        if (!(await store.ReadPeopleAsync(cancellationToken)).Any(person => person.Id == organizerId))
            throw new BookingException(BookingErrorCodes.OrganizerNotFound, "Choose an existing organizer.", BookingErrorKind.NotFound);

        var rooms = await store.ReadRoomsAsync(cancellationToken);
        var selected = rooms.SingleOrDefault(room => room.Id == roomId)
            ?? throw new BookingException(BookingErrorCodes.RoomNotFound, "Choose an existing room.", BookingErrorKind.NotFound);
        var reservations = await store.ReadReservationsAsync(cancellationToken);
        if (excludeReservationId is not null)
        {
            var original = reservations.SingleOrDefault(reservation => reservation.Id == excludeReservationId)
                ?? throw new BookingException(BookingErrorCodes.ReservationNotFound, "This reservation could not be found.", BookingErrorKind.NotFound);
            await profile.RequireAccessAsync(original.OrganizerId, cancellationToken);
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
                rules.Validate(new BookingDetails(room.Id, organizerId, "Room suggestion", startUtc, endUtc, attendees),
                    room, reservations, now, excludeReservationId);
                return [candidate];
            }
            catch (BookingException exception) when (exception.Kind == BookingErrorKind.Conflict)
            {
                // A suggestion must be free for both the room and organizer for the entire interval.
            }
        }
        return [];
    }
}
