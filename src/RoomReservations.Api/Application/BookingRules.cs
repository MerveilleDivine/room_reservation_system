using Microsoft.Extensions.Options;
using RoomReservations.Api.Domain;

namespace RoomReservations.Api.Application;

/// <summary>All booking decisions live here, not in React. Intervals are [start, end).</summary>
public sealed class BookingRules(IOptions<BookingOptions> options)
{
    public void Validate(
        BookingRequest request,
        Room room,
        IReadOnlyCollection<Reservation> reservations,
        DateTimeOffset now,
        Guid? excludedReservationId = null)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 120)
            throw new BookingException("INVALID_TITLE", "Enter a meeting title between 1 and 120 characters.");

        if (request.EndUtc <= request.StartUtc)
            throw new BookingException("INVALID_TIME_RANGE", "The end must be after the start.");

        if (request.StartUtc <= now)
            throw new BookingException("START_NOT_FUTURE", "Choose a start time in the future.");

        if (request.EndUtc - request.StartUtc > TimeSpan.FromDays(options.Value.MaximumDurationDays))
            throw new BookingException("DURATION_EXCEEDED", $"A reservation cannot exceed {options.Value.MaximumDurationDays} days.");

        if (request.StartUtc > now.AddDays(options.Value.MaximumAdvanceDays))
            throw new BookingException("ADVANCE_WINDOW_EXCEEDED", $"Book no more than {options.Value.MaximumAdvanceDays} days in advance.");

        if (request.Attendees < 1)
            throw new BookingException("INVALID_ATTENDEES", "At least one attendee is required.");

        if (request.Attendees > room.Capacity)
            throw new BookingException("CAPACITY_EXCEEDED", $"This room holds up to {room.Capacity} people.");

        if (!room.IsActive)
            throw new BookingException("ROOM_INACTIVE", "This room is inactive and cannot be booked.");

        var overlapping = reservations.Where(existing =>
            existing.Id != excludedReservationId &&
            existing.Status != ReservationStatus.Cancelled &&
            request.StartUtc < existing.EffectiveEndUtc &&
            existing.StartUtc < request.EndUtc).ToArray();

        if (overlapping.Any(existing => existing.RoomId == request.RoomId))
            throw new BookingException("ROOM_OVERLAP", "This room is already booked during that time.", 409);

        if (overlapping.Any(existing => existing.OrganizerId == request.OrganizerId))
            throw new BookingException("ORGANIZER_OVERLAP", "The organizer already has a meeting during that time.", 409);
    }
}
