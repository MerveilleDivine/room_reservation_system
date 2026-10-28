# Roomwise

**Find a room. Make a plan. Keep everyone’s time clear.**

Roomwise is a meeting-room reservation app. Find a space that fits your group, check that it is free for the whole meeting, and manage your booking as plans change. If you finish early, release the room. If you need longer, see how much extra time is available.

Built for an internship technical assignment with **ASP.NET Core, Entity Framework Core InMemory, React and TypeScript**. Booking rules and calculations run in the backend; React handles the interface.

**[Open Roomwise](https://roomwise-reservations.onrender.com/)** · [Run locally](#run-locally) · [How it works](#how-it-works) · [Architecture](docs/architecture.md)

## Try it out

No account setup is needed. Choose a sample profile in the header to explore the app.

1. **Find your next meeting.** Reservations opens on your own upcoming bookings. History holds completed and cancelled meetings.
2. **Find a room.** Open Rooms, choose the start and end, then select **Find a room**. Filter by group size, floor or equipment when needed.
3. **Make a reservation.** Choose **Book this room**, add a meeting title and the number of attendees, and check the details. The selected room and times carry into the form. Your organizer is filled in for a member profile.
4. **Consider a smaller space.** If a smaller suitable room is available, the form offers it as an option. Choose **Use Birch**, for example, to switch, or keep your original room.
5. **See your booking in Upcoming.** After saving, the app opens the page containing your reservation in its chronological place. You can edit or cancel it before it starts.
6. **Manage a meeting in progress.** Check in, reserve more time or end early to release the remaining time.

Choose **Administrator** to explore the full workspace schedule, the People view and Usage reports. Member profiles see their own reservation details.

The hosted demo runs on Render’s free service. After an idle period, its first load can take about a minute. Bookings stay through browser refreshes while the server is running; a server restart or redeployment resets the sample data.

## How it works

### A room that fits your group

Say you select **Atlas, which seats 12**, for **6 people**. If **Birch, which seats 6**, is free for the entire meeting, Roomwise can suggest it.

The suggestion shows the room’s capacity, floor and equipment, including equipment differences from your selected room. Equipment requirements chosen in the room finder are kept. You decide whether to switch; accepting changes only the room and preserves the other meeting details.

A suggestion is an availability check, not a reservation. Saving checks everything again, including whether somebody has booked that room in the meantime.

### A meeting needs a little longer

The extra-time form shows the available gap before the next room or organizer booking. If there are **2 minutes free**, you can reserve up to **2 minutes**. If the next meeting starts immediately afterward, there is no extra time available.

The next booking’s time interval is shown without its meeting title or organizer. Extra time creates a separate reservation linked to the original meeting, and the server checks the gap again when you save.

### Meetings finish early, or plans change

You can edit or cancel a future booking. During a meeting, ending early releases the unused portion of the reservation. Cancelled bookings also release their time.

Check-in is a manual record of reported use. Usage reports distinguish scheduled time, reported use, unconfirmed time and time released early. A missing check-in is treated as unconfirmed use. See the [usage definitions](docs/usage-report.md) for how those figures are calculated.

### Two requests arrive at the same time

The backend checks and saves booking changes together, one at a time, within the server process. That prevents two overlapping requests from both taking the same room or organizer slot.

Create, edit and extra-time requests also have identifiers that let the app recover a lost confirmation without creating another copy of the booking. These receipts last for the current server process.

## Booking rules

The default policy follows the assignment:

| Rule                   | What it means                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- |
| Duration               | Up to 7 days per reservation; exactly 7 days is allowed.                      |
| Room availability      | Reservations for the same room cannot overlap.                                |
| Organizer availability | An organizer cannot have overlapping meetings, including in different rooms.  |
| Dates                  | The start must be in the future, and the end must follow the start.           |
| Attendees              | A positive whole number, including the organizer, within the room’s capacity. |
| Advance booking        | A reservation can start up to 90 days ahead.                                  |
| Active rooms           | Only active rooms can be booked.                                              |

Back-to-back meetings are allowed: one can start exactly when another ends. Dates are entered in your device’s local timezone and sent to the API as UTC instants.

The duration and advance limits can be changed in [appsettings.json](src/RoomReservations.Api/appsettings.json). A day means 24 elapsed hours.

## Tech stack

| Part     | Technology                                                                |
| -------- | ------------------------------------------------------------------------- |
| Backend  | ASP.NET Core on .NET 10                                                   |
| Data     | Entity Framework Core InMemory with seeded rooms, people and reservations |
| Frontend | React 19, TypeScript and Vite                                             |
| Testing  | xUnit, Vitest, React Testing Library and Playwright                       |
| Delivery | GitHub Actions, Docker and a single-instance Render service               |

The app uses one API project, one backend test project and one frontend. No external database, secrets or database account are needed to run it locally.

## Run locally

### 1. Get the project

Install Git, the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) and [Node.js](https://nodejs.org/en/download). Node 24.15 or later in the 24.x series is supported; see [package.json](web/package.json) for other supported versions. Install the .NET **SDK**, which includes the tools to build the app.

```sh
git clone https://github.com/MerveilleDivine/room_reservation_system.git
cd room_reservation_system
```

Open this folder in VS Code or your preferred editor.

### 2. Start the API

From the repository root:

```sh
dotnet restore RoomReservations.slnx
dotnet run --project src/RoomReservations.Api
```

Leave this terminal running. The API runs on port 5080. Open its [health check](http://localhost:5080/api/health) to confirm it is ready.

### 3. Start the frontend

Open a second terminal at the repository root:

```sh
cd web
npm ci
npm run dev
```

Open **[http://127.0.0.1:5173](http://127.0.0.1:5173)** and choose a profile. Vite forwards API requests to the backend on port 5080.

If the page cannot reach the API, check that both terminals are still running. If `dotnet` is not recognized after installation, restart your terminal. VS Code’s **Terminal → Run Task** menu also includes API, frontend and test commands.

### Prefer Docker?

With Docker installed, run these commands from the repository root:

```sh
docker build --tag roomwise .
docker run --rm --publish 8080:8080 roomwise
```

Then open [http://localhost:8080](http://localhost:8080). The container builds the frontend and serves both the app and API through ASP.NET on the same port.

## Check the work

Run backend tests from the repository root:

```sh
dotnet test RoomReservations.slnx
```

Run frontend checks from `web`:

```sh
npm run check
```

This checks TypeScript, builds the frontend, runs unit tests and checks formatting.

For browser tests, stop the local development servers so their ports are free, then run from `web`:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts the real API and frontend with fresh sample data. Tests cover creating, reloading, editing and cancelling bookings; smaller-room suggestions; conflicts; extra time; lost confirmations; profile ownership; usage reports; and mobile and keyboard interactions.

GitHub Actions also runs the browser scenarios against the published Docker container. The [verification record](docs/verification.md) links the passing runs and records the exact source revisions, test counts and live checks.

## Find your way around the code

| Folder                                    | What belongs there                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `src/RoomReservations.Api/Domain`         | Rooms, people, reservations and reservation states                         |
| `src/RoomReservations.Api/Application`    | Booking rules, availability, suggestions, reservation services and reports |
| `src/RoomReservations.Api/Infrastructure` | EF Core context, sample data and the booking write gate                    |
| `src/RoomReservations.Api/Api`            | HTTP endpoints and consistent API errors                                   |
| `web/src`                                 | React pages, forms, API client and interface components                    |
| `tests/RoomReservations.Api.Tests`        | Backend rule, API, recovery and concurrency tests                          |
| `web/e2e`                                 | Browser tests using the real API                                           |
| `docs`                                    | Requirements, decisions, API reference and verification evidence           |

Start with the [architecture notes](docs/architecture.md) for the reasons behind the structure and its trade-offs.

## Demo scope and hosting

The assignment uses **EF Core InMemory**. Rooms and people are preloaded; creating or administering rooms and people is outside this version’s scope. Bookings and request receipts live in one server process and reset when that process restarts. Running one instance keeps every browser connected to the same booking store.

Profiles are selectable demo identities, with member and administrator views. They demonstrate ownership rules without account authentication. Use sample information in the public demo; real office use would need authenticated users, trusted roles and durable storage.

The current app is hosted on Render. The old Vercel address forwards to it. Deployment configuration is in [render.yaml](render.yaml), with the setup explained in [hosting.md](docs/hosting.md).

Optional calendar/timeline views and PDF export from the brief remain future work.

## More detail

- [Assignment requirements and acceptance criteria](docs/requirements.md)
- [Architecture and engineering decisions](docs/architecture.md)
- [API reference](docs/api.md)
- [Test results and live verification](docs/verification.md)
- [Usage report definitions](docs/usage-report.md)
- [Hosting and deployment](docs/hosting.md)
- [Image credits](web/public/images/CREDITS.md)
