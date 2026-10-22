# Implementation plan

## Current implementation

The required stack remains ASP.NET Core/C#, EF Core InMemory and React/TypeScript. The original booking rules, configured duration/advance limits and error contract remain authoritative on the backend.

Implemented in this iteration:

- A minimal interface with system typography, white/gray surfaces, one blue accent, restrained line icons and direct labels.
- Rooms, reservations, people and a new Usage page with responsive layouts.
- Backend usage calculations that merge intervals, clip the report window, exclude cancelled bookings and distinguish observation from unconfirmed time.
- Historical seed records that can be traced to report totals.
- Fixed-clock usage tests and API tests.
- Six Chromium scenarios against both running servers, including HTTP concurrency, reload persistence, keyboard focus and a 390 px viewport.
- CI browser reports/screenshots and a VS Code browser-test task.

## Verification gate

The foundation already passed 38 backend and 14 frontend tests. The current frontend passes its production build, strict TypeScript checks, all 17 unit tests and formatting locally. The expanded backend and browser suites run in GitHub Actions. Record actual results in verification.md before marking the current milestone validated.

A browser test failure is handled at the failing boundary: inspect its request, response and trace, fix the cause, then rerun the affected check. The real browser suite does not intercept or mock API calls.

## Next work after this gate passes

1. Inspect the desktop, mobile, booking-dialog and usage screenshots from the browser artifact.
2. Verify setup from a fresh Windows checkout with the README commands.
3. Add the optional calendar/timeline only if it improves browsing reservations.
4. Add optional PDF export using the existing backend usage calculation service.
5. Decide an explicit office timezone and daylight-saving ambiguity policy if this expands beyond the current browser-local demo.

## Deliberate scope

Room/user administration, authentication, billing, external calendars, notifications and production hosting are outside the assignment's current scope. InMemory remains the required storage provider. The report uses manual check-in, not inferred physical occupancy, and does not invent office-hours utilization.
