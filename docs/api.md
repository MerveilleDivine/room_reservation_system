# API contract

Local base URL: `http://localhost:5080/api`. JSON property names are camelCase. Timestamps are ISO 8601 instants with an explicit offset; the UI sends UTC (`Z`). No authentication.

| Method | Route                         | Purpose                                                          |
| ------ | ----------------------------- | ---------------------------------------------------------------- |
| GET    | `/health`                     | Local health check                                               |
| GET    | `/booking-policy`             | Configured maximum duration/advance days                         |
| GET    | `/usage`                      | Room usage; optional `from` + `to`, and `roomId`                 |
| GET    | `/rooms`                      | Filters: `minimumCapacity`, `floor`, comma-separated `equipment` |
| GET    | `/users`                      | User details and API-calculated active count                     |
| GET    | `/reservations`               | Filters: `roomId`, `organizerId`, `status`, `from`, `to`         |
| GET    | `/reservations/{id}`          | One reservation                                                  |
| POST   | `/reservations`               | Create; returns 201 and Location                                 |
| PUT    | `/reservations/{id}`          | Replace a future booking's editable fields                       |
| POST   | `/reservations/{id}/cancel`   | Cancel a future booking                                          |
| POST   | `/reservations/{id}/check-in` | Begin manual observed use of an ongoing meeting                  |
| POST   | `/reservations/{id}/end`      | End ongoing meeting early and release the room                   |

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

Reservation responses also include room/organizer names, status, nullable `checkedInAtUtc` and `actualEndUtc`, and `allowedActions`. Allowed actions are backend-calculated hints, not authorization or a substitute for server validation on click.

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

| Code                                              | Meaning                                                     |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `INVALID_TITLE`                                   | Missing/blank title or longer than 120 characters           |
| `INVALID_TIME_RANGE`                              | End is not after start                                      |
| `START_NOT_FUTURE`                                | Start is now or in the past                                 |
| `DURATION_EXCEEDED`                               | Duration is above the configured maximum                    |
| `ADVANCE_WINDOW_EXCEEDED`                         | Start is beyond the configured advance window               |
| `INVALID_ATTENDEES`                               | Attendees is not positive                                   |
| `CAPACITY_EXCEEDED`                               | Attendees exceeds room capacity                             |
| `ROOM_INACTIVE`                                   | Inactive room selected                                      |
| `ROOM_OVERLAP`                                    | Room already booked in an overlapping interval              |
| `ORGANIZER_OVERLAP`                               | Organizer already busy in an overlapping interval           |
| `ROOM_NOT_FOUND` / `ORGANIZER_NOT_FOUND`          | Selected reference does not exist                           |
| `RESERVATION_NOT_FOUND`                           | Target booking does not exist                               |
| `RESERVATION_NOT_EDITABLE`                        | Booking is not future and Booked                            |
| `RESERVATION_NOT_ACTIVE`                          | Booking has completed or been cancelled                     |
| `MEETING_NOT_STARTED`                             | Check-in/end attempted on a future meeting                  |
| `MEETING_ALREADY_STARTED`                         | Cancel attempted after start                                |
| `ALREADY_CHECKED_IN`                              | Duplicate check-in                                          |
| `INVALID_EQUIPMENT` / `INVALID_STATUS`            | Unknown filter value                                        |
| `INVALID_CAPACITY_FILTER` / `INVALID_DATE_FILTER` | Invalid filter range                                        |
| `INVALID_REQUEST`                                 | Malformed bound request fields                              |
| `UNEXPECTED_ERROR`                                | Unexpected server failure; internal details are not exposed |

The frontend additionally uses `API_UNAVAILABLE` for network failure and `REQUEST_FAILED` if the server does not return the expected error contract.

Usage errors are `INVALID_REPORT_RANGE` for missing/reversed endpoints, `REPORT_RANGE_EXCEEDED` for a range over 366 days, and `ROOM_NOT_FOUND` for an unknown room. Omitting both endpoints selects the last seven elapsed days. See [usage-report.md](usage-report.md) for the returned fields and exact metric definitions.
