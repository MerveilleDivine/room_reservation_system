# Requirements and acceptance criteria

Source: the supplied internship room-reservation assignment. This document paraphrases functional requirements; the original document is not committed.

## Required behavior

| ID            | Acceptance criterion                                                                               | Implementation and tests                                                                |
| ------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Rooms         | Each room has an ID, name, capacity, floor, multiple equipment options and active status           | Room entity, seeded room list, room DTO, React room cards with full IDs                 |
| Room filters  | Minimum capacity, floor and equipment selection are applied by the API                             | `GET /api/rooms`; API test for combined filters                                         |
| Users         | User ID, first/last name and active reservation count are available                                | Person entity, `GET /api/users`, Users page                                             |
| Reservations  | Room, organizer, title, start/end, attendees and Booked/Completed/Cancelled status are represented | Reservation entity and DTO                                                              |
| Actions       | Create, edit, cancel and end a meeting early                                                       | POST/PUT/action endpoints and UI controls; API test source                              |
| Filters       | Reservations can be filtered by room, organizer, status and date range                             | `GET /api/reservations`, Reservations page                                              |
| R1            | Duration cannot exceed the configured limit; exactly 7 days is valid by default                    | BookingRules; exact boundary and one-tick-over tests                                    |
| R2            | The same room cannot have overlapping non-cancelled reservation intervals                          | BookingRules; all overlap shapes, adjacent meetings, cancellation and concurrency tests |
| R3            | An organizer cannot have overlapping meetings, including different rooms                           | BookingRules; organizer-overlap test                                                    |
| R4            | A new or edited booking starts strictly in the future and ends after its start                     | BookingRules; now/past and zero/negative-length tests                                   |
| R5            | Attendees cannot exceed room capacity                                                              | BookingRules; exact and over-capacity tests                                             |
| R6            | Start is no more than 90 days ahead by default                                                     | BookingRules; exact boundary and one-tick-over tests                                    |
| R7            | Inactive rooms cannot be booked                                                                    | BookingRules; inactive room unit test and disabled UI                                   |
| Errors        | Backend failures expose a stable code and a human-readable message                                 | Problem Details handler and frontend error tests                                        |
| Configuration | Duration and advance limits come from appsettings                                                  | Options binding/startup validation and configurable-policy test                         |
| Technology    | ASP.NET backend, EF Core InMemory, React frontend, no authentication                               | Required stack retained                                                                 |

Usage reporting is implemented in `GET /api/usage` and the Usage page. The [metric definitions](usage-report.md) distinguish scheduled, observed and unconfirmed time. See `verification.md` for executed test evidence rather than treating the acceptance matrix as a test result.

## Explicit assumptions

1. **“Users page” in section 1:** the section describes room attributes and room filtering, so it is interpreted as a Rooms page. The separate Users page is also implemented.
2. **Editing:** included because the rules explicitly apply to new and edited bookings, even though the action list does not separately describe edit controls.
3. **Adjacent meetings:** intervals are half-open: `[start, end)`. A meeting may start at the exact instant another ends. An overlap exists when `candidate.start < existing.end && existing.start < candidate.end`.
4. **Time:** a “day” in duration/advance limits is 24 elapsed hours. The backend compares instants using UTC and an injectable clock. Exactly 90 days ahead is accepted, and the limit applies to the start, not the end.
5. **Attendees:** a positive integer, including the organizer. Zero or negative counts are rejected.
6. **Equipment:** selecting several items means the room must have all of them. Floor matching is exact.
7. **Date-range filtering:** returns meetings whose scheduled intervals intersect `[from, to)`. It uses the original scheduled end, not the observed end, so historical schedules remain findable after early completion.
8. **Active count:** future or currently ongoing Booked reservations. Cancelled, naturally elapsed and early-completed reservations are excluded. This is not a count of people physically in rooms.
9. **Lifecycle:** only future Booked reservations can be edited or cancelled. Ongoing meetings can be ended early. Elapsed Booked reservations are presented as Completed without a background status-writing job.
10. **Early completion:** preserves the scheduled end for comparison, records `actualEndUtc`, and releases the rest of the reserved interval.
11. **Actual use:** the brief does not specify a sensor, attendance feed or usage input. Manual check-in is an explicit, limited observation source. Missing check-in is **unknown/unconfirmed use**, not proof of a no-show. Check-in is accepted only during the scheduled meeting.
12. **Availability:** an active room is eligible to book, not necessarily free now. The first milestone validates availability when a complete booking is submitted; it does not pretend that an active flag proves availability for every time slot.
13. **No room/user CRUD:** seed data and browsing are included. The brief does not ask for room/user administration.

## Reporting decisions and follow-up

- Manual check-in is the explicit observation source for this implementation. A sensor or attendance-feed integration would require a new requirement.
- Choose a business timezone if reporting by office-local calendar day becomes required. Browser-local entry is adequate for the current local demo but ambiguous daylight-saving times need an explicit product policy before multi-office scheduling.
- The report's percentage is confirmed share of elapsed reserved time. Office-hours utilization is not defined.
- Ended meetings without check-in remain unconfirmed. Retrospective confirmation is not part of the current workflow.
