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
        var yesterday = tomorrow.AddDays(-2);
        db.Reservations.AddRange(
            new Reservation { Id = Guid.Parse("30000000-0000-0000-0000-000000000001"), RoomId = rooms[0].Id, OrganizerId = people[0].Id, Title = "Product planning", StartUtc = tomorrow, EndUtc = tomorrow.AddHours(1), Attendees = 8 },
            new Reservation { Id = Guid.Parse("30000000-0000-0000-0000-000000000002"), RoomId = rooms[1].Id, OrganizerId = people[1].Id, Title = "Design review", StartUtc = tomorrow.AddHours(2), EndUtc = tomorrow.AddHours(3), Attendees = 4 },
            new Reservation { Id = Guid.Parse("30000000-0000-0000-0000-000000000003"), RoomId = rooms[2].Id, OrganizerId = people[2].Id, Title = "Engineering sync", StartUtc = now.AddMinutes(-15), EndUtc = now.AddMinutes(45), Attendees = 3 },
            new Reservation { Id = Guid.Parse("30000000-0000-0000-0000-000000000004"), RoomId = rooms[0].Id, OrganizerId = people[0].Id, Title = "Roadmap review", StartUtc = yesterday, EndUtc = yesterday.AddHours(1), Attendees = 8, Status = ReservationStatus.Completed, CheckedInAtUtc = yesterday.AddMinutes(5), ActualEndUtc = yesterday.AddMinutes(40) },
            new Reservation { Id = Guid.Parse("30000000-0000-0000-0000-000000000005"), RoomId = rooms[1].Id, OrganizerId = people[1].Id, Title = "Team catch-up", StartUtc = yesterday.AddHours(2), EndUtc = yesterday.AddHours(3), Attendees = 4, Status = ReservationStatus.Completed },
            new Reservation { Id = Guid.Parse("30000000-0000-0000-0000-000000000006"), RoomId = rooms[2].Id, OrganizerId = people[2].Id, Title = "Planning workshop", StartUtc = yesterday.AddHours(5), EndUtc = yesterday.AddHours(6), Attendees = 3, Status = ReservationStatus.Completed, CheckedInAtUtc = yesterday.AddHours(5), ActualEndUtc = yesterday.AddHours(5).AddMinutes(30) },
            new Reservation { Id = Guid.Parse("30000000-0000-0000-0000-000000000007"), RoomId = rooms[0].Id, OrganizerId = people[0].Id, Title = "Weekly planning", StartUtc = yesterday.AddDays(-1), EndUtc = yesterday.AddDays(-1).AddHours(1), Attendees = 6, Status = ReservationStatus.Completed, CheckedInAtUtc = yesterday.AddDays(-1).AddMinutes(2) },
            new Reservation { Id = Guid.Parse("30000000-0000-0000-0000-000000000008"), RoomId = rooms[1].Id, OrganizerId = people[1].Id, Title = "Cancelled briefing", StartUtc = yesterday.AddDays(-1).AddHours(2), EndUtc = yesterday.AddDays(-1).AddHours(3), Attendees = 2, Status = ReservationStatus.Cancelled }
        );
        await db.SaveChangesAsync();
    }
}
