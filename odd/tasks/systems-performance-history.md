# Systems monthly performance history

Objective: deliver the authorized read-only Systems history unit on `ga_performance-t8`.
Delivery strategy: ask-on-risk; test runner: `npm.cmd run test`.

## Specs

S1. T8.A: Systems monthly performance history. Add the standalone read-only Systems route `/historial-rendimiento-mensual` and navigation label `Historial de rendimiento mensual` under Analítica.
S2. Only active, enabled, role-matched global Systems accounts can access or see the history surface; backend authorization remains authoritative.
S3. Use only `GET /api/calendar/performance/history/` with `area_id`, `business_date`, `from_month`, `to_month`, `cursor`, and `limit`; preserve opaque cursors and identifiers.
S4. Reuse the unchanged Areas service, visibly mark inactive Areas, and provide accessible read-only loading, empty, error, table, and responsive states.
S5. T8.B: correction flow, confirmation, receipt, and audit chain. Pending; not implemented in T8.A.
S6. T8.C: final integration and verification. Pending; not implemented in T8.A.

## Tasks

- [x] T8.A | S1-S4 | inline | complete | RED L6; GREEN L7 | commit pending
- [ ] T8.B | S5 | inline | pending | not started | commit pending
- [ ] T8.C | S6 | inline | pending | not started | commit pending

## Log

L1. You are the frontend implementation agent for T8.A: Systems monthly performance history.

## Authorized isolated worktree
The user explicitly authorized an adjacent dedicated worktree.

From the active frontend repository:

C:\Users\Desarrollador\Documents\proyectos\calendario-frontend

create exactly this worktree and branch:

- worktree:
  C:\Users\Desarrollador\Documents\proyectos\calendario-frontend-t8
- new local branch:
  ga_performance-t8
- base:
  the current checked-out HEAD of branch ga_performance

Record the full base SHA before creating it.

Do not modify the active checkout.
Do not touch its unrelated modified file:
src/features/operationalAlerts/pages/OperationalAlertsPage.jsx
Do not copy, edit, stage, or commit its untracked `.opencode/` directory.

After creating the worktree, perform all implementation only inside:
C:\Users\Desarrollador\Documents\proyectos\calendario-frontend-t8

Do not fetch, pull, push, reset, rebase, merge, amend, deploy, install packages, alter execution policy, or use remote credentials.

[Full authorized T8.A request retained in session transcript; scope is S1-S6 above.]

L2. Base SHA recorded before worktree creation: `0e23d2ef315e8b721711a108916a3fe240d81770`. Worktree: `C:\Users\Desarrollador\Documents\proyectos\calendario-frontend-t8`; branch: `ga_performance-t8`.

L3. T8.A source and focused regression coverage were added within the authorized edit surfaces. The service constructs only the documented history query keys, the UI preserves opaque cursors and does not render or route snapshot identifiers, and the Systems capability requires active, enabled, role-matched global Systems.

L4. RED attempt: `npm.cmd run test -- src/features/performanceHistory/services/performanceHistoryService.test.js src/features/performanceHistory/pages/SystemsPerformanceHistoryPage.test.jsx` could not start because `vitest` is unavailable in the worktree. No packages were installed.

L5. Required lint attempt: `npm.cmd run lint` could not start because `eslint` is unavailable in the worktree. `git diff --check` passed. The full suite was not run because the test runner is unavailable. This is an environmental/inconclusive blocker, not a documented localStorage baseline failure. T8.A remains pending verification and commit; T8.B and T8.C remain pending.

L6. Candidate-caused S4 defect: after an initial Areas-load failure, `Reintentar` called only the history request, which returned without an Area. RED observed with `npm.cmd run test -- src/features/performanceHistory/pages/SystemsPerformanceHistoryPage.test.jsx`: 1 failure, `getAreas` called once instead of twice.

L7. GREEN: retry now distinguishes the failed operation. A failed Areas load sets `areasLoadError`; `Reintentar` starts another Areas attempt, while history errors retain the history retry path. The regression test passed: 5/5 page tests. Focused T8.A tests passed: 7/7. Route, navigation, and policy tests passed: 149/149. Lint passed. Full suite: 635 passed, with only the documented 11 localStorage baseline failures (9 LoginPage, 2 AparienciaContext); OperationalAlertsPage passed. Independent recheck found the original Areas retry blocker structurally corrected; its isolated scratch runtime lacked Vitest.

L8. T8.A is complete with observed functional evidence. T8.B and T8.C remain pending.
