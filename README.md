# Roomwise

A meeting-room reservation app built with ASP.NET Core, Entity Framework Core InMemory, React and TypeScript.

This is the first implementation milestone, not a finished submission. It follows the supplied room-reservation technical brief. The original assignment PDF is intentionally not redistributed in this repository.

## Start in VS Code

Install the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0), [Node.js 24 LTS](https://nodejs.org/en/download) (24.15 or newer), and Git. Node.js 22.22.2+ is also supported. Install the SDK, not just the .NET runtime.

Open this repository's root folder in VS Code. The commands below also work in Windows PowerShell.

Terminal 1, from the repository root:

```powershell
dotnet restore RoomReservations.slnx
dotnet run --project src/RoomReservations.Api
```

Terminal 2, from the repository root:

```powershell
cd web
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The frontend forwards `/api` requests to http://localhost:5080. A health check is available at http://localhost:5080/api/health. No secrets, database server, accounts or environment files are needed.

If `dotnet` is not recognized after installation, restart the VS Code terminal. If the site reports that it cannot reach the API, check that terminal 1 is still running. The UI deliberately does not substitute fake data for a failed API connection.

VS Code's **Terminal → Run Task** menu also includes API, web and test commands. C# Dev Kit can discover the solution and launch the API through its normal project debugging workflow.

## First demo

1. Browse the four seeded rooms. Filter by capacity, floor and one or more equipment options. Inactive Studio cannot be booked.
2. Book Atlas with an organizer and a future time. Times are entered in your device's local timezone and sent to the API as UTC instants.
3. On Reservations, edit or cancel a future booking. Try creating a second overlapping booking to see a readable backend error.
4. Find the seeded **Engineering sync**, which starts 15 minutes before API startup. Check in and end it early to exercise observed-use timestamps and room release.
5. Open Users to see active reservation counts calculated by the API.

Seed dates are relative to server startup. Restarting the API resets all demo data. No authentication is included because the brief explicitly excludes it. This is a local demo, not an internet-ready multi-user deployment.

## Checks

From the root:

```powershell
dotnet test RoomReservations.slnx
```

From `web`:

```powershell
npm run check
```

`npm run check` runs strict TypeScript checking, a production build, the frontend tests, and formatting checks. `npm run test:watch` runs frontend tests while developing. A GitHub Actions workflow runs backend and frontend checks after the project is pushed.

See [verification.md](docs/verification.md) for the actual execution record. Written tests and source review are not equivalent to passing backend or end-to-end tests.

## Current scope

| Area            | First milestone                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Rooms           | Seed data, active/inactive status, capacity/floor/multiple-equipment filters                              |
| Users           | Seed data, unique IDs, backend-calculated active reservation counts                                       |
| Reservations    | Create, edit, cancel, check in, end early, filter by room/organizer/status/date range                     |
| Rules           | Seven specified rules, configurable duration/advance limits, stable error codes                           |
| Reliability     | Injectable clock, single-process write gate, API error contract, unit/integration/concurrency test source |
| UI              | Responsive pages, native modal, loading/empty/error states, UTC conversion                                |
| Still to finish | Live browser/full-stack verification, usage aggregation/report, calendar/timeline, PDF export             |

## Structure

- `src/RoomReservations.Api/Domain`: entities and reservation lifecycle.
- `src/RoomReservations.Api/Application`: booking policy, validation, service and DTO mapping.
- `src/RoomReservations.Api/Infrastructure`: EF Core context, seed data and the single-process write gate.
- `src/RoomReservations.Api/Api`: HTTP endpoints and Problem Details errors.
- `tests/RoomReservations.Api.Tests`: deterministic boundary, API and concurrency tests.
- `web/src/api`: the typed HTTP boundary.
- `web/src/pages` and `web/src/components`: page-level filtering and reusable presentation/form components.
- `docs`: requirements, assumptions, architecture, delivery plan and verification evidence.

This is intentionally one API project, one test project and one frontend. There is no authentication layer, microservice split, generic repository wrapper or messaging system to maintain for this scope.

## Configuration

Edit `src/RoomReservations.Api/appsettings.json`:

```json
{
  "BookingRules": {
    "MaximumDurationDays": 7,
    "MaximumAdvanceDays": 90
  }
}
```

Configuration is validated on startup. The frontend reads the policy from `/api/booking-policy`; it does not hard-code the displayed limits.

## Clone from GitHub

To open the project in VS Code from a fresh checkout:

```powershell
git clone https://github.com/MerveilleDivine/room_reservation_system.git
cd room_reservation_system
code .
```

Follow the two-terminal startup instructions above. The repository contains the solution and engineering notes; the employer's original assignment and correspondence are kept outside the source tree.

## Engineering notes

- [Requirements and acceptance criteria](docs/requirements.md)
- [Architecture and decisions](docs/architecture.md)
- [Implementation plan](docs/implementation-plan.md)
- [API contract](docs/api.md)
- [Verification record](docs/verification.md)
