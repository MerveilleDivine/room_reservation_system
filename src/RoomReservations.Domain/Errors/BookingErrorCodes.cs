namespace RoomReservations.Domain;

/// <summary>Stable error identifiers shared with API clients.</summary>
public static class BookingErrorCodes
{
    public const string AdminRequired = "ADMIN_REQUIRED";
    public const string AdvanceWindowExceeded = "ADVANCE_WINDOW_EXCEEDED";
    public const string AlreadyCheckedIn = "ALREADY_CHECKED_IN";
    public const string BookingAccessDenied = "BOOKING_ACCESS_DENIED";
    public const string BookingRequestNotFound = "BOOKING_REQUEST_NOT_FOUND";
    public const string CapacityExceeded = "CAPACITY_EXCEEDED";
    public const string ContinuationAlreadyBooked = "CONTINUATION_ALREADY_BOOKED";
    public const string DurationExceeded = "DURATION_EXCEEDED";
    public const string IdempotencyKeyReused = "IDEMPOTENCY_KEY_REUSED";
    public const string InvalidAction = "INVALID_ACTION";
    public const string InvalidAdditionalTime = "INVALID_ADDITIONAL_TIME";
    public const string InvalidAttendees = "INVALID_ATTENDEES";
    public const string InvalidCapacityFilter = "INVALID_CAPACITY_FILTER";
    public const string InvalidDateFilter = "INVALID_DATE_FILTER";
    public const string InvalidEquipment = "INVALID_EQUIPMENT";
    public const string InvalidPagination = "INVALID_PAGINATION";
    public const string InvalidProfile = "INVALID_PROFILE";
    public const string InvalidReportRange = "INVALID_REPORT_RANGE";
    public const string InvalidReservationView = "INVALID_RESERVATION_VIEW";
    public const string InvalidStatus = "INVALID_STATUS";
    public const string InvalidTimeRange = "INVALID_TIME_RANGE";
    public const string InvalidTitle = "INVALID_TITLE";
    public const string MeetingAlreadyStarted = "MEETING_ALREADY_STARTED";
    public const string MeetingNotOngoing = "MEETING_NOT_ONGOING";
    public const string MeetingNotStarted = "MEETING_NOT_STARTED";
    public const string OrganizerNotFound = "ORGANIZER_NOT_FOUND";
    public const string OrganizerOverlap = "ORGANIZER_OVERLAP";
    public const string ProfileRequired = "PROFILE_REQUIRED";
    public const string ReportRangeExceeded = "REPORT_RANGE_EXCEEDED";
    public const string ReservationNotActive = "RESERVATION_NOT_ACTIVE";
    public const string ReservationNotEditable = "RESERVATION_NOT_EDITABLE";
    public const string ReservationNotFound = "RESERVATION_NOT_FOUND";
    public const string RoomInactive = "ROOM_INACTIVE";
    public const string RoomNotFound = "ROOM_NOT_FOUND";
    public const string RoomOverlap = "ROOM_OVERLAP";
    public const string StartNotFuture = "START_NOT_FUTURE";
}
