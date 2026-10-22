# Architecture and decisions

## Boundaries

The React app sends JSON to the ASP.NET API through Vite's local `/api` proxy. Endpoints delegate mutation work to `ReservationService`. The service loads the room and organizer, obtains the current UTC time, invokes `BookingRules`, writes through EF Core, and returns a DTO. `ApiExceptionHandler` translates failures into a consistent HTTP response.

Dependency direction is explicit:

- Domain entities have no HTTP or EF dependency.
- `BookingRules` uses domain data and configured limits, not the database or browser.
- The application service orchestrates persistence and policy checks.
- Infrastructure owns EF Core and demo seed data.
- React owns presentation, form entry and request state. The API supplies status, allowed actions, active counts and policy values.

These are folders within one API project, not separate deployable services. Extracting assemblies is unnecessary for the current size.

## ADR 1: use the required InMemory provider, acknowledge its limits

**Decision:** EF Core InMemory, as required by the assignment. Data is ephemeral and reset on API restart.

**Consequences:** this is not a relational database or a production persistence strategy. Referential checks are explicit. A singleton write gate protects validation plus save only within this one API process. InMemory does not supply the relational guarantees needed for multiple deployed instances.

**Production direction, not implemented:** move to a relational provider, enforce required relationships, implement a database-backed concurrency/overlap strategy and integration-test it against that real provider. A process-local semaphore must not be advertised as a distributed solution.

Reference: [Microsoft EF Core InMemory guidance](https://learn.microsoft.com/en-us/ef/core/providers/in-memory/).

## ADR 2: validate the complete booking on the backend

**Decision:** one policy validator covers create and edit. A changed reservation is excluded from its own overlap check. Cancelled intervals do not block; an early-completed meeting blocks only its effective historical interval.

**Concurrency:** the service acquires `BookingWriteGate` before reading conflicts and holds it through save. Cancel/check-in/end use the same gate. The API does not perform a separate availability check and then trust that old result during save.

**Tradeoff:** all writes are serialized. This is simple and correct for a tiny, single-process, in-memory demo. The code documents the scaling limit instead of adding unsupported distributed machinery.

## ADR 3: time is an injected dependency

**Decision:** use `DateTimeOffset` and `TimeProvider`. Sample data is relative to the clock; tests use a fixed clock. Store normalized UTC instants. New booking start must be strictly after `now`.

**Interval semantics:** `[start, end)`. Exactly seven elapsed days and exactly ninety days ahead are allowed by default.

**UI:** local date inputs are converted to ISO UTC before transmission. No “fake UTC” string concatenation. A browser timezone is not a complete solution for ambiguous/nonexistent daylight-saving local times; a business-timezone input policy remains a documented next step.

## ADR 4: preserve schedule versus observation

**Decision:** keep `startUtc`/`endUtc`, `checkedInAtUtc` and `actualEndUtc` separate.

- Scheduled duration is a booking, not measured physical occupancy.
- Check-in starts an observed-use window; it does not retrospectively prove the room was used from scheduled start.
- Early completion releases the room immediately while retaining its original scheduled end.
- Missing check-in is unconfirmed use, not a no-show classification.

A future report must label planned, observed and unknown data separately. Do not calculate impressive-looking utilization figures from bookings alone.

## ADR 5: modest frontend state

**Decision:** React local state and a small abortable resource hook are sufficient. Page-specific filters stay in their own page components. Shared room/user data is loaded once per refresh; independent requests start concurrently. Requests are cancelled on unmount or query changes so stale responses do not overwrite newer queries.

**Tradeoff:** no persistent client cache or router yet. Reloading returns to the Rooms page. Add a query library or routing when caching, deep links or more complex navigation justify it; do not add Redux solely to make the stack list longer.

**Refresh:** mutation success reloads API-derived state, and a 30-second refresh updates elapsed statuses/allowed actions. Backend checks remain authoritative if a button's availability changes between refresh and click.

## ADR 6: predictable failures

Business failures carry a stable code and human message using Problem Details. Missing resources are 404, scheduling/lifecycle conflicts are 409, and invalid values are 400. Malformed bound requests are also routed through the handler. The frontend displays the server's message, keeps the form open, and preserves input.

Unexpected server errors must not expose exception internals. Normal server logging remains enabled. The API is bound to loopback for development and has no authentication by explicit assignment scope. Do not deploy it publicly as-is.
