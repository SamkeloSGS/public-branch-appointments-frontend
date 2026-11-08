# Spec: Angular frontend

Appointment Booking System · Angular single-page application · Domain-organised architecture

| | |
|---|---|
| Status | Draft for review |
| Scope | The Angular application used by customers, branch staff, branch admins and head-office admins |
| Depends on | The REST API sections of `branch-management-spec.md` (9), `customer-spec.md` (7), `booking-spec.md` (7) and `notification-spec.md` (7). The Identity and access design: Keycloak for sign-in, `GET /api/me` for role and branches, and the staff management endpoints |
| Out of scope | Backend behaviour, Keycloak realm setup, message templates |
| Date | 2026-10-09 |

How to use this spec: sections 1 to 7 define what to build and the rules all frontend code follows. Section 8 lists requirements with acceptance criteria; every requirement ID (`FE-n`) must be traceable to at least one test. Section 9 is the build order, and section 10 lists the assumptions to confirm.

---

## 1. Context

One Angular application with two areas:

| Area | Users | Characteristics |
|---|---|---|
| Customer area | The public and signed-in customers | Mobile-first, few screens, must be fast and simple |
| Admin area, under `/admin` | Branch staff, branch admins, head office | Desktop-first, data-dense, role-dependent |

The server is the authority on every business rule. The frontend's job is to present choices clearly, validate input for a better experience, and explain the server's answers. It never decides whether a time is free, whether a cancellation is allowed, or what a user may access.

## 2. Technology baseline

| Concern | Choice |
|---|---|
| Framework | Angular 22.x, standalone components, strict TypeScript |
| State | Angular signals, in per-domain store services. No global store library |
| Routing | Angular Router with lazy-loaded route trees per domain and area |
| HTTP | `HttpClient` with functional interceptors |
| Forms | Reactive forms |
| Sign-in | `keycloak-angular` with `keycloak-js`, authorization code flow with PKCE. The `keycloak-angular` major version matches the Angular major; `keycloak-js` matches the Keycloak server version |
| Components | Angular Material and CDK (assumption, see section 10) |
| Boundaries | Lint rules that enforce section 3, run in the build |
| Tests | The Angular CLI's default unit test runner; Playwright for end-to-end tests |

## 3. Architecture rules

The frontend is organised by domain, mirroring the backend's bounded contexts. Strategic DDD applies: the same contexts, the same names, enforced boundaries. Tactical DDD does not: there are no aggregates or repositories in the frontend, because business rules live on the server.

### 3.1 Structure

```
src/app/
  app.config.ts            providers: router, http, keycloak
  app.routes.ts            top-level lazy routes
  booking/
    index.ts               public entry: the only file other domains may import
    booking.routes.ts
    feature/               pages and smart components
    ui/                    presentational components
    data/                  API clients and signal stores
    model/                 TypeScript types for this domain
  branch-management/       same four layers
  customer/                same four layers
  identity/
    feature/               staff management pages
    data/                  current user, Keycloak wiring, guards, interceptors
    model/
  shared/
    ui/                    buttons, dialogs, tables, layout shell
    util/                  date and time formatting, error mapping, ETag helpers
```

Notification has two small staff screens and no customer-facing UI, so they live in `booking/feature` with their API client in `booking/data`.

### 3.2 Layers inside a domain

| Layer | Contains | May import |
|---|---|---|
| `feature` | Routed pages and smart components. They inject stores, call actions, and pass data down | `ui`, `data`, `model`, `shared` |
| `ui` | Presentational components: inputs in, events out. No HTTP, no stores, no router | `model`, `shared/ui` |
| `data` | One API client per backend resource, and signal stores holding loaded state | `model`, `shared/util` |
| `model` | Types and pure functions over them | Nothing |

### 3.3 Dependency rules

- A domain imports from another domain only through that domain's `index.ts`.
- `shared` imports from no domain. Anything that mentions an appointment, branch or customer does not belong in `shared`.
- `identity` may be imported by every domain (current user, guards). `identity` imports from no other domain.
- Customer-area routes and admin-area routes are separate lazy-loaded trees. No customer route imports an admin page.
- These rules are lint errors, not conventions.

### 3.4 Ubiquitous language

Type names, component names, route names and on-screen labels use the terms from the backend specs' glossaries: branch, service, service offering, capacity pool, calendar exception, capacity override, appointment, booking reference, rebooking required, overbooked. Synonyms are not introduced.

