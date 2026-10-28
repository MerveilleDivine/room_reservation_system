# API contract

Local base URL: `http://localhost:5080/api`. JSON property names are camelCase. Timestamps are ISO 8601 instants with an explicit offset; the UI sends UTC (`Z`). No authentication.

| Method | Route                              | Purpose                                                          |
| ------ | ---------------------------------- | ---------------------------------------------------------------- |
| GET    | `/health`                          | Local health check                                               |
| GET    | `/booking-policy`                  | Configured maximum duration/advance days                         |
| GET    | `/usage`                           | Room usage; optional `from` + `to`, and `roomId`                 |
| GET    | `/rooms`                           | Filters: `minimumCapacity`, `floor`, comma-separated `equipment` |
| GET    | `/users`                           | User details and API-calculated active count                     |
| GET    | `/reservations`                    | Filters: `roomId`, `organizerId`, `status`, `from`, `to`         |
| GET    | `/reservations/{id}`               | One reservation                                                  |
| POST   | `/reservations`                    | Create; returns 201 and Location                                 |
| PUT    | `/reservations/{id}`               | Replace a future booking's editable fields                       |
| POST   | `/reservations/{id}/cancel`        | Cancel a future booking                                          |
| POST   | `/reservations/{id}/check-in`      | Begin manual observed use of an ongoing meeting                  |
| POST   | `/reservations/{id}/end`           | End ongoing meeting early and release the room                   |
| POST   | `/reservations/{id}/continuations` | Reserve additional time after an ongoing booking                 |
| GET    | `/booking-requests/{requestId}`    | Recover the current reservation for a confirmed booking write    |

### Selected profile

Booking detail reads, writes and confirmation recovery require one `X-Roomwise-Profile` header: an existing person GUID, or `admin` for workspace management. Members receive only their own reservations from both list endpoints, cannot request another organizer's details, and cannot reassign ownership. Usage requires Administrator (`ADMIN_REQUIRED`, 403); non-admin user lookups do not expose booking counts. Public room availability contains no meeting titles or organizer identities. Organizer-specific availability requires the matching member or Administrator.

Missing headers return `PROFILE_REQUIRED` (400), invalid profiles return `INVALID_PROFILE` (400), and ownership violations return `BOOKING_ACCESS_DENIED` (403). A request receipt is also restricted to the current reservation owner or Administrator.

The header represents a freely selectable sample profile and is not proof of identity. It must be replaced by verified identity and trusted role resolution before real deployment.

Equipment codes: `projector`, `tv`, `videoConferencing`, `whiteboard`. Multiple filters require all selected equipment. Status is `Booked`, `Completed` or `Cancelled`.

Create/edit body (choose a future date inside the current advance window):

```json
{
  "roomId": "10000000-0000-0000-0000-000000000001",
  "organizerId": "20000000-0000-0000-0000-000000000001",
  "title": "Product planning",
  "startUtc": "2026-10-25T09:00:00Z",
  "endUtc": "2026-10-25T10:00:00Z",
  "attendees": 6
}
```

Reservation responses also include room/organizer names, status, nullable `checkedInAtUtc`, `actualEndUtc`, `continuationOfId`, `completionNote`, and `allowedActions`. Allowed actions are backend-calculated hints, not authorization or a substitute for server validation on click. `reserve-more` is offered while a meeting is ongoing. A naturally completed booking explains that its scheduled end does not establish actual departure.

## Additional time

`GET /reservations/{id}/extra-time` returns `{maximumMinutes,startsAtUtc,blockedFromUtc,blockedUntilUtc,reasonCode,message}` for the owner or Administrator. The maximum is the smaller of the configured duration limit and the whole-minute gap before the next conflicting room/organizer reservation. Cancelled bookings and released remainders do not block time. Zero disables submission; two minutes allows exactly two. A partial minute is rounded down to avoid overlap. Blocking timestamps do not include another meeting's details. Saving repeats this calculation under the write lock; an earlier availability response is not a hold.

Send `{ "additionalMinutes": 30 }` to `/reservations/{id}/continuations` before the original booking ends. The API creates a separate reservation starting at the original end, with the same room, organizer, title and attendee count. All booking rules apply to that future interval. The parent remains unchanged; the response is 201 with the child's Location and `continuationOfId`.

Only an ongoing, Booked parent is eligible. One non-cancelled continuation is allowed per parent. Edit or cancel that future booking instead of creating another continuation. A cancelled continuation can be replaced. Each reservation retains its own check-in and cancellation; ending the parent early does not cancel its child. To request time after a slot has already elapsed, make a new future booking. No retroactive reservation or automatic displacement is performed.

## Booking request recovery

Create, edit and continuation writes accept an optional `Idempotency-Key` header containing one non-empty UUID. The React forms always supply it and retain it for retries of the same submitted payload. The server normalizes title whitespace and UTC instants before fingerprinting create/edit commands. The operation and target ID are part of the fingerprint.

The same key and fingerprint returns the same reservation without reapplying the command, even if time or the reservation's state has since changed. Responses and recovery lookups return the resource's current state, not a historical response snapshot. Reusing a committed key for different input or a different operation returns 409. Failed validation does not store a receipt.

