using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Application;

// Selectable sample identities model ownership without introducing account authentication.
public sealed class BookingProfile(IHttpContextAccessor context)
{
    public async Task RequireAccessAsync(ReservationsDbContext db, Guid organizerId, CancellationToken cancellationToken)
    {
        var headers = context.HttpContext?.Request.Headers;
        if (headers is null || !headers.TryGetValue("X-Roomwise-Profile", out var values) || values.Count != 1)
            throw new BookingException("PROFILE_REQUIRED", "Choose a profile before making changes.");
        var value = values[0];
        if (value == "admin") return;
        if (!Guid.TryParse(value, out var personId) ||
            !await db.People.AsNoTracking().AnyAsync(person => person.Id == personId, cancellationToken))
            throw new BookingException("INVALID_PROFILE", "Choose an available profile.");
        if (personId != organizerId)
            throw new BookingException("BOOKING_ACCESS_DENIED", "You can only manage your own reservations.", 403);
    }
}
