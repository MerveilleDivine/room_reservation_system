using RoomReservations.Domain;

namespace RoomReservations.Application;

public static class EquipmentParser
{
    public static EquipmentType Parse(string? equipment)
    {
        var required = EquipmentType.None;
        foreach (var code in (equipment ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!DtoMapping.EquipmentCodes.TryGetValue(code, out var value))
                throw new BookingException(BookingErrorCodes.InvalidEquipment, $"Unknown equipment: {code}.");
            required |= value;
        }
        return required;
    }
}
