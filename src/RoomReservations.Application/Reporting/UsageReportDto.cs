namespace RoomReservations.Application;

public sealed record UsageReportDto(
    DateTimeOffset FromUtc, DateTimeOffset ToUtc, DateTimeOffset AsOfUtc,
    string MeasurementSource, string ObservationNote, RoomUsageDto[] Rooms);
