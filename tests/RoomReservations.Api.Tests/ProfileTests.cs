using System.Net;
using System.Net.Http.Json;
using RoomReservations.Api.Application;

namespace RoomReservations.Api.Tests;

public sealed class ProfileTests
{
    private const string Alex = "20000000-0000-0000-0000-000000000001";
    private const string Emilija = "20000000-0000-0000-0000-000000000002";
    private static BookingRequest Booking(string person) => new(
        Guid.Parse("10000000-0000-0000-0000-000000000001"), Guid.Parse(person), "Profile booking",
        TestApplication.Now.AddDays(3), TestApplication.Now.AddDays(3).AddHours(1), 2);

    private static void Select(HttpClient client, string? profile)
    {
        client.DefaultRequestHeaders.Remove("X-Roomwise-Profile");
        if (profile is not null) client.DefaultRequestHeaders.Add("X-Roomwise-Profile", profile);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("unknown")]
    [InlineData("20000000-0000-0000-0000-000000000099")]
    public async Task Missing_or_invalid_profile_cannot_write(string? profile)
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        Select(client, profile);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/reservations", Booking(Alex))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/reservations")).StatusCode);
    }

    [Fact]
    public async Task Member_can_create_edit_and_cancel_own_booking_but_cannot_assign_another_organizer()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        Select(client, Alex);
        var created = await client.PostAsJsonAsync("/api/reservations", Booking(Alex));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var booking = (await created.Content.ReadFromJsonAsync<ReservationDto>())!;
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/reservations", Booking(Emilija))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"/api/reservations/{booking.Id}", Booking(Emilija))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/reservations/{booking.Id}", Booking(Alex) with { Title = "My updated booking" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/reservations/{booking.Id}/cancel", null)).StatusCode);
    }

    [Theory]
    [InlineData("edit")]
    [InlineData("cancel")]
    [InlineData("check-in")]
    [InlineData("end")]
    [InlineData("continuations")]
    public async Task Member_cannot_change_another_persons_booking(string action)
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var meetings = (await client.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!;
        var other = meetings.Single(meeting => meeting.Title == (action is "edit" or "cancel" ? "Design review" : "Engineering sync"));
        Select(client, Alex);
        var response = action switch
        {
            "edit" => await client.PutAsJsonAsync($"/api/reservations/{other.Id}", Booking(Alex)),
            "continuations" => await client.PostAsJsonAsync($"/api/reservations/{other.Id}/continuations", new { additionalMinutes = 15 }),
            _ => await client.PostAsync($"/api/reservations/{other.Id}/{action}", null)
        };
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Contains("BOOKING_ACCESS_DENIED", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Admin_can_manage_any_organizer_and_receipts_remain_owner_scoped()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient();
        var key = Guid.NewGuid();
        client.DefaultRequestHeaders.Add("Idempotency-Key", key.ToString());
        var response = await client.PostAsJsonAsync("/api/reservations", Booking(Emilija));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var booking = (await response.Content.ReadFromJsonAsync<ReservationDto>())!;
        Select(client, Alex);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/booking-requests/{key}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/reservations", Booking(Emilija))).StatusCode);
        Select(client, Emilija);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/booking-requests/{key}")).StatusCode);
        Select(client, "admin");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/reservations/{booking.Id}/cancel", null)).StatusCode);
    }
}
