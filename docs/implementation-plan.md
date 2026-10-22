# Implementation plan

## Goal

Deliver a small, understandable reservation system that can be demonstrated and defended technically. First prove that valid bookings work and invalid or competing bookings cannot slip through. Then add usage reporting and presentation extras.

## Milestone 1: current foundation

Source implemented:

- ASP.NET Core API and EF Core InMemory seed data.
- Room and user browsing; required filters.
- Create/edit/cancel/end reservation flow and manual check-in.
- All seven booking rules, configurable policy, injectable time and stable errors.
- Responsive React/TypeScript frontend with real HTTP calls, no default fake-data mode.
- Boundary, API, concurrency and frontend test source.
- VS Code tasks, reproducible npm lockfile, CI workflow and engineering notes.

**Gate:** GitHub Actions passes the backend build and all 38 backend tests, plus the frontend build and 14 frontend tests. A real browser → API → data round-trip is still required before declaring the milestone fully validated.

## Milestone 2: prove the full stack

This is the next task in VS Code:

1. Verify startup from a fresh Windows checkout with the .NET 10 SDK. Run `dotnet test RoomReservations.slnx` locally as a setup check; the same backend suite already passes in GitHub Actions.
2. Run both servers. Exercise create → reload → edit → cancel; confirm database responses match rendered results.
3. Prove each of R1–R7 through real API calls. Do not rely only on disabled frontend controls.
4. Run two conflicting creates and check that exactly one succeeds. Run the organizer conflict across two different rooms.
5. Check in to the seeded ongoing meeting, end early, and book the released time with a start strictly after the clock.
6. Check invalid/malformed payloads, date-range errors, unknown IDs, completed/cancelled actions and API-unavailable UX.
7. Add coverage for naturally completed status, user counts, cancellation/edit lifecycle boundaries and HTTP-level concurrent requests.
8. Record the commands and outputs in `verification.md`. Push to a private GitHub repository and wait for CI.

**Done when:** all checks pass locally and in CI, no browser errors remain, and a fresh checkout can be started from README alone.

## Milestone 3: usage insights

1. Agree on the observation/check-in assumptions in `requirements.md`.
2. Add a backend usage service with an explicit report interval and per-room scheduled minutes, check-in-observed minutes, early-released minutes and unconfirmed completed bookings.
3. Clamp intervals to the report window on the backend. Exclude cancelled bookings from scheduled usage totals. Avoid double-counting overlapping or partially observed intervals.
4. Return exact metric definitions with the report DTO. Do not infer “unused” from missing check-in.
5. Test a partially overlapping report window, zero observations, an early-ended meeting, a cancelled meeting, and a multi-day booking.
6. Add a simple comparison view. Implement the optional PDF export from the same backend calculation service, not a second frontend calculation.

**Done when:** the report's labels and totals are explainable from underlying reservations and observations.

## Milestone 4: submission polish

- Optional calendar/timeline using the existing reservation contract, after the required list flow works.
- Explicit office timezone/DST policy if needed.
- Pagination and targeted queries if data volume makes the demo's in-memory scans inappropriate.
- Accessibility pass: keyboard, modal focus, labels, screen-reader messages and contrast.
- Clean-clone startup test on Windows; screenshots; concise demo script.
- Reconcile the acceptance matrix with actual behavior and outstanding limitations.

## Deliberate non-goals

Authentication, billing, microservices, external calendars, notifications, production hosting and a real database are not part of this milestone. The brief's required InMemory provider stays in place. Do not spend time on optional report visuals while booking correctness is unverified.
