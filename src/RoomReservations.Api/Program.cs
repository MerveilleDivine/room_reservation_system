using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Api;
using RoomReservations.Api.Application;
using RoomReservations.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<Microsoft.AspNetCore.Routing.RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOptions<BookingOptions>()
    .BindConfiguration(BookingOptions.SectionName)
    .Validate(options => options.MaximumDurationDays is > 0 and <= 365, "Duration must be between 1 and 365 days.")
    .Validate(options => options.MaximumAdvanceDays is > 0 and <= 3650, "Advance window must be between 1 and 3650 days.")
    .ValidateOnStart();
builder.Services.AddDbContext<ReservationsDbContext>(options => options.UseInMemoryDatabase("room-reservations"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<BookingWriteGate>();
builder.Services.AddScoped<BookingRules>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<BookingProfile>();
builder.Services.AddScoped<ReservationService>();
builder.Services.AddScoped<UsageReportService>();

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
    await SeedData.InitializeAsync(
        scope.ServiceProvider.GetRequiredService<ReservationsDbContext>(),
        scope.ServiceProvider.GetRequiredService<TimeProvider>());
}
app.Run();

public partial class Program { }