Types in `model` mirror the API's request and response shapes. They are generated from the backend's OpenAPI description if one is published (see section 10); otherwise written by hand and kept in step.

## 4. Cross-cutting rules

### 4.1 Sign-in and current user

- Keycloak is initialised at application start in "check" mode: a returning signed-in user is recognised, but nobody is forced to sign in to browse.
- An interceptor attaches the access token to requests to the API's base URL only, and never to other hosts.
- Tokens are refreshed automatically before expiry. If refresh fails, the user is sent to sign in and returned to the page they were on.
- After sign-in the app loads `GET /api/me` once and holds the result in a `CurrentUser` store: role and branch IDs.
- A signed-in user with the customer role and no profile is sent to profile setup before any screen that needs one.

### 4.2 Authorisation in the UI

- Route guards and menu visibility are driven by `CurrentUser`. They are a convenience only.
- A `403` from the API is always handled, even on a screen the guard allowed.
- Staff with several branches choose a working branch; the choice is kept for the session and shown in the admin header. Head office can choose any branch.

### 4.3 Calling the API

- **Errors.** The API returns Problem Details. A shared mapper turns status and error code into a user-facing message; each domain supplies the messages for its own codes. Unknown errors show a generic message and a retry option.
- **Stale data.** Single-resource responses carry an `ETag`. The data layer stores it with the resource and sends `If-Match` on updates. On `412` the user is told the record changed, and the latest version is reloaded.
- **Idempotency.** The booking confirmation generates one idempotency key when the confirm step opens and sends it with every submit attempt from that step.
- **No optimistic updates** for booking, rescheduling or cancelling. The UI waits for the server's answer.

### 4.4 Dates and times

- Every appointment time, opening hour and capacity window is displayed in the **branch's time zone**, never the browser's.
- The branch's time zone name is shown wherever a time is shown to a user who may be elsewhere.
- Local dates and times are sent to the API in the form the API defines; the frontend does not convert branch-local times to UTC.

### 4.5 State

- Each domain has signal stores in `data` for what its pages share: a list, a selected item, loading and error flags.
- State that only one component needs stays in that component.
- Stores are provided at the route level of their domain, so leaving the area discards them.
- Availability is never cached across visits to the time picker; it is reloaded each time the picker opens or the date changes.

### 4.6 Every screen

- Has explicit loading, empty and error states.
- Is usable by keyboard and screen reader, meeting WCAG 2.1 AA.
- In the customer area, works at phone width without horizontal scrolling.

## 5. Customer area

| Route | Screen | API |
|---|---|---|
| `/` | Find a branch: by service and city, or nearest | `GET /branches`, `GET /services` |
| `/branches/:id` | Branch detail: address, hours, services | `GET /branches/{id}` |
| `/book` | Booking flow: service, branch, date, time, confirm | `GET /availability/days`, `GET /availability`, `POST /appointments` |
| `/appointments` | My appointments: upcoming and past | `GET /appointments/mine` |
| `/appointments/:reference` | Appointment detail, with reschedule and cancel | `GET /appointments/mine/{reference}`, `.../reschedule`, `.../cancel` |
| `/profile/setup` | First-time profile | `POST /customers/me` |
| `/profile` | Details, contact preferences, erase my data | `GET`, `PUT /customers/me`, `PUT .../contact-preferences`, `DELETE /customers/me` |

Booking flow rules:

- Steps one to four (service, branch, date, time) need no sign-in.
- Sign-in is required at the confirm step. The selection survives the redirect to Keycloak and back.
- The date step marks days with no open times as unavailable, using `availability/days`.
- On `SLOT_UNAVAILABLE` the flow returns to the time step with fresh times and a message that the time was just taken.

## 6. Admin area

All routes are under `/admin` and require a staff role. The working branch is part of the route for branch-scoped screens.

