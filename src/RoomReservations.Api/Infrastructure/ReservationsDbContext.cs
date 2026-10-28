using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RoomReservations.Api.Domain;

namespace RoomReservations.Api.Infrastructure;

public sealed class ReservationsDbContext(DbContextOptions<ReservationsDbContext> options)
    : DbContext(options)
{
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<BookingSubmission> BookingSubmissions => Set<BookingSubmission>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Reservation>().Ignore(r => r.EffectiveEndUtc);
        modelBuilder.Entity<Reservation>().HasOne(r => r.Room).WithMany().HasForeignKey(r => r.RoomId);
        modelBuilder.Entity<Reservation>().HasOne(r => r.Organizer).WithMany().HasForeignKey(r => r.OrganizerId);
        modelBuilder.Entity<Reservation>().Property(r => r.Title).HasMaxLength(120);
    }
}

/// <summary>Serializes booking decisions locally and, when hosted, across database clients.</summary>
public sealed class BookingWriteGate : IDisposable
{
    public SemaphoreSlim Semaphore { get; } = new(1, 1);
    public async Task<BookingLease> AcquireAsync(ReservationsDbContext db, CancellationToken cancellationToken)
    {
        await Semaphore.WaitAsync(cancellationToken);
        IDbContextTransaction? transaction = null;
        try
        {
            if (db.Database.IsNpgsql())
            {
                transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                // The schema scopes the lock to this workspace/environment. Read committed
                // sees the previous holder's committed bookings after the lock is acquired.
                await db.Database.ExecuteSqlRawAsync(
                    "SELECT pg_advisory_xact_lock(hashtextextended(current_schema(), 782536))", cancellationToken);
            }
            return new BookingLease(Semaphore, transaction);
        }
        catch
        {
            if (transaction is not null) await transaction.DisposeAsync();
            Semaphore.Release();
            throw;
        }
    }
    public void Dispose() => Semaphore.Dispose();
}

public sealed class BookingLease(SemaphoreSlim semaphore, IDbContextTransaction? transaction) : IAsyncDisposable
{
    public Task CommitAsync(CancellationToken cancellationToken) =>
        transaction?.CommitAsync(cancellationToken) ?? Task.CompletedTask;
    public async ValueTask DisposeAsync()
    {
        try { if (transaction is not null) await transaction.DisposeAsync(); }
        finally { semaphore.Release(); }
    }
}
