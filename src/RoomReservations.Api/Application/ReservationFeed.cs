using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Application;

public sealed record ReservationFeedQuery(
    string? View = null, Guid? RoomId = null, Guid? OrganizerId = null, string? Status = null,
    DateTimeOffset? From = null, DateTimeOffset? To = null, int Page = 1, int PageSize = 6);

public sealed record ReservationFeedDto(ReservationDto[] Items, int TotalCount, int Page, int PageSize);

public sealed class ReservationFeedService(ReservationsDbContext db, TimeProvider clock, BookingWriteGate gate)
{
    public async Task<ReservationFeedDto> ReadAsync(ReservationFeedQuery query, CancellationToken cancellationToken)
    {
        var view = string.IsNullOrWhiteSpace(query.View) ? "upcoming" : query.View.ToLowerInvariant();
        if (view is not ("upcoming" or "history"))
            throw new BookingException("INVALID_RESERVATION_VIEW", "Choose Upcoming or History.");
        if (query.Page < 1 || query.PageSize is < 1 or > 50)
            throw new BookingException("INVALID_PAGINATION", "Choose a valid page and between 1 and 50 reservations per page.");
        if (query.From is not null && query.To is not null && query.From >= query.To)
            throw new BookingException("INVALID_DATE_FILTER", "The date range end must be after its start.");
        ReservationStatus? desiredStatus = null;
        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            if (!Enum.TryParse<ReservationStatus>(query.Status, true, out var status) || !Enum.IsDefined(status))
                throw new BookingException("INVALID_STATUS", "Choose Booked, Completed or Cancelled.");
            desiredStatus = status;
        }

        await gate.Semaphore.WaitAsync(cancellationToken);
        try
        {
            var now = clock.GetUtcNow();
            var snapshot = await db.Reservations.AsNoTracking().Include(reservation => reservation.Room)
                .Include(reservation => reservation.Organizer).ToListAsync(cancellationToken);
            var filtered = snapshot.Where(reservation =>
                (view == "upcoming"
                    ? reservation.StatusAt(now) == ReservationStatus.Booked
                    : reservation.StatusAt(now) != ReservationStatus.Booked) &&
                (query.RoomId is null || reservation.RoomId == query.RoomId) &&
                (query.OrganizerId is null || reservation.OrganizerId == query.OrganizerId) &&
                (desiredStatus is null || reservation.StatusAt(now) == desiredStatus) &&
                (query.From is null || reservation.EndUtc > query.From) &&
                (query.To is null || reservation.StartUtc < query.To)).ToArray();
            var ordered = view == "upcoming"
                ? filtered.OrderBy(reservation => reservation.StartUtc).ThenBy(reservation => reservation.Id)
                : filtered.OrderByDescending(reservation => reservation.StartUtc).ThenBy(reservation => reservation.Id);
            var offset = (long)(query.Page - 1) * query.PageSize;
            ReservationDto[] items = offset >= filtered.Length
                ? []
                : ordered.Skip((int)offset).Take(query.PageSize).Select(reservation => reservation.ToDto(now)).ToArray();
            return new ReservationFeedDto(items, filtered.Length, query.Page, query.PageSize);
        }
        finally { gate.Semaphore.Release(); }
    }
}
