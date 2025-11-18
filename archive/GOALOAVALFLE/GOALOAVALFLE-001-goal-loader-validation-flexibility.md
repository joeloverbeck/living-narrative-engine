# GoalLoader Validation Flexibility Specification

## 1. Executive Summary
Recent unit failures exposed that `GoalLoader._processFetchedItem` now enforces additional structural requirements (priority, relevance tree, goal state), but the rest of the codebase—including fixtures and helper tests—still behaves as if an `id` was sufficient. This spec proposes making the loader both schema-driven and easier to exercise so that internal assumptions do not silently drift again. The goals are to decouple loader behavior from ad-hoc checks, provide deterministic fixture builders, and wire dedicated diagnostics/tests that fail as soon as either the schema or loader deviates.

## 2. Current-State Analysis
- `_validateGoalStructure` performs manual type checks for `priority`, `relevance`, and `goalState`. Any additional requirement must be duplicated here, in JSON schemas, and in content docs.
- Unit tests double as behavior contracts but currently re-create bare `data` objects inline, so they easily fall out of sync with the real schema.
- There is no automated coverage proving that the loader enforces the JSON schema or that schema updates invalidate fixtures. Breakage only surfaced when Jest executed `_processFetchedItem` before stubbing helpers.

## 3. Proposed Enhancements
### 3.1 Schema-Driven Validation
- Replace bespoke `_validateGoalStructure` checks with a call to the already-available schema validator (`schemaValidator.getValidator('goal.schema.json')`). Compile once per loader instance and cache the function.
- When the schema rejects a goal, throw a single structured error that contains `modId`, `filename`, and the schema path that failed. This centralizes the source of truth for required fields and types.
- Add a feature flag (`GOAL_LOADER_ALLOW_DEFAULTS`) so designers can opt into permissive mode in dev builds while CI always enforces the schema path.

### 3.2 Normalization & Defaults Pipeline
- Introduce `normalizeGoalData(data, context)` that ensures `priority`, `relevance`, and `goalState` exist. Examples:
  - Coerce string priorities (`"1"`) to numbers when safe and log a warning instead of throwing immediately.
  - Provide helper builders for most common `relevance`/`goalState` scaffolding (e.g., `alwaysTrueCondition`, `simpleStateMatcher`).
- Allow custom validators to register via dependency injection so mods can add goal-specific extensions without editing the loader. This makes `_processFetchedItem` more flexible and keeps tests narrow in scope.

### 3.3 Deterministic Fixtures & Test Contracts
- Add `tests/fixtures/goals/minimalValidGoal.json` and a JS factory (`tests/fixtures/goals/createGoalFixture.js`) that returns the smallest schema-compliant object. All loader/unit tests should import this factory and override only the fields under test.
- Create a dedicated contract suite (`tests/unit/loaders/goalLoader.contract.test.js`) that feeds malformed payloads through the schema-driven validator to assert error messages and normalization outcomes. Wire it into `npm run test:unit`.
- Provide a snapshot or JSON report when schema changes invalidate fixtures so contributors see immediate CI failures rather than runtime loader errors.

### 3.4 Observability & Alerting
- Emit a debug event whenever normalization mutates incoming data (e.g., coerced string priority) so the content pipeline can detect soft failures before they promote to hard errors.
- Surface aggregate counts (number of normalized goals, number rejected, average fields auto-filled) through an existing diagnostics channel. If the counts regress, monitoring or pre-push hooks can fail fast.

## 4. Implementation Plan
1. **Schema Integration (3-4h):** Cache the schema validator in `GoalLoader`, replace manual checks, and update error messaging + logger payloads.
2. **Normalization Layer (4-5h):** Implement `normalizeGoalData`, add feature flag plumbing, and expose hooks for additional validators/defaults.
3. **Fixture & Contract Tests (3h):** Create the shared fixture factory, refactor existing unit tests to consume it, and author the new contract/diagnostic suites.
4. **Diagnostics (2h):** Add debug counters/logs and wire them into the loader plus any telemetry exporters.

## 5. Success Criteria
- Loader validation behavior is defined entirely by the JSON schema plus normalization hooks, eliminating mismatched manual checks.
- All unit/integration tests import the shared fixtures, so a schema change instantly fails compilation/tests if the fixture is outdated.
- CI reports how many goals were normalized vs rejected, giving immediate visibility into regressions.
- Contributors can extend goal requirements via injected validators instead of patching `_processFetchedItem` directly, improving long-term flexibility.

## 6. Open Questions
1. Should normalization live in `GoalLoader` or in a shared `goalDataPipeline` that also powers editor tooling?
2. Do we need to expose the normalization flag to mod authors, or should it remain a development-only escape hatch?
3. Would streaming diagnostics into the designer-facing debug HUD add value, or is CI + logging sufficient?
