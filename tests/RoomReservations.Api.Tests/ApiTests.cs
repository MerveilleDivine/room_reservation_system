using System.Net;
using System.Net.Http.Json;
using RoomReservations.Api.Application;

namespace RoomReservations.Api.Tests;

public sealed class ApiTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid RoomId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid OrganizerId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static BookingRequest Valid => new(RoomId, OrganizerId, "API test", Now.AddDays(1).AddHours(6), Now.AddDays(1).AddHours(7), 2);

    [Fact]
    public async Task Create_then_edit_then_cancel_round_trips()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/reservations", Valid);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var reservation = await created.Content.ReadFromJsonAsync<ReservationDto>();
        Assert.NotNull(reservation);
        Assert.Equal("Booked", reservation.Status);

        var edited = await client.PutAsJsonAsync($"/api/reservations/{reservation.Id}", Valid with { Title = "Updated" });
        Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        var updated = await edited.Content.ReadFromJsonAsync<ReservationDto>();
        Assert.Equal("Updated", updated!.Title);

        var cancelled = await client.PostAsync($"/api/reservations/{reservation.Id}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        var result = await cancelled.Content.ReadFromJsonAsync<ReservationDto>();
        Assert.Equal("Cancelled", result!.Status);

        var replacement = await client.PostAsJsonAsync("/api/reservations", Valid);
        Assert.Equal(HttpStatusCode.Created, replacement.StatusCode);
    }

    [Fact]
    public async Task Conflict_has_stable_code_and_readable_message()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        await client.PostAsJsonAsync("/api/reservations", Valid);
        var conflict = await client.PostAsJsonAsync("/api/reservations", Valid);
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        var problem = await conflict.Content.ReadFromJsonAsync<Problem>();
        Assert.Equal("ROOM_OVERLAP", problem!.Code);
        Assert.False(string.IsNullOrWhiteSpace(problem.Detail));
    }

    [Fact]
    public async Task Room_filter_requires_all_selected_equipment()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var rooms = await client.GetFromJsonAsync<RoomDto[]>("/api/rooms?minimumCapacity=8&floor=1&equipment=tv,whiteboard");
        var room = Assert.Single(rooms!);
        Assert.Equal("Atlas", room.Name);
    }

    [Fact]
    public async Task Missing_room_is_not_accepted()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/reservations", Valid with { RoomId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("ROOM_NOT_FOUND", (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    [Fact]
    public async Task Invalid_query_has_the_same_error_contract()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/api/reservations?roomId=not-a-guid");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("INVALID_REQUEST", (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    [Fact]
    public async Task Ongoing_meeting_can_check_in_then_end_but_not_edit()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var meetings = await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations");
        var meeting = Assert.Single(meetings!, item => item.Title == "Engineering sync");
        var edit = await client.PutAsJsonAsync($"/api/reservations/{meeting.Id}", Valid);
        Assert.Equal(HttpStatusCode.Conflict, edit.StatusCode);
        var checkIn = await client.PostAsync($"/api/reservations/{meeting.Id}/check-in", null);
        Assert.Equal(HttpStatusCode.OK, checkIn.StatusCode);
        Assert.NotNull((await checkIn.Content.ReadFromJsonAsync<ReservationDto>())!.CheckedInAtUtc);
        var end = await client.PostAsync($"/api/reservations/{meeting.Id}/end", null);
        var result = await end.Content.ReadFromJsonAsync<ReservationDto>();
        Assert.Equal("Completed", result!.Status);
        Assert.Equal(Now, result.ActualEndUtc);
        Assert.Empty(result.AllowedActions);
    }

    private sealed record Problem(string Code, string Detail);

    [Fact]
    public async Task Usage_report_returns_backend_calculated_observations()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var report = await client.GetFromJsonAsync<UsageReportDto>("/api/usage");
        Assert.NotNull(report);
        Assert.Equal(Now, report.AsOfUtc);
        var atlas = Assert.Single(report.Rooms, room => room.RoomName == "Atlas");
        Assert.Equal(2, atlas.ReservationCount);
        Assert.Equal(120, atlas.ScheduledMinutes);
        Assert.Equal(100, atlas.ElapsedReservedMinutes);
        Assert.Equal(93, atlas.ObservedMinutes);
        Assert.Equal(20, atlas.ReleasedMinutes);
        var birch = Assert.Single(report.Rooms, room => room.RoomName == "Birch");
        Assert.Equal(1, birch.UnconfirmedCompletedCount);
        Assert.Equal(0, birch.ObservedMinutes);
    }

    [Fact]
    public async Task Usage_report_can_filter_one_room()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var report = await client.GetFromJsonAsync<UsageReportDto>($"/api/usage?roomId={RoomId}");
        Assert.Equal(RoomId, Assert.Single(report!.Rooms).RoomId);
    }

    [Fact]
    public async Task Partial_report_range_has_a_clear_error()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/api/usage?from=2026-10-20T00:00:00Z");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("INVALID_REPORT_RANGE", (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    [Fact]
    public async Task Unknown_report_room_has_a_clear_error()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var response = await client.GetAsync($"/api/usage?roomId={Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("ROOM_NOT_FOUND", (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

}
