namespace RoomReservations.Domain;

public sealed record ExtraTimeAvailability(int MaximumMinutes, DateTimeOffset StartsAtUtc,
    DateTimeOffset? BlockedFromUtc, DateTimeOffset? BlockedUntilUtc, string? ReasonCode, string? Message);
