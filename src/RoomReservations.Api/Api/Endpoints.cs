using RoomReservations.Api.Api.Endpoints;

namespace RoomReservations.Api.Api;

internal static class EndpointMapping
{
    internal static void MapReservationApi(this WebApplication app)
    {
        app.MapSystemEndpoints();
        app.MapReservationEndpoints();
        app.MapRoomEndpoints();
        app.MapPeopleEndpoints();
        app.MapReportingEndpoints();
    }
}
