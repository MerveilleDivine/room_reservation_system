namespace RoomReservations.Application;

public sealed record DemoProfileSelection(DemoProfileKind Kind, Guid? PersonId = null);
