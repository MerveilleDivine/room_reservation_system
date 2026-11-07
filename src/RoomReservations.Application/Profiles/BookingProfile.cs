using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Application;

/// <summary>Ownership rules for synthetic demo identities; this is not authentication.</summary>
public sealed class BookingProfile(ICurrentDemoProfile current, IReservationReadStore store)
{
    public bool IsAdministrator => current.Selection.Kind == DemoProfileKind.Administrator;

    public async Task RequireAccessAsync(Guid organizerId, CancellationToken cancellationToken)
    {
        var personId = await ScopeOrganizerAsync(organizerId, cancellationToken);
        if (personId is not null && personId != organizerId)
            throw new BookingException(BookingErrorCodes.BookingAccessDenied, "You can only manage your own reservations.", BookingErrorKind.Forbidden);
    }

    public async Task<Guid?> ScopeOrganizerAsync(Guid? requestedOrganizer, CancellationToken cancellationToken)
    {
        var selection = current.Selection;
        if (selection.Kind == DemoProfileKind.Missing)
            throw new BookingException(BookingErrorCodes.ProfileRequired, "Choose a profile before making changes.");
        if (selection.Kind == DemoProfileKind.Administrator) return requestedOrganizer;
        if (selection.Kind != DemoProfileKind.Member || selection.PersonId is not Guid personId ||
            !(await store.ReadPeopleAsync(cancellationToken)).Any(person => person.Id == personId))
            throw new BookingException(BookingErrorCodes.InvalidProfile, "Choose an available profile.");
        if (requestedOrganizer is not null && personId != requestedOrganizer)
            throw new BookingException(BookingErrorCodes.BookingAccessDenied, "You can only view and manage your own reservations.", BookingErrorKind.Forbidden);
        return personId;
    }

    public void RequireAdministrator()
    {
        if (!IsAdministrator)
            throw new BookingException(BookingErrorCodes.AdminRequired, "This view is available to the administrator.", BookingErrorKind.Forbidden);
    }
}
