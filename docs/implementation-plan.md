# Implementation plan

## Current implementation

The required stack remains ASP.NET Core/C#, EF Core InMemory and React/TypeScript. The original booking rules, configured duration/advance limits and error contract remain authoritative on the backend.

Implemented features:

- A minimal interface with top navigation, system typography, white space, monochrome actions and a locally served workspace photograph.
- Rooms, reservations, people and Usage pages with responsive layouts.
- Backend usage calculations that merge intervals, clip the report window, exclude cancelled bookings and distinguish observation from unconfirmed time.
- Historical seed records that can be traced to report totals.
- Fixed-clock usage tests and API tests.
- Linked additional-time bookings that reuse the backend booking validator and preserve the next team's slot.
- Request receipts and stable client submission IDs to recover lost booking confirmations without reapplying a committed change.
- Reported-use estimates and explicit completion notes that distinguish schedule from actual departure.
- Eight Chromium scenarios against both server setups, including HTTP concurrency, lost confirmations, reload persistence, keyboard focus and a 390 px viewport.
- CI browser reports/screenshots and a VS Code browser-test task.
- A hosted preview of the same .NET/EF Core InMemory code, with React assets served by ASP.NET in a single non-root container.

## Verification

The recorded full CI run passed 80 backend tests, 28 frontend unit tests and all eight Chromium scenarios in both the development setup and the published Docker container. A subsequent local frontend check on 26 October passed 29 tests, including the idle-request regression test. Strict TypeScript, production build and formatting checks pass. Desktop, mobile, dialog and usage screenshots have been inspected. A linked additional-time booking was also created and displayed in the deployed preview. See verification.md for the source commit and run evidence.

The lost-confirmation scenario forwards a write to the real API, lets it commit, and aborts its browser response. The recovery lookup uses the real backend. Other browser scenarios do not intercept traffic.

## Profile ownership update

Selectable member and administrator profiles add ownership to booking workflows without account infrastructure. The API checks ownership under the booking write gate; the interface hides unavailable actions and fills a member's organizer automatically. Profile selection persists per browser tab. Technical explanations stay in documentation, while the interface uses concise feedback and clear booking controls.

The full CI run for `359f641` passed backend tests, 32 frontend tests, and all nine browser scenarios against development servers and the published container. See [verification.md](verification.md).

## Reliability update, 28 October 2026

The hosted InMemory store allowed different requests to reach different reservations. Optional shared PostgreSQL storage and a cross-server transaction lock now address that boundary. Seed IDs are stable. A saved reservation remains in Upcoming at its chronological page. Member detail reads are scoped on the API, and the extra-time form displays and enforces the exact gap, including two minutes or none. Independent-host PostgreSQL tests run in CI. Deployment remains blocked until a shared store is configured; the account has reached its Supabase free-project limit.

## Follow-up work

1. Verify setup from a fresh Windows checkout with the README commands.
2. Add the optional calendar/timeline only if it improves browsing reservations.
3. Add optional PDF export using the existing backend usage calculation service.
4. Decide an explicit office timezone and daylight-saving ambiguity policy if this expands beyond the current browser-local demo.

## Deliberate scope

Room/user administration, authentication, billing, external calendars, notifications and production operations are outside the assignment's current scope. A public demo uses synthetic data. InMemory remains the required local provider; hosted containers now require a separately configured shared PostgreSQL store. A new hosted store is not yet provisioned. The report uses manual check-in, not inferred physical occupancy, and does not invent office-hours utilization.