| Route | Screen | Minimum role | API |
|---|---|---|---|
| `/admin/branches/:branchId/day` | Day list with check-in, complete, no-show, cancel, reschedule | Branch staff | Booking staff endpoints |
| `/admin/appointments/:id` | Appointment detail with actions and its notifications | Branch staff | Booking, Notification |
| `/admin/branches/:branchId/book` | Book for a customer: find or create customer, then the booking steps | Branch staff | Customer admin, Booking |
| `/admin/customers` | Customer search and detail. Deactivate, reactivate and erase are shown to head office only | Branch staff | Customer admin |
| `/admin/branches/:branchId/notifications` | Failed notifications, with resend | Branch staff | Notification |
| `/admin/branches/:branchId/hours` | Weekly hours | Branch admin | Branch management |
| `/admin/branches/:branchId/capacity` | Capacity pools and service offerings | Branch admin | Branch management |
| `/admin/branches/:branchId/calendar` | Calendar exceptions and capacity overrides | Branch admin | Branch management, Booking impact preview |
| `/admin/branches/:branchId/overbooked` | Overbooked days and choosing who moves | Branch admin | Booking |
| `/admin/branches` | Register, edit, activate, suspend, close branches | Head office | Branch management |
| `/admin/services` | Service catalog | Head office | Branch management |
| `/admin/staff` | Invite, roles, branch assignments, suspend, remove, change log | Head office | Identity |

Admin rules:

- Before saving a calendar exception or capacity override, the screen calls the impact preview and shows the counts. The admin must confirm when either count is above zero.
- Destructive or far-reaching actions (close branch, erase customer, remove staff, displace appointment) require a confirmation dialog that names what will happen.
- Customer search requires at least 3 characters before sending a request.

## 7. Messages for API error codes

| Code | Shown to the user |
|---|---|
| `SLOT_UNAVAILABLE` | That time was just taken. Here are the times still open |
| `OUTSIDE_BOOKING_WINDOW` | That time can't be booked online. Choose a different time |
| `OFFERING_UNAVAILABLE` | This branch isn't taking bookings for that service right now |
| `CUSTOMER_INACTIVE` | Your account can't make bookings. Contact a branch |
| `PROFILE_REQUIRED` | No message; redirect to profile setup |
| `OVERLAPPING_APPOINTMENT` | You already have an appointment at that time |
| `TOO_MANY_APPOINTMENTS` | You've reached the limit of upcoming appointments |
| `PAST_CUTOFF` | It's too late to change this appointment online. Contact the branch |
| `INVALID_STATE` | This appointment has changed. Reloading |

Wording is a starting point for review, and all text is held in translation files, not in components.

## 8. Requirements and acceptance criteria

**FE-1 Architecture boundaries**
- A change that imports another domain's inner folder, imports a domain from `shared`, or breaks the layer rules in 3.2 fails the lint step.
- The build fails when lint fails.

**FE-2 Sign-in and session**
- A visitor can browse branches and open times without signing in.
- When a signed-in user returns, they are recognised without being asked to sign in again while their Keycloak session is valid.
- When token refresh fails, the user is sent to sign in and returned to the same page.
- The access token is never sent to a host other than the API.

**FE-3 Roles, guards and navigation**
- Menus show only what the current role can use.
- Navigating directly to a route above the user's role shows a "not allowed" page, not a blank screen.
- A `403` from the API on any screen shows the same "not allowed" state.

**FE-4 First-time profile**
- A signed-in customer without a profile who reaches a screen that needs one is sent to profile setup and returned afterwards.
- The email field is pre-filled from the sign-in identity.

**FE-5 Find a branch**
- A visitor can filter branches by service and city, and sort by distance if they allow location access.
- If location access is refused, the screen works without distance sorting and shows no error.

**FE-6 Book an appointment**
- A customer can complete a booking in the five steps of section 5 and sees the booking reference on success.
- A selection made before sign-in is still selected after returning from Keycloak.
- Submitting twice from the confirm step creates one appointment.
- On `SLOT_UNAVAILABLE` the customer is returned to the time step with refreshed times.
- Every other rejection shows its message from section 7.

**FE-7 My appointments**
- Upcoming and past appointments are listed with service, branch, date and time in the branch's time zone.
- An appointment in `REBOOKING_REQUIRED` is shown prominently with a "choose a new time" action.
- Reschedule and cancel are offered only for statuses that allow them; after the cutoff the screen explains why they are unavailable instead of hiding them.

**FE-8 Profile and preferences**
- A customer can change contact details and preferences; the screen prevents switching off the last channel and explains why.
- Erasing data requires typing a confirmation and warns that upcoming appointments will be cancelled. Afterwards the user is signed out.

**FE-9 Staff day list**
- Staff see the working branch's appointments for a date, ordered by start time, with status.
- Each row offers only the actions valid for its status and the current time.
- After an action, the row reflects the server's response without reloading the page.

