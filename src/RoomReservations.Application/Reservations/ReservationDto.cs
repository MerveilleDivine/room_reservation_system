namespace RoomReservations.Application;

public sealed record ReservationDto(
    Guid Id, Guid RoomId, string RoomName, Guid OrganizerId, string OrganizerName,
    string Title, DateTimeOffset StartUtc, DateTimeOffset EndUtc, int Attendees,
    string Status, DateTimeOffset? CheckedInAtUtc, DateTimeOffset? ActualEndUtc,
    string[] AllowedActions, Guid? ContinuationOfId, string? CompletionNote);
