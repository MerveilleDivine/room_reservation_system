namespace RoomReservations.Domain;

[Flags]
public enum EquipmentType
{
    None = 0,
    Projector = 1,
    Tv = 2,
    VideoConferencing = 4,
    Whiteboard = 8
}
