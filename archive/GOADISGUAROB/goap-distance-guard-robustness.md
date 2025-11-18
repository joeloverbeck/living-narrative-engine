# Context
- Module: `src/goap/planner/goapPlanner.js`, specifically `#taskReducesDistance`, `#safeHeuristicEstimate`, and `testTaskReducesDistance`.
- Purpose: simulate planning effects, compare heuristic distances for numeric goals, and filter tasks that fail to bring the actor closer to its goal.
- Current coverage: `tests/unit/goap/planner/goapPlanner.actionApplicability.test.js` exercises the guard plus telemetry logging; `docs/goap/debugging-tools.md` codifies failure handling for effects and heuristics.

# Problem
- Recent regressions came from tests assuming `testTaskReducesDistance` would swallow invalid effect simulations and heuristic failures, returning `false` with ad-hoc logs.
- Production code instead escalates `{ success: false }` simulations via `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` and sanitizes heuristic failures so the numeric guard can be bypassed rather than emitting bespoke warnings.
- The mismatch caused flaky expectations, obscured the fatal contract in `docs/goap/debugging-tools.md#Planner Contract Checklist`, and reduced confidence in telemetry consumers like GOAPDebugger.

# Truth sources
1. `docs/goap/debugging-tools.md:49-58` — planner contract requires invalid effect simulations to throw `INVALID_EFFECT_DEFINITION`.
2. `docs/goap/multi-action-planning.md:263-270` — numeric guard only runs for pure comparator roots and must respect heuristic sanitation.
3. `tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` — authoritative behavior for heuristic sanitization and warning throttling.
4. `specs/goap-system-specs.md` — planner/controller contract for diagnostics and dependency validation.
5. Integration diagnostics under `tests/integration/goap/dualFormatGoalPaths.integration.test.js` — confirm `DISTANCE_GUARD_BLOCKED` semantics.

# Desired behavior
## Normal cases
- When effects simulate successfully and heuristics return finite, non-negative numbers, `testTaskReducesDistance` returns `true` iff `nextDistance < currentDistance` and logs the reduction context.
- Tasks that leave distance unchanged or increase it yield `false` while emitting the existing debug breadcrumb.

## Edge cases
- **Heuristic invalid values (NaN/Infinity/negative)**: sanitize to `SAFE_HEURISTIC_MAX_COST`, log `'Heuristic produced invalid value'` once per `(actorId, goalId, heuristicId)` key, mark `sanitized: true`, bypass numeric guard with `'Heuristic distance invalid, bypassing guard'` logs.
- **Heuristic exceptions**: treat identical to invalid values—catch the error, sanitize, warn once, bypass guard, never log at `error` level unless the exception escapes the sanitizer.
- **Simulation failure `{ success: false }`**: record telemetry via `#recordEffectFailureTelemetry`, throw via `#failForInvalidEffect` with `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION`, and short-circuit any heuristic calls.
- **Non-numeric goals**: skip distance guard entirely (ensured by `#hasNumericConstraints`).

## Failure modes
- Invalid effect definitions → throw `Error` with `code = GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` and enriched details (actorId, phase) per docs.
- Invalid heuristic configuration that repeatedly sanitizes → continue planning but emit warning+debug logs; no errors thrown.
- Unexpected runtime exceptions escaping the try/catch (e.g., logger failure) → rethrow after logging `'Failed to check distance reduction'` for visibility.

## Invariants
- Planning state inputs are immutable; `currentState` must not be mutated by simulations.
- `#safeHeuristicEstimate` never returns non-finite values; sanitized outputs always equal `SAFE_HEURISTIC_MAX_COST`.
- Numeric guard bypass occurs only when either estimate is sanitized; result must default to `true` so planners do not prune tasks because of instrumentation failures.
- Effect failures never fall through as boolean `false` decisions—must always propagate via typed errors + telemetry.

## API contracts
- `GoapPlanner.testTaskReducesDistance(task, state, goal, actorId)` continues to return boolean success or throw planner failures; signature remains unchanged.
- `GOAP_PLANNER_FAILURES` constants stay stable for downstream tooling.
- Telemetry messages (`Heuristic produced invalid value`, `Heuristic distance invalid, bypassing guard`, effect failure payloads) remain available for log-based dashboards.
- Allowed to extend telemetry payloads (additional fields) and introduce opt-in hooks (e.g., after-effect inspectors) so long as default behavior persists.

# Testing plan
## Which tests must be updated/added
- Unit suite `tests/unit/goap/planner/goapPlanner.actionApplicability.test.js` already reflects the fatal effect contract and sanitized heuristics; keep it synchronized with docs whenever failure semantics change.
- Add a focused unit test that mocks `#effectsSimulator.simulateEffects` throwing (not just `{ success: false }`) to ensure the catch/log/false path stays covered.
- Extend `goapPlanner.heuristicGuards.test.js` to include a scenario where only the *next* heuristic estimate sanitizes, proving bypass conditions rely on either side signaling invalidity.

## Regression / property tests
- Property-style test: generate random numeric goals with randomized heuristic outputs (finite, NaN, negative, throwing) and assert that `testTaskReducesDistance` either returns `true` or throws `INVALID_EFFECT_DEFINITION`, never returning `false` solely because of heuristic sanitation.
- Integration smoke (`tests/integration/goap/dualFormatGoalPaths.integration.test.js`) should assert that planner failure history logs a single `INVALID_EFFECT_DEFINITION` entry when mods intentionally register malformed effects.
- Optional contract test for `GOAPDebugger` to verify the Effect Failure Telemetry section includes entries from `testTaskReducesDistance` failures, guarding against silent log regressions.
