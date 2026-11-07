using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RoomReservations.Application.Abstractions;

namespace RoomReservations.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddRoomReservationsInfrastructure(this IServiceCollection services)
    {
        services.AddDbContext<ReservationsDbContext>(options => options.UseInMemoryDatabase("room-reservations"));
        services.AddSingleton<IBookingGate, BookingWriteGate>();
        services.AddScoped<EfBookingStore>();
        services.AddScoped<IBookingStore>(provider => provider.GetRequiredService<EfBookingStore>());
        services.AddScoped<IReservationReadStore>(provider => provider.GetRequiredService<EfBookingStore>());
        return services;
    }

    public static async Task SeedRoomReservationsAsync(this IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        await SeedData.InitializeAsync(scope.ServiceProvider.GetRequiredService<ReservationsDbContext>(),
            scope.ServiceProvider.GetRequiredService<TimeProvider>());
    }
}
