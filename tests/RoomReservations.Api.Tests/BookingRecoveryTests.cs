using System.Net;
using System.Net.Http.Json;
using RoomReservations.Api.Application;

namespace RoomReservations.Api.Tests;

public sealed class BookingRecoveryTests
{
    private static BookingRequest Valid => new(
        Guid.Parse("10000000-0000-0000-0000-000000000001"),
        Guid.Parse("20000000-0000-0000-0000-000000000001"), "Recoverable booking",
        TestApplication.Now.AddDays(2), TestApplication.Now.AddDays(2).AddHours(1), 2);

    [Fact]
    public async Task Simultaneous_retries_return_one_booking_and_a_recoverable_receipt()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var key = Guid.NewGuid();
        var responses = await Task.WhenAll(
            Submit(client, HttpMethod.Post, "/api/reservations", Valid, key),
            Submit(client, HttpMethod.Post, "/api/reservations", Valid, key));
        Assert.All(responses, response => Assert.Equal(HttpStatusCode.Created, response.StatusCode));
        var first = await Read(responses[0]);
        Assert.Equal(first.Id, (await Read(responses[1])).Id);
        var recovered = await client.GetFromJsonAsync<ReservationDto>($"/api/booking-requests/{key}");
        Assert.Equal(first.Id, recovered!.Id);
        var reservations = await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations");
        Assert.Single(reservations!, item => item.Title == Valid.Title);
    }

    [Fact]
    public async Task Replays_normalize_whitespace_and_time_offsets_even_after_the_meeting_starts()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var key = Guid.NewGuid();
        var created = await Read(await Submit(client, HttpMethod.Post, "/api/reservations", Valid, key));
        app.Clock.UtcNow = Valid.StartUtc.AddMinutes(10);
        var retry = Valid with { Title = $"  {Valid.Title}  ", StartUtc = Valid.StartUtc.ToOffset(TimeSpan.FromHours(3)), EndUtc = Valid.EndUtc.ToOffset(TimeSpan.FromHours(3)) };
        var replay = await Submit(client, HttpMethod.Post, "/api/reservations", retry, key);
        Assert.Equal(HttpStatusCode.Created, replay.StatusCode);
        Assert.Equal(created.Id, (await Read(replay)).Id);
    }

    [Fact]
    public async Task Key_cannot_be_reused_for_different_content_or_a_different_operation()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var key = Guid.NewGuid();
        var created = await Read(await Submit(client, HttpMethod.Post, "/api/reservations", Valid, key));
        var changed = await Submit(client, HttpMethod.Post, "/api/reservations", Valid with { Title = "Different" }, key);
        await AssertProblem(changed, HttpStatusCode.Conflict, "IDEMPOTENCY_KEY_REUSED");
        var edit = await Submit(client, HttpMethod.Put, $"/api/reservations/{created.Id}", Valid, key);
        await AssertProblem(edit, HttpStatusCode.Conflict, "IDEMPOTENCY_KEY_REUSED");
    }

    [Fact]
    public async Task Replaying_an_old_edit_does_not_overwrite_a_later_change()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var created = await Read(await client.PostAsJsonAsync("/api/reservations", Valid));
        var key = Guid.NewGuid();
        var path = $"/api/reservations/{created.Id}";
        var firstEdit = Valid with { Title = "First edit" };
        await Submit(client, HttpMethod.Put, path, firstEdit, key);
        await client.PutAsJsonAsync(path, Valid with { Title = "Later edit" });
        var replay = await Read(await Submit(client, HttpMethod.Put, path, firstEdit, key));
        Assert.Equal("Later edit", replay.Title);
        Assert.Equal("Later edit", (await client.GetFromJsonAsync<ReservationDto>(path))!.Title);
    }

    [Fact]
    public async Task Validation_failure_does_not_consume_the_request_identifier()
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        var key = Guid.NewGuid();
        var invalid = await Submit(client, HttpMethod.Post, "/api/reservations", Valid with { Attendees = 100 }, key);
        await AssertProblem(invalid, HttpStatusCode.BadRequest, "CAPACITY_EXCEEDED");
        var missing = await client.GetAsync($"/api/booking-requests/{key}");
        await AssertProblem(missing, HttpStatusCode.NotFound, "BOOKING_REQUEST_NOT_FOUND");
        var corrected = await Submit(client, HttpMethod.Post, "/api/reservations", Valid, key);
        Assert.Equal(HttpStatusCode.Created, corrected.StatusCode);
    }

    [Theory]
    [InlineData("not-a-uuid")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    [InlineData("17f38df3-f10b-4db6-88d8-0b50eb4d8777,9fa14073-a3ed-49ad-b122-1cc48bb553ef")]
    public async Task Invalid_request_identifier_is_rejected(string key)
    {
        await using var app = new TestApplication();
        using var client = app.CreateClient();
        using var message = new HttpRequestMessage(HttpMethod.Post, "/api/reservations") { Content = JsonContent.Create(Valid) };
        message.Headers.TryAddWithoutValidation("Idempotency-Key", key);
        await AssertProblem(await client.SendAsync(message), HttpStatusCode.BadRequest, "INVALID_REQUEST_ID");
    }

    private static async Task<HttpResponseMessage> Submit(HttpClient client, HttpMethod method, string path, BookingRequest value, Guid key)
    {
        using var message = new HttpRequestMessage(method, path) { Content = JsonContent.Create(value) };
        message.Headers.Add("Idempotency-Key", key.ToString());
        return await client.SendAsync(message);
    }

    private static async Task<ReservationDto> Read(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ReservationDto>())!;

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal(code, (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    private sealed record Problem(string Code);
}
