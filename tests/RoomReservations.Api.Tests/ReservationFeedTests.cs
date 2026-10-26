using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using RoomReservations.Api.Application;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Tests;

public sealed class ReservationFeedTests
{
    private static readonly Guid Atlas = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Alex = Guid.Parse("20000000-0000-0000-0000-000000000001");

    [Fact]
    public async Task Default_view_contains_only_active_bookings_with_the_ongoing_meeting_first()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var feed = (await client.GetFromJsonAsync<ReservationFeedDto>("/api/reservation-feed"))!;
        Assert.Equal(1, feed.Page);
        Assert.Equal(6, feed.PageSize);
        Assert.Equal(3, feed.TotalCount);
        Assert.Equal(new[] { "Engineering sync", "Product planning", "Design review" }, feed.Items.Select(item => item.Title));
        Assert.All(feed.Items, item => Assert.Equal("Booked", item.Status));
    }

    [Fact]
    public async Task Organizer_scope_and_room_filter_are_applied_before_counting()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var feed = (await client.GetFromJsonAsync<ReservationFeedDto>($"/api/reservation-feed?organizerId={Alex}&roomId={Atlas}"))!;
        Assert.Equal(1, feed.TotalCount);
        var item = Assert.Single(feed.Items);
        Assert.Equal("Product planning", item.Title);
        Assert.Equal(Alex, item.OrganizerId);
        Assert.Equal(Atlas, item.RoomId);
    }

    [Fact]
    public async Task History_includes_elapsed_bookings_and_cancelled_future_bookings_newest_first()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        await AddAsync(factory, 1, TestApplication.Now.AddDays(3), ReservationStatus.Cancelled);
        var feed = (await client.GetFromJsonAsync<ReservationFeedDto>("/api/reservation-feed?view=history"))!;
        Assert.Equal(6, feed.TotalCount);
        Assert.Equal("Feed 1", feed.Items[0].Title);
        Assert.Equal("Cancelled", feed.Items[0].Status);
        Assert.All(feed.Items, item => Assert.NotEqual("Booked", item.Status));
        Assert.Equal(feed.Items.OrderByDescending(item => item.StartUtc).Select(item => item.Id), feed.Items.Select(item => item.Id));
    }

    [Fact]
    public async Task Status_filter_intersects_the_selected_view()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var history = (await client.GetFromJsonAsync<ReservationFeedDto>("/api/reservation-feed?view=history&status=Completed"))!;
        Assert.Equal(4, history.TotalCount);
        Assert.All(history.Items, item => Assert.Equal("Completed", item.Status));
        var upcoming = (await client.GetFromJsonAsync<ReservationFeedDto>("/api/reservation-feed?view=upcoming&status=Completed"))!;
        Assert.Equal(0, upcoming.TotalCount);
        Assert.Empty(upcoming.Items);
    }

    [Fact]
    public async Task Date_filters_use_half_open_scheduled_intervals()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var start = TestApplication.Now.AddDays(3);
        await AddAsync(factory, 1, start, ReservationStatus.Booked);
        var from = Uri.EscapeDataString(start.AddHours(1).ToString("O"));
        var feed = (await client.GetFromJsonAsync<ReservationFeedDto>($"/api/reservation-feed?from={from}"))!;
        Assert.Empty(feed.Items);
        var to = Uri.EscapeDataString(start.ToString("O"));
        feed = (await client.GetFromJsonAsync<ReservationFeedDto>($"/api/reservation-feed?from={Uri.EscapeDataString(start.AddDays(-1).ToString("O"))}&to={to}"))!;
        Assert.Empty(feed.Items);
    }

    [Fact]
    public async Task Pagination_is_stable_for_equal_start_times_and_count_is_not_page_limited()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var start = TestApplication.Now.AddDays(3);
        foreach (var id in new[] { 3, 1, 2 }) await AddAsync(factory, id, start, ReservationStatus.Booked);
        var range = $"from={Uri.EscapeDataString(start.AddDays(-1).ToString("O"))}";
        var first = (await client.GetFromJsonAsync<ReservationFeedDto>($"/api/reservation-feed?{range}&pageSize=2"))!;
        var second = (await client.GetFromJsonAsync<ReservationFeedDto>($"/api/reservation-feed?{range}&pageSize=2&page=2"))!;
        Assert.Equal(3, first.TotalCount);
        Assert.Equal(3, second.TotalCount);
        Assert.Equal(new[] { "Feed 1", "Feed 2" }, first.Items.Select(item => item.Title));
        Assert.Equal("Feed 3", Assert.Single(second.Items).Title);
        Assert.Equal(2, second.Page);
        Assert.Equal(2, second.PageSize);
        var beyond = (await client.GetFromJsonAsync<ReservationFeedDto>($"/api/reservation-feed?{range}&pageSize=50&page={int.MaxValue}"))!;
        Assert.Equal(3, beyond.TotalCount);
        Assert.Empty(beyond.Items);
    }

    [Fact]
    public async Task Crossing_the_scheduled_end_moves_a_booking_into_history_without_a_status_write()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        factory.Clock.UtcNow = TestApplication.Now.AddHours(1);
        var upcoming = (await client.GetFromJsonAsync<ReservationFeedDto>("/api/reservation-feed"))!;
        Assert.Equal(2, upcoming.TotalCount);
        Assert.DoesNotContain(upcoming.Items, item => item.Title == "Engineering sync");
        var history = (await client.GetFromJsonAsync<ReservationFeedDto>("/api/reservation-feed?view=history"))!;
        Assert.Contains(history.Items, item => item.Title == "Engineering sync" && item.Status == "Completed");
    }

    [Theory]
    [InlineData("view=everything", "INVALID_RESERVATION_VIEW")]
    [InlineData("status=unknown", "INVALID_STATUS")]
    [InlineData("page=0", "INVALID_PAGINATION")]
    [InlineData("page=-1", "INVALID_PAGINATION")]
    [InlineData("pageSize=0", "INVALID_PAGINATION")]
    [InlineData("pageSize=51", "INVALID_PAGINATION")]
    [InlineData("from=2026-10-22T12:00:00Z&to=2026-10-22T12:00:00Z", "INVALID_DATE_FILTER")]
    public async Task Invalid_queries_use_the_standard_error_contract(string query, string code)
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/api/reservation-feed?" + query);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(code, await response.Content.ReadAsStringAsync());
    }

    private static async Task AddAsync(TestApplication factory, int id, DateTimeOffset start, ReservationStatus status)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ReservationsDbContext>();
        db.Reservations.Add(new Reservation
        {
            Id = Guid.Parse($"70000000-0000-0000-0000-{id:000000000000}"), RoomId = Atlas, OrganizerId = Alex,
            Title = $"Feed {id}", StartUtc = start, EndUtc = start.AddHours(1), Attendees = 2, Status = status
        });
        await db.SaveChangesAsync();
    }
}
