# Feedback remediation

This repair starts from `e2b54be9e516346d3b5fe09c7e28b079f4c35ff1`, the submitted version identified in the supplied feedback plan. All remote branches inspected on 7 November 2026 were behind `main`. Work is on `refactor/reviewer-feedback`.

## Baseline

Fresh checks against the unchanged source on 7 November 2026:

| Check | Result |
| --- | --- |
| Backend Release tests | 136 passed, no skips |
| Frontend build, unit tests and formatting | Passed; 50 tests |
| Chromium with real API and Vite | 14 scenarios passed |

The baseline is a comparison point, not evidence that reviewer feedback was already fixed. Final repair evidence is recorded in [verification.md](verification.md).

## Milestone walkthrough

| Milestone | Previous problem | Changed responsibility and tradeoff | Evidence to review |
| --- | --- | --- | --- |
| Backend boundaries | HTTP handlers queried EF and application code depended on storage/HTTP | Four assemblies enforce dependency direction. Narrow stores return materialized data; minimal APIs stay as small feature modules. One deployed process remains. | Architecture, API, profile and booking tests |
| Booking safety | Access checks could be skipped by omitting the profile dependency | An explicit demo-profile context is required. One shared gate still encloses validation, mutation, receipt and save; recovery waits for writes. | Concurrency, gate release, ownership and receipt tests |
| Frontend transport and data | One client and a custom resource hook mixed transport, operations and server state | Axios handles transport; feature APIs handle operations/recovery; Query owns fetched data. No automatic write retry or background polling. | Transport, cancellation, query/profile tests and lost-response browser journey |
| Composition and navigation | App, booking dialog and reservations page mixed unrelated responsibilities | Shell, workflow, form controller and page sections have distinct owners. Router owns routes and shared reservation filters; one union owns dialogs. | Component tests, route/reload/history and shared-filter browser journeys |
| Feedback and styling | Browser confirmations and duplicated controls gave inconsistent interactions | Shared native dialogs retain input, disable pending actions and restore focus. Tailwind starts with shared controls/layout; Preflight stays off to preserve the design. | Keyboard/mobile browser journeys, lint and desktop/mobile comparison |

## Finding checklist

Backend changes are in `13ae91154f8520af87131d43328478d9831e1d04`; frontend and CI changes are in `7a4ab59` (frontend/test source); delivery permissions are fixed in `1d97023`, and Back/Forward confirmation handling in `26d581439161600ba0905590280262d76ae133ed`. Full commands and packaged-artifact results are in the verification record. “Accepted alternative” means the reviewer concern has an explicit engineering decision rather than a package or pattern added solely for appearance.

