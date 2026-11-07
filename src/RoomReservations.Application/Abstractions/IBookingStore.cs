using RoomReservations.Domain;

namespace RoomReservations.Application.Abstractions;

/// <summary>Operations used by booking commands within the shared booking gate.</summary>
public interface IBookingStore : IReservationReadStore
{
    Task<Room?> FindRoomAsync(Guid id, CancellationToken cancellationToken);
    Task<Person?> FindPersonAsync(Guid id, CancellationToken cancellationToken);
    Task<Reservation?> FindReservationAsync(Guid id, CancellationToken cancellationToken);
    Task<BookingSubmission?> FindSubmissionAsync(Guid id, CancellationToken cancellationToken);
    void AddReservation(Reservation reservation);
    void AddSubmission(BookingSubmission submission);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
