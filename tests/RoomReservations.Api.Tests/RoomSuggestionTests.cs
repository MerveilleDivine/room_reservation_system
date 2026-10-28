using System.Net;
using System.Net.Http.Json;
using RoomReservations.Api.Application;

namespace RoomReservations.Api.Tests;

public sealed class RoomSuggestionTests
{
    private static readonly Guid Atlas = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Birch = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid Cedar = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid Alex = Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static readonly Guid Emilija = Guid.Parse("20000000-0000-0000-0000-000000000002");
    private static DateTimeOffset Start => TestApplication.Now.AddDays(2);

    private static string Query(int attendees = 6, Guid? roomId = null, DateTimeOffset? start = null,
        DateTimeOffset? end = null, Guid? organizerId = null, string? equipment = null, Guid? exclude = null) =>
        $"/api/room-suggestions?roomId={roomId ?? Atlas}&organizerId={organizerId ?? Alex}&attendees={attendees}" +
        $"&startUtc={Uri.EscapeDataString((start ?? Start).ToString("O"))}" +
        $"&endUtc={Uri.EscapeDataString((end ?? (start ?? Start).AddHours(1)).ToString("O"))}" +
        (equipment is null ? "" : $"&equipment={equipment}") +
        (exclude is null ? "" : $"&excludeReservationId={exclude}");

    [Fact]
    public async Task Six_people_in_a_twelve_seat_room_get_one_available_six_seat_suggestion_with_equipment_differences()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var before = (await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!;
        var result = (await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query()))!;
        var suggestion = Assert.Single(result);
        Assert.Equal(Birch, suggestion.Room.Id);
        Assert.Equal(6, suggestion.Room.Capacity);
        Assert.Contains("projector", suggestion.Room.Equipment);
        Assert.Equal(new[] { "tv", "videoConferencing" }, suggestion.MissingEquipment);
        // Suggestions do not create a booking, reserve a room, or change the current one.
        Assert.Equal(before.Length, (await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!.Length);
    }

    [Fact]
    public async Task Similar_equipment_is_preferred_and_an_explicit_equipment_requirement_is_never_dropped()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        Assert.Equal(Cedar, Assert.Single((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query(3)))!).Room.Id);
        Assert.Equal(Birch, Assert.Single((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query(3, equipment: "projector")))!).Room.Id);
        Assert.Empty((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query(equipment: "videoConferencing")))!);
        Assert.Empty((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query(equipment: "tv")))!);
    }

    [Theory]
    [InlineData(7)]
    [InlineData(8)]
    [InlineData(12)]
    [InlineData(13)]
    public async Task Does_not_suggest_an_inactive_or_undersized_room_or_one_without_a_capacity_saving(int attendees)
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        Assert.Empty((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query(attendees)))!);
        Assert.Empty((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query(4, roomId: Cedar)))!);
    }

    [Fact]
    public async Task A_room_busy_during_any_part_of_the_slot_is_skipped_but_an_adjacent_or_cancelled_booking_is_allowed()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var saved = (await (await client.PostAsJsonAsync("/api/reservations",
            new BookingRequest(Birch, Emilija, "Block only the last minute", Start.AddMinutes(59), Start.AddHours(2), 6)))
            .Content.ReadFromJsonAsync<ReservationDto>())!;
        Assert.Empty((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query()))!);
        Assert.Single((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query(end: Start.AddMinutes(59))))!);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/reservations/{saved.Id}/cancel", null)).StatusCode);
        Assert.Single((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query()))!);
    }

    [Fact]
    public async Task An_organizer_conflict_is_not_hidden_by_a_free_room()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var response = await client.PostAsJsonAsync("/api/reservations", new BookingRequest(Atlas, Alex, "Already attending", Start, Start.AddHours(1), 6));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query()))!);
    }

    [Fact]
    public async Task Editing_excludes_the_existing_booking_but_cannot_exclude_another_members_booking()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var saved = (await (await client.PostAsJsonAsync("/api/reservations",
            new BookingRequest(Atlas, Alex, "Move to a smaller room", Start, Start.AddHours(1), 6)))
            .Content.ReadFromJsonAsync<ReservationDto>())!;
        client.DefaultRequestHeaders.Remove("X-Roomwise-Profile");
        client.DefaultRequestHeaders.Add("X-Roomwise-Profile", Alex.ToString());
        Assert.Single((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query(exclude: saved.Id)))!);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(Query(organizerId: Emilija))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(Query(exclude: Guid.Parse("30000000-0000-0000-0000-000000000002")))).StatusCode);
    }

    [Theory]
    [InlineData(0, null, "INVALID_ATTENDEES")]
    [InlineData(-1, null, "INVALID_ATTENDEES")]
    [InlineData(6, "unknown", "INVALID_EQUIPMENT")]
    public async Task Invalid_suggestion_input_uses_the_same_validation_as_bookings(int attendees, string? equipment, string code)
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var response = await client.GetAsync(Query(attendees, equipment: equipment));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(code, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_room_booked_after_the_suggestion_is_rejected_when_saving()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var suggestion = Assert.Single((await client.GetFromJsonAsync<RoomSuggestionDto[]>(Query()))!);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/reservations",
            new BookingRequest(Birch, Emilija, "Someone books first", Start, Start.AddHours(1), 6))).StatusCode);
        var response = await client.PostAsJsonAsync("/api/reservations",
            new BookingRequest(suggestion.Room.Id, Alex, "Use suggested room", Start, Start.AddHours(1), 6));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("ROOM_OVERLAP", await response.Content.ReadAsStringAsync());
    }
}
