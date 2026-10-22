# Verification record

Date: 22 October 2026. First implementation milestone.

## Executed

| Check                         | Evidence                                                              | Result               |
| ----------------------------- | --------------------------------------------------------------------- | -------------------- |
| Dependency installation       | `npm install` completed; package-lock committed                       | Pass                 |
| TypeScript + production build | `npm run build`; Vite 8.3.5 built 27 modules                          | Pass                 |
| Frontend tests                | `npm test`; 4 files, 14 tests passed                                  | Pass                 |
| Lithuania timezone test run   | `TZ=Europe/Vilnius npm test`; all 14 tests passed                     | Pass                 |
| Formatting                    | `npm run format:check`; all matched files pass                        | Pass                 |
| Production dependency audit   | `npm audit --omit=dev --audit-level=high`; 0 vulnerabilities reported | Pass at time checked |
| Frontend dev server           | Vite started on 127.0.0.1:5173                                        | Pass                 |

Frontend tests use explicit mocks at the API boundary. They establish request construction, API-error behavior and UI interactions, not .NET server correctness or persistence.

## Not yet executed

| Check                                  | Reason                                                                     | Next action                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Backend restore/build/tests            | This workspace has no .NET SDK; normal SDK download was unavailable        | Run `dotnet test RoomReservations.slnx` with .NET 10 in VS Code |
| Live browser → ASP.NET → EF → response | Backend could not start without SDK                                        | Run both servers and execute the Milestone 2 checklist          |
| GitHub CI                              | Workflow prepared for the newly created private repository; result pending | Push the project and inspect the Checks workflow                |
| Real-browser smoke check               | Playwright package is present but its Chromium executable is not installed | Run a browser check in the local development environment        |

The .NET tests are written but **not claimed as passing**. They include all seven booking rules, exact boundaries, interval overlap shapes, configurable limits, API flows and two competing service calls sharing a write gate. They must be compiled and executed before submission.

## First defects found and fixed

- A stray CSS import caused the first build to fail; it was removed and the production build rerun successfully.
- Test database naming was made per test application rather than per context, avoiding both cross-test sharing and per-request data loss.
- The create endpoint's Location now resolves through a matching GET-by-ID endpoint.
- Page-specific filters were extracted from the application shell so unrelated page state is not coupled together.
- Room-card booking controls now honor user/room data availability, not just the room's active flag.

## Full-stack gate

The story to prove is: select a room → submit a reservation form → API validates the complete booking → EF saves it → the returned reservation appears after a fresh GET, with the correct user count and allowed lifecycle actions.

The first currently blocked boundary is server execution. Do not mark the complete story as verified using a mocked browser/API demo.
