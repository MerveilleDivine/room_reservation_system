using RoomReservations.Application.Abstractions;
using RoomReservations.Application;

namespace RoomReservations.Api.Profiles;

internal sealed class HttpDemoProfile(IHttpContextAccessor context) : ICurrentDemoProfile
{
    public const string HeaderName = "X-Roomwise-Profile";

    public DemoProfileSelection Selection
    {
        get
        {
            var headers = context.HttpContext?.Request.Headers;
            if (headers is null || !headers.TryGetValue(HeaderName, out var values) || values.Count != 1)
                return new(DemoProfileKind.Missing);
            var value = values[0];
            if (value == "admin") return new(DemoProfileKind.Administrator);
            return Guid.TryParse(value, out var personId)
                ? new(DemoProfileKind.Member, personId)
                : new(DemoProfileKind.Invalid);
        }
    }
}
