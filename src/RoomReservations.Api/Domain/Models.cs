namespace RoomReservations.Api.Domain;

[Flags]
public enum Equipment
{
    None = 0,
    Projector = 1,
    Tv = 2,
    VideoConferencing = 4,
    Whiteboard = 8
}

public enum ReservationStatus { Booked, Completed, Cancelled }

public sealed class Room
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public int Capacity { get; set; }
    public required string Floor { get; set; }
    public Equipment Equipment { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Person
{
    public Guid Id { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
}

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
}

/// <summary>A receipt for a booking write, retained for this in-memory server's lifetime.</summary>
public sealed class BookingSubmission
{
    public Guid Id { get; set; }
    public required string Fingerprint { get; set; }
    public Guid ReservationId { get; set; }
}
