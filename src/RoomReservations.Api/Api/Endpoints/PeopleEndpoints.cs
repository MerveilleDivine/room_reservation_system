using RoomReservations.Application;

namespace RoomReservations.Api.Api.Endpoints;

internal static class PeopleEndpoints
{
    internal static void MapPeopleEndpoints(this WebApplication app) =>
        app.MapGet("/api/users", async (PeopleService service, CancellationToken cancellationToken) =>
            await service.ReadAsync(cancellationToken));
}
