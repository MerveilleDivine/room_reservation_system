using RoomReservations.Domain;

namespace RoomReservations.Application;

public static class DtoMapping
{
    public static readonly IReadOnlyDictionary<string, EquipmentType> EquipmentCodes =
        new Dictionary<string, EquipmentType>(StringComparer.OrdinalIgnoreCase)
        {
            ["projector"] = EquipmentType.Projector,
            ["tv"] = EquipmentType.Tv,
            ["videoConferencing"] = EquipmentType.VideoConferencing,
            ["whiteboard"] = EquipmentType.Whiteboard
        };

    public static ExtraTimeDto ToDto(this ExtraTimeAvailability availability) => new(
        availability.MaximumMinutes, availability.StartsAtUtc, availability.BlockedFromUtc,
        availability.BlockedUntilUtc, availability.ReasonCode, availability.Message);

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
