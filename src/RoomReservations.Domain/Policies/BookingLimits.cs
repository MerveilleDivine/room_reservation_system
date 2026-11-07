namespace RoomReservations.Domain;

public sealed record BookingLimits(int MaximumDurationDays = 7, int MaximumAdvanceDays = 90)
{
    public const int MaximumTitleLength = 120;
}
