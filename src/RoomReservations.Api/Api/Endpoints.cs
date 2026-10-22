using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RoomReservations.Api.Application;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Api;

public static class Endpoints
{
    public static void MapReservationApi(this WebApplication app)
    {
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
        app.MapGet("/api/booking-policy", (IOptions<BookingOptions> options) =>
            new BookingPolicyDto(options.Value.MaximumDurationDays, options.Value.MaximumAdvanceDays));
        app.MapGet("/api/usage", async (
            DateTimeOffset? from, DateTimeOffset? to, Guid? roomId,
            UsageReportService service, CancellationToken cancellationToken) =>
            await service.ReadAsync(from, to, roomId, cancellationToken));

        app.MapGet("/api/rooms", async (
            int? minimumCapacity, string? floor, string? equipment,
            ReservationsDbContext db, CancellationToken cancellationToken) =>
        {
            if (minimumCapacity is < 1)
                throw new BookingException("INVALID_CAPACITY_FILTER", "Minimum capacity must be positive.");
            var requiredEquipment = Equipment.None;
            foreach (var code in (equipment ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!DtoMapping.EquipmentCodes.TryGetValue(code, out var value))
                    throw new BookingException("INVALID_EQUIPMENT", $"Unknown equipment: {code}.");
                requiredEquipment |= value;
            }
            var rooms = await db.Rooms.AsNoTracking().OrderBy(r => r.Name).ToListAsync(cancellationToken);
            return rooms.Where(r =>
                (minimumCapacity is null || r.Capacity >= minimumCapacity) &&
                (string.IsNullOrWhiteSpace(floor) || r.Floor == floor) &&
                (r.Equipment & requiredEquipment) == requiredEquipment).Select(r => r.ToDto());
        });

        app.MapGet("/api/users", async (
            ReservationsDbContext db, TimeProvider clock, CancellationToken cancellationToken) =>
        {
            var now = clock.GetUtcNow();
            var people = await db.People.AsNoTracking().OrderBy(p => p.FirstName).ToListAsync(cancellationToken);
            var reservations = await db.Reservations.AsNoTracking().ToListAsync(cancellationToken);
            return people.Select(person => new PersonDto(person.Id, person.FirstName, person.LastName,
                reservations.Count(r => r.OrganizerId == person.Id && r.StatusAt(now) == ReservationStatus.Booked)));
        });

        app.MapGet("/api/reservations", async (
            Guid? roomId, Guid? organizerId, string? status, DateTimeOffset? from, DateTimeOffset? to,
            ReservationsDbContext db, TimeProvider clock, CancellationToken cancellationToken) =>
        {
            if (from is not null && to is not null && from >= to)
                throw new BookingException("INVALID_DATE_FILTER", "The date range end must be after its start.");
            ReservationStatus? desiredStatus = null;
            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!Enum.TryParse<ReservationStatus>(status, true, out var parsed) || !Enum.IsDefined(parsed))
                    throw new BookingException("INVALID_STATUS", "Choose Booked, Completed or Cancelled.");
                desiredStatus = parsed;
            }
            var now = clock.GetUtcNow();
            var reservations = await db.Reservations.AsNoTracking().Include(r => r.Room).Include(r => r.Organizer)
                .OrderBy(r => r.StartUtc).ToListAsync(cancellationToken);
            return reservations.Where(r =>
                (roomId is null || r.RoomId == roomId) &&
                (organizerId is null || r.OrganizerId == organizerId) &&
                (desiredStatus is null || r.StatusAt(now) == desiredStatus) &&
                (from is null || r.EndUtc > from) &&
                (to is null || r.StartUtc < to)).Select(r => r.ToDto(now));
        });

        app.MapPost("/api/reservations", async (
            BookingRequest request, ReservationService service, CancellationToken cancellationToken) =>
        {
            var result = await service.SaveAsync(request, null, cancellationToken);
            return Results.Created($"/api/reservations/{result.Id}", result);
        });
        app.MapGet("/api/reservations/{id:guid}", async (
            Guid id, ReservationsDbContext db, TimeProvider clock, CancellationToken cancellationToken) =>
        {
            var reservation = await db.Reservations.AsNoTracking().Include(r => r.Room).Include(r => r.Organizer)
                .SingleOrDefaultAsync(r => r.Id == id, cancellationToken)
                ?? throw new BookingException("RESERVATION_NOT_FOUND", "This reservation could not be found.", 404);
            return Results.Ok(reservation.ToDto(clock.GetUtcNow()));
        });
        app.MapPut("/api/reservations/{id:guid}", async (
            Guid id, BookingRequest request, ReservationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.SaveAsync(request, id, cancellationToken)));
        app.MapPost("/api/reservations/{id:guid}/cancel", async (
            Guid id, ReservationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.TransitionAsync(id, "cancel", cancellationToken)));
        app.MapPost("/api/reservations/{id:guid}/check-in", async (
            Guid id, ReservationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.TransitionAsync(id, "check-in", cancellationToken)));
        app.MapPost("/api/reservations/{id:guid}/end", async (
            Guid id, ReservationService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.TransitionAsync(id, "end", cancellationToken)));
    }
}
