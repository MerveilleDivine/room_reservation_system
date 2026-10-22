using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Domain;

namespace RoomReservations.Api.Infrastructure;

public static class SeedData
{
    public static async Task InitializeAsync(ReservationsDbContext db, TimeProvider clock)
    {
        if (await db.Rooms.AnyAsync()) return;

        Room[] rooms = [
            new() { Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), Name = "Atlas", Capacity = 12, Floor = "1", Equipment = Equipment.Tv | Equipment.VideoConferencing | Equipment.Whiteboard },
            new() { Id = Guid.Parse("10000000-0000-0000-0000-000000000002"), Name = "Birch", Capacity = 6, Floor = "1", Equipment = Equipment.Projector | Equipment.Whiteboard },
            new() { Id = Guid.Parse("10000000-0000-0000-0000-000000000003"), Name = "Cedar", Capacity = 4, Floor = "2", Equipment = Equipment.Tv | Equipment.Whiteboard },
            new() { Id = Guid.Parse("10000000-0000-0000-0000-000000000004"), Name = "Studio", Capacity = 8, Floor = "2", Equipment = Equipment.Projector | Equipment.VideoConferencing, IsActive = false }
        ];
        Person[] people = [
            new() { Id = Guid.Parse("20000000-0000-0000-0000-000000000001"), FirstName = "Alex", LastName = "Morgan" },
            new() { Id = Guid.Parse("20000000-0000-0000-0000-000000000002"), FirstName = "Emilija", LastName = "Petrauskaite" },
            new() { Id = Guid.Parse("20000000-0000-0000-0000-000000000003"), FirstName = "Noah", LastName = "Larsen" }
        ];
        db.Rooms.AddRange(rooms);
        db.People.AddRange(people);

        var now = clock.GetUtcNow();
        var tomorrow = new DateTimeOffset(now.UtcDateTime.Date.AddDays(1).AddHours(9), TimeSpan.Zero);
        db.Reservations.AddRange(
            new Reservation { Id = Guid.NewGuid(), RoomId = rooms[0].Id, OrganizerId = people[0].Id, Title = "Product planning", StartUtc = tomorrow, EndUtc = tomorrow.AddHours(1), Attendees = 8 },
            new Reservation { Id = Guid.NewGuid(), RoomId = rooms[1].Id, OrganizerId = people[1].Id, Title = "Design review", StartUtc = tomorrow.AddHours(2), EndUtc = tomorrow.AddHours(3), Attendees = 4 },
            new Reservation { Id = Guid.NewGuid(), RoomId = rooms[2].Id, OrganizerId = people[2].Id, Title = "Engineering sync", StartUtc = now.AddMinutes(-15), EndUtc = now.AddMinutes(45), Attendees = 3 }
        );
        await db.SaveChangesAsync();
    }
}
