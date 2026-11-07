namespace RoomReservations.Api.Api.Routing;

/// <summary>Keeps API route and method matching independent from the frontend fallback.</summary>
public sealed class SpaRouteConstraint : IRouteConstraint
{
    public bool Match(HttpContext? httpContext, IRouter? route, string routeKey,
        RouteValueDictionary values, RouteDirection routeDirection) =>
        httpContext is not null && !httpContext.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase);
}
