using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Domain;
using RoomReservations.Api.Infrastructure;

namespace RoomReservations.Api.Application;

public sealed class ReservationService(
    ReservationsDbContext db, BookingRules rules, TimeProvider clock, BookingWriteGate gate)
{
    public async Task<ReservationDto> SaveAsync(
        BookingRequest request, Guid? id, CancellationToken cancellationToken)
    {
        await gate.Semaphore.WaitAsync(cancellationToken);
        try
        {
            var now = clock.GetUtcNow();
            Reservation? existing = null;
            if (id is not null)
            {
                existing = await FindAsync(id.Value, cancellationToken);
                if (existing.StatusAt(now) != ReservationStatus.Booked || existing.StartUtc <= now)
                    throw new BookingException("RESERVATION_NOT_EDITABLE", "Only future, booked reservations can be edited.", 409);
            }

            var room = await db.Rooms.FindAsync([request.RoomId], cancellationToken)
                ?? throw new BookingException("ROOM_NOT_FOUND", "Choose an existing room.", 404);
            var person = await db.People.FindAsync([request.OrganizerId], cancellationToken)
                ?? throw new BookingException("ORGANIZER_NOT_FOUND", "Choose an existing organizer.", 404);
            var reservations = await db.Reservations.AsNoTracking().ToListAsync(cancellationToken);
            rules.Validate(request, room, reservations, now, id);

            var reservation = existing ?? new Reservation { Id = Guid.NewGuid(), Title = "" };
            reservation.RoomId = room.Id;
            reservation.Room = room;
            reservation.OrganizerId = person.Id;
            reservation.Organizer = person;
            reservation.Title = request.Title!.Trim();
            reservation.StartUtc = request.StartUtc.ToUniversalTime();
            reservation.EndUtc = request.EndUtc.ToUniversalTime();
            reservation.Attendees = request.Attendees;
            if (existing is null) db.Reservations.Add(reservation);
            await db.SaveChangesAsync(cancellationToken);
            return reservation.ToDto(now);
        }
        finally { gate.Semaphore.Release(); }
    }

    public async Task<ReservationDto> TransitionAsync(
        Guid id, string action, CancellationToken cancellationToken)
    {
        await gate.Semaphore.WaitAsync(cancellationToken);
        try
        {
            var reservation = await FindAsync(id, cancellationToken);
            var now = clock.GetUtcNow();
            if (reservation.StatusAt(now) != ReservationStatus.Booked)
                throw new BookingException("RESERVATION_NOT_ACTIVE", "This reservation is no longer active.", 409);

            switch (action)
            {
                case "cancel":
                    if (reservation.StartUtc <= now)
                        throw new BookingException("MEETING_ALREADY_STARTED", "End a started meeting instead of cancelling it.", 409);
                    reservation.Status = ReservationStatus.Cancelled;
                    break;
                case "check-in":
                    if (reservation.StartUtc > now)
                        throw new BookingException("MEETING_NOT_STARTED", "Check in when the meeting starts.", 409);
                    if (reservation.CheckedInAtUtc is not null)
                        throw new BookingException("ALREADY_CHECKED_IN", "This meeting is already checked in.", 409);
                    reservation.CheckedInAtUtc = now;
                    break;
                case "end":
                    if (reservation.StartUtc > now)
                        throw new BookingException("MEETING_NOT_STARTED", "A future meeting cannot be ended early.", 409);
                    reservation.ActualEndUtc = now;
                    reservation.Status = ReservationStatus.Completed;
                    break;
                default:
                    throw new BookingException("INVALID_ACTION", "Unknown reservation action.");
            }

            await db.SaveChangesAsync(cancellationToken);
            return reservation.ToDto(now);
        }
        finally { gate.Semaphore.Release(); }
    }

    private async Task<Reservation> FindAsync(Guid id, CancellationToken cancellationToken) =>
        await db.Reservations.Include(r => r.Room).Include(r => r.Organizer)
            .SingleOrDefaultAsync(r => r.Id == id, cancellationToken)
        ?? throw new BookingException("RESERVATION_NOT_FOUND", "This reservation could not be found.", 404);
}
