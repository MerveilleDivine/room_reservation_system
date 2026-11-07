using RoomReservations.Domain;

namespace RoomReservations.Api.Tests;

public sealed class ReservationLifecycleTests
{
    [Theory]
    [InlineData(-1)]
    [InlineData(int.MaxValue)]
    public void Unknown_lifecycle_action_is_a_validation_error_and_does_not_mutate_the_booking(int action)
    {
        // Arrange
        var now = TestApplication.Now;
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            Title = "Planning",
            StartUtc = now.AddHours(1),
            EndUtc = now.AddHours(2)
        };

        // Act
        var exception = Assert.Throws<BookingException>(() => reservation.Transition((ReservationAction)action, now));

        // Assert
        Assert.Multiple(
            () => Assert.Equal("INVALID_ACTION", exception.Code),
            () => Assert.Equal(BookingErrorKind.Validation, exception.Kind),
            () => Assert.Equal(exception.Code, exception.Error.Code),
            () => Assert.Equal(exception.Message, exception.Error.Message),
            () => Assert.Equal(BookingErrorKind.Validation, exception.Error.Kind),
            () => Assert.Equal(ReservationStatus.Booked, reservation.Status),
            () => Assert.Null(reservation.CheckedInAtUtc),
            () => Assert.Null(reservation.ActualEndUtc));
    }
}
