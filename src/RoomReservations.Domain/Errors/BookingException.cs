namespace RoomReservations.Domain;

/// <summary>Boundary adapter for a typed, expected booking failure; never carries an HTTP status.</summary>
public sealed class BookingException(string code, string message, BookingErrorKind kind = BookingErrorKind.Validation)
    : Exception(message)
{
    public BookingError Error { get; } = new(code, message, kind);
    public string Code => Error.Code;
    public BookingErrorKind Kind => Error.Kind;
}
