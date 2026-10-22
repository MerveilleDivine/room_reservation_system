using Microsoft.Extensions.Options;
using RoomReservations.Api.Application;
using RoomReservations.Api.Domain;

namespace RoomReservations.Api.Tests;

public sealed class BookingRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid RoomId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid OrganizerId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static Room Room => new() { Id = RoomId, Name = "Atlas", Capacity = 10, Floor = "1" };
    private static BookingRequest Valid => new(RoomId, OrganizerId, "Planning", Now.AddDays(1), Now.AddDays(1).AddHours(1), 4);
    private static BookingRules Rules(int duration = 7, int advance = 90) =>
        new(Options.Create(new BookingOptions { MaximumDurationDays = duration, MaximumAdvanceDays = advance }));

    private static void AssertCode(string code, BookingRequest request, Room? room = null, Reservation[]? existing = null)
    {
        var exception = Assert.Throws<BookingException>(() => Rules().Validate(request, room ?? Room, existing ?? [], Now));
        Assert.Equal(code, exception.Code);
        Assert.False(string.IsNullOrWhiteSpace(exception.Message));
    }

    [Fact]
    public void Valid_booking_is_accepted() => Rules().Validate(Valid, Room, [], Now);

    [Fact]
    public void Exactly_seven_days_is_allowed() =>
        Rules().Validate(Valid with { EndUtc = Valid.StartUtc.AddDays(7) }, Room, [], Now);

    [Fact]
    public void One_tick_over_duration_limit_is_rejected() =>
        AssertCode("DURATION_EXCEEDED", Valid with { EndUtc = Valid.StartUtc.AddDays(7).AddTicks(1) });

    [Fact]
    public void Exactly_ninety_days_ahead_is_allowed() =>
        Rules().Validate(Valid with { StartUtc = Now.AddDays(90), EndUtc = Now.AddDays(90).AddHours(1) }, Room, [], Now);

    [Fact]
    public void One_tick_beyond_advance_window_is_rejected() =>
        AssertCode("ADVANCE_WINDOW_EXCEEDED", Valid with { StartUtc = Now.AddDays(90).AddTicks(1), EndUtc = Now.AddDays(90).AddHours(1) });

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Start_must_be_strictly_in_future(int seconds) =>
        AssertCode("START_NOT_FUTURE", Valid with { StartUtc = Now.AddSeconds(seconds) });

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void End_must_be_after_start(int minutes) =>
        AssertCode("INVALID_TIME_RANGE", Valid with { EndUtc = Valid.StartUtc.AddMinutes(minutes) });

    [Theory]
    [InlineData(0)]
    [InlineData(-4)]
    public void Attendees_must_be_positive(int count) => AssertCode("INVALID_ATTENDEES", Valid with { Attendees = count });

    [Fact]
    public void Exact_room_capacity_is_allowed() => Rules().Validate(Valid with { Attendees = 10 }, Room, [], Now);

    [Fact]
    public void Attendees_over_capacity_are_rejected() => AssertCode("CAPACITY_EXCEEDED", Valid with { Attendees = 11 });

    [Fact]
    public void Inactive_room_is_rejected()
    {
        var room = Room;
        room.IsActive = false;
        AssertCode("ROOM_INACTIVE", Valid, room);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Blank_title_is_rejected(string? title) => AssertCode("INVALID_TITLE", Valid with { Title = title });

    [Fact]
    public void Overlong_title_is_rejected() => AssertCode("INVALID_TITLE", Valid with { Title = new string('x', 121) });

    [Theory]
    [InlineData(-60, 0, false)]
    [InlineData(60, 120, false)]
    [InlineData(-30, 30, true)]
    [InlineData(30, 90, true)]
    [InlineData(-60, 120, true)]
    [InlineData(15, 30, true)]
    [InlineData(0, 60, true)]
    public void Half_open_intervals_handle_every_overlap_shape(int startMinutes, int endMinutes, bool overlaps)
    {
        var existing = Existing(startMinutes, endMinutes);
        if (overlaps) AssertCode("ROOM_OVERLAP", Valid, existing: [existing]);
        else Rules().Validate(Valid, Room, [existing], Now);
    }

    [Fact]
    public void Same_organizer_cannot_overlap_in_different_rooms()
    {
        var existing = Existing(0, 60);
        existing.RoomId = Guid.NewGuid();
        existing.OrganizerId = OrganizerId;
        AssertCode("ORGANIZER_OVERLAP", Valid, existing: [existing]);
    }

    [Fact]
    public void Cancelled_reservations_do_not_block()
    {
        var existing = Existing(0, 60);
        existing.Status = ReservationStatus.Cancelled;
        Rules().Validate(Valid, Room, [existing], Now);
    }

    [Fact]
    public void Edited_reservation_does_not_conflict_with_itself()
    {
        var existing = Existing(0, 60);
        Rules().Validate(Valid, Room, [existing], Now, existing.Id);
    }

    [Fact]
    public void Early_completion_releases_originally_reserved_time()
    {
        var existing = Existing(-60, 60);
        existing.Status = ReservationStatus.Completed;
        existing.ActualEndUtc = Valid.StartUtc;
        Rules().Validate(Valid, Room, [existing], Now);
    }

    [Fact]
    public void Limits_are_read_from_configuration()
    {
        var exception = Assert.Throws<BookingException>(() => Rules(duration: 1).Validate(
            Valid with { EndUtc = Valid.StartUtc.AddDays(2) }, Room, [], Now));
        Assert.Equal("DURATION_EXCEEDED", exception.Code);
        exception = Assert.Throws<BookingException>(() => Rules(advance: 2).Validate(
            Valid with { StartUtc = Now.AddDays(3), EndUtc = Now.AddDays(3).AddHours(1) }, Room, [], Now));
        Assert.Equal("ADVANCE_WINDOW_EXCEEDED", exception.Code);
    }

    [Fact]
    public void Different_offsets_are_compared_as_instants()
    {
        var existing = Existing(0, 60);
        var request = Valid with { StartUtc = Valid.StartUtc.ToOffset(TimeSpan.FromHours(3)), EndUtc = Valid.EndUtc.ToOffset(TimeSpan.FromHours(3)) };
        AssertCode("ROOM_OVERLAP", request, existing: [existing]);
    }

    private static Reservation Existing(int startMinutes, int endMinutes) => new()
    {
        Id = Guid.NewGuid(), RoomId = RoomId, OrganizerId = Guid.NewGuid(), Title = "Existing meeting",
        StartUtc = Valid.StartUtc.AddMinutes(startMinutes), EndUtc = Valid.StartUtc.AddMinutes(endMinutes), Attendees = 3
    };
}
