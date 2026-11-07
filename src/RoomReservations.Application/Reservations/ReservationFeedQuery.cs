namespace RoomReservations.Application;

public sealed record ReservationFeedQuery(
    string? View = null, Guid? RoomId = null, Guid? OrganizerId = null, string? Status = null,
    DateTimeOffset? From = null, DateTimeOffset? To = null, int Page = 1, int PageSize = ReservationFeedQuery.DefaultPageSize, Guid? FocusId = null)
{
    public const int DefaultPageSize = 6;
    public const int MaximumPageSize = 50;
}
