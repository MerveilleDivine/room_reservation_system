namespace RoomReservations.Application;

public sealed record RoomDto(
    Guid Id, string Name, int Capacity, string Floor, string[] Equipment, bool IsActive);
