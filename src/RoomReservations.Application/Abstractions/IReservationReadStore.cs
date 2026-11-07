using RoomReservations.Domain;

namespace RoomReservations.Application.Abstractions;

/// <summary>Materialized read snapshots; callers never depend on a database query provider.</summary>
public interface IReservationReadStore
{
    Task<Room[]> ReadRoomsAsync(CancellationToken cancellationToken);
    Task<Person[]> ReadPeopleAsync(CancellationToken cancellationToken);
    Task<Reservation[]> ReadReservationsAsync(CancellationToken cancellationToken);
}
