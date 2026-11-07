using RoomReservations.Domain;

namespace RoomReservations.Api.Api;

internal static class BookingProtocol
{
    internal const string IdempotencyHeader = "Idempotency-Key";

    internal static Guid? SubmissionKey(HttpRequest request)
    {
        if (!request.Headers.TryGetValue(IdempotencyHeader, out var values)) return null;
        if (values.Count != 1 || !Guid.TryParse(values[0], out var key) || key == Guid.Empty)
            throw new BookingException(ApiErrorCodes.InvalidRequestId, "Idempotency-Key must contain a single, non-empty UUID.");
        return key;
    }
}
