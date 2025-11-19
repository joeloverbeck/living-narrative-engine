# GOARESTASSCHVAL-003 – Enforce planning-scope existence when loading tasks

**Status:** Completed

## Problem
`TaskLoader` only checks that `planningScope` strings look like `modId:scopeName`, but it never verifies that the referenced scope actually exists in the registry. Invalid scopes slip through content load and only fail later in `goapPlanner`, creating confusing runtime warnings.

### Reality check
- The loader currently has access to the shared `IDataRegistry`, not the runtime `scopeRegistry`, so existence checks must happen against the registry contents.
- `ScopeLoader` is invoked **after** `TaskLoader` during the definitions phase, so scopes from the same mod are not in the registry yet when tasks are validated. That ordering has to be adjusted before same-mod validation is possible.

## Proposed scope
- Move scope loading ahead of task loading within the definitions phase so that per-mod scopes are already available when tasks validate.
- Augment `_validateTaskStructure` to look up `planningScope` IDs via `IDataRegistry.get('scopes', scopeId)` (skipping the `none`/`self` literals). Throw a descriptive loader error when the scope is missing.
- Error copy should stay aligned with the existing violation reporting flow and should mention the offending file and task ID.
- Capture coverage for success and failure scenarios in unit tests, including `none`/`self` bypasses and missing-scope failures now that same-mod scopes can be detected immediately.

## Outcome
- Loader ordering now runs scope files before tasks, enabling same-mod validation while still honoring mod dependency ordering.
- `TaskLoader` validates `planningScope` IDs against the shared data registry (with `none`/`self` bypasses) and now emits a blocking error when the scope is absent instead of allowing a late planner warning.
- Added focused unit/integration tests that cover valid lookups, missing-scope failures, and seeded registry fixtures so the stricter validation remains enforced.

## File list
- `src/loaders/taskLoader.js`
- `src/loaders/scopeLoader.js` (or registry helpers, if they expose lookup APIs)
- `src/loaders/helpers/*` (if new helpers are required)
- `tests/unit/loaders/taskLoader.test.js`
- `tests/integration/loaders/taskLoading.integration.test.js`
- `tests/unit/goap/planner/goapPlanner.parameterBinding.test.js` (ensure warning path changes are covered)

## Out of scope
- Changes to scope DSL syntax or schema definitions.
- Altering planner scheduling or runtime execution once scopes are valid.
- Implementing refinement-method validation (separate ticket).

## Acceptance criteria
### Tests
- `npm run test:unit -- tests/unit/loaders/taskLoader.test.js`
- `npm run test:unit -- tests/unit/goap/planner/goapPlanner.parameterBinding.test.js`
- `npm run test:integration -- tests/integration/loaders/taskLoading.integration.test.js`
- `npm run validate:quick` (ensures validation fails for broken scopes and succeeds for canonical content).

### Invariants
- `planningScope: 'none'` and `'self'` bypass the registry check and continue to load.
- Error messaging still routes through the existing violation reporter mechanisms.
- Successful tasks produce identical runtime behavior compared to pre-change behavior (only validation is stricter).
