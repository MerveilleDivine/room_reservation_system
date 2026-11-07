using Microsoft.EntityFrameworkCore;
using RoomReservations.Application.Abstractions;
using RoomReservations.Domain;

namespace RoomReservations.Infrastructure;

public sealed class EfBookingStore(ReservationsDbContext db) : IBookingStore
{
    public Task<Room[]> ReadRoomsAsync(CancellationToken cancellationToken) =>
        db.Rooms.AsNoTracking().ToArrayAsync(cancellationToken);

    public Task<Person[]> ReadPeopleAsync(CancellationToken cancellationToken) =>
        db.People.AsNoTracking().ToArrayAsync(cancellationToken);

    public Task<Reservation[]> ReadReservationsAsync(CancellationToken cancellationToken) =>
        db.Reservations.AsNoTracking().Include(reservation => reservation.Room)
            .Include(reservation => reservation.Organizer).ToArrayAsync(cancellationToken);

    public async Task<Room?> FindRoomAsync(Guid id, CancellationToken cancellationToken) =>
        await db.Rooms.FindAsync([id], cancellationToken);

    public async Task<Person?> FindPersonAsync(Guid id, CancellationToken cancellationToken) =>
        await db.People.FindAsync([id], cancellationToken);

    public Task<Reservation?> FindReservationAsync(Guid id, CancellationToken cancellationToken) =>
        db.Reservations.Include(reservation => reservation.Room).Include(reservation => reservation.Organizer)
            .SingleOrDefaultAsync(reservation => reservation.Id == id, cancellationToken);

    public async Task<BookingSubmission?> FindSubmissionAsync(Guid id, CancellationToken cancellationToken) =>
        await db.BookingSubmissions.FindAsync([id], cancellationToken);

    public void AddReservation(Reservation reservation) => db.Reservations.Add(reservation);
    public void AddSubmission(BookingSubmission submission) => db.BookingSubmissions.Add(submission);
    public async Task SaveChangesAsync(CancellationToken cancellationToken) => await db.SaveChangesAsync(cancellationToken);
}
