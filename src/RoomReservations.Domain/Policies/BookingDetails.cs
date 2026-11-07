namespace RoomReservations.Domain;

public sealed record BookingDetails(Guid RoomId, Guid OrganizerId, string? Title,
    DateTimeOffset StartUtc, DateTimeOffset EndUtc, int Attendees);
