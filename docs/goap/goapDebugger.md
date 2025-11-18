# GOAPDebugger Telemetry Guide

GOAPDebugger aggregates every diagnostics channel that `GoapController` exposes. Use it to confirm dependency contracts, inspect numeric guards, and—most importantly for this ticket—understand whether a failed plan came from a broken task definition or an admissible guard decision. This guide complements `docs/goap/debugging-tools.md` with concrete telemetry expectations.

## Effect Failure Telemetry

`GoapPlanner.testTaskReducesDistance` records telemetry whenever `planningEffectsSimulator` throws or returns `{ success: false }`. The planner immediately calls `#failForInvalidEffect` with `code = GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION`, which surfaces two artifacts inside GOAPDebugger:

1. **Failure History**: The planner failure snapshot lists `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` with the same `taskId`/`goalId` metadata GoapController captures.
2. **Effect Failure Telemetry section**: `GOAPDebugger.generateReport(actorId)` allocates a block labeled *Effect Failure Telemetry*. Each entry mirrors the payload captured by `#recordEffectFailureTelemetry`:
   - `taskId`, `goalId`, and `phase` (distance-check or reuse check) identify where the fatal failure occurred.
   - `message` and optional `errorType` explain what the simulator returned/threw.
   - `timestamp` is recorded when the guard observed the failure; only the last ten entries per actor are held.

Example (from `report.effectFailureTelemetry.failures[0]`):

```json
{
  "taskId": "core:reduce_hunger",
  "goalId": "stay_fed",
  "phase": "distance-check",
  "message": "PlanningEffectsSimulator returned unsuccessfully during distance check",
  "errorType": "Error",
  "timestamp": 1734116400000
}
```

QA/content workflows:

- Treat every entry as a blocker—distance guards never return `false` for effect failures. Fix the task data, rerun `npm run test:ci -- --runTestsByPath tests/unit/goap/planner/goapPlanner.heuristicGuards.test.js`, and confirm the telemetry list stays empty.
- If you see the same `taskId` repeatedly, capture the planner failure snapshot alongside this telemetry when filing bugs so engineering can reproduce the exact invalid effect definition.

## Distance guard breadcrumbs

GOAPDebugger replays the logger stream inside its report, so you can line up telemetry with the `goalHasPureNumericRoot(goal)` check inside `GoapPlanner`:

- Guard activation is annotated under **Numeric Constraint Diagnostics**. If the report says *Numeric Heuristic: BYPASSED*, your goal root was not a pure comparator and the guard never ran.
- When heuristics sanitize (NaN, Infinity, negative values, or thrown calculations), the planner logs `Heuristic produced invalid value` (warn) once per `(actorId, goalId, heuristicId)` tuple and immediately prints `Heuristic distance invalid, bypassing guard` (debug) before returning `true`. History viewers within GOAPDebugger surface these breadcrumbs so data teams know instrumentation—not behavior—caused the bypass.
- A missing entry here combined with an Effect Failure Telemetry row means the run aborted before heuristics were even invoked, reinforcing that `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` always wins over guard logic.

## Programmatic access

```javascript
import tokens from '../../src/di/tokens-core.js';

const goapDebugger = container.resolve(tokens.IGOAPDebugger);

// Grab report plus effect failures
const report = await goapDebugger.generateReport(actorId);
const { effectFailureTelemetry } = report;

if (effectFailureTelemetry.totalFailures > 0) {
  console.table(effectFailureTelemetry.failures.map(({ taskId, phase, message }) => ({
    taskId,
    phase,
    message
  })));
}
```

Always capture this telemetry alongside planner logs when triaging GOAP regressions—`GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` plus the two log messages (`Heuristic produced invalid value`, `Heuristic distance invalid, bypassing guard`) tell you whether to escalate the issue to gameplay/content or instrumentation.

See the archived guard rationale in `archive/GOADISGUAROB/goap-distance-guard-robustness.md` for the exhaustive list of heuristics and telemetry edge cases.
