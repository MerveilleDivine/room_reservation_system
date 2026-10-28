using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using RoomReservations.Api.Application;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Tests;

public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ROOMWISE_POSTGRES_TEST_CONNECTION")))
            Skip = "Set ROOMWISE_POSTGRES_TEST_CONNECTION to run the real PostgreSQL multi-server checks.";
    }
}

// Each test has its own schema. The API hosts have independent DI containers,
// DbContexts and semaphores, so only the database can coordinate their writes.
[Trait("Category", "Postgres")]
public sealed class SharedStorageTests : IAsyncLifetime
{
    private readonly string schema = "roomwise_test_" + Guid.NewGuid().ToString("N");
    private string connectionString = "";

    public async Task InitializeAsync()
    {
        var configured = Environment.GetEnvironmentVariable("ROOMWISE_POSTGRES_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(configured)) return;
        var options = new NpgsqlConnectionStringBuilder(configured) { SearchPath = schema, MaxPoolSize = 5 };
        connectionString = options.ConnectionString;
        await using var connection = new NpgsqlConnection(configured);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE SCHEMA \"{schema}\"", connection);
        await command.ExecuteNonQueryAsync();
    }

    public async Task DisposeAsync()
    {
        if (connectionString.Length == 0) return;
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"DROP SCHEMA \"{schema}\" CASCADE", connection);
        await command.ExecuteNonQueryAsync();
        NpgsqlConnection.ClearAllPools();
    }

    [PostgresFact]
    public async Task Seeded_booking_can_be_edited_on_another_server_and_cancelled_after_restart()
    {
        await using var first = new SharedStorageApplication(connectionString);
        using var a = first.CreateClient();
        var seed = (await a.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!
            .Single(r => r.Title == "Product planning");
        await using (var second = new SharedStorageApplication(connectionString))
        {
            using var b = second.CreateClient();
            var request = new BookingRequest(seed.RoomId, seed.OrganizerId, "Edited on another server",
                seed.StartUtc, seed.EndUtc, seed.Attendees);
            Assert.Equal(HttpStatusCode.OK, (await b.PutAsJsonAsync($"/api/reservations/{seed.Id}", request)).StatusCode);
            Assert.Equal(request.Title, (await a.GetFromJsonAsync<ReservationDto>($"/api/reservations/{seed.Id}"))!.Title);
        }
        await using var restarted = new SharedStorageApplication(connectionString);
        using var afterRestart = restarted.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await afterRestart.PostAsync($"/api/reservations/{seed.Id}/cancel", null)).StatusCode);
        Assert.Equal("Cancelled", (await a.GetFromJsonAsync<ReservationDto>($"/api/reservations/{seed.Id}"))!.Status);
    }

    [PostgresFact]
    public async Task Created_booking_and_its_receipt_are_visible_on_another_server_and_after_restart()
    {
        await using var first = new SharedStorageApplication(connectionString);
        using var a = first.CreateClient();
        var key = Guid.NewGuid();
        a.DefaultRequestHeaders.Add("Idempotency-Key", key.ToString());
        var response = await a.PostAsJsonAsync("/api/reservations", Booking("Durable booking"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var saved = (await response.Content.ReadFromJsonAsync<ReservationDto>())!;
        await using (var second = new SharedStorageApplication(connectionString))
        {
            using var b = second.CreateClient();
            Assert.Equal(saved.Id, (await b.GetFromJsonAsync<ReservationDto>($"/api/booking-requests/{key}"))!.Id);
            var feed = (await b.GetFromJsonAsync<ReservationFeedDto>($"/api/reservation-feed?focusId={saved.Id}"))!;
            Assert.Contains(feed.Items, r => r.Id == saved.Id);
            b.DefaultRequestHeaders.Add("Idempotency-Key", key.ToString());
            var replay = await b.PostAsJsonAsync("/api/reservations", Booking("Durable booking"));
            Assert.Equal(saved.Id, (await replay.Content.ReadFromJsonAsync<ReservationDto>())!.Id);
        }
        await using var restarted = new SharedStorageApplication(connectionString);
        using var afterRestart = restarted.CreateClient();
        Assert.Equal(saved.Id, (await afterRestart.GetFromJsonAsync<ReservationDto>($"/api/reservations/{saved.Id}"))!.Id);
        Assert.Single((await afterRestart.GetFromJsonAsync<ReservationDto[]>("/api/reservations"))!, r => r.Title == "Durable booking");
    }

    [PostgresFact]
    public async Task Concurrent_overlapping_requests_on_separate_servers_cannot_both_commit()
    {
        await using var first = new SharedStorageApplication(connectionString);
        await using var second = new SharedStorageApplication(connectionString);
        using var a = first.CreateClient();
        using var b = second.CreateClient();
        var responses = await Task.WhenAll(a.PostAsJsonAsync("/api/reservations", Booking("First")),
            b.PostAsJsonAsync("/api/reservations", Booking("Second")));
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
    }

    private static BookingRequest Booking(string title) => new(
        Guid.Parse("10000000-0000-0000-0000-000000000001"), Guid.Parse("20000000-0000-0000-0000-000000000001"),
        title, TestApplication.Now.AddDays(20), TestApplication.Now.AddDays(20).AddHours(1), 2);
}

internal sealed class SharedStorageApplication(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add("X-Roomwise-Profile", "admin");
    }
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.ConfigureServices(services =>
    {
        services.RemoveAll<TimeProvider>();
        services.AddSingleton<TimeProvider>(new TestClock(TestApplication.Now));
        services.RemoveAll<DbContextOptions<ReservationsDbContext>>();
        services.RemoveAll<IDbContextOptionsConfiguration<ReservationsDbContext>>();
        services.AddDbContext<ReservationsDbContext>(options => options.UseNpgsql(connectionString));
    });
}
