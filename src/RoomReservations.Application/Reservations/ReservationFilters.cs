using RoomReservations.Domain;

namespace RoomReservations.Application;

internal static class ReservationFilters
{
    internal static void ValidateRange(DateTimeOffset? from, DateTimeOffset? to)
    {
        if (from is not null && to is not null && from >= to)
            throw new BookingException(BookingErrorCodes.InvalidDateFilter, "The date range end must be after its start.");
    }

    internal static ReservationStatus? ParseStatus(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!Enum.TryParse<ReservationStatus>(value, true, out var status) || !Enum.IsDefined(status))
            throw new BookingException(BookingErrorCodes.InvalidStatus, "Choose Booked, Completed or Cancelled.");
        return status;
    }
}
