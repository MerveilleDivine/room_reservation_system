using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Application;

// Selectable sample identities model ownership without introducing account authentication.
public sealed class BookingProfile(IHttpContextAccessor context)
{
    public async Task RequireAccessAsync(ReservationsDbContext db, Guid organizerId, CancellationToken cancellationToken)
    {
        var personId = await ScopeOrganizerAsync(db, organizerId, cancellationToken);
        if (personId is not null && personId != organizerId)
            throw new BookingException("BOOKING_ACCESS_DENIED", "You can only manage your own reservations.", 403);
    }

    public async Task<Guid?> ScopeOrganizerAsync(ReservationsDbContext db, Guid? requestedOrganizer, CancellationToken cancellationToken)
    {
        var headers = context.HttpContext?.Request.Headers;
        if (headers is null || !headers.TryGetValue("X-Roomwise-Profile", out var values) || values.Count != 1)
            throw new BookingException("PROFILE_REQUIRED", "Choose a profile before making changes.");
        var value = values[0];
        if (value == "admin") return requestedOrganizer;
        if (!Guid.TryParse(value, out var personId) ||
            !await db.People.AsNoTracking().AnyAsync(person => person.Id == personId, cancellationToken))
            throw new BookingException("INVALID_PROFILE", "Choose an available profile.");
        if (requestedOrganizer is not null && personId != requestedOrganizer)
            throw new BookingException("BOOKING_ACCESS_DENIED", "You can only view and manage your own reservations.", 403);
        return personId;
    }

    public void RequireAdministrator()
    {
        if (context.HttpContext?.Request.Headers["X-Roomwise-Profile"].ToString() != "admin")
            throw new BookingException("ADMIN_REQUIRED", "This view is available to the administrator.", 403);
    }
}
