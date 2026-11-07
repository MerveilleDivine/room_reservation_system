using RoomReservations.Application;

namespace RoomReservations.Api.Api.Endpoints;

internal static class ReportingEndpoints
{
    internal static void MapReportingEndpoints(this WebApplication app) =>
        app.MapGet("/api/usage", async (DateTimeOffset? from, DateTimeOffset? to, Guid? roomId,
            UsageReportService service, CancellationToken cancellationToken) =>
            await service.ReadAsync(from, to, roomId, cancellationToken));
}
