namespace RoomReservations.Application.Abstractions;

/// <summary>Supplies the selected synthetic identity, without coupling use cases to HTTP.</summary>
public interface ICurrentDemoProfile
{
    DemoProfileSelection Selection { get; }
}
