# Running the assignment demo

The same ASP.NET Core, EF Core InMemory and React application runs locally and on the demo host. ASP.NET serves the compiled React files and `/api` on one port. No additional database service or connection secret is required.

## One server process

InMemory belongs to one running process. The process-wide booking gate protects validation plus saving against overlapping requests. Every request must reach that same process: multiple independently running replicas would have different booking stores.

The root `Dockerfile` builds and runs one non-root ASP.NET process. `render.yaml` selects a free single-instance web service in Frankfurt, configures the allowed hostname and checks `/api/health`. The API refuses Vercel execution because Vercel's independently scaled instances cannot share the required in-memory store.

## Local check

```sh
docker build --tag roomwise .
docker run --rm --publish 8080:8080 roomwise
```

Open `http://localhost:8080`. Create, refresh, edit and cancel a booking. The reservation must stay consistent while that process runs.

## Hosted release

The [live app](https://roomwise-reservations.onrender.com/) is service `srv-dbgst9dg1s2s73c8col0` in the approved `My Workspace`, using the free Frankfurt compute plan with one instance. It was created directly through Render's connector. The deployed source is `7b2066d4cac6ffa3d17ec86c9ec42fa7082891f5`, from `fix/hosted-booking-reliability`. Auto-deploy is off so repository documentation updates do not reset the demo. The initial service uses Render's default TCP readiness check; `/api/health` was separately verified to return 200. The reusable Blueprint additionally specifies HTTP health checks.

For future releases, deploy an explicitly tested revision from the configured branch. Preserve the single-instance limit. The acceptance checks are:

1. Edit and cancel a preloaded reservation.
2. Create a reservation and find it in Upcoming, including after browser reload.
3. Check personal and administrator views.
4. Reject room/organizer conflicts and check exact extra-time limits.
5. Confirm mobile forms, filters and History work.

No automated browser suite should target an existing user's live bookings. The complete CI suite uses a fresh disposable store. Hosted smoke checks use named synthetic reservations and cancel them afterward.

## Expected reset

A server restart, redeployment or idle shutdown resets the synthetic data and request receipts. A free Render service sleeps after 15 minutes without traffic and can take about a minute to wake. This is a documented limitation of the assignment demo, not durable reservation storage. Ordinary browser refreshes do not reset a running server's data.

Selectable profiles demonstrate the requested member/admin workflows without account infrastructure. They are not authenticated identities. Use sample data only.

The old Vercel URL forwards to the Render app using `vercel.json` and the static `legacy-redirect` page. It no longer runs the ASP.NET backend. The root Dockerfile continues to serve the real app on Render and locally.

References: [Render free-service limits](https://render.com/docs/free), [scaling](https://render.com/docs/scaling), and [Blueprint fields](https://render.com/docs/blueprint-spec).
