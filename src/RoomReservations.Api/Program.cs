using RoomReservations.Api.Api;
using RoomReservations.Api;
using RoomReservations.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
if (Environment.GetEnvironmentVariable("VERCEL") == "1")
    throw new InvalidOperationException("This InMemory demo requires one server process. Use the single-instance host in render.yaml or run locally.");
builder.Services.AddRoomReservations();

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages(async context =>
{
    var http = context.HttpContext;
    if (http.Response.StatusCode == StatusCodes.Status404NotFound &&
        http.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase))
        await Results.Problem(statusCode: StatusCodes.Status404NotFound, title: ApiErrorCodes.ApiNotFound,
            detail: "This API endpoint could not be found.",
            extensions: new Dictionary<string, object?> { ["code"] = ApiErrorCodes.ApiNotFound }).ExecuteAsync(http);
});
if (Directory.Exists(app.Environment.WebRootPath))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}
app.MapReservationApi();
// Exclude API requests and missing asset files from frontend routing.
app.MapFallbackToFile("{*path:nonfile:spa}", "index.html");
await app.Services.SeedRoomReservationsAsync();
app.Run();

public partial class Program { }
