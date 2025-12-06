# GOADISGUAROB-002 Harden heuristic sanitization and bypass logic

## Status

Completed — runtime behavior already met the contract, so this ticket focused on locking the expectations into tests.

## Reassessment

- `GoapPlanner.#safeHeuristicEstimate` already clamps NaN/Infinity/negative outputs and exceptions to `SAFE_HEURISTIC_MAX_COST`, returning `{ estimate, sanitized: true }` when it does so.
- `#warnOnceForHeuristic` already throttles `'Heuristic produced invalid value'` logs per `(actorId, goalId, heuristicId)` tuple and the cache is reset at the start of every plan.
- `#taskReducesDistance` and `testTaskReducesDistance` already short-circuit the numeric guard and emit `'Heuristic distance invalid, bypassing guard'` whenever either heuristic call was sanitized.

The remaining gap is test coverage: `tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` only exercises NaN outputs and a single thrown exception. There is no proof that Infinity, negative values, or asymmetric sanitization (only the "next" estimate) keep bypassing the guard, nor that warnings stay throttled once the guard is triggered via `testTaskReducesDistance`.

## Updated scope

- Leave `src/goap/planner/goapPlanner.js` untouched unless new regressions are uncovered while adding tests.
- Expand `tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` to cover NaN, Infinity, negative, and thrown outputs plus the scenario where the "next" estimate sanitizes while the "current" estimate remains finite.
- Assert that guard bypass logging (`'Heuristic distance invalid, bypassing guard'`) occurs whenever sanitization happens, and that throttled warnings still trigger exactly once per `(actorId, goalId, heuristicId)` tuple even when both estimates sanitize independently.

## Out of scope

- Changing telemetry wording or log levels beyond what the spec requires.
- Property-based fuzz tests for randomized heuristic outputs (see GOADISGUAROB-003).
- Refactoring of `#hasNumericConstraints` or other planner modules.

## Acceptance criteria

### Tests

- `npm run test:unit -- goapPlanner.heuristicGuards` exercises NaN, Infinity, negative, thrown, and asymmetric sanitization scenarios. Each case verifies the bypass behavior and warning throttling described above.
- `npm run test:unit -- goapPlanner.actionApplicability` continues to pass, proving no regressions to effect applicability guards.

### Invariants

- `#safeHeuristicEstimate` never surfaces NaN, Infinity, or negative values; sanitized outputs remain fixed at `SAFE_HEURISTIC_MAX_COST`.
- Warning `'Heuristic produced invalid value'` fires only once per `(actorId, goalId, heuristicId)` combination even if both current and next estimates sanitize within the same guard check.
- When either estimate is sanitized, the numeric guard returns `true` and logs `'Heuristic distance invalid, bypassing guard'`, ensuring instrumentation failures never prune a task.

## Outcome

- Reframed the ticket to acknowledge that `GoapPlanner.#safeHeuristicEstimate` already clamps invalid outputs and that guard bypassing is live.
- Added targeted heuristic guard unit tests (NaN, Infinity, negative, asymmetrically sanitized distances) instead of altering the planner implementation.
