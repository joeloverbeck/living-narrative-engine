# GOADISGUAROB-004 Sync planner contract documentation and debugger references
Refresh the planner documentation so every truth source reflects the fatal effect contract, heuristic sanitation flow, and telemetry hooks that GOAPDebugger depends on.

## Status
Completed — docs + spec references updated per the guard contract rev.

## Ground truth check (Feb 2025)
- `src/goap/planner/goapPlanner.js` already escalates `{ success: false }` simulations and thrown `simulateEffects` errors through `#failForInvalidEffect`, tagging them with `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` before any heuristic work runs. See the guard inside `#taskReducesDistance` (lines ~840-915).
- `#safeHeuristicEstimate` clamps `NaN`, `Infinity`, negative numbers, and thrown heuristic calculations to `SAFE_HEURISTIC_MAX_COST` while emitting the exact warnings `Heuristic produced invalid value` (warn) and `Heuristic distance invalid, bypassing guard` (debug) once per `(actorId, goalId, heuristicId)` tuple. The unit coverage lives in `tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` and already demonstrates the sanitized bypass behavior.
- GOAPDebugger currently surfaces Effect Failure Telemetry entries whenever `testTaskReducesDistance` records `#recordEffectFailureTelemetry`, but none of the written guides document how QA/content teams should interpret those rows or the guard bypass breadcrumbs.

## Revised scope
- Documentation is the only drift; do not change planner/telemetry code. Update every referenced guide/spec so it speaks to the actual log strings, telemetry names, and guard prerequisites enforced by the code/tests noted above.

## File list
- `docs/goap/debugging-tools.md` — align the "Planner Contract Checklist" with the enforced failure semantics by calling out the telemetry event names, the `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` escalation path, and the sanitized heuristic bypass debug logs consumed by GOAPDebugger.
- `docs/goap/multi-action-planning.md` — clarify that the numeric guard only runs for pure comparator roots (`goalHasPureNumericRoot`) and explicitly document the sanitized bypass path (what triggers it, how it logs, and why it returns `true`).
- `specs/goap-system-specs.md` — update the planner/controller contract tables to surface the distance-guard telemetry and debugger expectations so dependency validators and QA tooling speak the same language (`INVALID_EFFECT_DEFINITION`, `Heuristic distance invalid, bypassing guard`, etc.).
- `docs/goap/goapDebugger.md` (or the relevant debugger guide) — describe how Effect Failure Telemetry entries bubble up inside GOAPDebugger so QA and content teams know how to spot bad effect definitions versus heuristic bypasses.

## Out of scope
- Modifying planner implementation or tests; this ticket is documentation-only.
- Introducing new telemetry fields beyond what the code already emits.
- Reorganizing doc navigation/sidebar content.

## Acceptance criteria
### Tests
- `npm run lint` completes successfully on the modified files, catching any Markdown/ESLint regressions caused by the documentation updates.
- `npm run test:ci -- --runTestsByPath tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js` (or equivalent focused invocation) still passes, ensuring doc guidance matches actual behavior.

### Invariants
- Docs reference the correct failure code `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` and describe telemetry message strings verbatim (`Heuristic produced invalid value`, `Heuristic distance invalid, bypassing guard`).
- Each truth source explicitly states that sanitized heuristic estimates bypass the numeric guard and that effect simulations that fail must throw.
- Debugger documentation explains that the Effect Failure Telemetry section includes entries produced by `testTaskReducesDistance` failures, reinforcing QA workflows.

## Outcome
- Planner-adjacent docs (`docs/goap/debugging-tools.md`, `docs/goap/multi-action-planning.md`, `docs/goap/goapDebugger.md`) now call out the `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` failure path plus the exact warning/debug strings emitted by heuristic sanitation, with clear instructions about when the numeric guard runs or bypasses.
- `specs/goap-system-specs.md` gained an explicit distance-guard telemetry contract, so GoapController + GOAPDebugger references stop hand-waving about how to interpret effect failures versus heuristic bypasses.
- The historical guard spec moved from `specs/goap-distance-guard-robustness.md` to `archive/GOADISGUAROB/goap-distance-guard-robustness.md`, and every current guide now links to that archived truth source.
