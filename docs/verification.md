# Verification record

Date: 22 October 2026. First implementation milestone.

## GitHub CI

[Checks run 39789237165](https://github.com/MerveilleDivine/room_reservation_system/actions/runs/39789237165) completed successfully for source commit `058d6b1d6c8a08a4a9fa20f742e3fcfbb8ae4464`.

| Check                 | Evidence                                                                                                      | Result   |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| Backend restore/build | .NET 10 on the GitHub Actions runner; restore and Release test build completed                                | Pass     |
| Backend tests         | 38 passed, 0 failed, 0 skipped; booking rules, boundary cases, API integration and competing booking requests | Pass     |
| Frontend checks       | Clean `npm ci`, strict TypeScript/production build, 4 test files with 14 tests, formatting                    | Pass     |
| Published source      | 58 files on main; uploaded Git tree matches the prepared local source                                         | Verified |

API integration tests run the real ASP.NET application with EF Core InMemory through WebApplicationFactory. The tests use a fixed clock. Frontend tests mock the API boundary. These checks do not establish that a browser completes a booking against a running backend.

## Local checks

- `npm run check`: production build, all 14 frontend tests and formatting pass.
- `TZ=Europe/Vilnius npm test`: all 14 frontend tests pass.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities reported at time checked.
- Vite starts on 127.0.0.1:5173.
- The local Git repository is connected to the private GitHub repository.

The workspace used for initial implementation has no .NET SDK. Backend build/test evidence comes from GitHub Actions. The README includes commands for local development with the SDK installed.

## Remaining verification

| Check                                  | Reason                                                                       | Next action                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Live browser → ASP.NET → EF → response | Both development servers have not yet been exercised together from a browser | Start both servers from a fresh checkout and run the Milestone 2 checklist                 |
| Real-browser smoke check               | Playwright's Chromium executable is not installed in the initial workspace   | Check keyboard, modal focus, responsive layout and real HTTP failures in the local browser |

The story still to prove is: select a room → submit a reservation form → API validates and saves it → a fresh GET renders the reservation with the correct user count and lifecycle actions.

## Defects corrected during implementation

- Removed a stray CSS import found by the first production build.
- Isolated test databases per application while keeping requests within each application on the same database.
- Added GET-by-ID so the create endpoint's Location resolves.
- Extracted page filters from the application shell.
- Disabled room-card booking when required room/user data is unavailable.
