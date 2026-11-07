using RoomReservations.Application;
using RoomReservations.Domain;

namespace RoomReservations.Api.Api.Endpoints;

internal static class ReservationEndpoints
{
    internal static void MapReservationEndpoints(this WebApplication app)
    {
        app.MapGet("/api/reservation-feed", async (
            string? view, Guid? roomId, Guid? organizerId, string? status, DateTimeOffset? from, DateTimeOffset? to,
            int? page, int? pageSize, Guid? focusId, ReservationFeedService service, CancellationToken cancellationToken) =>
            await service.ReadAsync(new ReservationFeedQuery(view, roomId, organizerId, status, from, to,
                page ?? 1, pageSize ?? ReservationFeedQuery.DefaultPageSize, focusId), cancellationToken));
        app.MapGet("/api/reservations", async (
            Guid? roomId, Guid? organizerId, string? status, DateTimeOffset? from, DateTimeOffset? to,
            ReservationReadService service, CancellationToken cancellationToken) =>
            await service.ReadAsync(roomId, organizerId, status, from, to, cancellationToken));
        app.MapGet("/api/reservations/{id:guid}", async (
            Guid id, ReservationReadService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.FindAsync(id, cancellationToken)));
        app.MapPost("/api/reservations", async (
            BookingRequest request, HttpRequest http, ReservationService service, CancellationToken cancellationToken) =>
        {
            var result = await service.SaveAsync(request, null, cancellationToken, BookingProtocol.SubmissionKey(http));
            return Results.Created($"/api/reservations/{result.Id}", result);
        });
        app.MapPut("/api/reservations/{id:guid}", async (
            Guid id, BookingRequest request, HttpRequest http, ReservationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.SaveAsync(request, id, cancellationToken, BookingProtocol.SubmissionKey(http))));
        app.MapGet("/api/booking-requests/{requestId:guid}", async (
            Guid requestId, ReservationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.RecoverAsync(requestId, cancellationToken)));
        app.MapPost("/api/reservations/{id:guid}/continuations", async (
            Guid id, ContinuationRequest request, HttpRequest http, ReservationService service, CancellationToken cancellationToken) =>
        {
            var result = await service.ReserveMoreAsync(id, request, cancellationToken, BookingProtocol.SubmissionKey(http));
            return Results.Created($"/api/reservations/{result.Id}", result);
        });
        app.MapGet("/api/reservations/{id:guid}/extra-time", async (
            Guid id, ExtraTimeService service, CancellationToken cancellationToken) =>
            await service.ReadAsync(id, cancellationToken));
        app.MapPost("/api/reservations/{id:guid}/cancel", async (
            Guid id, ReservationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.TransitionAsync(id, ReservationAction.Cancel, cancellationToken)));
        app.MapPost("/api/reservations/{id:guid}/check-in", async (
            Guid id, ReservationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.TransitionAsync(id, ReservationAction.CheckIn, cancellationToken)));
        app.MapPost("/api/reservations/{id:guid}/end", async (
            Guid id, ReservationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.TransitionAsync(id, ReservationAction.End, cancellationToken)));
    }
}
