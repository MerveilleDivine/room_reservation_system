namespace RoomReservations.Domain;

public sealed class Room
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public int Capacity { get; set; }
    public required string Floor { get; set; }
    public EquipmentType Equipment { get; set; }
    public bool IsActive { get; set; } = true;
}
