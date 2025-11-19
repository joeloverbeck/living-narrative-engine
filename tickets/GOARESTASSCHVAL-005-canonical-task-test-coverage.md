# GOARESTASSCHVAL-005 – Expand tests for canonical task & scope workflows

## Problem
Even after canonical tasks exist, existing tests rely on synthetic fixtures and never load the real files from `data/mods/core/tasks/`. We also lack regression coverage for planning-scope instance expansion and refinement-method lookups using disk-backed content.

## Proposed scope
Add coverage that reads the canonical tasks via the normal loader stack, verifies they register successfully, and asserts multi-instance behavior derived from planning scopes (e.g., `items:known_nourishing_items` creating per-entity task entries), in a similar way it happens for actions (action.schema.json). Extend integration suites so `ContentLoadManager` plus the planner/refinement pipeline operate on real files. Include failure-path tests (missing scope/method) so the new validation logic has deterministic protection.

## File list
- `tests/unit/loaders/taskLoader.test.js`
- `tests/integration/loaders/taskLoading.integration.test.js`
- `tests/integration/loaders/modsLoader.coreMod.integration.test.js` (or similar harness)
- `tests/unit/goap/planner/goapPlanner.parameterBinding.test.js`
- `tests/integration/loaders/multiModsWorldLoader.integration.test.js` (if needed for dependency scenarios)
- `tests/common/mockFactories/coreServices.js` (if fixtures require updates)

## Out of scope
- Implementing the validation logic itself (handled in GOARESTASSCHVAL-003/004).
- Modifying planner heuristics or scoring beyond what’s required to observe canonical behavior.
- Rewriting unrelated tests (only touch suites needed to exercise canonical content).

## Acceptance criteria
### Tests
- `npm run test:unit -- tests/unit/loaders/taskLoader.test.js`
- `npm run test:unit -- tests/unit/goap/planner/goapPlanner.parameterBinding.test.js`
- `npm run test:integration -- tests/integration/loaders/taskLoading.integration.test.js`
- `npm run test:integration -- tests/integration/loaders/modsLoader.coreMod.integration.test.js`
- `npm run validate:ecosystem`

### Invariants
- Existing mocks/fixtures for other mods remain unchanged unless necessary for canonical coverage.
- Test suites continue running in-band without introducing the known force-exit behavior.
- Canonical tasks are treated as read-only fixtures; subsequent tickets can rely on them without replicating mock data.