`GET /booking-requests/{requestId}` waits for the process's write gate and returns 200 with the current reservation if its receipt exists, or 404 otherwise. The browser attempts this lookup after a network failure, 5xx or unreadable success response. If recovery remains uncertain, it preserves the payload and key, locks the inputs and offers a retry of that same request. A definite 4xx validation rejection permits correction. Closing/reloading a form does not persist its submission identity.

Receipts share the InMemory store and booking gate with reservations. They are process-local and disappear on restart. A missing receipt is not proof of a failed write. Lifecycle actions do not use this booking-write recovery protocol; their failures refresh the displayed schedule without reporting success.

Example conflict (HTTP 409):

```json
{
  "title": "ROOM_OVERLAP",
  "status": 409,
  "detail": "This room is already booked during that time.",
  "code": "ROOM_OVERLAP"
}
```

## Stable business codes

| Code                                              | Meaning                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `INVALID_TITLE`                                   | Missing/blank title or longer than 120 characters                  |
| `INVALID_TIME_RANGE`                              | End is not after start                                             |
| `START_NOT_FUTURE`                                | Start is now or in the past                                        |
| `DURATION_EXCEEDED`                               | Duration is above the configured maximum                           |
| `ADVANCE_WINDOW_EXCEEDED`                         | Start is beyond the configured advance window                      |
| `INVALID_ATTENDEES`                               | Attendees is not positive                                          |
| `CAPACITY_EXCEEDED`                               | Attendees exceeds room capacity                                    |
| `ROOM_INACTIVE`                                   | Inactive room selected                                             |
| `ROOM_OVERLAP`                                    | Room already booked in an overlapping interval                     |
| `ORGANIZER_OVERLAP`                               | Organizer already busy in an overlapping interval                  |
| `ROOM_NOT_FOUND` / `ORGANIZER_NOT_FOUND`          | Selected reference does not exist                                  |
| `RESERVATION_NOT_FOUND`                           | Target booking does not exist                                      |
| `RESERVATION_NOT_EDITABLE`                        | Booking is not future and Booked                                   |
| `RESERVATION_NOT_ACTIVE`                          | Booking has completed or been cancelled                            |
| `MEETING_NOT_STARTED`                             | Check-in/end attempted on a future meeting                         |
| `MEETING_ALREADY_STARTED`                         | Cancel attempted after start                                       |
| `ALREADY_CHECKED_IN`                              | Duplicate check-in                                                 |
| `MEETING_NOT_ONGOING`                             | Extra time requested before start or after completion/cancellation |
| `INVALID_ADDITIONAL_TIME`                         | Nonpositive extra duration or above the configured limit           |
| `CONTINUATION_ALREADY_BOOKED`                     | Parent already has a non-cancelled continuation                    |
| `INVALID_REQUEST_ID`                              | Malformed, empty or multiple idempotency keys                      |
| `IDEMPOTENCY_KEY_REUSED`                          | Committed key reused for another payload or command                |
| `BOOKING_REQUEST_NOT_FOUND`                       | No receipt found in the configured booking store                          |
| `INVALID_EQUIPMENT` / `INVALID_STATUS`            | Unknown filter value                                               |
| `INVALID_CAPACITY_FILTER` / `INVALID_DATE_FILTER` | Invalid filter range                                               |
| `INVALID_REQUEST`                                 | Malformed bound request fields                                     |
| `UNEXPECTED_ERROR`                                | Unexpected server failure; internal details are not exposed        |

The frontend additionally uses `API_UNAVAILABLE` for network failure, `INVALID_RESPONSE` for unreadable success responses, `REQUEST_FAILED` if the server does not return the expected error contract, and `BOOKING_UNCONFIRMED` when a booking write and its recovery lookup cannot be confirmed.

Usage errors are `INVALID_REPORT_RANGE` for missing/reversed endpoints, `REPORT_RANGE_EXCEEDED` for a range over 366 days, and `ROOM_NOT_FOUND` for an unknown room. Omitting both endpoints selects the last seven elapsed days. See [usage-report.md](usage-report.md) for the returned fields and exact metric definitions.

## Task-focused read models

`GET /api/reservation-feed` returns `{items,totalCount,page,pageSize}`. `view=upcoming` is the default and includes ongoing/future Booked reservations, nearest start first. `view=history` includes completed/cancelled reservations, newest start first. Equal start times use reservation ID as a stable tie-breaker. `roomId`, `organizerId`, `status`, `from` and `to` retain the existing filter semantics. Page defaults to 1, page size to 6 (maximum 50). Counts and pagination follow filtering inside one consistent read snapshot. The original `/api/reservations` array contract remains available. Both routes apply member scope on the server. Optional `focusId` selects the page containing that reservation after filtering, allowing a saved booking to appear in its chronological position; it cannot bypass member scope.

`GET /api/room-availability?startUtc=...&endUtc=...&organizerId=...` returns an array of `{roomId,isAvailable,reason}` for the selected interval. Organizer is optional. Invalid common time ranges return a normal 400; an unknown organizer returns 404. The same booking rules account for overlapping room and organizer bookings, cancelled intervals, early release and inactive rooms. This endpoint does not hold a room; saving always revalidates under the write gate.
