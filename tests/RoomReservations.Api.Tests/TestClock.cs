namespace RoomReservations.Api.Tests;

internal sealed class TestClock(DateTimeOffset value) : TimeProvider
{
    public DateTimeOffset UtcNow { get; set; } = value;
    public override DateTimeOffset GetUtcNow() => UtcNow;
}
