# Roomwise

### A room. A time. A booking that actually holds.

You book a meeting room, arrive with your team, and someone else is already there. Lovely.

Roomwise handles the scheduling side of that problem: find a room, make a reservation, and check that both the space and the organizer are free. If the meeting finishes early, release the room. If it needs more time, reserve the next slot without pushing somebody else's meeting out of the way.

I built Roomwise for an internship technical assignment using ASP.NET Core, EF Core InMemory, React and TypeScript.

[Try Roomwise](https://roomwise-reservations.onrender.com/) · [Run locally](#run-it-locally) · [Architecture](docs/architecture.md) · [API](docs/api.md) · [Verification](docs/verification.md)

No account needed. Choose a profile in the header and start with what’s next.

## Give it five minutes

1. Choose a profile. Your personal upcoming reservations open first, with a greeting. Administrator sees the workspace schedule.
2. Open Rooms, choose a start and end time, and find a space. The compact room grid shows availability for that interval. Capacity, floor and equipment filters are there when needed.
3. Book a room. Your selected room and time carry into the form, and your organizer is filled in for a member profile.
4. Your confirmed reservation appears in Upcoming. The app opens its page, even if it is weeks away, and keeps the schedule in chronological order.
5. Open History for past or cancelled meetings. Members see their own bookings; Administrator can filter the workspace schedule. Results are paginated six at a time.
6. Edit or cancel an upcoming booking. For a meeting in progress, check in, reserve more time or end early. Actions follow the selected profile and the meeting's current state.
7. As Administrator, open People or Usage for organizer counts and room activity.

Times use your device's timezone and are sent to the API as UTC instants. Room availability is a snapshot; saving repeats all conflict checks. Extra time is a separate linked booking and must fit the room and organizer schedules.

The reservation form can suggest one smaller room that fits the attendee count and is free for the full meeting. It keeps explicit equipment requirements, shows any equipment differences, and changes the room only when you choose the suggestion. Saving rechecks availability.

The app uses synthetic EF Core InMemory data in one server process. Browser refreshes preserve bookings while the process runs. A server restart resets the demo; seed IDs remain stable, and the ongoing example eventually ends.

[Read the product design and research](docs/product-design.md) for the reasoning behind the flow.

## Who can change a booking?

Members can browse room availability, read their own booking details, and create and manage their own reservations. Administrator can read and manage every organizer's reservations and view People and Usage. List, feed, individual lookup and recovery enforce the selected profile on the server.

The selection stays in session storage for the current browser tab. Switching profiles closes open forms. The API checks ownership inside the same write gate used for booking validation, including edits, cancellations, check-in, early completion, extra time and confirmation recovery.

Profiles are selectable sample identities, not authenticated accounts. The `X-Roomwise-Profile` header carries the chosen person ID or `admin`; anyone can switch it. This models the workflow without adding account infrastructure to an assignment that excludes authentication.

## The part I cared about

Getting a booking onto a screen is one part of the work. Deciding what happens when two requests arrive together, or when a saved booking loses its confirmation on the way back, takes a little more thought.

### Two people want the same slot

Booking writes share a process-wide gate. Validation and saving run within that gate, so concurrent requests cannot both reserve overlapping room or organizer intervals. The gate is released on both success and failure.

One API process is a deliberate deployment constraint of the required InMemory provider. The hosted configuration uses one instance. A distributed service would need different storage and concurrency requirements.

### The booking saved. The response disappeared.

Create, edit and additional-time requests carry a request identifier. The server stores a receipt so the client can recover the confirmation instead of immediately creating another booking.

Receipts last for the current server process. They support retrying a lost confirmation without duplicating the booking, but do not survive server replacement. Lifecycle actions refresh the schedule after an error so stale controls do not remain on screen.

### A meeting needs two more minutes

The extra-time form asks the server for the exact free gap before the next room or organizer booking. A two-minute gap allows two minutes; an adjacent booking allows none. It shows the blocking interval without the next meeting's title or organizer. Saving rechecks the gap under the booking gate because availability is a snapshot rather than a hold.

### A booked room is not proof of a used room

The usage report separates scheduled time, reported use, unconfirmed time and time released by early completion.

Manual check-in supplies a limited estimate of use. Missing check-in does not prove a no-show. Reaching the scheduled end does not prove that everyone left. The report makes those limits explicit.

[Read the metric definitions](docs/usage-report.md).

## What is included

| Area         | What you can do                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Rooms        | Browse rooms, see equipment and active status, filter by capacity, floor and multiple equipment options |
| People       | View organizers, unique IDs and active reservation counts calculated by the backend                     |
| Reservations | Create, edit, cancel, check in, reserve additional time and end early                                   |
| Filters      | Find reservations by room, organizer, status and date range                                             |
| Usage        | Compare scheduled, reported, unconfirmed and early-released time                                        |
| Interface    | Use desktop or mobile layouts, keyboard-accessible dialogs and clear loading, empty and error states    |

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

| Location                                  | Responsibility                                                 |
| ----------------------------------------- | -------------------------------------------------------------- |
| `src/RoomReservations.Api/Domain`         | Entities and reservation lifecycle                             |
| `src/RoomReservations.Api/Application`    | Booking rules, services, usage calculations and DTO mapping    |
| `src/RoomReservations.Api/Infrastructure` | EF Core context, seed data and the write gate                  |
| `src/RoomReservations.Api/Api`            | HTTP endpoints and Problem Details errors                      |
| `tests/RoomReservations.Api.Tests`        | Backend rule, API, recovery and concurrency tests              |
| `web/src/api`                             | Typed API contracts and HTTP client                            |
| `web/src/pages`                           | Page-level views and filtering                                 |
| `web/src/components`                      | Booking forms and reusable interface components                |
| `docs`                                    | Requirements, decisions, assumptions and verification evidence |

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

See the [verification record](docs/verification.md) for source revisions, test counts, run links and environment limits. Both browser setups use the real ASP.NET API and the assignment-required EF Core InMemory provider.

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
docker build --tag roomwise .
docker run --rm --publish 8080:8080 roomwise
```

Open [http://localhost:8080](http://localhost:8080).

The container builds React and publishes ASP.NET into one non-root image. ASP.NET serves the frontend and API from the same origin. No database account, connection secret or additional service is required.

The [hosted demo](https://roomwise-reservations.onrender.com/) runs on Render's free single-instance service in Frankfurt. Releases are manual, after CI verification. `render.yaml` records a reusable service configuration. The free service sleeps after idle periods; waking it may take about a minute and resets the in-memory demo. Only synthetic information belongs here.

Vercel's independently scaled server instances cannot share this process's memory. The API refuses to start there rather than presenting an inconsistent booking store. The old Vercel address forwards to the single-instance app using a small static redirect page; it no longer runs a separate booking backend. See [hosting.md](docs/hosting.md).

To target an already running disposable instance with browser tests, set `PLAYWRIGHT_BASE_URL`. The suite changes booking data and expects fresh seeds.

## What I would do next

Calendar/timeline views and PDF export are optional features from the brief and are not implemented.

For real office use, the next work includes authenticated identities and trusted role assignment, schema migrations, capacity planning and an explicit office timezone policy. Selectable demo profiles do not protect private real-world bookings.

## A little more detail

- [Requirements and acceptance criteria](docs/requirements.md)
- [Architecture and decisions](docs/architecture.md)
- [Implementation plan](docs/implementation-plan.md)
- [API contract](docs/api.md)
- [Verification record](docs/verification.md)
- [Usage report definitions](docs/usage-report.md)
- [Workspace photograph credit](web/public/images/CREDITS.md)
