namespace RoomReservations.Domain;

public static class ExtraTimePolicy
{
    public static ExtraTimeAvailability Calculate(Reservation original, IEnumerable<Reservation> reservations,
        DateTimeOffset now, TimeSpan durationLimit)
    {
        if (original.StatusAt(now) != ReservationStatus.Booked || original.StartUtc > now)
            return new(0, original.EndUtc, null, null, BookingErrorCodes.MeetingNotOngoing, "Reserve extra time while the meeting is in progress.");
        var bookings = reservations.Where(r => r.Id != original.Id && r.Status != ReservationStatus.Cancelled).ToArray();
        if (bookings.Any(r => r.ContinuationOfId == original.Id))
            return new(0, original.EndUtc, null, null, BookingErrorCodes.ContinuationAlreadyBooked, "Extra time is already reserved. Edit or cancel the additional booking.");
        var next = bookings.Where(r => r.EffectiveEndUtc > original.EndUtc &&
                (r.RoomId == original.RoomId || r.OrganizerId == original.OrganizerId))
            .OrderBy(r => r.StartUtc).FirstOrDefault();
        var minutes = (int)durationLimit.TotalMinutes;
        if (next is not null) minutes = Math.Min(minutes, Math.Max(0, (int)Math.Floor((next.StartUtc - original.EndUtc).TotalMinutes)));
        var code = next is null ? null : next.RoomId == original.RoomId ? BookingErrorCodes.RoomOverlap : BookingErrorCodes.OrganizerOverlap;
        var message = next is null ? null : next.RoomId == original.RoomId
            ? minutes == 0 ? "The room is booked immediately after this meeting." : $"Only {minutes} more minutes are available before the next room booking."
            : minutes == 0 ? "You have another meeting immediately after this one." : $"Only {minutes} more minutes are available before your next meeting.";
        return new(minutes, original.EndUtc, next?.StartUtc, next?.EffectiveEndUtc, code, message);
    }
}
