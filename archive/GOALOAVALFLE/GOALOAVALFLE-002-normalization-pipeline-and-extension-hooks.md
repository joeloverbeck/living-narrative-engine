# GOALOAVALFLE-002: Normalization Pipeline and Extension Hooks

**Status**: Completed
**Priority**: High
**Spec Reference**: `archive/GOALOAVALFLE/GOALOAVALFLE-001-goal-loader-validation-flexibility.md`

## Objective

Deliver the normalization/defaults workflow from Section 3.2 so that goals missing optional shape can be auto-corrected, coercions are deterministic, and mods can inject custom validators without editing the loader core.

## Current Findings (Apr 2024)

- `src/loaders/goalLoader.js` already wires the `GOAL_LOADER_ALLOW_DEFAULTS` flag for schema validation errors, but nothing runs between schema validation and storage beyond a debug log. There is no `normalizeGoalData` (or equivalent) hook today.
- No helper/builders exist for `relevance` or `goalState` scaffolding—tests under `tests/unit/loaders/goalLoader*.test.js` assemble ad-hoc payloads inline.
- There is no registration surface for third-party validators/default providers. `GoalLoader` does not expose any DI hook nor mutate incoming goal data after validation.
- Existing integration/unit tests only exercise schema validation (including the permissive flag); they never assert normalization, warnings, or extension lifecycle behavior.

## Scope & Tasks

1. Implement `normalizeGoalData(data, context)` (new module under `src/goals/` or another shared pipeline home) that:
   - Ensures `priority`, `relevance`, and `goalState` nodes exist after schema validation succeeds.
   - Coerces unambiguous values (e.g., `'1'` -> `1`) and emits structured warnings through the provided logger/context hook.
   - Returns both the normalized data and a `mutations` collection so loaders/tests can assert deterministic behavior.
   - Documents the `context` contract: `{ modId, filename, logger, featureFlags, validators }`.
2. Provide normalization helpers requested in the spec (e.g., `alwaysTrueCondition`, `simpleStateMatcher`) inside a reusable builders module consumed by tests and mods. This module should live next to `normalizeGoalData` and be exported via an index so fixtures/tests can import without reaching into loader internals.
3. Introduce a registration surface (DI hook or setter) for custom goal validators/default providers so mods (or tests) can extend normalization without touching `_processFetchedItem`. At minimum expose `GoalLoader.registerGoalNormalizer(fn)` or similar static/instance API that `normalizeGoalData` invokes with the proper context.
4. Integrate `normalizeGoalData` into `GoalLoader` immediately after schema validation succeeds and before storing the goal. Honor existing `GOAL_LOADER_ALLOW_DEFAULTS` semantics when normalization encounters a hard failure (warn+continue only when the flag is enabled).
5. Write/extend unit and integration tests:
   - A dedicated unit suite for the new normalization module covering coercions, scaffolding, and extension hooks.
   - Loader tests asserting that warnings are logged and normalized data is stored.
   - Extension lifecycle coverage (register, execute, propagate failures) using the new DI surface.

## Deliverables

- New normalization module + helper builders exported for reuse.
- Loader wiring that runs normalization and captures mutation metadata.
- Test coverage ensuring normalization decisions are deterministic and DI hooks work.

## Acceptance Criteria

- Every goal that passes schema validation is normalized into a consistent structure before further processing.
- External validators/defaults can be registered and run without mutating core loader code.
- Normalization honors the permissive flag (i.e., warnings in dev, errors in strict environments).

## Dependencies / Notes

- Depends on GOALOAVALFLE-001 for schema-driven validation baseline and feature flag definitions.
- Feeds diagnostics work in GOALOAVALFLE-004 since normalization must expose mutation metadata.

## Outcome

- Implemented the standalone normalization module, helper builders, and extension registry expected by the spec; GoalLoader now runs normalization (capturing mutations/warnings) and exposes static registration helpers.
- Added deterministic unit coverage for normalization (including extension lifecycle) plus loader tests exercising the new plumbing. Loader fixtures were updated to align with schema/normalization expectations.
