namespace RoomReservations.Domain;

public sealed class Reservation
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public Room Room { get; set; } = null!;
    public Guid OrganizerId { get; set; }
    public Person Organizer { get; set; } = null!;
    public required string Title { get; set; }
    public DateTimeOffset StartUtc { get; set; }
    public DateTimeOffset EndUtc { get; set; }
    public int Attendees { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Booked;
    public DateTimeOffset? CheckedInAtUtc { get; set; }
    public DateTimeOffset? ActualEndUtc { get; set; }
    public Guid? ContinuationOfId { get; set; }

    public DateTimeOffset EffectiveEndUtc => ActualEndUtc ?? EndUtc;

    public ReservationStatus StatusAt(DateTimeOffset now) =>
        Status == ReservationStatus.Booked && EffectiveEndUtc <= now
            ? ReservationStatus.Completed
            : Status;

    public void Transition(ReservationAction action, DateTimeOffset now)
    {
        if (StatusAt(now) != ReservationStatus.Booked)
            throw new BookingException(BookingErrorCodes.ReservationNotActive, "This reservation is no longer active.", BookingErrorKind.Conflict);

        switch (action)
        {
            case ReservationAction.Cancel:
                if (StartUtc <= now)
                    throw new BookingException(BookingErrorCodes.MeetingAlreadyStarted, "End a started meeting instead of cancelling it.", BookingErrorKind.Conflict);
                Status = ReservationStatus.Cancelled;
                break;
            case ReservationAction.CheckIn:
                if (StartUtc > now)
                    throw new BookingException(BookingErrorCodes.MeetingNotStarted, "Check in when the meeting starts.", BookingErrorKind.Conflict);
                if (CheckedInAtUtc is not null)
                    throw new BookingException(BookingErrorCodes.AlreadyCheckedIn, "This meeting is already checked in.", BookingErrorKind.Conflict);
                CheckedInAtUtc = now;
                break;
            case ReservationAction.End:
                if (StartUtc > now)
                    throw new BookingException(BookingErrorCodes.MeetingNotStarted, "A future meeting cannot be ended early.", BookingErrorKind.Conflict);
                ActualEndUtc = now;
                Status = ReservationStatus.Completed;
                break;
            default:
                throw new BookingException(BookingErrorCodes.InvalidAction, "Unknown reservation action.");
        }
    }
}
