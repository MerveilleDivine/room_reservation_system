using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Application;

public sealed class ReservationFeedService(IReservationReadStore store, TimeProvider clock, IBookingGate gate, BookingProfile profile)
{
    public async Task<ReservationFeedDto> ReadAsync(ReservationFeedQuery query, CancellationToken cancellationToken)
    {
        var view = string.IsNullOrWhiteSpace(query.View) ? "upcoming" : query.View.ToLowerInvariant();
        if (view is not ("upcoming" or "history"))
            throw new BookingException(BookingErrorCodes.InvalidReservationView, "Choose Upcoming or History.");
        if (query.Page < 1 || query.PageSize is < 1 or > ReservationFeedQuery.MaximumPageSize)
            throw new BookingException(BookingErrorCodes.InvalidPagination, "Choose a valid page and between 1 and 50 reservations per page.");
        ReservationFilters.ValidateRange(query.From, query.To);
        var desiredStatus = ReservationFilters.ParseStatus(query.Status);

        var organizerId = await profile.ScopeOrganizerAsync(query.OrganizerId, cancellationToken);
        using var lease = await gate.EnterAsync(cancellationToken);
        var now = clock.GetUtcNow();
        var snapshot = await store.ReadReservationsAsync(cancellationToken);
        var filtered = snapshot.Where(reservation =>
            (view == "upcoming"
                ? reservation.StatusAt(now) == ReservationStatus.Booked
                : reservation.StatusAt(now) != ReservationStatus.Booked) &&
            (query.RoomId is null || reservation.RoomId == query.RoomId) &&
            (organizerId is null || reservation.OrganizerId == organizerId) &&
            (desiredStatus is null || reservation.StatusAt(now) == desiredStatus) &&
            (query.From is null || reservation.EndUtc > query.From) &&
            (query.To is null || reservation.StartUtc < query.To)).ToArray();
        var ordered = view == "upcoming"
            ? filtered.OrderBy(reservation => reservation.StartUtc).ThenBy(reservation => reservation.Id)
            : filtered.OrderByDescending(reservation => reservation.StartUtc).ThenBy(reservation => reservation.Id);
        var rows = ordered.ToArray();
        var focusedIndex = query.FocusId is null ? -1 : Array.FindIndex(rows, r => r.Id == query.FocusId);
        var page = focusedIndex < 0 ? query.Page : focusedIndex / query.PageSize + 1;
        var offset = (long)(page - 1) * query.PageSize;
        ReservationDto[] items = offset >= filtered.Length
            ? []
            : rows.Skip((int)offset).Take(query.PageSize).Select(reservation => reservation.ToDto(now)).ToArray();
        return new ReservationFeedDto(items, filtered.Length, page, query.PageSize);
    }
}
