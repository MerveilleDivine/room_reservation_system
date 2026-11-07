namespace RoomReservations.Application;

public sealed record ReservationFeedDto(ReservationDto[] Items, int TotalCount, int Page, int PageSize);
