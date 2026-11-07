namespace RoomReservations.Application;

public sealed record ExtraTimeDto(int MaximumMinutes, DateTimeOffset StartsAtUtc,
    DateTimeOffset? BlockedFromUtc, DateTimeOffset? BlockedUntilUtc, string? ReasonCode, string? Message);
