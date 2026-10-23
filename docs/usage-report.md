# Room usage

The Usage page reads `GET /api/usage`. Calculations run in ASP.NET. React displays the returned values and converts the report's date inputs from device-local time to UTC.

## Observation source

The assignment does not provide sensors or an attendance feed. This implementation uses manual check-in to estimate reported use. The estimate starts when someone checks in and ends at the earlier of the effective meeting end or the report snapshot. It does not establish continuous presence, actual departure or a meeting overrun. Missing check-in is unconfirmed time; it does not establish that a room was empty or that the organizer was a no-show.

The UI labels are “Reported use” and “Reported share”. JSON fields `observedMinutes` and `confirmedSharePercent` are retained for compatibility. A booking's `Completed` status can simply mean its scheduled time elapsed; the reservation response and UI make that limitation explicit. A continuation is a separate booking and needs its own check-in rather than inheriting assumed attendance from its parent.

The default report covers the last seven elapsed days. An explicit range is half-open `[from, to)` and may cover at most 366 elapsed days. Both dates must be provided together. Inactive rooms remain visible in historical reports. Cancelled bookings do not contribute.

## Metrics

| Field                       | Definition                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `reservationCount`          | Non-cancelled reservations whose original scheduled intervals intersect the range                             |
| `scheduledMinutes`          | Union of original scheduled intervals, clipped to the range                                                   |
| `elapsedReservedMinutes`    | Union of effective reservation intervals clipped to the range and the snapshot time                           |
| `observedMinutes`           | Union of checked-in intervals, clipped to the effective meeting end, the range and the snapshot time          |
| `unconfirmedMinutes`        | Elapsed reserved minutes minus observed minutes                                                               |
| `releasedMinutes`           | Scheduled union minutes minus effective union minutes; time already rebooked is excluded from the freed total |
| `unconfirmedCompletedCount` | Completed reservations without check-in whose effective intervals intersect the range                         |
| `confirmedSharePercent`     | Observed / elapsed reserved minutes × 100; null when there is no elapsed reserved time                        |

The effective end is the early completion timestamp when present, otherwise the original scheduled end. Interval unions avoid double-counting a room when an early-ended reservation retains its original schedule and another booking uses the released slot. Each room is measured separately.

Minutes are rounded only after aggregation, to two decimal places. Confirmed share is rounded to one decimal place. The percentage measures confirmation of reserved time, not office-wide utilization or physical occupancy. No office-hours denominator is invented.

## Traceable seeded example

Atlas has two historical bookings totaling 120 scheduled minutes. One ended 20 minutes early, leaving 100 elapsed reserved minutes. Their check-ins account for 93 observed minutes, so 7 minutes are unconfirmed and the confirmed share is 93%. The default report also includes a Birch meeting without a check-in to demonstrate the distinction between zero observation and proof of no use.

## Snapshot consistency

The report service takes the same single-process gate as booking mutations while it materializes rooms and reservations. It reads the clock once. The calculation builder accepts those records and that explicit snapshot time, so its tests do not depend on wall-clock timing.

## Tests

The backend suite covers late check-in, live meeting clipping, both report edges, cancelled/future bookings, early release, rebooking, interval unions, inactive rooms, exact boundaries and report range errors. API tests verify default totals, a room filter and stable error codes. Browser coverage reads real API totals through the Usage page.
