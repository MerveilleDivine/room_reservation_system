namespace RoomReservations.Application;

public sealed record RoomAvailabilityDto(Guid RoomId, bool IsAvailable, string? Reason);
