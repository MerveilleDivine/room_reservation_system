using Microsoft.Extensions.Options;
using RoomReservations.Application;

namespace RoomReservations.Api.Api.Endpoints;

internal static class SystemEndpoints
{
    internal static void MapSystemEndpoints(this WebApplication app)
    {
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
        app.MapGet("/api/booking-policy", (IOptions<BookingOptions> options) =>
            new BookingPolicyDto(options.Value.MaximumDurationDays, options.Value.MaximumAdvanceDays));
    }
}
