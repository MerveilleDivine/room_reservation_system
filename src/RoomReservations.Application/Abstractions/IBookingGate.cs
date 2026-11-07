namespace RoomReservations.Application.Abstractions;

/// <summary>Serializes a complete booking operation and receipt recovery in one API process.</summary>
public interface IBookingGate
{
    Task<IDisposable> EnterAsync(CancellationToken cancellationToken);
}
