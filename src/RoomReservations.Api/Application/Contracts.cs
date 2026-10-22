namespace RoomReservations.Api.Application;

public sealed record BookingRequest(
    Guid RoomId,
    Guid OrganizerId,
    string? Title,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    int Attendees);

public sealed record RoomDto(
    Guid Id, string Name, int Capacity, string Floor, string[] Equipment, bool IsActive);

public sealed record PersonDto(
    Guid Id, string FirstName, string LastName, int ActiveReservationCount);

public sealed record ReservationDto(
    Guid Id, Guid RoomId, string RoomName, Guid OrganizerId, string OrganizerName,
    string Title, DateTimeOffset StartUtc, DateTimeOffset EndUtc, int Attendees,
    string Status, DateTimeOffset? CheckedInAtUtc, DateTimeOffset? ActualEndUtc,
    string[] AllowedActions);

public sealed record BookingPolicyDto(int MaximumDurationDays, int MaximumAdvanceDays);

public sealed class BookingOptions
{
    public const string SectionName = "BookingRules";
    public int MaximumDurationDays { get; set; } = 7;
    public int MaximumAdvanceDays { get; set; } = 90;
}

public sealed class BookingException(string code, string message, int statusCode = 400)
    : Exception(message)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}
