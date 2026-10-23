using RoomReservations.Api.Domain;

namespace RoomReservations.Api.Application;

public static class DtoMapping
{
    public static readonly IReadOnlyDictionary<string, Equipment> EquipmentCodes =
        new Dictionary<string, Equipment>(StringComparer.OrdinalIgnoreCase)
        {
            ["projector"] = Equipment.Projector,
            ["tv"] = Equipment.Tv,
            ["videoConferencing"] = Equipment.VideoConferencing,
            ["whiteboard"] = Equipment.Whiteboard
        };

    public static RoomDto ToDto(this Room room) => new(
        room.Id, room.Name, room.Capacity, room.Floor,
        EquipmentCodes.Where(item => room.Equipment.HasFlag(item.Value)).Select(item => item.Key).ToArray(),
        room.IsActive);

    public static ReservationDto ToDto(this Reservation reservation, DateTimeOffset now) => new(
        reservation.Id, reservation.RoomId, reservation.Room.Name,
        reservation.OrganizerId, $"{reservation.Organizer.FirstName} {reservation.Organizer.LastName}",
        reservation.Title, reservation.StartUtc, reservation.EndUtc, reservation.Attendees,
        reservation.StatusAt(now).ToString(), reservation.CheckedInAtUtc, reservation.ActualEndUtc,
        AllowedActions(reservation, now), reservation.ContinuationOfId,
        reservation.StatusAt(now) == ReservationStatus.Completed
            ? reservation.ActualEndUtc is not null
                ? "Ended early."
                : "Scheduled time ended. Actual departure is not recorded."
            : null);

    private static string[] AllowedActions(Reservation reservation, DateTimeOffset now)
    {
        if (reservation.StatusAt(now) != ReservationStatus.Booked) return [];
        if (reservation.StartUtc > now) return ["edit", "cancel"];
        return reservation.CheckedInAtUtc is null
            ? ["check-in", "reserve-more", "end"]
            : ["reserve-more", "end"];
    }
}
