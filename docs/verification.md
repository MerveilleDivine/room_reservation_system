# Verification record

## Current reliability fix

The app retains ASP.NET Core, EF Core InMemory and React. The external database proposal has been removed. Hosting now requires one API process, as configured in `render.yaml`, rather than independently scaled in-memory replicas.

[Checks run 40671363249](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/40671363249) passed for application and test source `d4cbb7c412f50284c542cd23b09d6003fbf62b88` on 28 October 2026:

| Check | Result |
| --- | --- |
| Backend Release tests | 123 passed, no skips |
| Frontend | TypeScript, production build, 45 tests and formatting passed |
| Development browser | All 12 Chromium scenarios passed |
| Published container browser | All 12 Chromium scenarios passed |

This establishes the source's tested behavior within one API process. It does not establish that the public release is deployed. Render is connected, but its first deployment requires explicit workspace selection. The sole listed workspace is `My Workspace`; no service has been created yet.

The regression coverage includes saved bookings in their chronological Upcoming page, private member reads, zero/two/seventeen-minute extension limits, partial-minute rejection, conflict recovery and lost HTTP confirmations. Browser scenarios also check editing, reload and cancellation of preloaded reservations at a 390 px mobile width, plus clearing a confirmation when filters hide its booking.

A server restart resets synthetic data and receipts. Browser refreshes must preserve them while the single server runs. Profile selection demonstrates visibility without authentication, as the brief allows. See [hosting.md](hosting.md) for the release setup and checks.

The old public Vercel site still runs the previous release. The fixed public URL will be recorded only after the single-instance host is deployed and verified.

## Earlier verification

Recorded verification: 26 October 2026.

## Personal schedule and room finder

[Checks run 40376897444](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/40376897444) passed for application/test source `87c10ef9445f553d81124c29946108cf7356a4dd`.

| Check | Result |
| --- | --- |
| Backend Release build and tests | 117 passed, 0 failed |
| Frontend | Strict TypeScript, production build, 40 tests and formatting passed |
| Development browser | All 11 Chromium scenarios passed |
| Published container | All 11 Chromium scenarios passed |
| Visual review | Compact desktop room grid, mobile room finder and personal home screen reviewed |

The schedule opens on personal upcoming bookings with a greeting. History is explicit, results are paginated, and a new booking is shown immediately above the chronological feed with keyboard focus on confirmation. Room search checks the selected interval and carries it into the booking form. The browser scenarios cover creation from history/page two, far-future confirmation visibility, history after early completion, room conflicts during search and the room/time handoff to saving. Unit tests also cover stale-query suppression and repeated availability checks for unchanged dates.

The release documentation update changes no application or test code. See [product-design.md](product-design.md) for research and interaction decisions.

## Profile ownership and interface update

[Checks run 40371881745](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/40371881745) passed for source commit `359f641524ff481573f4f21b2e209b5269466395`: backend restore/build/tests, strict TypeScript, production frontend build, 32 frontend tests, formatting and all nine Chromium scenarios in both development and published-container setups.

The new browser scenario verifies read-only access to another organizer's booking, API rejection of a cross-owner cancellation, owner editing, administrator access and profile persistence after reload. Backend profile tests cover missing/invalid profiles, all mutation actions, ownership transfer prevention, administrator writes and receipt recovery. The interface now includes a discreet profile selector, automatic member organizer selection, simpler feedback and no implementation notes or image caption.

The following sections preserve the earlier baseline evidence and its exact source revisions.

## Verified source

[Checks run 40010656310](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/40010656310) verifies source commit `339040e4eec9e00dd612f567eb3064882808de75`. It includes the hexagon background, linked additional-time reservations, booking request recovery and precise usage/completion language. Both browser checks use the official Playwright image matching the installed test dependency, avoiding host-level browser dependency installation. This run records the state of that source revision; later checks are listed below.

| Check               | Evidence                                                                                        | Result   |
| ------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| Backend             | .NET 10 Release restore/build; 80 tests passed, 0 failed, 0 skipped                             | Pass     |
| Frontend            | Clean npm install, strict TypeScript, production build, 28 tests in 6 files, formatting         | Pass     |
| Development browser | Real ASP.NET + Vite, Chromium; 8 scenarios passed in 19.2 seconds                               | Pass     |
| Published container | Docker build, real ASP.NET serving React and API on one port; 8 scenarios passed in 8.4 seconds | Pass     |
| Hosted preview      | Public background and booking controls verified; earlier linked-booking flow remains covered    | Pass     |
| Visual review       | Updated desktop rooms and usage report, plus the 390 px mobile room list                        | Reviewed |

