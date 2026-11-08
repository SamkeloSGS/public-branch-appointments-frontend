# Requirement traceability

Every requirement of `frontend-spec.md` (section 8) and the tests that cover it. Test names start with the
requirement ID. Unit tests: `npm test` (Vitest, `src/**/*.spec.ts`). Build checks: `npm run lint` (`tests/*.test.mjs`)
and `npm run build`. End-to-end: `npm run e2e` against the running backend (`e2e/*.spec.ts`).

| ID | Requirement | Tests |
|---|---|---|
| FE-1 | Architecture boundaries | `tests/architecture.test.mjs` (12 cases: rejected and accepted imports); `npm run lint` fails the build |
| FE-2 | Sign-in and session | `shared/util/http.spec.ts` (token only for the API on the app origin); `e2e/booking-journeys.spec.ts` (visitor browses, signs in at confirm, returns to the same page) |
| FE-3 | Roles, guards and navigation | `shared/util/problem.spec.ts` (403 shows "not allowed"); admin menu filtered by role in `shell/admin/admin-shell.ts`; route guard `minimumRoleGuard` |
| FE-4 | First-time profile | `customer/model/customer.spec.ts` (email pre-filled, contact required, blank fields not sent); `e2e/sign-up-journey.spec.ts` (asked for on return to the confirm step, email from the sign-in, back to the same selection) |
| FE-5 | The branch page | `branch-management/model/branch.spec.ts` (address, closed days, service names); `e2e/customer-area.spec.ts` |
| FE-6 | Book an appointment | `booking/model/selection.spec.ts`, `booking/model/calendar.spec.ts`, `shared/util/problem.spec.ts`; `e2e/booking-journeys.spec.ts` (selection kept through Keycloak, double submit books once, reference shown); `e2e/sign-up-journey.spec.ts` (a new customer registers, verifies their email, books and receives the confirmation email) |
| FE-7 | My appointments | `booking/model/appointment.spec.ts` (order, changeable statuses, cutoff); `e2e/booking-journeys.spec.ts` (reschedule, cancel) |
| FE-8 | Profile and preferences | `customer/model/customer.spec.ts` (last channel, channel needs its contact) |
| FE-9 | Staff day list | `booking/model/staff-actions.spec.ts` (actions per status and time, order by start, row takes the server answer) |
| FE-10 | Book for a customer | `customer/model/customer.spec.ts` (search from 3 characters, email clash names the customer); `e2e/admin-capacity-override.spec.ts` (staff book two customers) |
| FE-11 | Hours, capacity and calendar | `booking/model/staff-actions.spec.ts` (non-zero impact needs confirmation), `branch-management/model/branch-admin.spec.ts` (hours editor rules); `e2e/admin-capacity-override.spec.ts` (impact preview and confirmation) |
| FE-12 | Overbooked days | `e2e/admin-capacity-override.spec.ts` (move one out, interval disappears) |
| FE-13 | Branch manager screens | `branch-management/model/branch-admin.spec.ts`, `identity/model/staff.spec.ts`, `shared/util/problem.spec.ts` (a rejected change shows the server's reason) |
| FE-14 | Notifications | `booking/model/staff-actions.spec.ts` (which notifications can be resent) |
| FE-15 | Errors and stale data | `shared/util/problem.spec.ts` (412/428 and network failures) |
| FE-16 | Time zones | `shared/util/format.spec.ts`, `booking/model/calendar.spec.ts`; unit tests run with the browser in America/New_York |
| FE-17 | Accessibility and responsiveness | `e2e/customer-area.spec.ts` (axe WCAG 2.1 AA, keyboard-only booking steps, 360 px without horizontal scroll) |
| FE-18 | Lazy loading | `tests/lazy-loading.test.mjs`, `scripts/check-lazy-loading.mjs` (build check); `e2e/customer-area.spec.ts` (no admin code downloaded) |

Not covered by an automated test yet: page-level component tests for the admin screens (FE-9 to FE-14 are covered by
their model rules and the end-to-end journey), and the 412 keep-your-input behaviour on each form (FE-15).
