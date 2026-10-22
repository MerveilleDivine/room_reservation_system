using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;
using RoomReservations.Api.Application;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Tests;

public sealed class ConcurrentBookingTests
{
    [Fact]
    public async Task Two_simultaneous_requests_cannot_double_book_a_room()
    {
        var options = new DbContextOptionsBuilder<ReservationsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), new InMemoryDatabaseRoot()).Options;
        await using var firstDb = new ReservationsDbContext(options);
        await using var secondDb = new ReservationsDbContext(options);
        var room = new Room { Id = Guid.NewGuid(), Name = "Atlas", Capacity = 8, Floor = "1" };
        var firstPerson = new Person { Id = Guid.NewGuid(), FirstName = "Alex", LastName = "Morgan" };
        var secondPerson = new Person { Id = Guid.NewGuid(), FirstName = "Noah", LastName = "Larsen" };
        firstDb.AddRange(room, firstPerson, secondPerson);
        await firstDb.SaveChangesAsync();

        using var gate = new BookingWriteGate();
        var now = new DateTimeOffset(2026, 10, 22, 8, 0, 0, TimeSpan.Zero);
        var clock = new FixedClock(now);
        var rules = new BookingRules(Options.Create(new BookingOptions()));
        var firstService = new ReservationService(firstDb, rules, clock, gate);
        var secondService = new ReservationService(secondDb, rules, clock, gate);
        var request = new BookingRequest(room.Id, firstPerson.Id, "Concurrent booking", now.AddDays(1), now.AddDays(1).AddHours(1), 2);

        var results = await Task.WhenAll(
            Task.Run(() => Attempt(firstService, request)),
            Task.Run(() => Attempt(secondService, request with { OrganizerId = secondPerson.Id })));

        Assert.Single(results, result => result == "CREATED");
        Assert.Single(results, result => result == "ROOM_OVERLAP");
        Assert.Equal(1, await firstDb.Reservations.CountAsync());
    }

    private static async Task<string> Attempt(ReservationService service, BookingRequest request)
    {
        try
        {
            await service.SaveAsync(request, null, CancellationToken.None);
            return "CREATED";
        }
        catch (BookingException exception) { return exception.Code; }
    }

    private sealed class FixedClock(DateTimeOffset value) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => value;
    }
}
