using Microsoft.Extensions.Options;
using RoomReservations.Api.Api;
using RoomReservations.Api.Api.Routing;
using RoomReservations.Api.Profiles;
using RoomReservations.Application.Abstractions;
using RoomReservations.Application;
using RoomReservations.Domain;
using RoomReservations.Infrastructure;

namespace RoomReservations.Api;

internal static class DependencyInjection
{
    internal static IServiceCollection AddRoomReservations(this IServiceCollection services)
    {
        services.Configure<Microsoft.AspNetCore.Routing.RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
        services.Configure<RouteOptions>(options => options.ConstraintMap["spa"] = typeof(SpaRouteConstraint));
        services.AddProblemDetails();
        services.AddExceptionHandler<ApiExceptionHandler>();
        services.AddOptions<BookingOptions>()
            .BindConfiguration(BookingOptions.SectionName)
            .Validate(options => options.MaximumDurationDays is > 0 and <= 365, "Duration must be between 1 and 365 days.")
            .Validate(options => options.MaximumAdvanceDays is > 0 and <= 3650, "Advance window must be between 1 and 3650 days.")
            .ValidateOnStart();
        services.AddRoomReservationsInfrastructure();
        services.AddSingleton(TimeProvider.System);
        services.AddScoped(provider =>
        {
            var options = provider.GetRequiredService<IOptions<BookingOptions>>().Value;
            return new BookingRules(new BookingLimits(options.MaximumDurationDays, options.MaximumAdvanceDays));
        });
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentDemoProfile, HttpDemoProfile>();
        services.AddScoped<BookingProfile>();
        services.AddScoped<ReservationService>();
        services.AddScoped<ReservationReadService>();
        services.AddScoped<RoomCatalogService>();
        services.AddScoped<PeopleService>();
        services.AddScoped<UsageReportService>();
        services.AddScoped<ReservationFeedService>();
        services.AddScoped<RoomAvailabilityService>();
        services.AddScoped<ExtraTimeService>();
        return services;
    }
}
