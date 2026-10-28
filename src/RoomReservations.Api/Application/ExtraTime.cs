using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Application;

public sealed record ExtraTimeDto(int MaximumMinutes, DateTimeOffset StartsAtUtc,
    DateTimeOffset? BlockedFromUtc, DateTimeOffset? BlockedUntilUtc, string? ReasonCode, string? Message);

public static class ExtraTimePolicy
{
    public static ExtraTimeDto Calculate(Reservation original, IEnumerable<Reservation> reservations,
        DateTimeOffset now, TimeSpan durationLimit)
    {
        if (original.StatusAt(now) != ReservationStatus.Booked || original.StartUtc > now)
            return new(0, original.EndUtc, null, null, "MEETING_NOT_ONGOING", "Reserve extra time while the meeting is in progress.");
        var bookings = reservations.Where(r => r.Id != original.Id && r.Status != ReservationStatus.Cancelled).ToArray();
        if (bookings.Any(r => r.ContinuationOfId == original.Id))
            return new(0, original.EndUtc, null, null, "CONTINUATION_ALREADY_BOOKED", "Extra time is already reserved. Edit or cancel the additional booking.");
        var next = bookings.Where(r => r.EffectiveEndUtc > original.EndUtc &&
                (r.RoomId == original.RoomId || r.OrganizerId == original.OrganizerId))
            .OrderBy(r => r.StartUtc).FirstOrDefault();
        var minutes = (int)durationLimit.TotalMinutes;
        if (next is not null) minutes = Math.Min(minutes, Math.Max(0, (int)Math.Floor((next.StartUtc - original.EndUtc).TotalMinutes)));
        var code = next is null ? null : next.RoomId == original.RoomId ? "ROOM_OVERLAP" : "ORGANIZER_OVERLAP";
        var message = next is null ? null : next.RoomId == original.RoomId
            ? minutes == 0 ? "The room is booked immediately after this meeting." : $"Only {minutes} more minutes are available before the next room booking."
            : minutes == 0 ? "You have another meeting immediately after this one." : $"Only {minutes} more minutes are available before your next meeting.";
        return new(minutes, original.EndUtc, next?.StartUtc, next?.EffectiveEndUtc, code, message);
    }
}

public sealed class ExtraTimeService(ReservationsDbContext db, BookingRules rules, TimeProvider clock,
    BookingWriteGate gate, BookingProfile profile)
{
    public async Task<ExtraTimeDto> ReadAsync(Guid id, CancellationToken cancellationToken)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        var original = await db.Reservations.AsNoTracking().SingleOrDefaultAsync(r => r.Id == id, cancellationToken)
            ?? throw new BookingException("RESERVATION_NOT_FOUND", "This reservation could not be found.", 404);
        await profile.RequireAccessAsync(db, original.OrganizerId, cancellationToken);
        var bookings = await db.Reservations.AsNoTracking().ToListAsync(cancellationToken);
        return ExtraTimePolicy.Calculate(original, bookings, clock.GetUtcNow(), rules.MaximumDuration);
    }
}
