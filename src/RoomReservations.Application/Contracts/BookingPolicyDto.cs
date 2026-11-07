namespace RoomReservations.Application;

public sealed record BookingPolicyDto(int MaximumDurationDays, int MaximumAdvanceDays);
