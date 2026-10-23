using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Application;

public sealed record RoomUsageDto(
    Guid RoomId, string RoomName, string Floor, bool IsActive, int ReservationCount,
    double ScheduledMinutes, double ElapsedReservedMinutes, double ObservedMinutes,
    double UnconfirmedMinutes, double ReleasedMinutes, int UnconfirmedCompletedCount,
    double? ConfirmedSharePercent);

public sealed record UsageReportDto(
    DateTimeOffset FromUtc, DateTimeOffset ToUtc, DateTimeOffset AsOfUtc,
    string MeasurementSource, string ObservationNote, RoomUsageDto[] Rooms);

/// <summary>Calculates room minutes as interval unions, never by counting bookings as occupancy.</summary>
public static class UsageReportBuilder
{
    public const int MaximumRangeDays = 366;

    public static UsageReportDto Build(
        IReadOnlyCollection<Room> rooms, IReadOnlyCollection<Reservation> reservations,
        DateTimeOffset from, DateTimeOffset to, DateTimeOffset now)
    {
        if (from >= to)
            throw new BookingException("INVALID_REPORT_RANGE", "Choose a report end after its start.");
        if (to - from > TimeSpan.FromDays(MaximumRangeDays))
            throw new BookingException("REPORT_RANGE_EXCEEDED", $"Choose a report range of {MaximumRangeDays} days or less.");

        var byRoom = reservations.Where(r => r.Status != ReservationStatus.Cancelled).ToLookup(r => r.RoomId);
        var rows = rooms.OrderBy(r => r.Name).Select(room =>
        {
            var bookings = byRoom[room.Id].Where(r => r.StartUtc < to && r.EndUtc > from).ToArray();
            var scheduled = Minutes(bookings.Select(r => (r.StartUtc, r.EndUtc)), from, to);
            var reserved = Minutes(bookings.Select(r => (r.StartUtc, r.EffectiveEndUtc)), from, to);
            var elapsedEnd = Earlier(to, now);
            var elapsed = Minutes(bookings.Select(r => (r.StartUtc, r.EffectiveEndUtc)), from, elapsedEnd);
            var observed = Minutes(bookings.Where(r => r.CheckedInAtUtc is not null)
                .Select(r => (Later(r.StartUtc, r.CheckedInAtUtc!.Value), r.EffectiveEndUtc)), from, elapsedEnd);
            var unconfirmed = bookings.Count(r => r.StatusAt(now) == ReservationStatus.Completed &&
                r.CheckedInAtUtc is null && r.EffectiveEndUtc > from && r.StartUtc < to);

            return new RoomUsageDto(room.Id, room.Name, room.Floor, room.IsActive, bookings.Length,
                Round(scheduled), Round(elapsed), Round(observed), Round(Math.Max(0, elapsed - observed)),
                Round(Math.Max(0, scheduled - reserved)), unconfirmed,
                elapsed > 0 ? Math.Round(observed / elapsed * 100, 1, MidpointRounding.AwayFromZero) : null);
        }).ToArray();

        return new UsageReportDto(from.ToUniversalTime(), to.ToUniversalTime(), now.ToUniversalTime(),
            "Manual check-in",
            "Reported use is an estimate from manual check-in until early completion, the scheduled end or this snapshot. It does not establish continuous presence, actual departure or an overrun. A missing check-in is not evidence of a no-show.", rows);
    }

    private static double Minutes(IEnumerable<(DateTimeOffset Start, DateTimeOffset End)> intervals,
        DateTimeOffset from, DateTimeOffset to)
    {
        if (from >= to) return 0;
        var ordered = intervals.Select(i => (Start: Later(i.Start, from), End: Earlier(i.End, to)))
            .Where(i => i.Start < i.End).OrderBy(i => i.Start).ThenBy(i => i.End);
        DateTimeOffset? start = null;
        DateTimeOffset end = default;
        double total = 0;
        foreach (var interval in ordered)
        {
            if (start is null) { start = interval.Start; end = interval.End; }
            else if (interval.Start <= end) end = Later(end, interval.End);
            else { total += (end - start.Value).TotalMinutes; start = interval.Start; end = interval.End; }
        }
        return start is null ? 0 : total + (end - start.Value).TotalMinutes;
    }

    private static DateTimeOffset Earlier(DateTimeOffset first, DateTimeOffset second) => first < second ? first : second;
    private static DateTimeOffset Later(DateTimeOffset first, DateTimeOffset second) => first > second ? first : second;
    private static double Round(double value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

public sealed class UsageReportService(ReservationsDbContext db, TimeProvider clock, BookingWriteGate gate)
{
    public async Task<UsageReportDto> ReadAsync(
        DateTimeOffset? from, DateTimeOffset? to, Guid? roomId, CancellationToken cancellationToken)
    {
        if ((from is null) != (to is null))
            throw new BookingException("INVALID_REPORT_RANGE", "Provide both the report start and end, or leave both empty.");

        // Materialize a consistent snapshot while booking mutations are excluded.
        await gate.Semaphore.WaitAsync(cancellationToken);
        try
        {
            var now = clock.GetUtcNow();
            var rooms = await db.Rooms.AsNoTracking().ToListAsync(cancellationToken);
            if (roomId is not null)
            {
                rooms = rooms.Where(r => r.Id == roomId).ToList();
                if (rooms.Count == 0) throw new BookingException("ROOM_NOT_FOUND", "This room could not be found.", 404);
            }
            var reservations = await db.Reservations.AsNoTracking().ToListAsync(cancellationToken);
            return UsageReportBuilder.Build(rooms, reservations, from ?? now.AddDays(-7), to ?? now, now);
        }
        finally { gate.Semaphore.Release(); }
    }
}