The backend suite includes all seven original booking rules, interval boundaries, API flows, concurrent writes, usage aggregation, continuation conflicts/lifecycle, request-key validation and replay after time or resource state changes. Clock-sensitive tests use injected fixed or explicitly advanced time. An old edit replay is verified not to overwrite a newer change.

## Browser scenarios

The suite uses the real ASP.NET API and EF Core InMemory in both server setups:

1. Create through the form, verify UTC transmission, reload from the API, edit and cancel. Check API-calculated active user counts.
2. Submit an overlapping room booking; preserve form input and display the backend error.
3. Reserve additional time. Reject the next team's room booking and an organizer conflict in another room, then create and display the linked booking when those slots are released.
4. Let a real booking POST commit, abort only its browser response, recover via its request receipt and verify exactly one reservation exists.
5. Check in to an ongoing meeting, end early and successfully book the released time.
6. Render backend usage totals, filter a room and display the estimate's limitations.
7. Check mobile horizontal overflow, initial modal focus, Escape dismissal and focus return.
8. Send simultaneous HTTP requests for one room, confirm exactly one succeeds, and reject an organizer conflict in another room.

Scenario 4 intentionally injects a transport failure after forwarding the request to the actual backend. Its receipt lookup and reads are real. No other scenario intercepts traffic or supplies mock API data.

Configuration: 1440 × 1000 desktop, 390 × 844 mobile, Europe/Vilnius browser timezone. Successful screenshots and failure diagnostics are retained for seven days in the run's `roomwise-browser-results` and `roomwise-container-browser-results` artifacts.

## Hosted preview

The [live demo](https://roomwise-reservations.vercel.app/) serves the actual ASP.NET/EF Core InMemory implementation and built React assets in one non-root container. The background was verified on public deployment `dpl_EaZ3PMCaK85N2w5mo83iqfKQEYUR`, using application commit `5dd90380ea57882a1078bcaea0df8e7f4ae0213c`. The later CI changes leave application code unchanged.

Current hosted verification inspected the hexagon background on Rooms and Usage and confirmed that the public booking controls become available after API data loads. The same revision's 390 px browser screenshot was reviewed for mobile layout. The background is a 918-byte local SVG with no extra runtime dependency.

Earlier hosted verification opened the extra-time dialog, selected 30 minutes, submitted it, and displayed the new linked booking after the API refresh. A direct API read confirmed that its start equals the parent's scheduled end, its end is 30 minutes later, and its `continuationOfId` points to the original booking. Completed historical reservations displayed the distinction between early completion and an elapsed schedule. The current real-backend browser suite continues to cover these workflows.

The live demo has no sign-in and uses synthetic data. Records and request receipts reset on process replacement and are not shared across separate instances. The one-process container tests establish behavior within the assignment's required storage model, not distributed persistence.

## Implemented scope

The required pages, seven configurable backend booking rules, clear API errors, backend usage calculations and required ASP.NET/EF Core InMemory/React stack are implemented. The README includes clean-checkout startup commands; architecture, assumptions and API contracts are documented. Calendar/timeline and PDF export remain optional, unimplemented enhancements.

## Local evidence and limits

- On 26 October 2026, `npm run check` passed for application commit `c08825f50bd4bd8428fa9db43278634607695b56`: strict TypeScript, production build, 29 tests and formatting. This includes the regression test for no API polling while idle.
- Backend and browser execution evidence comes from the linked GitHub Actions run. The 26 October check covered the frontend only.
- A clean Windows checkout has not yet been manually started. The README documents the startup commands for that environment.
- Manual check-in estimates reported use. It cannot establish continuous presence, actual departure, a no-show or an overrun. The percentage is not office-hours utilization.
- Booking receipts cover create/edit/additional-time requests for one server lifetime. They are not persistent client drafts or distributed idempotency, and do not cover lifecycle actions.

Earlier baseline checks: [39916754941](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/39916754941) for booking/container behavior, and [39926034597](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/39926034597) for the interface revision. The complete current run above supersedes their test counts.
