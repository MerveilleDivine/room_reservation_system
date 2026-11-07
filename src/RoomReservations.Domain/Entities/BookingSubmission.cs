namespace RoomReservations.Domain;

/// <summary>A receipt for a booking write, retained for this in-memory server's lifetime.</summary>
public sealed class BookingSubmission
{
    public Guid Id { get; set; }
    public required string Fingerprint { get; set; }
    public Guid ReservationId { get; set; }
}
