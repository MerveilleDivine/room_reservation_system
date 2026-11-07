namespace RoomReservations.Application;

public sealed record PersonDto(
    Guid Id, string FirstName, string LastName, int ActiveReservationCount);
