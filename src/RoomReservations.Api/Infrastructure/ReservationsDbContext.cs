using Microsoft.EntityFrameworkCore;
using RoomReservations.Api.Domain;

namespace RoomReservations.Api.Infrastructure;

public sealed class ReservationsDbContext(DbContextOptions<ReservationsDbContext> options)
    : DbContext(options)
{
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<Reservation> Reservations => Set<Reservation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Reservation>().Ignore(r => r.EffectiveEndUtc);
        modelBuilder.Entity<Reservation>().HasOne(r => r.Room).WithMany().HasForeignKey(r => r.RoomId);
        modelBuilder.Entity<Reservation>().HasOne(r => r.Organizer).WithMany().HasForeignKey(r => r.OrganizerId);
        modelBuilder.Entity<Reservation>().Property(r => r.Title).HasMaxLength(120);
    }
}

/// <summary>Serializes validate + save in one API process. This is not a distributed lock.</summary>
public sealed class BookingWriteGate : IDisposable
{
    public SemaphoreSlim Semaphore { get; } = new(1, 1);
    public void Dispose() => Semaphore.Dispose();
}