| ID | Status | Resolution | Changed code / evidence |
| --- | --- | --- | --- |
| B01 | Verified | Task-returning helpers use Async names | [Backend helper/call-site review and build](../tests/RoomReservations.Api.Tests) |
| B02 | Verified | Queries and profile policy moved out of HTTP handlers | [Feature endpoints and application use cases](../src/RoomReservations.Api/Api/Endpoints) |
| B03 | Verified | Named policy limits, error codes and protocol identifiers; typed lifecycle actions | [Domain/application policy and API tests](../src/RoomReservations.Domain/Errors) |
| B04 | Verified | EquipmentType naming and existing ReservationStatus; wire values preserved | [API/equipment tests](../src/RoomReservations.Domain/Enums) |
| B05 | Verified | Interfaces at storage, profile and concurrency boundaries | [DI registrations and architecture tests](../src/RoomReservations.Application/Abstractions) |
| B06 | Verified | Domain, Application, Infrastructure and API assemblies | [Solution, project references and architecture tests](../RoomReservations.slnx) |
| B07 | Accepted alternative | Narrow store abstractions and typed errors; generic repository/Strategy/Factory accepted as unnecessary | [Architecture decisions and behavior tests](architecture.md) |
| B08 | Verified | Meaningful public types split into dedicated files | [Source organization](../src/RoomReservations.Application) |
| B09 | Accepted alternative | Feature-focused minimal APIs instead of MVC controllers | [Endpoint modules and unchanged HTTP contracts](../src/RoomReservations.Api/Api/Endpoints) |
| B10 | Verified | Unused backend code removed after reference checks | [Build and source review](../src) |
| B11 | Accepted alternative | Namespaces for ordinary types; top-level Program/test-host exception retained | [Build and architecture tests](../src) |
| B12 | Accepted alternative | Pure policies/mappings and DI/endpoint extensions remain static | [Architecture decisions](architecture.md) |
| B13 | Verified | Related assertions grouped using existing xUnit support | [Backend tests; no new assertion-package license](../tests/RoomReservations.Api.Tests/ApiTests.cs) |
| B14 | Verified | Behavior/condition/outcome test names | [Backend test review](../tests/RoomReservations.Api.Tests) |
| B15 | Verified | Arrange, Act and Assert separated; explicit fixtures/profile contexts | [Backend tests](../tests/RoomReservations.Api.Tests/ApiTests.cs) |
| F01 | Verified | Configured Axios transport | [Transport tests and real API journeys](../web/src/shared/api/transport.ts) |
| F02 | Verified | Query owns server state and profile-aware cache identity | [Query/profile tests](../web/src/hooks/useApi.test.tsx) |
| F03 | Verified | ESLint in npm run check and existing CI frontend gate | [Lint and CI configuration](../web/eslint.config.js) |
| F04 | Verified | Router, direct URLs, URL filters and SPA fallback | [Navigation browser tests](../web/e2e/navigation.spec.ts) |
| F05 | Verified | Same-origin /api default and VITE_API_BASE_URL override | [Transport configuration and .env.example](../web/.env.example) |
| F06 | Verified | Async/await for sequential workflows and recovery | [Transport/workflow source review](../web/src/features/reservations/api.ts) |
| F07 | Verified | Incremental Tailwind shared-control/layout migration, preserving existing design | [Build and visual comparison](../web/src/styles.css) |
| F08 | Verified | Feature API modules own endpoint builders | [Component/feature source review](../web/src/features) |
| F09 | Verified | Shared transport/profile identifiers and feature action types | [TypeScript/lint and source review](../web/src/api/contracts.ts) |
| F10 | Verified | Accessible application confirmation dialogs | [Pending, Escape and focus browser tests](../web/src/components/ConfirmationDialog.tsx) |
| F11 | Verified | Booking defaults/date/query helpers extracted from rendering | [Pure helper and component tests](../web/src/components/booking/bookingForm.ts) |
| F12 | Verified | App reduced to providers and routing | [Shell/workflow modules](../web/src/App.tsx) |
| F13 | Verified | Booking fields/controller/defaults extracted | [Booking tests including uncertain outcomes](../web/src/components/booking) |
| F14 | Verified | Reservation filters, list/confirmation/pagination composed separately | [Page and navigation tests](../web/src/pages/reservations) |
| F15 | Verified | Query owns server state; URL owns filters; dialog reducer owns related transitions | [Query/page/profile tests](../web/src/app/useReservationWorkflow.ts) |
| F16 | Accepted alternative | Shared contracts and feature types separated; single-owner props intentionally local | [TypeScript/lint and architecture decisions](../web/src/features/reservations/types.ts) |
| F17 | Verified | Unused frontend code caught by TypeScript and ESLint | [npm run check](../web/package.json) |
| F18 | Verified | Shared modal, transport, query construction and form helpers | [Component tests and source review](../web/src/components/ModalDialog.tsx) |
| F19 | Verified | Feature API operations separated from transport | [Transport/feature tests](../web/src/features) |

## Trace a booking

The booking form controller builds a command and retains its submission key. The feature mutation calls the reservations API through Axios, carrying the selected profile and idempotency header. A reservation endpoint binds the request and invokes the application service. The service enters the shared gate, checks the explicit profile, finds any existing receipt, evaluates domain rules and saves the reservation plus receipt through the EF store.

The returned reservation becomes the confirmation and Query invalidates affected server data. The feed remains the canonical chronological list. If a write response is lost, the feature API looks up its receipt using the same captured profile and submission identity. A missing receipt preserves uncertainty; the app does not invent a failed save or create a replacement booking automatically.

## Limits

Profiles remain selectable synthetic identities, not authentication. Data and receipts reset on restart and belong to one API process. No production database, additional features, infrastructure migration or visual redesign is included. Merging and publishing the repaired demo are separate from this branch's verification.
