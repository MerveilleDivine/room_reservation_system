# Verification record

Date: 22 October 2026.

## Current verified source

[Checks run 39797314851](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/39797314851) verifies source commit `16be356f5b9d52bb7b03ed4c17ffe1ad39dab48f`.

| Check                 | Evidence                                                                                      | Result   |
| --------------------- | --------------------------------------------------------------------------------------------- | -------- |
| Backend restore/build | .NET 10; Release build through the test command                                               | Pass     |
| Backend tests         | 57 passed, 0 failed, 0 skipped                                                                | Pass     |
| Frontend              | Clean npm install, strict TypeScript/production build, 5 test files with 17 tests, formatting | Pass     |
| Real browser          | Chromium, both running servers, 6 scenarios passed in 25 seconds                              | Pass     |
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
