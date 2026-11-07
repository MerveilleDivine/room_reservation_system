using RoomReservations.Application;

namespace RoomReservations.Api.Api.Endpoints;

internal static class RoomEndpoints
{
    internal static void MapRoomEndpoints(this WebApplication app)
    {
        app.MapGet("/api/rooms", async (int? minimumCapacity, string? floor, string? equipment,
            RoomCatalogService service, CancellationToken cancellationToken) =>
            await service.ReadAsync(minimumCapacity, floor, equipment, cancellationToken));
        app.MapGet("/api/room-availability", async (
            DateTimeOffset startUtc, DateTimeOffset endUtc, Guid? organizerId,
            RoomAvailabilityService service, CancellationToken cancellationToken) =>
            await service.ReadAsync(startUtc, endUtc, organizerId, cancellationToken));
        app.MapGet("/api/room-suggestions", async (
            Guid roomId, Guid organizerId, int attendees, DateTimeOffset startUtc, DateTimeOffset endUtc,
            string? equipment, Guid? excludeReservationId,
            RoomAvailabilityService service, CancellationToken cancellationToken) =>
            await service.SuggestAsync(roomId, organizerId, attendees, startUtc, endUtc,
                EquipmentParser.Parse(equipment), excludeReservationId, cancellationToken));
    }
}
