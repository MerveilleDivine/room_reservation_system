using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Api;
using RoomReservations.Api.Application;
using RoomReservations.Api.Infrastructure;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<Microsoft.AspNetCore.Routing.RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOptions<BookingOptions>()
    .BindConfiguration(BookingOptions.SectionName)
    .Validate(options => options.MaximumDurationDays is > 0 and <= 365, "Duration must be between 1 and 365 days.")
    .Validate(options => options.MaximumAdvanceDays is > 0 and <= 3650, "Advance window must be between 1 and 3650 days.")
    .ValidateOnStart();
var connectionString = builder.Configuration.GetConnectionString("Reservations");
if ((builder.Configuration.GetValue<bool>("Storage:RequireShared") ||
     Environment.GetEnvironmentVariable("VERCEL") == "1") && string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("The hosted demo requires shared storage. Configure ConnectionStrings__Reservations.");
builder.Services.AddDbContext<ReservationsDbContext>(options =>
{
    if (string.IsNullOrWhiteSpace(connectionString)) options.UseInMemoryDatabase("room-reservations");
    else options.UseNpgsql(connectionString);
});
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<BookingWriteGate>();
builder.Services.AddScoped<BookingRules>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<BookingProfile>();
builder.Services.AddScoped<ReservationService>();
builder.Services.AddScoped<UsageReportService>();
builder.Services.AddScoped<ReservationFeedService>();
builder.Services.AddScoped<RoomAvailabilityService>();
builder.Services.AddScoped<ExtraTimeService>();

var app = builder.Build();
app.UseExceptionHandler();
if (Directory.Exists(app.Environment.WebRootPath))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}
app.MapReservationApi();
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ReservationsDbContext>();
    await using var lease = await scope.ServiceProvider.GetRequiredService<BookingWriteGate>()
        .AcquireAsync(db, CancellationToken.None);
    if (db.Database.IsNpgsql())
    {
        var exists = await db.Database.SqlQueryRaw<int>(
            "SELECT CASE WHEN to_regclass('\"Rooms\"') IS NULL THEN 0 ELSE 1 END AS \"Value\"").SingleAsync();
        if (exists == 0) await db.GetService<IRelationalDatabaseCreator>().CreateTablesAsync();
    }
    await SeedData.InitializeAsync(db, scope.ServiceProvider.GetRequiredService<TimeProvider>());
    await lease.CommitAsync(CancellationToken.None);
}
app.Run();

public partial class Program { }
