using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Application;

public sealed class PeopleService(IReservationReadStore store, TimeProvider clock,
    IBookingGate gate, BookingProfile profile)
{
    public async Task<PersonDto[]> ReadAsync(CancellationToken cancellationToken)
    {
        using var lease = await gate.EnterAsync(cancellationToken);
        var now = clock.GetUtcNow();
        var people = await store.ReadPeopleAsync(cancellationToken);
        var reservations = profile.IsAdministrator ? await store.ReadReservationsAsync(cancellationToken) : [];
        return people.OrderBy(person => person.FirstName).Select(person => new PersonDto(person.Id,
            person.FirstName, person.LastName, reservations.Count(reservation =>
                reservation.OrganizerId == person.Id && reservation.StatusAt(now) == ReservationStatus.Booked))).ToArray();
    }
}
