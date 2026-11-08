# Branch Appointments Frontend

Angular single-page app for booking appointments at a bank branch: customers pick a service, a date and a time and manage their appointments; branch staff and the branch manager run the branch from the admin area.

Built with Angular 22 (standalone components, signals, zoneless change detection, strict TypeScript), Angular Material 3, `keycloak-angular` / `keycloak-js` for sign-in and `ngx-translate` for text. It talks to the Branch Appointments backend's REST API at `/api/v1`, which it expects on its own origin.

**The app serves one branch.** `frontend-spec.md` was written for many branches; the differences are listed under [Spec deviations](#spec-deviations).

## Requirements

- Node `^22.22.3` or `>=24.15.0`
- Docker, running
- The [backend](https://github.com/SamkeloSGS/public-branch-appointments-backend) on `localhost:8081`, with its compose services (Keycloak on `localhost:8180`, Mailpit on `localhost:8025`)

## Quickstart

Start the backend first, in its own checkout:

```bash
docker compose up -d    # PostgreSQL, Redis, Vault, Keycloak, Mailpit, monitoring
mvn spring-boot:run     # port 8081
```

`mvn spring-boot:run` uses the backend's `local` profile by default, which points it at those compose services and loads the demo data this app expects — services, opening hours, capacity pools and holidays. The backend does not start without Vault, so `docker compose up -d` is not optional. `docker compose down -v` in the backend resets everything, demo data included.

Then this app:

```bash
npm ci
npm start               # http://localhost:4200
```

Port 4200 is fixed, not just the default — the Keycloak client `appointments-web` registers `http://localhost:4200/*` as its redirect URI. `proxy.conf.json` forwards `/api` to `localhost:8081`, because the API sends no CORS headers.

### Signing in

The local users of the Keycloak realm `appointments` live in the backend's `keycloak/local/` and all share the password `Local-dev-password-1`. They are for local development only.

| User | Role |
| --- | --- |
| `manager@appointments.test` | Branch manager — invited at backend start-up, so it works straight away |
| `staff@appointments.test` | Branch staff — invite them from the admin area first; they already have a login, so no setup email is sent |
| `customer@appointments.test` | Customer; the demo data links this address to a customer record on the first `POST /api/v1/customers/me` |

Admin requests need a second factor, so the first manager or staff sign-in asks to set up an authenticator app.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Dev server on port 4200 with the `/api` proxy |
| `npm run build` | The full gate: lint, translation-key check, architecture and lazy-loading tests, API type check, production build |
| `npm test` | Unit tests (Vitest through `ng test`), run with `TZ=America/New_York` so browser-zone mistakes fail |
| `npm run lint` | ESLint (including the layering rules), `scripts/check-translations.mjs`, `tests/*.test.mjs` |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run api:fetch` | Download `openapi/*.json` from the running backend |
| `npm run api:generate` | Regenerate `src/app/<domain>/model/api.generated.ts` from those files |
| `npm run api:check` | Fail if the generated types are out of date (part of `npm run build`) |

### API types

Request and response types are generated, never hand-written:

```bash
npm run api:fetch       # backend must be running
npm run api:generate
```

`api:fetch` downloads the backend's two OpenAPI groups from `http://localhost:8081/v3/api-docs/{public,admin}` (override with `API_DOCS_URL`) into `openapi/public.json` and `openapi/admin.json`; commit those, then generate. The backend serves them only outside production, alongside Swagger UI at `http://localhost:8081/swagger-ui.html`.

The build fails if the generated files do not match `openapi/`. New nullable response fields have to be added to `NULLABLE` in `scripts/generate-api.mjs`.

### End-to-end tests

`npm run e2e` needs the backend on its default `local` profile with its compose services up. `PW_CHANNEL=msedge` runs them in the installed Edge.

```bash
npx playwright test --ui          # watch a run
npx playwright test --headed
npx playwright codegen http://localhost:4200
```

- `e2e/sign-up-journey.spec.ts` registers a new customer each run (`e2e-<time>@appointments.test`). Keycloak asks for a password only after the email is verified, so the test reads the verification and confirmation mails from Mailpit's API (`e2e/support/mail.ts`, `http://localhost:8025`, override with `E2E_MAILPIT_URL`), waiting up to two minutes for the backend's notification dispatcher.
- The local test customer's demo profile is linked on its first save, so the booking journey fills in the profile form when the app asks for it (a fresh database).
- The admin journey signs in as `manager@appointments.test` with a one-time code from the secret in `e2e/.auth/totp-secrets.json` (git-ignored, recorded when the test sets up the authenticator) or `E2E_TOTP_SECRET_MANAGER`. `npm run e2e:reset-otp` removes that user's authenticator from the **local** Keycloak so the next run records a new one.
- The journeys book, change and cancel real appointments, and clean up after themselves.

## Container image

```bash
docker build -t branch-appointments-frontend .
docker run -p 4200:8080 -e BACKEND_URL=http://backend:8081 branch-appointments-frontend
```

The `Dockerfile` builds the production bundle (`ng build` only — lint and tests run in CI) and serves it with unprivileged nginx on port 8080. `nginx/default.conf.template` proxies `/api` to `BACKEND_URL` (default `http://backend:8081`) and sends client-side routes to `index.html`. The Keycloak address is compiled in from `src/environments/environment.ts`.

Running the whole stack from images — this app, the backend and every service it needs — is covered by the separate Fullstack repository.

### CI

`.github/workflows/frontend-image.yml` runs `npm run build` and `npm test` on every push and pull request, and pushes `<DOCKERHUB_USERNAME>/branch-appointments-frontend` (amd64 and arm64) to Docker Hub from `main` (`latest`, `sha-...`) and from `v*.*.*` tags. It needs the repository variable `DOCKERHUB_USERNAME` and the secret `DOCKERHUB_TOKEN`.

## Architecture

`src/app/<domain>/` mirrors the backend's contexts: `booking`, `branch-management`, `customer`, `identity`. Each domain has four layers, and imports only ever point to the right:

| Layer | Holds | May not |
| --- | --- | --- |
| `feature` | Pages and smart components |  |
| `ui` | Presentational components, inputs in/outputs out | Touch HTTP, the router or stores |
| `data` | API clients, signal stores, guards |  |
| `model` | Types and pure functions | Import anything |

Rules, enforced by ESLint `boundaries/dependencies` and proven by `tests/architecture.test.mjs`:

- Other domains are reachable only through `src/app/<domain>/index.ts`.
- Every domain may import `identity`; `identity` imports no domain.
- `data` may import only the `identity` of other domains.
- `shared/` imports no domain.
- `src/app/shell/` holds the two area layouts (customer shell, admin shell) and sees domains only through their entry files.
- Admin pages live in `<domain>/feature/admin/` with their routes in `<domain>.admin.routes.ts`, gathered by `shell/admin/admin.routes.ts`. Admin code is only ever loaded lazily from routes; the menu is `shell/admin/admin-sections.ts`.
- `app.routes.ts` loads each domain's customer routes with `loadChildren`, keeping domain entry files out of the start-up bundle. Importing a domain entry from `app.*` duplicates it — `scripts/check-lazy-loading.mjs` fails the build if that happens.
- Route-level stores (`providers` on a domain's route) are discarded when the area is left; root stores (`CurrentUser`, `ProfileStore`) reset through `Session.onSessionEnd`.

## Conventions

- **HTTP** goes through `call()` in `shared/util/http.ts`, which throws `ApiError` (status plus the Problem Details `code`). Show failures with `<app-error-panel [error] [messages]>` (403 renders "not allowed"); each domain maps its own codes in `model`.
- **Concurrency.** Single resources are `Versioned<T>` (value plus ETag) and updates send `If-Match`. List rows carry no ETag header, but the API's ETag is the quoted version, so `fromVersion(row)` rebuilds it. On `412`, reload and keep the user's input.
- **Staff screens** pass `[serverDetail]="true"` to the error panel, so branch-management rule violations without a code show the server's own reason (for example why a capacity override conflicts), and every invalid field a `400` names in `errors` is marked (`fieldProblems()` in `shared/util/problem.ts`).
- **Paged lists** (customer search, my appointments, notifications) arrive as `Page<T>` (`shared/util/page.ts`: `items`, `page` from 0, `size`, `totalItems`, `totalPages`) and are rendered with `<app-show-more>`, which appends the next page via `appendPage`. The API takes a `size` of 1 to 100 and defaults to 20. Lists the API returns whole stay plain arrays.
- **Rate limits** are applied per user, or per client address before sign-in, with a tighter limit on booking changes. The backend answers `429` with `Retry-After`.
- **Dates and times** are branch-local and stay strings (`booking/model/calendar.ts`). Display them with the `localDate` / `localTime` pipes and name the zone with `<app-zone-note>`. Never format an appointment time in the browser's zone — the unit tests run in a different zone to catch exactly that.
- The booking selection lives in the `/book` query string; the confirm step mints one idempotency key per opening.
- Effects that call async loaders read their inputs first and run the loader in `untracked`, so writes inside the loader cannot re-trigger the effect.
- All user-facing text lives in `public/i18n/en.json` (ngx-translate, `{{param}}` interpolation). `npm run lint` fails on a key that is used but missing, or defined but unused.
- Unit test names start with the requirement ID (`FE-n`).

## Spec deviations

`frontend-spec.md` (requirement IDs `FE-n`) describes a multi-branch product. This app serves a single branch, so:

- The home page (`/`) **is** the branch page (`GET /api/v1/branch`): address, opening hours, services. There is no branch finder, and the booking flow is service → date → time → confirm, with no branch step and no `branch` parameter in the `/book` query string.
- The roles are branch staff and the branch manager; there is no head office. The manager has every management screen: opening hours, capacity, calendar, overbooked days, service catalog and staff. Staff have no branch assignments.
- Admin screens sit directly under `/admin/` rather than `/admin/branches/:branchId/...`, and the header shows the branch name.
- `BranchCatalog.branch()` holds the branch for the session; booking pages read it through `useBranch()`.

## Related repositories

| Repository | Contents |
| --- | --- |
| [public-branch-appointments-backend](https://github.com/SamkeloSGS/public-branch-appointments-backend) | Spring Boot modular monolith on port 8081, serving `/api/v1`, plus the Keycloak realm and the compose services |
| Branch Appointments Fullstack | Runs the whole app from images — backend, frontend and every service they need |

The backend's own README documents the API conventions this app relies on: `/api/v1` path versioning (unversioned `/api/...` paths are refused), `PageResponse`, Problem Details with an `errors` list on `400`, and the Redis-cached public branch, services and categories.

## Documentation

- `frontend-spec.md` — the specification, with the `FE-n` requirement IDs
- `docs/traceability.md` — which test covers which requirement
- `openapi/` — the backend contract the generated types come from, downloaded by `npm run api:fetch`
