using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RoomReservations.Api.Application;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Tests;

internal sealed class TestApplication(int maximumDurationDays = 7) : WebApplicationFactory<Program>
{
    public static readonly DateTimeOffset Now = new(2026, 10, 22, 8, 0, 0, TimeSpan.Zero);
    private readonly string databaseName = Guid.NewGuid().ToString();
    public TestClock Clock { get; } = new(Now);

    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add("X-Roomwise-Profile", "admin");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.PostConfigure<BookingOptions>(options => options.MaximumDurationDays = maximumDurationDays);
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
            services.RemoveAll<DbContextOptions<ReservationsDbContext>>();
            services.AddDbContext<ReservationsDbContext>(options => options.UseInMemoryDatabase(databaseName));
        });
    }
}

internal sealed class TestClock(DateTimeOffset value) : TimeProvider
{
    public DateTimeOffset UtcNow { get; set; } = value;
    public override DateTimeOffset GetUtcNow() => UtcNow;
}
