using RoomReservations.Api.Application;
using RoomReservations.Api.Domain;

namespace RoomReservations.Api.Tests;

public sealed class UsageReportTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);
    private static readonly Room Room = new() { Id = Guid.NewGuid(), Name = "Atlas", Floor = "1", Capacity = 12 };

    private static Reservation Meeting(int start = -60, int end = 0, int? checkIn = null, int? actualEnd = null) => new()
    {
        Id = Guid.NewGuid(), RoomId = Room.Id, OrganizerId = Guid.NewGuid(), Title = "Meeting",
        StartUtc = Now.AddMinutes(start), EndUtc = Now.AddMinutes(end),
        CheckedInAtUtc = checkIn is null ? null : Now.AddMinutes(checkIn.Value),
        ActualEndUtc = actualEnd is null ? null : Now.AddMinutes(actualEnd.Value), Attendees = 2,
        Status = actualEnd is null ? ReservationStatus.Booked : ReservationStatus.Completed
    };

    private static RoomUsageDto Row(params Reservation[] reservations) =>
        Assert.Single(UsageReportBuilder.Build([Room], reservations, Now.AddHours(-2), Now.AddHours(1), Now).Rooms);

    [Fact]
    public void Late_check_in_is_observed_only_from_check_in()
    {
        var row = Row(Meeting(checkIn: -40));
        Assert.Equal(60, row.ScheduledMinutes);
        Assert.Equal(40, row.ObservedMinutes);
        Assert.Equal(20, row.UnconfirmedMinutes);
        Assert.Equal(66.7, row.ConfirmedSharePercent);
    }

    [Fact]
    public void Ongoing_observation_stops_at_the_snapshot_clock()
    {
        var row = Row(Meeting(start: -30, end: 30, checkIn: -5));
        Assert.Equal(60, row.ScheduledMinutes);
        Assert.Equal(30, row.ElapsedReservedMinutes);
        Assert.Equal(5, row.ObservedMinutes);
        Assert.Equal(25, row.UnconfirmedMinutes);
    }

    [Fact]
    public void Both_sides_of_the_report_window_are_clamped()
    {
        var meeting = Meeting(start: -180, end: 60, checkIn: -150, actualEnd: -30);
        var row = Assert.Single(UsageReportBuilder.Build([Room], [meeting], Now.AddHours(-2), Now, Now).Rooms);
        Assert.Equal(120, row.ScheduledMinutes);
        Assert.Equal(90, row.ElapsedReservedMinutes);
        Assert.Equal(90, row.ObservedMinutes);
        Assert.Equal(30, row.ReleasedMinutes);
    }

    [Fact]
    public void Cancelled_bookings_contribute_nothing()
    {
        var meeting = Meeting(checkIn: -50);
        meeting.Status = ReservationStatus.Cancelled;
        var row = Row(meeting);
        Assert.Equal(0, row.ReservationCount);
        Assert.Equal(0, row.ScheduledMinutes);
        Assert.Equal(0, row.ObservedMinutes);
        Assert.Null(row.ConfirmedSharePercent);
    }

    [Fact]
    public void Unchecked_completed_bookings_are_unconfirmed()
    {
        var row = Row(Meeting());
        Assert.Equal(1, row.UnconfirmedCompletedCount);
        Assert.Equal(60, row.UnconfirmedMinutes);
        Assert.Equal(0, row.ObservedMinutes);
        Assert.Equal(0, row.ConfirmedSharePercent);
    }

    [Fact]
    public void Future_bookings_do_not_become_elapsed_or_observed()
    {
        var row = Row(Meeting(start: 15, end: 60));
        Assert.Equal(45, row.ScheduledMinutes);
        Assert.Equal(0, row.ElapsedReservedMinutes);
        Assert.Equal(0, row.UnconfirmedCompletedCount);
        Assert.Null(row.ConfirmedSharePercent);
    }

    [Fact]
    public void Early_completion_records_time_released()
    {
        var row = Row(Meeting(checkIn: -60, actualEnd: -30));
        Assert.Equal(60, row.ScheduledMinutes);
        Assert.Equal(30, row.ElapsedReservedMinutes);
        Assert.Equal(30, row.ObservedMinutes);
        Assert.Equal(30, row.ReleasedMinutes);
        Assert.Equal(100, row.ConfirmedSharePercent);
    }

    [Fact]
    public void Rebooking_released_time_does_not_double_count_room_minutes()
    {
        var row = Row(Meeting(checkIn: -60, actualEnd: -30), Meeting(start: -30, checkIn: -30));
        Assert.Equal(2, row.ReservationCount);
        Assert.Equal(60, row.ScheduledMinutes);
        Assert.Equal(60, row.ElapsedReservedMinutes);
        Assert.Equal(60, row.ObservedMinutes);
        Assert.Equal(0, row.ReleasedMinutes);
    }

    [Fact]
    public void Overlapping_observation_intervals_are_merged()
    {
        var row = Row(Meeting(start: -90, end: -20, checkIn: -80), Meeting(start: -60, end: 0, checkIn: -50));
        Assert.Equal(90, row.ScheduledMinutes);
        Assert.Equal(80, row.ObservedMinutes);
        Assert.Equal(10, row.UnconfirmedMinutes);
    }

    [Fact]
    public void Bookings_ending_exactly_at_window_start_are_excluded()
    {
        var row = Row(Meeting(start: -180, end: -120));
        Assert.Equal(0, row.ReservationCount);
    }

    [Fact]
    public void Inactive_rooms_remain_visible_in_historical_reports()
    {
        var inactive = new Room { Id = Room.Id, Name = Room.Name, Floor = "1", Capacity = 12, IsActive = false };
        var row = Assert.Single(UsageReportBuilder.Build([inactive], [Meeting()], Now.AddHours(-2), Now, Now).Rooms);
        Assert.False(row.IsActive);
        Assert.Equal(60, row.ScheduledMinutes);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Report_end_must_follow_start(int minutes)
    {
        var exception = Assert.Throws<BookingException>(() => UsageReportBuilder.Build([Room], [], Now, Now.AddMinutes(minutes), Now));
        Assert.Equal("INVALID_REPORT_RANGE", exception.Code);
    }

    [Fact]
    public void Exactly_maximum_report_range_is_allowed() =>
        UsageReportBuilder.Build([Room], [], Now.AddDays(-UsageReportBuilder.MaximumRangeDays), Now, Now);

    [Fact]
    public void Excessive_report_range_is_rejected()
    {
        var exception = Assert.Throws<BookingException>(() => UsageReportBuilder.Build(
            [Room], [], Now.AddDays(-UsageReportBuilder.MaximumRangeDays).AddTicks(-1), Now, Now));
        Assert.Equal("REPORT_RANGE_EXCEEDED", exception.Code);
    }
}
