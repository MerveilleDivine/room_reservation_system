using System.Net;
using System.Net.Http.Json;
using RoomReservations.Application;

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
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act: create the booking that the rest of this integration journey changes.
        var created = await client.PostAsJsonAsync("/api/reservations", Valid);
        var reservation = await created.Content.ReadFromJsonAsync<ReservationDto>();

        // Assert
        Assert.NotNull(reservation);
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.Created, created.StatusCode),
            () => Assert.Equal("Booked", reservation.Status));

        // Act / Assert: edit the same booking through its public URL.
        var edited = await client.PutAsJsonAsync($"/api/reservations/{reservation.Id}", Valid with { Title = "Updated" });
        var updated = await edited.Content.ReadFromJsonAsync<ReservationDto>();
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.OK, edited.StatusCode),
            () => Assert.Equal(reservation.Id, updated!.Id),
            () => Assert.Equal("Updated", updated!.Title));

        // Act / Assert: cancel it, then prove its original slot can be booked again.
        var cancelled = await client.PostAsync($"/api/reservations/{reservation.Id}/cancel", null);
        var result = await cancelled.Content.ReadFromJsonAsync<ReservationDto>();
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode),
            () => Assert.Equal("Cancelled", result!.Status));

        var replacement = await client.PostAsJsonAsync("/api/reservations", Valid);
        Assert.Equal(HttpStatusCode.Created, replacement.StatusCode);
    }

    [Fact]
    public async Task Conflict_has_stable_code_and_readable_message()
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        await client.PostAsJsonAsync("/api/reservations", Valid);

        // Act
        var conflict = await client.PostAsJsonAsync("/api/reservations", Valid);
        var problem = await conflict.Content.ReadFromJsonAsync<Problem>();

        // Assert
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode),
            () => Assert.Equal("ROOM_OVERLAP", problem!.Code),
            () => Assert.False(string.IsNullOrWhiteSpace(problem!.Detail)));
    }

    [Fact]
    public async Task Room_catalog_filters_capacity_floor_and_all_selected_equipment()
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act
        var rooms = await client.GetFromJsonAsync<RoomDto[]>("/api/rooms?minimumCapacity=8&floor=1&equipment=tv,whiteboard");

        // Assert
        var room = Assert.Single(rooms!);
        Assert.Multiple(
            () => Assert.Equal("Atlas", room.Name),
            () => Assert.Equal("1", room.Floor),
            () => Assert.True(room.Capacity >= 8),
            () => Assert.Contains("tv", room.Equipment),
            () => Assert.Contains("whiteboard", room.Equipment));
    }

    [Fact]
    public async Task Booking_for_an_unknown_room_returns_not_found()
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/reservations", Valid with { RoomId = Guid.NewGuid() });
        var problem = await response.Content.ReadFromJsonAsync<Problem>();

        // Assert
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.NotFound, response.StatusCode),
            () => Assert.Equal("ROOM_NOT_FOUND", problem!.Code));
    }

    [Fact]
    public async Task Malformed_room_identifier_uses_the_invalid_request_problem_contract()
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/reservations?roomId=not-a-guid");
        var problem = await response.Content.ReadFromJsonAsync<Problem>();

        // Assert
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode),
            () => Assert.Equal("INVALID_REQUEST", problem!.Code));
    }

    [Fact]
    public async Task Ongoing_meeting_can_check_in_then_end_but_not_edit()
    {
        // Arrange: locate an ongoing seeded meeting for the lifecycle journey.
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var meetings = await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations");
        var meeting = meetings!.Single(item => item.Title == "Engineering sync");

        // Act / Assert: an ongoing booking cannot be edited.
        var edit = await client.PutAsJsonAsync($"/api/reservations/{meeting.Id}", Valid);
        Assert.Equal(HttpStatusCode.Conflict, edit.StatusCode);

        // Act / Assert: check in before ending the same booking.
        var checkIn = await client.PostAsync($"/api/reservations/{meeting.Id}/check-in", null);
        var checkedIn = await checkIn.Content.ReadFromJsonAsync<ReservationDto>();
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.OK, checkIn.StatusCode),
            () => Assert.NotNull(checkedIn!.CheckedInAtUtc));

        // Act / Assert: ending records the server time and removes lifecycle actions.
        var end = await client.PostAsync($"/api/reservations/{meeting.Id}/end", null);
        var result = await end.Content.ReadFromJsonAsync<ReservationDto>();
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.OK, end.StatusCode),
            () => Assert.Equal("Completed", result!.Status),
            () => Assert.Equal(Now, result!.ActualEndUtc),
            () => Assert.Empty(result!.AllowedActions));
    }

    [Fact]
    public async Task Usage_report_returns_backend_calculated_observations()
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act
        var report = await client.GetFromJsonAsync<UsageReportDto>("/api/usage");

        // Assert
        Assert.NotNull(report);
        var atlas = Assert.Single(report.Rooms, room => room.RoomName == "Atlas");
        var birch = Assert.Single(report.Rooms, room => room.RoomName == "Birch");
        Assert.Multiple(
            () => Assert.Equal(Now, report.AsOfUtc),
            () => Assert.Equal(2, atlas.ReservationCount),
            () => Assert.Equal(120, atlas.ScheduledMinutes),
            () => Assert.Equal(100, atlas.ElapsedReservedMinutes),
            () => Assert.Equal(93, atlas.ObservedMinutes),
            () => Assert.Equal(20, atlas.ReleasedMinutes),
            () => Assert.Equal(1, birch.UnconfirmedCompletedCount),
            () => Assert.Equal(0, birch.ObservedMinutes));
    }

    [Fact]
    public async Task Usage_report_can_filter_one_room()
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act
        var report = await client.GetFromJsonAsync<UsageReportDto>($"/api/usage?roomId={RoomId}");

        // Assert
        Assert.Equal(RoomId, Assert.Single(report!.Rooms).RoomId);
    }

    [Fact]
    public async Task Partial_report_range_has_a_clear_error()
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/usage?from=2026-10-20T00:00:00Z");
        var problem = await response.Content.ReadFromJsonAsync<Problem>();

        // Assert
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode),
            () => Assert.Equal("INVALID_REPORT_RANGE", problem!.Code));
    }

    [Fact]
    public async Task Unknown_report_room_has_a_clear_error()
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/usage?roomId={Guid.NewGuid()}");
        var problem = await response.Content.ReadFromJsonAsync<Problem>();

        // Assert
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.NotFound, response.StatusCode),
            () => Assert.Equal("ROOM_NOT_FOUND", problem!.Code));
    }

    [Theory]
    [InlineData("/api")]
    [InlineData("/api/does-not-exist")]
    [InlineData("/api/reservations/10000000-0000-0000-0000-000000000001/unknown")]
    public async Task Unknown_api_route_returns_a_json_problem_instead_of_the_application_shell(string route)
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act
        using var response = await client.GetAsync(route);
        var problem = await response.Content.ReadFromJsonAsync<Problem>();

        // Assert
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.NotFound, response.StatusCode),
            () => Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType),
            () => Assert.Equal("API_NOT_FOUND", problem!.Code));
    }

    [Fact]
    public async Task Unsupported_method_on_an_existing_api_route_remains_method_not_allowed()
    {
        // Arrange
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();

        // Act
        using var response = await client.DeleteAsync("/api/reservations");

        // Assert
        Assert.Multiple(
            () => Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode),
            () => Assert.Contains("GET", response.Content.Headers.Allow),
            () => Assert.Contains("POST", response.Content.Headers.Allow));
    }

    private sealed record Problem(string Code, string Detail);
}
