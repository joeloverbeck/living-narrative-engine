# GOALOAVALFLE-003: Deterministic Fixtures and Contract Tests

**Status**: Completed
**Priority**: Medium
**Spec Reference**: `archive/GOALOAVALFLE/GOALOAVALFLE-001-goal-loader-validation-flexibility.md`

## Objective
Build the shared fixtures, builders, and contract suite from Section 3.3 so schema/loader changes fail quickly and consistently across the test pyramid. Today the `GoalLoader` tests (`tests/unit/loaders/goalLoader.test.js`, `goalLoader.fixes.test.js`, and `tests/integration/loaders/goalLoader.integration.test.js`) all create bespoke inline payloads, there is no shared fixture directory under `tests/`, and no contract suite exercises the schema-driven error payloads that `GoalLoader` currently produces. We already have schema-focused specs (`tests/unit/schemas/goal.schema.test.js`) plus large data fixtures in `data/fixtures/`, so the work here is to introduce a minimal deterministic fixture factory for loader-focused tests and wire the contract coverage that the spec calls for.

## Scope & Tasks
1. Create canonical fixtures under `tests/fixtures/goals/`:
   - `minimalValidGoal.json` mirroring the current schema surface used by `GoalLoader`.
   - `createGoalFixture.js` factory that returns the smallest valid goal, accepts overrides, and exposes a helper to snapshot/export the default payload.
2. Update the existing `GoalLoader`-touching tests (`tests/unit/loaders/goalLoader.test.js`, `tests/unit/loaders/goalLoader.fixes.test.js`, and `tests/integration/loaders/goalLoader.integration.test.js`) to import the factory instead of duplicating inline data blobs.
3. Author `tests/unit/loaders/goalLoader.contract.test.js` that:
   - Uses the real `GoalLoader` collaborators and shared fixture to exercise schema-driven validation failures and assert the structured `ModValidationError` payload.
   - Covers normalization outcomes (coercions, default scaffolding) so fixture mutations remain deterministic.
   - Runs inside `npm run test:unit` with no config changes required.
4. Provide automation (snapshot or JSON report) that alerts when schema changes require fixture updates—e.g., snapshotting the default factory output so that any schema-driven edits force a deliberate snapshot update.
5. Document fixture usage expectations via inline comments (and/or a short README snippet inside `tests/fixtures/goals/`) so contributors know to extend the factory when the schema changes.

## Deliverables
- Fixture files + builder helper committed under `tests/fixtures/goals/` and referenced across the loader tests.
- Updated loader tests using the new fixtures/factory.
- New contract test suite wired into Jest plus the accompanying snapshot/report artifact.

## Outcome
- Introduced `tests/fixtures/goals/` with `minimalValidGoal.json`, the `createGoalFixture` factory, and README instructions covering how/when to update them.
- Updated `tests/unit/loaders/goalLoader.test.js`, `tests/unit/loaders/goalLoader.fixes.test.js`, and `tests/integration/loaders/goalLoader.integration.test.js` to reference the shared factory instead of inline payloads.
- Added `tests/unit/loaders/goalLoader.contract.test.js` with the deterministic fixture snapshot, schema error contract assertions, and normalization coverage so schema/normalization drifts fail fast.

## Acceptance Criteria
- Schema modifications cause immediate fixture/test failures instead of runtime loader regressions.
- Contract suite proves both validation error messaging and normalization behavior.
- Contributors have a single entry point (factory) for creating valid goals in tests.

## Dependencies / Notes
- Builds on GOALOAVALFLE-001/002 implementations to observe real validator + normalization behavior.
- Coordinate with QA to ensure `npm run test:unit` picks up the new suite and remains stable (--runInBand if necessary per AGENTS instructions).
