# Verification record

Date: 23 October 2026.

## Interface revision

Source commit `e84d84c1ae8caeda2ac5fd238305bd41cc6f40a6` replaces the sidebar and boxed room cards with top navigation, a room list, larger typography and one locally served workspace photograph. The required room IDs and controls remain visible.

[Design checks run 39926034597](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/39926034597) passes the backend and frontend jobs and all six development-browser scenarios in 15.7 seconds. The published container builds successfully. Desktop rooms, the booking dialog, the usage report and the full 390 px mobile room list were visually inspected. The separate container-browser job's final result is available in that run.

## Booking and container baseline

[Checks run 39916754941](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/39916754941) verifies source commit `d532ec20fe96abc1878270769615e1423b07a618`. The later documentation commit does not change application code.

| Check                 | Evidence                                                                                      | Result   |
| --------------------- | --------------------------------------------------------------------------------------------- | -------- |
| Backend restore/build | .NET 10; Release build through the test command                                               | Pass     |
| Backend tests         | 57 passed, 0 failed, 0 skipped                                                                | Pass     |
| Frontend              | Clean npm install, strict TypeScript/production build, 5 test files with 17 tests, formatting | Pass     |
| Development browser   | Chromium, both running servers, 6 scenarios passed in 23.3 seconds                            | Pass     |
| Published container   | Docker build, real ASP.NET static assets/API on one port, 6 scenarios passed in 8 seconds     | Pass     |
| Visual review         | Desktop rooms, booking dialog, usage and 390 px mobile screenshots inspected                  | Reviewed |

The backend tests include all seven booking rules, interval boundaries, API flows, competing writes and usage aggregation. Their clock-dependent tests use fixed time.

## Browser scenarios

The browser suite uses the real ASP.NET API and EF Core InMemory via the React app's Vite proxy. It does not intercept API requests.

1. Create a booking through the form, verify UTC transmission, reload it from the API, edit it and cancel it. Active user counts are checked against the backend.
2. Submit an overlapping room booking and verify that the server error appears while the form input remains.
3. Check in to a real ongoing meeting, end early and successfully book the released time.
4. Render the backend usage totals, filter a room and display the observation explanation.
5. Check the mobile document for horizontal overflow, initial modal focus, Escape dismissal and focus return.
6. Send simultaneous HTTP requests for one room, confirm exactly one succeeds, and reject an organizer conflict in a different room.

Browser configuration: 1440 × 1000 desktop, 390 × 844 mobile, Europe/Vilnius timezone. Successful run screenshots are available in the `roomwise-browser-results` artifact of the linked CI run.

## Hosted preview

The [live demo](https://roomwise-reservations.vercel.app/) deploys the actual ASP.NET/EF Core InMemory implementation and its built React assets in one container. Vercel deployment `dpl_6QAUK8WGUro6ZqkQ7zABLQWz2fgy` uses the verified commit above.

Public HTTP checks returned 200 for `/`, `/api/health`, `/api/rooms` and `/api/usage`. The hosted browser displayed all four rooms with full IDs, opened the booking form and rendered the Usage page with the expected Atlas figures (120 scheduled minutes, 93 observed minutes). These hosted checks complement the six mutating scenarios run against the same Docker packaging in CI.

The first hosting attempt did not detect the Dockerfile automatically; explicit container service routing fixed the empty deployment. The next surfaced ASP.NET's local-only hostname allowlist, corrected with a deployment-scoped `AllowedHosts` setting. CI also caught a startup race in its health probe, which now retries connection resets while the server initializes. The final container suite passes.

The live demo has no sign-in and uses synthetic data. Its in-memory records reset on process replacement and are not shared across separate server instances.

## Defects found and fixed

The first browser run exposed two issues that the component tests did not cover:

- Wrapped select labels required role-based browser locators; the controls already exposed the correct accessible names.
- React autofocus ran before the native modal opened, so initial focus was unreliable. The dialog now focuses its title input after opening and closes before unmounting to restore focus.

The complete browser suite passed after those fixes. The mobile equipment filters were also aligned into a two-column grid and visually reviewed.

## Local evidence and limits

- `npm run check` passes: strict TypeScript, production build, 17 unit tests and formatting.
- Playwright test discovery finds all six scenarios.
- The initial workspace has no .NET SDK, and its browser binary download was unavailable. Backend and live-browser execution evidence comes from the actual GitHub Actions runner.
- A clean Windows checkout has not yet been manually started. Follow the README setup commands for that final environment check.
- The report uses manual check-in. Unconfirmed time is not proof that a room was empty, and confirmed share is not an office-hours utilization measure.
