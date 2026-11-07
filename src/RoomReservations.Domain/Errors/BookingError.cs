namespace RoomReservations.Domain;

public sealed record BookingError(string Code, string Message, BookingErrorKind Kind);
