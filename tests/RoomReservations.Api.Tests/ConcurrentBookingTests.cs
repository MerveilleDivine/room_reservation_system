using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RoomReservations.Application;
using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;
using RoomReservations.Infrastructure;

namespace RoomReservations.Api.Tests;

public sealed class ConcurrentBookingTests
{
    [Theory]
    [InlineData(false, "ROOM_OVERLAP")]
    [InlineData(true, "ORGANIZER_OVERLAP")]
    public async Task Simultaneous_conflicting_bookings_have_exactly_one_winner(bool sameOrganizer, string expectedConflict)
    {
        // Arrange: two scoped contexts share the same database and process-wide gate.
        var options = new DbContextOptionsBuilder<ReservationsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), new InMemoryDatabaseRoot()).Options;
        await using var firstDb = new ReservationsDbContext(options);
        await using var secondDb = new ReservationsDbContext(options);
        var room = new Room { Id = Guid.NewGuid(), Name = "Atlas", Capacity = 8, Floor = "1" };
        var secondRoom = new Room { Id = Guid.NewGuid(), Name = "Birch", Capacity = 8, Floor = "1" };
        var firstPerson = new Person { Id = Guid.NewGuid(), FirstName = "Alex", LastName = "Morgan" };
        var secondPerson = new Person { Id = Guid.NewGuid(), FirstName = "Noah", LastName = "Larsen" };
        firstDb.AddRange(room, secondRoom, firstPerson, secondPerson);
        await firstDb.SaveChangesAsync();

        using var gate = new BookingWriteGate();
        var now = new DateTimeOffset(2026, 10, 22, 8, 0, 0, TimeSpan.Zero);
        var clock = new TestClock(now);
        var rules = new BookingRules(new BookingLimits());
        var firstStore = new EfBookingStore(firstDb);
        var secondStore = new EfBookingStore(secondDb);
        var secondOrganizerId = sameOrganizer ? firstPerson.Id : secondPerson.Id;
        var firstService = new ReservationService(firstStore, rules, clock, gate,
            new BookingProfile(new SelectedMember(firstPerson.Id), firstStore));
        var secondService = new ReservationService(secondStore, rules, clock, gate,
            new BookingProfile(new SelectedMember(secondOrganizerId), secondStore));
        var request = new BookingRequest(room.Id, firstPerson.Id, "Concurrent booking", now.AddDays(1), now.AddDays(1).AddHours(1), 2);
        var secondRequest = request with { RoomId = sameOrganizer ? secondRoom.Id : room.Id, OrganizerId = secondOrganizerId };

        // Act
        var results = await Task.WhenAll(
            Task.Run(() => AttemptAsync(firstService, request)),
            Task.Run(() => AttemptAsync(secondService, secondRequest)));

        // Assert
        var savedCount = await firstDb.Reservations.CountAsync();
        Assert.Multiple(
            () => Assert.Single(results, result => result == "CREATED"),
            () => Assert.Single(results, result => result == expectedConflict),
            () => Assert.Equal(1, savedCount));
    }

    private static async Task<string> AttemptAsync(ReservationService service, BookingRequest request)
    {
        try
        {
            await service.SaveAsync(request, null, CancellationToken.None);
            return "CREATED";
        }
        catch (BookingException exception) { return exception.Code; }
    }

    private sealed class SelectedMember(Guid personId) : ICurrentDemoProfile
    {
        public DemoProfileSelection Selection => new(DemoProfileKind.Member, personId);
    }
}
