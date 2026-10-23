# Verification record

Date: 23 October 2026.

## Verified source

[Checks run 39939234381](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/39939234381) verifies application commit `7e3a69463b8f80d7ca9ce7a84ef06584274ac233`. It adds linked additional-time reservations, booking request recovery and more precise usage/completion language to the minimal interface. The subsequent documentation update changes no application or test code.

| Check               | Evidence                                                                                         | Result   |
| ------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| Backend             | .NET 10 Release restore/build; 80 tests passed, 0 failed, 0 skipped                              | Pass     |
| Frontend            | Clean npm install, strict TypeScript, production build, 28 tests in 6 files, formatting          | Pass     |
| Development browser | Real ASP.NET + Vite, Chromium; 8 scenarios passed in 20.7 seconds                                | Pass     |
| Published container | Docker build, real ASP.NET serving React and API on one port; 8 scenarios passed in 13.0 seconds | Pass     |
| Hosted preview      | Extra-time dialog inspected; a 30-minute linked booking created and displayed                    | Pass     |
| Visual review       | Desktop rooms, booking dialog, usage, extra-time dialog and 390 px mobile screenshots            | Reviewed |

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

The [live demo](https://roomwise-reservations.vercel.app/) serves the actual ASP.NET/EF Core InMemory implementation and built React assets in one non-root container. The feature preview for the verified source is deployment `dpl_63oqN5yBDBRCQH4mU73cCB6kNRSw`.

Hosted verification opened the extra-time dialog with keyboard focus on its duration selector, selected 30 minutes, submitted it, and displayed the new linked booking after the API refresh. A direct API read confirmed that its start equals the parent's scheduled end, its end is 30 minutes later, and its `continuationOfId` points to the original booking. Completed historical reservations displayed the distinction between early completion and an elapsed schedule.

The live demo has no sign-in and uses synthetic data. Records and request receipts reset on process replacement and are not shared across separate instances. The one-process container tests establish behavior within the assignment's required storage model, not distributed persistence.

## Local evidence and limits

- `npm run check` passes locally: strict TypeScript, production build, 28 tests and formatting.
- Backend and browser execution evidence comes from the actual GitHub Actions runner; this workspace has no .NET SDK.
- A clean Windows checkout has not yet been manually started. Follow the README setup commands for that environment check.
- Manual check-in estimates reported use. It cannot establish continuous presence, actual departure, a no-show or an overrun. The percentage is not office-hours utilization.
- Booking receipts cover create/edit/additional-time requests for one server lifetime. They are not persistent client drafts or distributed idempotency, and do not cover lifecycle actions.

Earlier baseline checks: [39916754941](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/39916754941) for booking/container behavior, and [39926034597](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/39926034597) for the interface revision. The complete current run above supersedes their test counts.
