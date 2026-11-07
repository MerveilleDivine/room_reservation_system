using RoomReservations.Domain;

namespace RoomReservations.Application;

public sealed record BookingRequest(
    Guid RoomId,
    Guid OrganizerId,
    string? Title,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    int Attendees)
{
    public BookingDetails ToDetails() => new(RoomId, OrganizerId, Title, StartUtc, EndUtc, Attendees);
}
