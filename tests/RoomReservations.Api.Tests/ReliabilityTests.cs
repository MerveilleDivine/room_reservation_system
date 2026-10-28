using System.Net;
using System.Net.Http.Json;
using RoomReservations.Api.Application;

namespace RoomReservations.Api.Tests;

public sealed class ReliabilityTests
{
    private const string Alex = "20000000-0000-0000-0000-000000000001";

    [Fact]
    public async Task Members_cannot_read_other_bookings_through_any_detail_endpoint()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var all = (await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!;
        var other = all.First(r => r.OrganizerId.ToString() != Alex);
        client.DefaultRequestHeaders.Remove("X-Roomwise-Profile");
        client.DefaultRequestHeaders.Add("X-Roomwise-Profile", Alex);
        var mine = (await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!;
        Assert.All(mine, r => Assert.Equal(Alex, r.OrganizerId.ToString()));
        var feed = (await client.GetFromJsonAsync<ReservationFeedDto>("/api/reservation-feed?view=upcoming"))!;
        Assert.All(feed.Items, r => Assert.Equal(Alex, r.OrganizerId.ToString()));
        foreach (var path in new[] { $"/api/reservations/{other.Id}", $"/api/reservations?organizerId={other.OrganizerId}",
                     $"/api/reservation-feed?organizerId={other.OrganizerId}", $"/api/reservations/{other.Id}/extra-time", "/api/usage" })
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(path)).StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(17)]
    public async Task Extra_time_advertises_and_enforces_the_exact_free_gap(int minutes)
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var parent = (await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!
            .Single(r => r.Title == "Engineering sync");
        var block = new BookingRequest(parent.RoomId, Guid.Parse(Alex), "Next private meeting",
            parent.EndUtc.AddMinutes(minutes), parent.EndUtc.AddMinutes(60), 1);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/reservations", block)).StatusCode);
        var extra = (await client.GetFromJsonAsync<ExtraTimeDto>($"/api/reservations/{parent.Id}/extra-time"))!;
        Assert.Equal(minutes, extra.MaximumMinutes);
        Assert.Equal(block.StartUtc, extra.BlockedFromUtc);
        Assert.Equal(block.EndUtc, extra.BlockedUntilUtc);
        Assert.DoesNotContain("private", extra.Message!);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/reservations/{parent.Id}/continuations", new { additionalMinutes = minutes + 1 })).StatusCode);
        if (minutes > 0)
            Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync($"/api/reservations/{parent.Id}/continuations", new { additionalMinutes = minutes })).StatusCode);
    }

    [Fact]
    public async Task Extra_time_never_rounds_a_partial_minute_into_the_next_booking()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var parent = (await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!
            .Single(r => r.Title == "Engineering sync");
        var block = new BookingRequest(parent.RoomId, Guid.Parse(Alex), "Private next meeting",
            parent.EndUtc.AddMinutes(2).AddTicks(-1), parent.EndUtc.AddHours(1), 1);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/reservations", block)).StatusCode);
        var extra = (await client.GetFromJsonAsync<ExtraTimeDto>($"/api/reservations/{parent.Id}/extra-time"))!;
        Assert.Equal(1, extra.MaximumMinutes);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/reservations/{parent.Id}/continuations",
            new { additionalMinutes = 2 })).StatusCode);
    }

    [Fact]
    public async Task Saved_booking_focus_resolves_to_its_actual_schedule_page()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        ReservationDto? last = null;
        for (var i = 0; i < 9; i++)
        {
            var request = new BookingRequest(Guid.Parse("10000000-0000-0000-0000-000000000001"), Guid.Parse(Alex),
                $"Focus {i}", TestApplication.Now.AddDays(i + 10), TestApplication.Now.AddDays(i + 10).AddMinutes(30), 1);
            last = await (await client.PostAsJsonAsync("/api/reservations", request)).Content.ReadFromJsonAsync<ReservationDto>();
        }
        var feed = (await client.GetFromJsonAsync<ReservationFeedDto>($"/api/reservation-feed?organizerId={Alex}&pageSize=6&focusId={last!.Id}"))!;
        Assert.Equal(2, feed.Page);
        Assert.Contains(feed.Items, r => r.Id == last.Id);
    }
}
