# GOAPLASTOCRIHAR-005 - Add dual-format planning state integration regression

## Status
- Completed 2025-01-17

## Summary
- Create `tests/integration/goap/dualFormatGoalPaths.integration.test.js` that runs the planner through `goapTestSetup`, builds dual-format planning states via `setup.buildPlanningState`, and proves canonical goals referencing `state.actor.components.*` complete without any `GOAP_INVALID_GOAL_PATH` warnings.
- Extend `tests/integration/goap/testFixtures/goapTestSetup.js` to expose the planner's logger so tests can assert warning payloads without modifying production code. The current harness hides this logger, which contradicted the original assumption that warning counts were observable already.
- Exercise both the normalized success path and the defensive path where a goal missing the `state.actor.components` prefix now fails distance guards: assert planners still emit just one `GOAP_INVALID_GOAL_PATH` warning while documenting the `DISTANCE_GUARD_BLOCKED` failure telemetry, so regressions stay visible without rewriting production heuristics.
- Define any bespoke test data locally within the new suite; no production GOAP modules or mod data need to change for this regression.

## Reassessed assumptions
- `setup.buildPlanningState` already returns the dual-format hash described in the spec, so tests only need to call this helper rather than re-implementing `buildDualFormatState`.
- `createGoapTestSetup` does **not** currently expose the `GoapPlanner` logger, so the regression must add that hook before warning assertions are possible.
- Goal-path violations are cached per `(actorId, goalId)` pair via `GoapPlanner.#goalPathNormalizationCache`; the defensive scenario should therefore verify a single warning even across repeated plans while expecting the planner to surface `GOAP_EVENTS.PLANNING_FAILED` entries with `DISTANCE_GUARD_BLOCKED` payloads rather than a completed plan.

## File list
- `tests/integration/goap/dualFormatGoalPaths.integration.test.js`
- `tests/integration/goap/testFixtures/goapTestSetup.js`

## Out of scope
- Making modifications to production planner or validator code (handled by other tickets).
- Expanding the integration harness beyond what’s necessary to exercise the dual-format state scenario.

## Acceptance criteria
### Tests
- `npm run test:integration`
- `npm run lint` only on the modified files.

### Invariants
- The integration harness APIs exposed by `goapTestSetup` (e.g., `buildPlanningState`, `createActorFixture`) remain backward compatible for other integration suites.
- New fixtures introduced for this test stay under `tests/integration/goap/testFixtures` and do not alter canonical mod data in `data/mods/`.

## Outcome
- Added `tests/integration/goap/dualFormatGoalPaths.integration.test.js` to exercise both the canonical success path and the legacy failure mode while asserting planner event telemetry plus warning deduplication.
- Surfaced the planner logger via `tests/integration/goap/testFixtures/goapTestSetup.js` so integration suites can inspect `GOAP_INVALID_GOAL_PATH` payloads without mutating production code.
- Documented that legacy `state.actor.*` goal paths still fail the numeric distance guard even after normalization, ensuring regressions track the existing behavior rather than implying the planner now completes.
