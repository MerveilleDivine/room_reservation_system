# Implementation plan

## Current implementation

The required stack remains ASP.NET Core/C#, EF Core InMemory and React/TypeScript. The original booking rules, configured duration/advance limits and error contract remain authoritative on the backend.

Implemented in this iteration:

- A minimal interface with top navigation, system typography, white space, monochrome actions and a locally served workspace photograph.
- Rooms, reservations, people and a new Usage page with responsive layouts.
- Backend usage calculations that merge intervals, clip the report window, exclude cancelled bookings and distinguish observation from unconfirmed time.
- Historical seed records that can be traced to report totals.
- Fixed-clock usage tests and API tests.
- Linked additional-time bookings that reuse the backend booking validator and preserve the next team's slot.
- Request receipts and stable client submission IDs to recover lost booking confirmations without reapplying a committed change.
- Reported-use estimates and explicit completion notes that distinguish schedule from actual departure.
- Eight Chromium scenarios against both server setups, including HTTP concurrency, lost confirmations, reload persistence, keyboard focus and a 390 px viewport.
- CI browser reports/screenshots and a VS Code browser-test task.
- A hosted preview of the same .NET/EF Core InMemory code, with React assets served by ASP.NET in a single non-root container.

## Verification gate

The current implementation passes 80 backend tests, 28 frontend unit tests and all eight Chromium scenarios in both the development setup and the published Docker container in GitHub Actions. Strict TypeScript, production build and formatting checks pass. Desktop, mobile, dialog and usage screenshots have been inspected. A linked additional-time booking was also created and displayed in the deployed preview. See verification.md for the source commit and run evidence.

A browser test failure is handled at the failing boundary: inspect its request, response and trace, fix the cause, then rerun the affected check. The lost-confirmation scenario forwards a write to the real API, lets it commit, and aborts its browser response. The recovery lookup uses the real backend. Other browser scenarios do not intercept traffic.

## Next work after this gate passes

1. Verify setup from a fresh Windows checkout with the README commands.
2. Add the optional calendar/timeline only if it improves browsing reservations.
3. Add optional PDF export using the existing backend usage calculation service.
4. Decide an explicit office timezone and daylight-saving ambiguity policy if this expands beyond the current browser-local demo.

## Deliberate scope

Room/user administration, authentication, billing, external calendars, notifications and production operations are outside the assignment's current scope. A disposable hosted preview is provided for review. InMemory remains the required storage provider. The report uses manual check-in, not inferred physical occupancy, and does not invent office-hours utilization.
