# GOAPLASTOCRIHAR-004 - Harden stopping-criteria diagnostics in the unit suite

**Status:** Completed

## Summary
- The suite already constructs states/goals through `buildPlanningState` and `buildPlanningGoal`; keep that invariant documented but no additional migration is needed.
- The remaining gap is diagnostic coverage: only the numeric-guard test asserts the full `logger.warn` payload, so regressions could silently drop `actorId`, `goalId`, `nodesExpanded`, `closedSetSize`, `maxCost`, or `maxActions` from the cost/action limit warnings. Add a shared helper that captures a warning by message and asserts those canonical fields plus the scenario-specific failure stats.
- Reuse that helper for the feasibility gate (`Goal estimated cost exceeds limit`) and the cost/action-limit exhaustion cases so every stopping-criteria pathway proves it logs the required diagnostics.

## File list
- `tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js`

## Out of scope
- Changing planner runtime behavior (handled by other tickets); this ticket only touches test fixtures and helpers.
- Adding new production logging or telemetry fields beyond what the test suite needs to assert.

## Acceptance criteria
### Tests
- `npm run test:unit -- --runInBand goapPlanner.stoppingCriteria`
- `npx eslint tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js`

## Outcome
- Added a shared helper inside `goapPlanner.stoppingCriteria.test.js` to capture `logger.warn` payloads per message and assert the canonical diagnostic fields (actor/goal IDs, node counters, limit values) remain present.
- Updated the cost-limit, action-limit, numeric-guard, and feasibility-gate scenarios to use the helper so each stopping-criteria pathway now verifies its warning payload plus the relevant `failureStats` flag.

### Invariants
- Shared helpers such as `createTestBed`, `buildPlanningState`, and `buildPlanningGoal` retain their current public signatures so other suites continue to compile.
- Tests continue to run under Jest in band (no changes to npm scripts or runner configuration).
