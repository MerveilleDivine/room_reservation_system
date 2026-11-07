namespace RoomReservations.Application;

public sealed record RoomSuggestionDto(RoomDto Room, string[] MissingEquipment);
