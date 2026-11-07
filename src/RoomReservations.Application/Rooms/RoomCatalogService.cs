using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Application;

public sealed class RoomCatalogService(IReservationReadStore store)
{
    public async Task<RoomDto[]> ReadAsync(int? minimumCapacity, string? floor, string? equipment,
        CancellationToken cancellationToken)
    {
        if (minimumCapacity is < 1)
            throw new BookingException(BookingErrorCodes.InvalidCapacityFilter, "Minimum capacity must be positive.");
        var required = EquipmentParser.Parse(equipment);
        return (await store.ReadRoomsAsync(cancellationToken)).OrderBy(room => room.Name)
            .Where(room => (minimumCapacity is null || room.Capacity >= minimumCapacity) &&
                (string.IsNullOrWhiteSpace(floor) || room.Floor == floor) &&
                (room.Equipment & required) == required).Select(room => room.ToDto()).ToArray();
    }
}
