using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RoomReservations.Api.Application;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Tests;

public sealed class ContinuationTests
{
    [Fact]
    public async Task Extra_time_is_a_future_linked_booking_with_its_own_check_in()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var parent = await Ongoing(client);
        await client.PostAsync($"/api/reservations/{parent.Id}/check-in", null);
        var response = await Continue(client, parent.Id, 30);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var child = (await response.Content.ReadFromJsonAsync<ReservationDto>())!;
        Assert.NotEqual(parent.Id, child.Id);
        Assert.Equal(parent.Id, child.ContinuationOfId);
        Assert.Equal(parent.EndUtc, child.StartUtc);
        Assert.Equal(parent.EndUtc.AddMinutes(30), child.EndUtc);
        Assert.Equal(parent.RoomId, child.RoomId);
        Assert.Equal(parent.OrganizerId, child.OrganizerId);
        Assert.Equal(parent.Title, child.Title);
        Assert.Equal(parent.Attendees, child.Attendees);
        Assert.Null(child.CheckedInAtUtc);
        Assert.Equal(new[] { "edit", "cancel" }, child.AllowedActions);
        Assert.Equal($"/api/reservations/{child.Id}", response.Headers.Location!.ToString());
        var unchanged = await client.GetFromJsonAsync<ReservationDto>($"/api/reservations/{parent.Id}");
        Assert.Equal(parent.EndUtc, unchanged!.EndUtc);

        // Releasing the original slot does not silently cancel another booking.
        await client.PostAsync($"/api/reservations/{parent.Id}/end", null);
        var retained = await client.GetFromJsonAsync<ReservationDto>($"/api/reservations/{child.Id}");
        Assert.Equal("Booked", retained!.Status);
    }

    [Theory]
    [InlineData(false, "ROOM_OVERLAP")]
    [InlineData(true, "ORGANIZER_OVERLAP")]
    public async Task Additional_time_cannot_displace_the_next_room_or_organizer_booking(bool organizerConflict, string code)
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var parent = await Ongoing(client);
        var nextBooking = new BookingRequest(
            organizerConflict ? Guid.Parse("10000000-0000-0000-0000-000000000001") : parent.RoomId,
            organizerConflict ? parent.OrganizerId : Guid.Parse("20000000-0000-0000-0000-000000000001"),
            "Next team", parent.EndUtc, parent.EndUtc.AddHours(1), 2);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/reservations", nextBooking)).StatusCode);
        await AssertProblem(await Continue(client, parent.Id, 15), HttpStatusCode.Conflict, code);
        var reservations = await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations");
        Assert.DoesNotContain(reservations!, item => item.ContinuationOfId == parent.Id);
    }

    [Theory]
    [InlineData("future")]
    [InlineData("elapsed")]
    [InlineData("ended")]
    [InlineData("cancelled")]
    public async Task Only_a_currently_ongoing_booking_can_reserve_more_time(string state)
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var parent = await Ongoing(client);
        if (state is "future" or "cancelled")
            parent = (await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!.Single(item => item.Title == "Product planning");
        if (state == "cancelled") await client.PostAsync($"/api/reservations/{parent.Id}/cancel", null);
        if (state == "ended") await client.PostAsync($"/api/reservations/{parent.Id}/end", null);
        if (state == "elapsed") app.Clock.UtcNow = parent.EndUtc;
        await AssertProblem(await Continue(client, parent.Id, 15), HttpStatusCode.Conflict, "MEETING_NOT_ONGOING");
    }

    [Fact]
    public async Task Retrying_after_the_parent_ends_recovers_the_same_booking_without_reviving_it()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var parent = await Ongoing(client);
        var key = Guid.NewGuid();
        var created = (await (await Continue(client, parent.Id, 15, key)).Content.ReadFromJsonAsync<ReservationDto>())!;
        await client.PostAsync($"/api/reservations/{created.Id}/cancel", null);
        app.Clock.UtcNow = parent.EndUtc.AddMinutes(1);
        var replay = await Continue(client, parent.Id, 15, key);
        Assert.Equal(HttpStatusCode.Created, replay.StatusCode);
        var recovered = (await replay.Content.ReadFromJsonAsync<ReservationDto>())!;
        Assert.Equal(created.Id, recovered.Id);
        Assert.Equal("Cancelled", recovered.Status);
    }

    [Fact]
    public async Task A_second_continuation_requires_cancelling_the_existing_one()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var parent = await Ongoing(client);
        var child = (await (await Continue(client, parent.Id, 15)).Content.ReadFromJsonAsync<ReservationDto>())!;
        await AssertProblem(await Continue(client, parent.Id, 30), HttpStatusCode.Conflict, "CONTINUATION_ALREADY_BOOKED");
        await client.PostAsync($"/api/reservations/{child.Id}/cancel", null);
        Assert.Equal(HttpStatusCode.Created, (await Continue(client, parent.Id, 30)).StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(1441)]
    [InlineData(int.MaxValue)]
    public async Task Additional_time_respects_the_configured_duration_limit(int minutes)
    {
        await using var app = new TestApplication(maximumDurationDays: 1);
        using var client = app.CreateClient();
        var parent = await Ongoing(client);
        await AssertProblem(await Continue(client, parent.Id, minutes), HttpStatusCode.BadRequest, "INVALID_ADDITIONAL_TIME");
    }

    [Fact]
    public async Task Room_availability_and_capacity_are_rechecked_before_extra_time_is_saved()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var parent = await Ongoing(client);
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ReservationsDbContext>();
        var room = await db.Rooms.SingleAsync(item => item.Id == parent.RoomId);
        room.IsActive = false;
        await db.SaveChangesAsync();
        await AssertProblem(await Continue(client, parent.Id, 15), HttpStatusCode.BadRequest, "ROOM_INACTIVE");
        room.IsActive = true;
        room.Capacity = 1;
        await db.SaveChangesAsync();
        await AssertProblem(await Continue(client, parent.Id, 15), HttpStatusCode.BadRequest, "CAPACITY_EXCEEDED");
    }

    [Fact]
    public async Task Natural_completion_reports_the_limit_of_what_is_known()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var parent = await Ongoing(client);
        Assert.Contains("reserve-more", parent.AllowedActions);
        app.Clock.UtcNow = parent.EndUtc;
        var completed = (await client.GetFromJsonAsync<ReservationDto>($"/api/reservations/{parent.Id}"))!;
        Assert.Equal("Completed", completed.Status);
        Assert.Null(completed.ActualEndUtc);
        Assert.Contains("Actual departure is not recorded", completed.CompletionNote!);
        Assert.Empty(completed.AllowedActions);
    }

    private static async Task<ReservationDto> Ongoing(HttpClient client) =>
        (await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!.Single(item => item.Title == "Engineering sync");

    private static async Task<HttpResponseMessage> Continue(HttpClient client, Guid id, int minutes, Guid? key = null)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, $"/api/reservations/{id}/continuations")
        { Content = JsonContent.Create(new ContinuationRequest(minutes)) };
        if (key is not null) message.Headers.Add("Idempotency-Key", key.ToString());
        return await client.SendAsync(message);
    }

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal(code, (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    private sealed record Problem(string Code);
}
