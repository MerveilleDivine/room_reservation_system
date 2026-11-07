namespace RoomReservations.Application;

public sealed record RoomUsageDto(
    Guid RoomId, string RoomName, string Floor, bool IsActive, int ReservationCount,
    double ScheduledMinutes, double ElapsedReservedMinutes, double ObservedMinutes,
    double UnconfirmedMinutes, double ReleasedMinutes, int UnconfirmedCompletedCount,
    double? ConfirmedSharePercent);
