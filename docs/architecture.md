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

**Production direction, not implemented:** move to a relational provider, enforce required relationships, implement a database-backed concurrency/overlap strategy and integration-test it against that real provider. The process-local semaphore does not protect writes across instances.

Reference: [Microsoft EF Core InMemory guidance](https://learn.microsoft.com/en-us/ef/core/providers/in-memory/).

## ADR 2: validate the complete booking on the backend

**Decision:** one policy validator covers create, edit and continuation bookings. A changed reservation is excluded from its own overlap check. Cancelled intervals do not block; an early-completed meeting blocks only its effective historical interval. The service shares the room/organizer lookup, validation and mapping path; endpoints do not duplicate booking policy.

**Concurrency:** the service acquires `BookingWriteGate` before reading conflicts and holds it through save. Cancel/check-in/end use the same gate. The API does not perform a separate availability check and then trust that old result during save.

**Tradeoff:** all writes are serialized. This is simple and correct for a tiny, single-process, in-memory demo. The code documents the scaling limit instead of adding unsupported distributed machinery.

## ADR 3: time is an injected dependency

**Decision:** use `DateTimeOffset` and `TimeProvider`. Sample data is relative to the clock; tests use a fixed clock. Store normalized UTC instants. New booking start must be strictly after `now`.

**Interval semantics:** `[start, end)`. Exactly seven elapsed days and exactly ninety days ahead are allowed by default.

**UI:** local date inputs are converted to ISO UTC before transmission. No “fake UTC” string concatenation. A browser timezone is not a complete solution for ambiguous/nonexistent daylight-saving local times; a business-timezone input policy remains a documented next step.

## ADR 4: preserve schedule versus observation

**Decision:** keep `startUtc`/`endUtc`, `checkedInAtUtc` and `actualEndUtc` separate.

- Scheduled duration is a booking, not measured physical occupancy.
- Check-in starts a reported-use estimate; it does not retrospectively prove the room was used from scheduled start, continuously afterwards, or until actual departure.
- Early completion releases the room immediately while retaining its original scheduled end.
- Missing check-in is unconfirmed use, not a no-show classification.

The usage report labels scheduled, reported and unconfirmed minutes separately. Existing JSON metric names remain compatible. An elapsed booking carries a completion note explaining that actual departure is not recorded. Its interval-union calculations run in the backend and avoid double-counting an early-released slot that was booked again. The report snapshot uses the booking gate and one injected clock reading. See [usage-report.md](usage-report.md).

## ADR 5: modest frontend state

**Decision:** React local state and a small abortable resource hook are sufficient. Page-specific filters stay in their own page components. Shared room/user data is loaded once per refresh; independent requests start concurrently. Requests are cancelled on unmount or query changes so stale responses do not overwrite newer queries.

**Tradeoff:** no persistent client cache or router yet. Reloading returns to the Rooms page. A query library or router would become useful for persistent caching, deep links or more complex navigation.

**Refresh:** mutation success reloads API-derived state, and the Refresh workspace button reloads the current view on demand. There is no periodic API polling: an unattended demo tab must not keep a serverless container awake. Displayed statuses and allowed actions describe the last response. Backend checks remain authoritative if a button's availability changes between refresh and click.

## ADR 6: predictable failures

Business failures carry a stable code and human message using Problem Details. Missing resources are 404, scheduling/lifecycle conflicts are 409, and invalid values are 400. Malformed bound requests are also routed through the handler. The frontend displays the server's message, keeps the form open, and preserves input.

Unexpected server errors return a generic message without exception internals. Normal server logging remains enabled. The API is bound to loopback for development and has no authentication by explicit assignment scope. The public preview uses synthetic data and deployment-scoped hostname configuration; it is not intended for private or real office bookings.

## ADR 7: minimal interface

The interface uses a compact top navigation, white space, larger system typography, thin separators and monochrome actions. A small, locally served SVG tile provides a soft hexagon background with sparse pale blue accents. It repeats through CSS without JavaScript, animation or extra dependencies, stays sharp on all screen sizes, and is decorative rather than part of the accessibility tree. The header and dialogs retain solid white surfaces. Rooms appear as a scannable list with explicit IDs, capacity, equipment, status and booking. One locally served, 159 KB workspace photograph provides context; its CC0 source is recorded in `web/public/images/CREDITS.md`, and it is decorative rather than a photograph of a particular seeded room. Explicit image dimensions reserve layout space while it loads.

Reservations, people, usage and the booking dialog share the same spacing and type scale. Inline SVG icons use a consistent stroke. The modal closes before unmounting so the native dialog can restore focus to its trigger. Reduced-motion settings and a keyboard skip link are supported.

## ADR 8: run the browser against the actual stack

Playwright starts a fresh ASP.NET process and the React development server, then drives Chromium through the Vite proxy to EF Core InMemory. CI also builds the published container and runs the same scenarios against ASP.NET serving both the React assets and API on one port. Both browser checks use Playwright's official image, with its exact version derived from the installed test dependency. The development check connects the host test runner to a loopback-bound browser service, preserving the existing server-startup configuration. The published-container check runs the test runner inside the browser image. These test-only browser containers use the Linux runner's network so all page URLs retain the same trustworthy localhost origin as local development, including Web Crypto availability. The published app's port is bound to loopback. Tests run sequentially against deterministic seed scenarios, use distinct future booking windows, and cancel created future reservations. The browser uses Europe/Vilnius, while requests carry UTC instants. Screenshots and failure traces are stored in the CI artifact. Frontend component tests remain separate and explicitly mock their API boundary.

References: [Playwright webServer](https://playwright.dev/docs/test-webserver) and [GitHub CI setup](https://playwright.dev/docs/ci-intro).

## ADR 9: additional time is a linked future reservation

The assignment requires newly saved or edited bookings to start in the future. Updating an ongoing booking's original start would violate that policy. Instead, the service derives a continuation beginning at its scheduled end and invokes the same booking validator. A nullable `ContinuationOfId` records provenance without coupling the two reservations' lifecycle transitions.

Room and organizer conflicts are checked at save under the existing gate. One non-cancelled continuation per parent prevents repeated clicks with new request keys from creating several extra bookings. The parent stays unchanged; the child can be edited or cancelled while future, and needs its own check-in. This intentionally does not infer physical presence, automatically extend a slot, or release a no-show.

## ADR 10: recover ambiguous booking writes with receipts

A booking and its optional `BookingSubmission` receipt are staged in the same EF context and saved together while holding the booking gate. SHA-256 fingerprints use a normalized command payload including operation and target. Receipt replay happens before time-sensitive policy checks, so an acknowledged booking is recoverable after its start or after subsequent edits. Replaying an old edit returns current state without overwriting newer changes. Failed validation never consumes a key.

The API boundary parses the HTTP header; the application service owns receipt matching and write orchestration. React's API client owns transport failure classification and the one recovery lookup. A small submission-key hook preserves identity across form retries; dialogs retain uncertain input rather than starting a different operation. No global state library, extra infrastructure service or alternate backend is introduced.

The guarantee is limited to one in-memory server lifetime. Restart, scale-down or a second instance can lose or miss receipts. This is a recoverable demo workflow, not a claim of globally exactly-once delivery. A production database would need a unique request key, durable receipt retention and a transactional booking/concurrency strategy.

The browser recovery test forwards a POST to the actual ASP.NET API, lets it commit, then aborts only its response to simulate a lost acknowledgement. The subsequent receipt lookup and reservation reads use the real backend. Other browser scenarios do not intercept traffic.

## ADR 11: selectable profiles and reservation ownership

A small header selector switches between the seeded people and Administrator. Members can view all reservations but create only for themselves and manage only their own bookings. Administrator can manage every organizer. The selected profile is stored per tab in session storage, with an in-memory fallback if storage is unavailable.

The browser includes `X-Roomwise-Profile` on API requests. `BookingProfile` checks the selected person against the existing in-memory people, while `ReservationService` checks ownership under its write gate. Edits check both the existing owner and requested organizer, preventing reassignment as a workaround. Request recovery and replay check the reservation's current owner. Missing or invalid profiles cannot make changes.

These are deliberately selectable sample profiles, not authenticated accounts. The header is user-controlled; production authorization would require a verified identity and trusted role assignments. Those distinctions belong in the engineering documentation rather than repeated notices in the interface.

React derives action visibility from the selected profile and the API's lifecycle actions. A member's organizer is filled automatically and read-only. Profile changes clear forms and stale notices; switching is disabled while a write is pending. The API remains authoritative for ownership and lifecycle checks.
