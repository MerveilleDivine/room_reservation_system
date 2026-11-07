namespace RoomReservations.Domain;

/// <summary>All booking decisions live here, not in React. Intervals are [start, end).</summary>
public sealed class BookingRules(BookingLimits options)
{
    public TimeSpan MaximumDuration => TimeSpan.FromDays(options.MaximumDurationDays);

    public void Validate(
        BookingDetails request,
        Room room,
        IReadOnlyCollection<Reservation> reservations,
        DateTimeOffset now,
        Guid? excludedReservationId = null)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > BookingLimits.MaximumTitleLength)
            throw new BookingException(BookingErrorCodes.InvalidTitle, "Enter a meeting title between 1 and 120 characters.");

        ValidateTimeRange(request.StartUtc, request.EndUtc, now);

        if (request.Attendees < 1)
            throw new BookingException(BookingErrorCodes.InvalidAttendees, "At least one attendee is required.");

        if (request.Attendees > room.Capacity)
            throw new BookingException(BookingErrorCodes.CapacityExceeded, $"This room holds up to {room.Capacity} people.");

        if (!room.IsActive)
            throw new BookingException(BookingErrorCodes.RoomInactive, "This room is inactive and cannot be booked.");

        var overlapping = reservations.Where(existing =>
            existing.Id != excludedReservationId &&
            existing.Status != ReservationStatus.Cancelled &&
            request.StartUtc < existing.EffectiveEndUtc &&
            existing.StartUtc < request.EndUtc).ToArray();

        if (overlapping.Any(existing => existing.RoomId == request.RoomId))
            throw new BookingException(BookingErrorCodes.RoomOverlap, "This room is already booked during that time.", BookingErrorKind.Conflict);

        if (overlapping.Any(existing => existing.OrganizerId == request.OrganizerId))
            throw new BookingException(BookingErrorCodes.OrganizerOverlap, "The organizer already has a meeting during that time.", BookingErrorKind.Conflict);
    }

    public void ValidateTimeRange(DateTimeOffset startUtc, DateTimeOffset endUtc, DateTimeOffset now)
    {
        if (endUtc <= startUtc)
            throw new BookingException(BookingErrorCodes.InvalidTimeRange, "The end must be after the start.");
        if (startUtc <= now)
            throw new BookingException(BookingErrorCodes.StartNotFuture, "Choose a start time in the future.");
        if (endUtc - startUtc > MaximumDuration)
            throw new BookingException(BookingErrorCodes.DurationExceeded, $"A reservation cannot exceed {options.MaximumDurationDays} days.");
        if (startUtc > now.AddDays(options.MaximumAdvanceDays))
            throw new BookingException(BookingErrorCodes.AdvanceWindowExceeded, $"Book no more than {options.MaximumAdvanceDays} days in advance.");
    }
}
