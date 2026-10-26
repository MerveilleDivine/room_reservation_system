# Roomwise
### A room. A time. A booking that actually holds.

You book a meeting room, arrive with your team, and someone else is already there. Lovely.

Roomwise handles the scheduling side of that problem: find a room, make a reservation, and check that both the space and the organizer are free. If the meeting finishes early, release the room. If it needs more time, reserve the next slot without pushing somebody else's meeting out of the way.

I built Roomwise for an internship technical assignment using ASP.NET Core, EF Core InMemory, React and TypeScript.

[Try Roomwise](https://roomwise-reservations.vercel.app/) · [Architecture](docs/architecture.md) · [API](docs/api.md) · [Verification](docs/verification.md)

No account needed. Choose a profile in the header and have a look.

## Give it five minutes

1. Choose a person in the header to manage their own bookings, or Administrator to manage all bookings. Open Rooms. Filter by capacity, floor or equipment. Select several equipment options if you need them together. Studio is inactive, so you cannot book it.
2. Reserve Atlas for a future time. Choose an organizer, add a title and enter the number of attendees.
3. Try booking the same room at the same time. Then try booking that organizer into another room at the same time. Both should be rejected with a clear explanation.
4. Open Reservations to edit or cancel a future booking.
5. Find Engineering sync, seeded as an ongoing meeting at server startup. Check in, reserve more time, or end it early.
6. Open People for active reservation counts and Usage for the room report.

Extra time creates a separate, linked booking. It must fit the room's schedule and the organizer's schedule. Ending the original meeting early does not cancel that extra booking; cancel it separately if you no longer need it.

All times are entered in your device's timezone and sent to the API as UTC instants. Use Refresh workspace to fetch the latest state. An unattended tab does not poll the API.

The demo uses synthetic data and in-memory storage. Restarting the server resets it. Seeded dates are relative to startup, so the ongoing example eventually ends.

## Who can change a booking?

Everyone can browse rooms, people, reservations and usage. A selected member can create bookings for themselves and manage their own reservations. Administrator can create and manage bookings for any organizer.

The selection stays in session storage for the current browser tab. Switching profiles closes open forms. The API checks ownership inside the same write gate used for booking validation, including edits, cancellations, check-in, early completion, extra time and confirmation recovery.

Profiles are selectable sample identities, not authenticated accounts. The `X-Roomwise-Profile` header carries the chosen person ID or `admin`; anyone can switch it. This models the workflow without adding account infrastructure to an assignment that excludes authentication.

## The part I cared about

Getting a booking onto a screen is one part of the work. Deciding what happens when two requests arrive together, or when a saved booking loses its confirmation on the way back, takes a little more thought.

### Two people want the same slot

Booking writes share a single-process gate. Validation and saving happen inside that gate, so simultaneous requests cannot both pass a conflict check for the same slot.

That guarantee matches the assignment's in-memory storage model. A deployment with multiple instances would need shared persistent storage and database-level conflict protection.

### The booking saved. The response disappeared.

Create, edit and additional-time requests carry a request identifier. The server stores a receipt so the client can recover the confirmation instead of immediately creating another booking.

Receipts last for the current server process. They do not survive a restart, and lifecycle actions such as cancellation do not use this recovery mechanism.

### A booked room is not proof of a used room

The usage report separates scheduled time, reported use, unconfirmed time and time released by early completion.

Manual check-in supplies a limited estimate of use. Missing check-in does not prove a no-show. Reaching the scheduled end does not prove that everyone left. The report makes those limits explicit.

[Read the metric definitions](docs/usage-report.md).

## What is included

| Area | What you can do |
| --- | --- |
| Rooms | Browse rooms, see equipment and active status, filter by capacity, floor and multiple equipment options |
| People | View organizers, unique IDs and active reservation counts calculated by the backend |
| Reservations | Create, edit, cancel, check in, reserve additional time and end early |
| Filters | Find reservations by room, organizer, status and date range |
| Usage | Compare scheduled, reported, unconfirmed and early-released time |
| Interface | Use desktop or mobile layouts, keyboard-accessible dialogs and clear loading, empty and error states |

All seven required booking rules are enforced in the backend:

- A reservation can last up to seven days. Exactly seven days is valid.
- Room bookings cannot overlap.
- An organizer cannot have overlapping meetings, even in different rooms.
- The start must be in the future, and the end must follow the start.
- Attendees cannot exceed the room's capacity.
- A reservation can start up to 90 days ahead.
- Inactive rooms cannot be booked.

Adjacent bookings are allowed: one meeting can start exactly when another ends. Cancelled reservations do not block availability, and early completion releases the unused remainder.

The duration and advance limits are configurable.

## Run it locally

You need Git, the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) and [Node.js](https://nodejs.org/en/download). Supported Node versions are 22.22.2+, 24.15+ or 26+. Install the .NET SDK, not just the runtime.

```powershell
git clone https://github.com/MerveilleDivine/room_reservation_system.git
cd room_reservation_system
```

Start the API from the repository root:

```powershell
dotnet restore RoomReservations.slnx
dotnet run --project src/RoomReservations.Api
```

In a second terminal, also from the repository root:

```powershell
cd web
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

Vite forwards `/api` requests to the ASP.NET server at `http://127.0.0.1:5080`. You can check the API at [http://localhost:5080/api/health](http://localhost:5080/api/health).

There are no secrets, environment files or database accounts to configure.

If `dotnet` is not recognized after installation, restart your terminal. If the frontend cannot reach the API, check that the first terminal is still running.

In VS Code, Terminal → Run Task also provides API, web and test commands. C# Dev Kit can discover the solution.

## Where things live

| Location | Responsibility |
| --- | --- |
| `src/RoomReservations.Api/Domain` | Entities and reservation lifecycle |
| `src/RoomReservations.Api/Application` | Booking rules, services, usage calculations and DTO mapping |
| `src/RoomReservations.Api/Infrastructure` | EF Core context, seed data and the write gate |
| `src/RoomReservations.Api/Api` | HTTP endpoints and Problem Details errors |
| `tests/RoomReservations.Api.Tests` | Backend rule, API, recovery and concurrency tests |
| `web/src/api` | Typed API contracts and HTTP client |
| `web/src/pages` | Page-level views and filtering |
| `web/src/components` | Booking forms and reusable interface components |
| `docs` | Requirements, decisions, assumptions and verification evidence |

One API project, one test project and one frontend keep the structure manageable for this scope. Booking decisions and report calculations stay in the backend. React handles interaction and presentation.

The [architecture notes](docs/architecture.md) explain the choices and their trade-offs.

## Check the work

Backend, from the repository root:

```powershell
dotnet test RoomReservations.slnx
```

Frontend, from `web`:

```powershell
npm run check
```

The frontend command checks TypeScript, builds the production app, runs unit tests and checks formatting. For development, `npm run test:watch` runs tests as you work.

For browser tests, close the development servers so their ports are free, then run from `web`:

```powershell
npx playwright install chromium
npm run test:e2e
```

Playwright starts the real API and frontend with fresh seed data. The browser scenarios cover booking, reload, editing, cancellation, conflicts, additional time, lost confirmations, check-in, early completion, usage filtering, mobile layout, keyboard focus, concurrent requests and profile ownership.

GitHub Actions checks both the two-server development setup and the published container.

The profile-selector update passes 32 local frontend tests, TypeScript, the production build and formatting. The recorded full CI verification passed 80 backend tests and eight Chromium scenarios in each server setup. See the [verification record](docs/verification.md) for its source revision, run links and environment limits.

## Change the booking policy

Edit `src/RoomReservations.Api/appsettings.json`:

```json
{
  "BookingRules": {
    "MaximumDurationDays": 7,
    "MaximumAdvanceDays": 90
  }
}
```

Configuration is validated at startup. The current limits are available from `/api/booking-policy`.

A day here means 24 elapsed hours. An explicit office timezone and a policy for ambiguous daylight-saving times would be needed for broader scheduling requirements.

## Run the container

```powershell
docker build --file Dockerfile.vercel --tag roomwise .
docker run --rm --publish 8080:8080 roomwise
```

Open [http://localhost:8080](http://localhost:8080).

The container builds React and publishes ASP.NET into one non-root image. ASP.NET serves the frontend and API from the same origin. The hosted demo uses this same ASP.NET and EF Core InMemory implementation.

`vercel.json` routes requests to the container service. The hosted configuration uses `PORT=8080` and `AllowedHosts=localhost;127.0.0.1;*.vercel.app`.

In-memory data belongs to one running process. Restarts, idle shutdowns and separate instances have separate data. This is a public assignment demo, so use sample information.

To target an already running disposable instance with browser tests, set `PLAYWRIGHT_BASE_URL`. The suite changes booking data and expects fresh seeds.

## What I would do next

Calendar/timeline views and PDF export are optional features from the brief and are not implemented.

For a real shared office deployment, the next work would include persistent storage, database-backed concurrency protection, authentication and an explicit office timezone policy. Those changes would need requirements beyond this assignment.

## A little more detail

- [Requirements and acceptance criteria](docs/requirements.md)
- [Architecture and decisions](docs/architecture.md)
- [Implementation plan](docs/implementation-plan.md)
- [API contract](docs/api.md)
- [Verification record](docs/verification.md)
- [Usage report definitions](docs/usage-report.md)
- [Workspace photograph credit](web/public/images/CREDITS.md)
