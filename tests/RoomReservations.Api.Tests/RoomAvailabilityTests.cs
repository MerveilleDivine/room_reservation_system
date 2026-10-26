using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RoomReservations.Api.Application;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Tests;

public sealed class RoomAvailabilityTests
{
    private static readonly Guid Atlas = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Birch = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid Cedar = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid Studio = Guid.Parse("10000000-0000-0000-0000-000000000004");
    private static readonly Guid Alex = Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static DateTimeOffset Tomorrow => TestApplication.Now.AddDays(1).AddHours(1);

    private static string Query(DateTimeOffset start, DateTimeOffset end, Guid? organizerId = null) =>
        $"/api/room-availability?startUtc={Uri.EscapeDataString(start.ToString("O"))}&endUtc={Uri.EscapeDataString(end.ToString("O"))}" +
        (organizerId is null ? "" : $"&organizerId={organizerId}");

    [Fact]
    public async Task Search_returns_every_room_with_time_specific_availability_and_an_inactive_reason()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Remove("X-Roomwise-Profile");
        var rooms = (await client.GetFromJsonAsync<RoomAvailabilityDto[]>(Query(Tomorrow, Tomorrow.AddHours(1))))!;
        Assert.Equal(4, rooms.Length);
        Assert.False(rooms.Single(room => room.RoomId == Atlas).IsAvailable);
        Assert.Contains("already booked", rooms.Single(room => room.RoomId == Atlas).Reason!);
        Assert.True(rooms.Single(room => room.RoomId == Birch).IsAvailable);
        Assert.Null(rooms.Single(room => room.RoomId == Birch).Reason);
        Assert.False(rooms.Single(room => room.RoomId == Studio).IsAvailable);
        Assert.Contains("inactive", rooms.Single(room => room.RoomId == Studio).Reason!);
    }

    [Fact]
    public async Task Optional_organizer_conflicts_make_otherwise_free_rooms_unavailable()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var rooms = (await client.GetFromJsonAsync<RoomAvailabilityDto[]>(Query(Tomorrow, Tomorrow.AddHours(1), Alex)))!;
        var birch = rooms.Single(room => room.RoomId == Birch);
        Assert.False(birch.IsAvailable);
        Assert.Contains("organizer already has a meeting", birch.Reason!);
        Assert.All(rooms, room => Assert.False(room.IsAvailable));
    }

    [Fact]
    public async Task Adjacent_bookings_and_later_future_bookings_do_not_block_the_requested_slot()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var rooms = (await client.GetFromJsonAsync<RoomAvailabilityDto[]>(Query(Tomorrow.AddHours(1), Tomorrow.AddHours(2))))!;
        Assert.True(rooms.Single(room => room.RoomId == Atlas).IsAvailable);
        rooms = (await client.GetFromJsonAsync<RoomAvailabilityDto[]>(Query(TestApplication.Now.AddHours(2), TestApplication.Now.AddHours(3))))!;
        Assert.All(rooms.Where(room => room.RoomId != Studio), room => Assert.True(room.IsAvailable));
    }

    [Fact]
    public async Task Cancelled_booking_releases_the_slot_for_search()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ReservationsDbContext>();
            var meeting = await db.Reservations.SingleAsync(reservation => reservation.Title == "Product planning");
            meeting.Status = ReservationStatus.Cancelled;
            await db.SaveChangesAsync();
        }
        var rooms = (await client.GetFromJsonAsync<RoomAvailabilityDto[]>(Query(Tomorrow, Tomorrow.AddHours(1), Alex)))!;
        Assert.True(rooms.Single(room => room.RoomId == Atlas).IsAvailable);
    }

    [Fact]
    public async Task Early_completion_releases_the_unneeded_remainder()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var start = TestApplication.Now.AddMinutes(5);
        var end = TestApplication.Now.AddMinutes(30);
        var before = (await client.GetFromJsonAsync<RoomAvailabilityDto[]>(Query(start, end)))!;
        Assert.False(before.Single(room => room.RoomId == Cedar).IsAvailable);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ReservationsDbContext>();
            var meeting = await db.Reservations.SingleAsync(reservation => reservation.Title == "Engineering sync");
            meeting.Status = ReservationStatus.Completed;
            meeting.ActualEndUtc = TestApplication.Now;
            await db.SaveChangesAsync();
        }
        var after = (await client.GetFromJsonAsync<RoomAvailabilityDto[]>(Query(start, end)))!;
        Assert.True(after.Single(room => room.RoomId == Cedar).IsAvailable);
    }

    [Theory]
    [InlineData(0, 60, "START_NOT_FUTURE")]
    [InlineData(-1, 60, "START_NOT_FUTURE")]
    [InlineData(60, 60, "INVALID_TIME_RANGE")]
    [InlineData(60, 59, "INVALID_TIME_RANGE")]
    [InlineData(60, 10141, "DURATION_EXCEEDED")]
    [InlineData(129601, 129661, "ADVANCE_WINDOW_EXCEEDED")]
    public async Task Invalid_common_dates_return_a_request_error_instead_of_unavailable_rooms(int startMinutes, int endMinutes, string code)
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var response = await client.GetAsync(Query(TestApplication.Now.AddMinutes(startMinutes), TestApplication.Now.AddMinutes(endMinutes)));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(code, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Configured_duration_and_exact_boundaries_match_booking_validation()
    {
        await using var factory = new TestApplication(1);
        using var client = factory.CreateClient();
        var start = TestApplication.Now.AddDays(90);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(Query(start, start.AddDays(1)))).StatusCode);
        var invalid = await client.GetAsync(Query(start, start.AddDays(1).AddTicks(1)));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Contains("DURATION_EXCEEDED", await invalid.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Unknown_organizer_is_rejected_and_both_dates_are_required()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var unknown = await client.GetAsync(Query(Tomorrow, Tomorrow.AddHours(1), Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Contains("ORGANIZER_NOT_FOUND", await unknown.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/room-availability")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/room-availability?startUtc={Uri.EscapeDataString(Tomorrow.ToString("O"))}")).StatusCode);
    }
}
