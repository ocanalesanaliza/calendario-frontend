# Vacation requester identity
Frontend work unit for presenting the additive requester identity from vacation list responses.
Branch: `fix/go-vacation-request-requester`; delivery: no commit at user direction; runner: Vitest.

## Specs
S1. Use the additive `gerente_area` field directly in the authorized `/ausencias-area` vacation presentation.
S2. Do not add requester lookup, selector, route, authorization, approval, or rejection behavior.
S3. Add focused rendering coverage showing the supplied requester identity without another API request.

## Tasks
- T1 | S1-S3 | inline | complete | frontend focused suites: 31 passed; no commit (user prohibited commits)

## Log
L1. Implement only the approved “vacation requester identity” enhancement. Work carefully, preserve unrelated local work, and return a detailed hand-off. Do not commit, push, open a PR, merge, rebase, reset, stash, clean, delete files, perform remote operations, inspect credentials, access production data, or run migrations.
L2. Preflight completed from local `dev`; protected unrelated frontend files remain untouched. The existing list service is pass-through and the page currently fetches the list once; the vacation table needs a requester column.
L3. Added the existing GA display column to the authorized vacation table and verified it consumes gerente_area.nombre from the list payload. The initial RED test failed because the GA header was absent; the focused page and service suites then passed 31 tests.

L4. Applied the authorized correction batch: null requester data now renders —; the vacation GA column uses a compact explicit five-column budget; special-situation table rows consume the additive nested GA name. Focused page tests passed 30 tests.
