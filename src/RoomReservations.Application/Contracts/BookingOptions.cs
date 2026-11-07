namespace RoomReservations.Application;

public sealed class BookingOptions
{
    public const string SectionName = "BookingRules";
    public int MaximumDurationDays { get; set; } = 7;
    public int MaximumAdvanceDays { get; set; } = 90;
}