**FE-10 Book for a customer**
- Staff can find an existing customer or create one, then book using the same steps as a customer.
- When creating a customer fails because the email exists, the existing customer is offered for selection.

**FE-11 Hours, capacity and calendar**
- A branch admin can edit weekly hours, pools, offerings, exceptions and overrides for assigned branches.
- Saving an exception or override shows the impact preview first; with a non-zero impact the admin must confirm.
- Validation errors from the server are shown next to the field they concern.

**FE-12 Overbooked days**
- A branch admin sees each overbooked interval with the appointments in it and can choose one to displace.
- After displacing, the list refreshes and the interval disappears once it is no longer overbooked.

**FE-13 Head-office screens**
- Head office can manage branches, the service catalog and staff as listed in section 6.
- A rejected activation names the missing precondition returned by the server.

**FE-14 Notifications**
- An appointment's detail shows every notification with type, status, reason and channel outcomes.
- Staff can resend from the failed list; the new notification appears as pending.

**FE-15 Errors and stale data**
- On `412`, the user is told the record changed and the latest version is loaded; their unsaved input is not silently discarded.
- A network failure shows a retry option and never an empty screen.

**FE-16 Time zones**
- With the browser set to a different time zone from the branch, all appointment times and hours still show the branch's local time, with the zone named.

**FE-17 Accessibility and responsiveness**
- All customer-area screens pass automated accessibility checks and can be completed with a keyboard alone.
- The booking flow is usable at 360 pixels wide.

**FE-18 Lazy loading**
- A customer who never visits `/admin` downloads no admin-area code.

## 9. Implementation tasks

- [ ] 1. Workspace, strict TypeScript, lint with the boundary rules of section 3, CI running lint and tests (FE-1)
- [ ] 2. App shell, shared UI and layout for both areas
- [ ] 3. Keycloak wiring, token interceptor, refresh, `CurrentUser` store, guards (FE-2, FE-3)
- [ ] 4. Shared error mapper, ETag helpers, date and time formatting in a given zone (FE-15, FE-16)
- [ ] 5. Customer domain: profile setup, profile, preferences, erase (FE-4, FE-8)
- [ ] 6. Branch finder and branch detail (FE-5)
- [ ] 7. Booking flow with sign-in handoff and idempotency (FE-6)
- [ ] 8. My appointments, reschedule, cancel (FE-7)
- [ ] 9. Admin shell with working-branch selection
- [ ] 10. Day list and appointment actions (FE-9)
- [ ] 11. Customer search and book for a customer (FE-10)
- [ ] 12. Hours, capacity, calendar with impact preview (FE-11)
- [ ] 13. Overbooked days (FE-12)
- [ ] 14. Notification views and resend (FE-14)
- [ ] 15. Head-office screens: branches, services, staff (FE-13)
- [ ] 16. Accessibility and responsive pass, lazy-loading check (FE-17, FE-18)
- [ ] 17. End-to-end tests for booking, rescheduling, cancelling, and a capacity override with impact preview

Test levels:

| Level | Covers |
|---|---|
| Unit | `model` functions, stores, error mapper, time formatting |
| Component | `ui` components with inputs and events; `feature` pages with fake API clients |
| End-to-end | The journeys in task 17 against a running backend with a test Keycloak realm |

## 10. Assumptions and open decisions

| # | Item | Current assumption |
|---|---|---|
| 1 | One application | Customers and staff share one Angular app with two lazy-loaded areas. Two separate apps is the alternative if they need different release schedules or hosting |
| 2 | Component library | Angular Material. Any accessible library works; the rules in section 3 do not depend on it |
| 3 | Boundary tooling | Lint-based boundary rules in a single workspace. A monorepo tool with library projects is the alternative if the app grows |
| 4 | API types | Generated from an OpenAPI description published by the backend. The backend specs do not yet require one; add that requirement or write the types by hand |
| 5 | Languages | The UI is translatable from the start, because customers have a preferred language. The list of languages is the same as the backend's |
| 6 | No global store | Per-domain signal stores are enough. Revisit if many screens start sharing and changing the same data |
| 7 | Identity endpoints | `GET /api/me` and the staff endpoints are taken from the Identity and access design; its spec file is not written yet |
| 8 | Offline use | Not supported |
