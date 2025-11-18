# GOAP Debugging Tools

**Status**: ✅ Complete
**Last Updated**: 2025-11-16

## Overview

The GOAP debugging tools provide comprehensive inspection and tracing capabilities for the GOAP system. These tools help developers understand planning behavior, refinement execution, and diagnose issues during development and testing.

Per `specs/goap-system-specs.md` (guardrail 5), always reach for these tools—Plan Inspector, GOAPDebugger, Refinement Tracer—before sprinkling `console.log`. The built-in telemetry now emits structured failure codes so you can see depth limits, numeric guard rejections, and other planner outcomes without ad-hoc logging.

### Available Tools

1. **Plan Inspector** - Visualize active GOAP plans
2. **State Diff Viewer** - Compare planning state changes
3. **Refinement Tracer** - Trace step-by-step refinement execution
4. **GOAP Debugger** - Unified API for all debug tools

## Quick Start

### Basic Usage

```javascript
// Get debugger from DI container
const debugger = container.resolve(tokens.IGOAPDebugger);

// Inspect active plan
const plan = debugger.inspectPlan('actor-123');
console.log(plan);

// Start refinement trace
debugger.startTrace('actor-123');

// Execute turn (triggers planning and refinement)
await goapController.decideTurn(actor, world);

// Get comprehensive report
const report = debugger.generateReport('actor-123');
console.log(report);

// View recent GOAP events
const eventStream = debugger.getEventStream('actor-123');
console.table(eventStream.events);

// Stop trace
debugger.stopTrace('actor-123');
```

## Planner Contract Checklist

- Use `tests/common/mocks/createGoapPlannerMock.js` for any GOAP planner doubles. The factory ships with `plan()` and `getLastFailure()` wired to the same defaults required by `GoapController`.
- Immediately call `expectGoapPlannerMock(mock)` after instantiating a test double. It mirrors the runtime dependency validator so tests fail locally instead of during E2E runs.
- Route every GOAP test harness through `tests/common/mocks/createEventBusMock.js`. The helper enforces `dispatch(eventType, payload)` up front and mirrors `validateEventBusContract`, so suites can’t regress to the legacy `{ type, payload }` signature.
- When `GoapController` boots it emits `goap:dependency_validated` telemetry and the debugger prints a **Dependency Contracts** section. That block lists required vs provided methods plus timestamps, making mock drift obvious inside `npm run test:e2e -- --report-goap-debug` logs.
- Any `GOAP_DEPENDENCY_WARN` log means a mock bypassed the factory or a dependency is missing methods. CI greps for this string to fail builds before the regression spreads.
- GOAP integration harnesses should call `setup.registerPlanningActor(actor)`, `setup.buildPlanningState(actor)`, and `setup.registerPlanningStateSnapshot(state)` instead of wiring the entity manager manually. This keeps `SimpleEntityManager`, the dual-format planning state, and the new task validation guardrails perfectly in sync.
- Set `GOAP_GOAL_PATH_LINT=1` (or run `npm run validate:goals`) to lint JSON Logic goals for canonical `actor.components.*` paths. When the planner encounters a bare `actor.hp` reference it aborts with `GOAP_PLANNER_FAILURES.INVALID_GOAL_PATH` and GOAPDebugger links to the offending variable.
- `GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION` now powers the **Effect Failure Telemetry** section in GOAPDebugger. Any `{ success: false }` result from `planningEffectsSimulator` is fatal—surface the missing precondition instead of relying on simulator failures.

### Test Integration

```javascript
// In integration test
it('should debug GOAP behavior', async () => {
  const debugger = container.resolve(tokens.IGOAPDebugger);

  debugger.startTrace('actor-1');

  await goapController.decideTurn(actor, world);

  const trace = debugger.stopTrace('actor-1');
  const formatted = debugger.formatTrace(trace);

  console.log(formatted);

  // Assert on trace events
  expect(trace.events).toContainEqual(
    expect.objectContaining({
      type: GOAP_EVENTS.TASK_REFINED
    })
  );
});
```

## Tool Reference

### Plan Inspector

**Purpose**: Display active GOAP plans with task details and parameters.

**Methods**:
- `inspect(actorId)` - Returns formatted plan text
- `inspectJSON(actorId)` - Returns plan as JSON object

**Example Output**:
```
=== GOAP Plan: Achieve 'stay_fed' ===
Actor: actor-123
Goal: Maintain nourishment
Goal Priority: 10
Numeric Heuristic: ACTIVE (pure numeric root comparator)
Heuristic Reason: Root operator is <=, <, >=, or >
Plan Length: 2 tasks
Created: 2025-11-16T12:34:56.789Z

Tasks:
  1. [consume_nourishing_item] (COMPLETED)
     Parameters:
       - item: "Apple" (food-1)

  2. [gather_resources] (CURRENT)
     Parameters:
       - resourceType: "food"
       - location: "Forest" (forest-1)

Failure Tracking:
  Failed Goals: 0
  Failed Tasks: 0

=== End Plan ===
```

**Key Features**:
- Shows task execution status (COMPLETED/CURRENT/PENDING)
- Resolves entity IDs to human-readable names
- Displays failure tracking metrics
- Includes goal and task metadata
- Indicates whether numeric distance heuristics are active or bypassed for the goal

`inspectJSON()` exposes this data via `goal.numericHeuristic`, allowing GOAPDebugger and downstream tooling to display whether `#taskReducesDistance` is active.

### Task Library Diagnostics

**Purpose**: Capture the raw task registry state the planner saw for a given actor.

**What it shows**:
- Number of tasks discovered per namespace after structural gates.
- Warnings emitted by the normalization guardrails (deprecated `component_id`, missing namespaces, etc.).
- Actor IDs that failed to register with `SimpleEntityManager` before planning began.

**Where to find it**:
- The GOAP debugger report now prints a `Task Library Diagnostics` section, and `generateReportJSON()` returns a `taskLibraryDiagnostics` payload.
- `GOAP_EVENTS.PLANNING_FAILED` includes a `code` property so CI and content tooling can distinguish setup violations (e.g., `GOAP_SETUP_MISSING_ACTOR`) from genuine search exhaustion.
- When the controller returns `null`, GOAPDebugger now emits a single `GOAP_DEBUGGER_DIAGNOSTICS_MISSING` warning per actor/section and annotates the report with an empty state so downstream tooling can alert on missing instrumentation.
- `generateReportJSON()` exposes a `diagnosticsMeta.taskLibrary` object that includes `{ available, stale, lastUpdated }` so dashboards can render freshness indicators alongside the raw payload.

### Goal Normalization Telemetry

- `GoalLoader` now emits per-mutation debug logs whenever `normalizeGoalData` mutates incoming content. Each entry uses the `goal-normalization.mutation` (or `.warning`) tag and includes `{ modId, filename, mutation, allowDefaults }`, so you can grep logs for specific files or extension output.
- Set `GOAL_LOADER_NORMALIZATION_DIAGNOSTICS=0` in your environment to suppress the per-mutation chatter when fuzzing data locally. The loader still counts mutations internally and emits a single `goal-normalization.summary` log at `info` with `{ goalsProcessed, goalsWithMutations, goalsRejected, totalMutations, fieldsAutoFilled, warningsEmitted }` plus timing metadata.
- CI/integration harnesses can call `goalLoader.getNormalizationDiagnosticsSnapshot()` after `loadItemsForMod()` to retrieve the same summary payload without parsing logs. Use it to fail builds when `goalsRejected` spikes or when the ratio of `fieldsAutoFilled` to `goalsProcessed` exceeds the thresholds in `validate:ecosystem`.
- When `GOAL_LOADER_ALLOW_DEFAULTS=1` is set, each diagnostic log also includes `allowDefaults: true` so dashboards can distinguish deliberate permissive-mode fixes from unexpected coercions.

### State Diff Viewer

**Purpose**: Visualize changes to planning state during task simulation.

**IMPORTANT**: Works with **planning state hashes** (symbolic key-value pairs), not ECS components.

**Methods**:
- `diff(beforeState, afterState)` - Returns diff object
- `visualize(beforeState, afterState, options)` - Returns formatted diff text
- `diffJSON(beforeState, afterState)` - Returns diff as JSON

**Example Output**:
```
=== State Diff: Before Task → After Task ===
Task Applied: consume_nourishing_item (params: {"item":"food-1"})

Added Facts:
  + actor.state.last_ate = 1234567890

Modified Facts:
  ~ actor.state.hunger: 50 → 30
  ~ world.entities.food-1.exists: true → false

Removed Facts:
  - world.location.forest-1.resources.available = true

Total Changes: 4 (1 added, 2 modified, 1 removed)

=== End Diff ===
```

**Use Cases**:
- Verify task planning effects are correct
- Debug unexpected state changes
- Understand task preconditions/effects

### Component-Aware Planning Checks

`specs/goap-system-specs.md` calls out `GoapPlanner.#buildEvaluationContext` as the canonical hook for mirroring planner state into JSON Logic. When a `has_component` gate behaves oddly:

- Use **Plan Inspector** to capture the raw planning state hash for the actor (`entityId:componentId[:field]` keys). Those hashes are the same format surfaced by the GOAP diagnostics scripts.
- Feed the hash into the **State Diff Viewer** before/after a task to verify whether the expected `entityId:componentId` entries exist. When a key is missing during **planning mode** (`context.state` present), `HasComponentOperator` refuses to fall back to the runtime `EntityManager`; it emits a `GOAP_EVENTS.STATE_MISS` instead so stale snapshots fail fast. Runtime fallback only occurs when the operator runs without a planning-state context (pure execution-time lookups).
- Inspect `state.actor.components` (and the flattened aliases with underscores) in the diff output to ensure colon-based component IDs stay mirrored—those mirrors are what allow JSON Logic expressions like `state.actor.components.core_needs.hunger` to resolve without helper glue.

This workflow keeps component-aware planning observable without ad-hoc logging and reaffirms that `#buildEvaluationContext` is the extension point for any future preprocessing.

### STATE_MISS workflow

- `PlanningStateView.hasComponent()` publishes every miss through `recordPlanningStateMiss`, which in turn dispatches `GOAP_EVENTS.STATE_MISS` and annotates GOAPDebugger reports with the offending `{ entityId, componentId, reason }` tuple.
- Planning-mode lookups never silently retry in the runtime; instead, run `GOAP_STATE_ASSERT=1 npm run test:integration -- --runInBand …numericGoalPlanning.integration.test.js` locally to turn these misses into hard failures while you diagnose the stale snapshot.
- GOAPDebugger exposes the last five misses per actor under **Planning State Diagnostics**, so grab that data (and the probe transcript) before attempting runtime fallbacks—those fallbacks are explicitly prohibited whenever `context.state` exists.

### Goal Path & Effect Telemetry

Plan Inspector and the consolidated GOAPDebugger report now include two additional diagnostics blocks:

- **Goal Path Violations**—lists every actor/goal that referenced `actor.*` or `state.actor.*` without the `components` segment. Run `npm run validate:goals` locally (or export `GOAP_GOAL_PATH_LINT=1`) to catch these before they reach CI. When the planner aborts with `INVALID_GOAL_PATH`, the block shows the exact variable path(s) to fix.
- **Effect Failure Telemetry**—captures every `{ success: false }` response from `planningEffectsSimulator` along with `{ taskId, phase, goalId }`. Treat each entry as a missing precondition; `INVALID_EFFECT_DEFINITION` remains a hard failure and GOAPDebugger links back to this section so you can see which task caused the abort.

### Numeric Constraint Diagnostics

- `GOAP_EVENTS.NUMERIC_CONSTRAINT_FALLBACK` fires whenever `NumericConstraintEvaluator` returns `null` and the heuristic falls back to boolean counting. The payload follows the same `(eventType, payload)` contract enforced by `createGoapEventDispatcher()` and surfaces under the event-compliance diagnostics described in the **Planner Contract Checklist**.
- `GOAP_NUMERIC_ADAPTER=1` enables the shared `GoalEvaluationContextAdapter` so heuristics, evaluators, and `GoapController` consume the same dual-format `PlanningStateView`. `GOAP_NUMERIC_STRICT=1` turns those fallback events into hard errors; CI sets this flag to fail fast whenever numeric paths drift.
- Plan Inspector now prints a **Numeric Constraint Diagnostics** block per actor showing total fallbacks and the most recent `{ varPath, reason, timestamp }` entries. `GOAPDebugger.inspectPlanJSON()` mirrors this data so integration harnesses can assert on it directly.
- `MonitoringCoordinator` increments a lightweight counter whenever the fallback event dispatches on the shared event bus. `npm run test:ci` (and custom smoke tests) can read `monitoringCoordinator.getGoapNumericFallbackCount()` to ensure strict mode runs stay clean.

## Diagnostics Contract

`GoapController` and `GOAPDebugger` share a diagnostics contract defined in `src/goap/debug/goapDebuggerDiagnosticsContract.js` (`version = 1.2.0` at the time of writing). The contract ensures:

- Both sides expose `getTaskLibraryDiagnostics`, `getPlanningStateDiagnostics`, `getEventComplianceDiagnostics`, and `getDiagnosticsContractVersion()`; mismatches throw during dependency injection so carets fail early instead of emitting partial reports.
- Each diagnostics section includes metadata describing whether data is available, when it was last updated, and whether it is stale. Payloads older than five minutes (configurable via the contract) are tagged with `⚠️ STALE` in the text report and `diagnosticsMeta.*.stale = true` in JSON output.
- Missing payloads emit a throttled `GOAP_DEBUGGER_DIAGNOSTICS_MISSING` warning so CI can grep for instrumentation gaps. Bumping the contract version is mandatory whenever a new diagnostics block is added or the stale threshold changes.

Event contract compliance now appears alongside the task library and planning-state sections. The controller exposes `{ actor, global, planning }` diagnostics fed by `createGoapEventDispatcher()`: `actor`/`global` list total dispatch counts and payload violations, while `planning` mirrors `createGoapEventDispatcher.getPlanningComplianceSnapshot()` so dashboards can compare `PLANNING_COMPLETED` vs `PLANNING_FAILED` totals per actor without parsing the raw stream. Violations carry `GOAP_EVENT_PAYLOAD_MISSING` stacks and the debugger links back to `#Planner Contract Checklist` for remediation.

When you add diagnostics:

1. Update `goapDebuggerDiagnosticsContract.js` with the new sections + increment `version`.
2. Extend `GoapController.getDiagnosticsContractVersion()` (re-exported from the same module) if the runtime needs additional metadata.
3. Update the debugger tests to acknowledge the new sections and to assert on warnings/staleness where it makes sense.
4. Link the update in your PR description along with `npm run test:integration -- goap` logs that prove the new section is populated.

### Refinement Tracer

**Purpose**: Capture step-by-step refinement method execution.

**Methods**:
- `startCapture(actorId)` - Begin capturing events
- `stopCapture(actorId)` - Stop and return trace
- `getTrace(actorId)` - Get current trace without stopping
- `format(trace)` - Format trace as text

**Example Output**:
```
=== Refinement Trace: actor-123 ===
Capture Duration: 250 ms
Events Captured: 8

Events:
[2025-11-16T12:34:56.100Z] TASK_REFINED: taskId=consume_nourishing_item, stepsGenerated=2
[2025-11-16T12:34:56.102Z] REFINEMENT_STEP_STARTED: step=0, type=primitive_action
[2025-11-16T12:34:56.105Z] REFINEMENT_STATE_UPDATED: pickedItem = "food-1"
[2025-11-16T12:34:56.110Z] REFINEMENT_STEP_COMPLETED: step=0, success=true, duration=8ms
[2025-11-16T12:34:56.112Z] REFINEMENT_STEP_STARTED: step=1, type=primitive_action
[2025-11-16T12:34:56.120Z] REFINEMENT_STEP_COMPLETED: step=1, success=true, duration=8ms

Summary:
  Tasks Refined: 1
  Steps Executed: 2
  Steps Succeeded: 2
  Steps Failed: 0

=== End Trace ===
```

**Use Cases**:
- Debug refinement method execution
- Verify action generation
- Track local state updates
- Identify step failures

> Planner failure codes (e.g., `DEPTH_LIMIT_REACHED`, `DISTANCE_GUARD_BLOCKED`) only appear in GOAPDebugger/Plan Inspector failure history. Refinement Tracer still focuses on post-planning execution events, so check the failure history before assuming a trace bug when the tracer stays silent.

### GOAP Debugger (Main API)

**Purpose**: Unified interface for all debug tools.

**Full API**:

```javascript
// Plan inspection
debugger.inspectPlan(actorId)
debugger.inspectPlanJSON(actorId)
debugger.inspectCurrentGoal(actorId)
debugger.getFailureHistory(actorId)

// State visualization
debugger.showStateDiff(beforeState, afterState, options)
debugger.showStateDiffJSON(beforeState, afterState)

// Refinement tracing
debugger.startTrace(actorId)
debugger.stopTrace(actorId)
debugger.getTrace(actorId)
debugger.formatTrace(trace)

// Combined reporting
debugger.generateReport(actorId)
debugger.generateReportJSON(actorId)
```

## Advanced Usage

### Debugging Failed Plans

```javascript
const debugger = container.resolve(tokens.IGOAPDebugger);

// Check failure history
const failures = debugger.getFailureHistory('actor-123');

console.log(`Failed Goals: ${failures.failedGoals.length}`);
for (const goalFailure of failures.failedGoals) {
  console.log(`  ${goalFailure.goalId}: ${goalFailure.failures.length} entries`);
  for (const entry of goalFailure.failures) {
    const label = entry.code ? `[${entry.code}]` : '[UNKNOWN]';
    console.log(`    ${label} ${entry.reason}`);
    console.log(`    Timestamp: ${new Date(entry.timestamp).toISOString()}`);
  }
}

console.log(`Failed Tasks: ${failures.failedTasks.length}`);
for (const taskFailure of failures.failedTasks) {
  console.log(`  ${taskFailure.taskId}: ${taskFailure.failures.length} entries`);
  for (const entry of taskFailure.failures) {
    const label = entry.code ? `[${entry.code}]` : '[TASK_FAILURE]';
    console.log(`    ${label} ${entry.reason}`);
    console.log(`    Timestamp: ${new Date(entry.timestamp).toISOString()}`);
  }
}
```

### Debugging State Changes

```javascript
// During planning
const beforeState = { 'actor.state.hunger': 50 };

// Simulate task application
const afterState = await planningEffectsSimulator.simulate(
  beforeState,
  task,
  params
);

// Visualize changes
const diff = debugger.showStateDiff(beforeState, afterState, {
  taskId: task.taskId,
  params: params,
});

console.log(diff);
```

### Planner Failure Codes

Plan Inspector and GOAPDebugger now prefix each failure entry with the planner's structured code. These codes map directly to `src/goap/planner/goapPlannerFailureReasons.js` and the guardrails outlined in `specs/goap-system-specs.md`:

| Code | Meaning |
| --- | --- |
| `TASK_LIBRARY_EXHAUSTED` | No planning tasks were available for the actor; check mod/task registrations. |
| `ESTIMATED_COST_EXCEEDS_LIMIT` | The heuristic estimate exceeded `goal.maxCost` before search began. |
| `TIME_LIMIT_EXCEEDED` | Search exceeded the configured time budget. |
| `NODE_LIMIT_REACHED` | Search hit `maxNodes` without producing a plan. |
| `DEPTH_LIMIT_REACHED` | All branches hit the depth cap (`options.maxDepth` or `goal.maxActions`). |
| `DISTANCE_GUARD_BLOCKED` | Numeric distance guard rejected every applicable task (pure numeric goals only). |
| `NO_APPLICABLE_TASKS` | The planner never found a task that passed parameter binding and preconditions. |
| `NO_VALID_PLAN` | Catch-all for “open list exhausted” after exploring valid branches. |

Task/refinement failures reuse the same formatting but use `TASK_FAILURE`, `REFINEMENT_FAILURE_REPLAN`, etc., so you can distinguish controller-level fallbacks from planner issues at a glance.

### Continuous Tracing

```javascript
// Enable tracing for entire session
debugger.startTrace('actor-123');

// Execute multiple turns
for (let i = 0; i < 10; i++) {
  await goapController.decideTurn(actor, world);
}

// Get accumulated trace
const trace = debugger.getTrace('actor-123');
console.log(`Total events: ${trace.events.length}`);

// Stop when done
debugger.stopTrace('actor-123');
```

### Event Stream Diagnostics

```javascript
debugger.startTrace('actor-456');
await goapController.decideTurn(actor, world);

const stream = debugger.getEventStream('actor-456');
console.log(`Captured ${stream.totalCaptured} events (${stream.totalViolations} violations)`);
stream.events.slice(-5).forEach(evt => {
  console.log(evt.type, evt.payload);
});

debugger.stopTrace('actor-456');
```

`createGoapEventTraceProbe()` fans out from `createGoapEventDispatcher()` so probes see the normalized `(eventType, payload)` pairs without mutating the shared bus. `validateEventBusContract(eventBus)`—and the shared `tests/common/mocks/createEventBusMock.js` helper—keep every dependency on the `(eventType, payload)` signature before anything reaches the probe.

### Trace Wiring Checklist

- Call `setup.bootstrapEventTraceProbe()` from `createGoapTestSetup()` when writing integration harnesses. It creates a real `createGoapEventTraceProbe()` instance, attaches it to `createGoapEventDispatcher()`, and returns `{ probe, detach }` so suites can opt out if needed.
- Inspect `setup.goapEventDispatcherLogger.info` (or your runtime logger) for `GOAP_EVENT_TRACE_DISABLED` / `GOAP_EVENT_TRACE_ENABLED` messages. The dispatcher now calls `getProbeDiagnostics()` internally and emits these codes whenever the active probe count drops to zero or rises back above it.
- When `GOAPDebugger.startTrace()` runs without any dispatcher probes, it logs `GOAP_DEBUGGER_TRACE_PROBE_FALLBACK`, flags `getEventStream()` with `captureDisabled: true`, and leaves the buffered probe untouched so suites can detect the misconfiguration before debugging.
- `createGoapEventTraceProbe().getTotals()` now reports `{ totalRecorded, totalViolations, attachedAtLeastOnce }`. Dashboards and CI can alert when `attachedAtLeastOnce` stays `false` across a session, signaling that tracing never ran.

## Troubleshooting

### Common Issues

#### 1. "No active plan" when inspecting

**Problem**: `inspectPlan()` returns "No active plan" message.

**Causes**:
- Actor has no current goal selected
- Planning failed (check failure history)
- Plan was invalidated

**Solution**:
```javascript
// Check if actor has goals
const goals = await goalSelectionService.selectGoal(actor);
console.log(`Available goals: ${goals.length}`);

// Check failure history
const failures = debugger.getFailureHistory(actorId);
if (failures.failedGoals.length > 0) {
  console.log('Recent failures:', failures.failedGoals);
}
```

#### 2. Empty refinement trace

**Problem**: Trace has no events after execution.

**Causes**:
- Trace started after execution completed
- Wrong actor ID
- No refinement occurred (plan is empty)

**Solution**:
```javascript
// Start trace BEFORE executing turn
debugger.startTrace('actor-123');

// Then execute
await goapController.decideTurn(actor, world);

// Verify trace has events
const trace = debugger.getTrace('actor-123');
console.log(`Events captured: ${trace.events.length}`);
```

### Empty plan completions ("goal already satisfied")

Per `specs/goap-system-specs.md`, the planner can legitimately return an empty plan when the goal state is already satisfied at planning time. When this happens:

- `GoapController.decideTurn` dispatches `GOAP_EVENTS.PLANNING_COMPLETED` with `planLength: 0` and an empty `tasks` array.
- The controller logs an info-level message: `Planner returned empty plan (goal already satisfied)` that includes the `actorId` and `goalId`.
- No refinement or primitive actions run; GOAPDebugger's plan inspector will show no current plan for the actor on the next turn.

Use the event payload and structured log to confirm a "goal satisfied" completion before assuming the planner stalled. Tooling that watches the event bus can treat `planLength: 0` completions as a telemetry signal meaning "goal already met" and skip retry logic.

#### Actor alias guardrail

- Reusable goal templates **must** reference the acting actor through the `'actor'` alias (or `state.actor`) inside `has_component` clauses. Hardcoding literal IDs like `actor_alpha` makes the goal unusable for any other actor and violates the Planning-State View contract.
- `npm run validate:goals` (or setting `GOAP_GOAL_PATH_LINT=1` during planner runs) now flags these violations with `GOAP_PLANNER_FAILURES.INVALID_GOAL_PATH`. Fix the goal by replacing the literal ID with `'actor'` before rerunning suites.
- Test helpers such as `createTestGoal` also warn when a suite overrides `has_component` with a literal ID, so treat that console warning as a regression signal and update the goal template immediately.

#### 3. State diff shows unexpected changes

**Problem**: State diff shows changes that don't match task effects.

**Causes**:
- Planning effects are incorrect in task definition
- Parameter substitution failed
- Multiple tasks applied simultaneously

**Solution**:
```javascript
// Verify task definition
const task = dataRegistry.getTask(taskId);
console.log('Planning effects:', task.planningEffects);

// Check parameter bindings
console.log('Task params:', taskParams);

// Trace planning step-by-step
const plan = goapController.getActivePlan(actorId);
for (const task of plan.tasks) {
  console.log(`Task: ${task.taskId}, Params: ${JSON.stringify(task.params)}`);
}
```

### Performance Considerations

#### Memory Usage

- **Plan Inspector**: Minimal (< 1KB per inspection)
- **State Diff**: Small (depends on state size, typically < 10KB)
- **Refinement Tracer**: Grows with events (~ 1KB per event)

**Best Practices**:
- Stop traces when not needed
- Don't enable tracing in production
- Clear old traces periodically

#### Execution Overhead

- **Plan Inspector**: < 1ms (read-only)
- **State Diff**: < 5ms (comparison + formatting)
- **Refinement Tracer**: < 0.1ms per event

**Impact**: < 1% of total GOAP execution time when tracing is active.

## Integration with Testing

### Unit Test Pattern

```javascript
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

it('should trace refinement execution', async () => {
  const debugger = container.resolve(tokens.IGOAPDebugger);

  debugger.startTrace('actor-1');

  await refinementEngine.refineTask(task, world, context);

  const trace = debugger.stopTrace('actor-1');

  // Assert on events
  expect(trace.events).toContainEqual(
    expect.objectContaining({
      type: GOAP_EVENTS.TASK_REFINED,
      payload: expect.objectContaining({
        taskId: task.taskId,
      }),
    })
  );

  // Verify steps executed
  const stepsCompleted = trace.events.filter(
    e => e.type === GOAP_EVENTS.REFINEMENT_STEP_COMPLETED
  );
  expect(stepsCompleted.length).toBeGreaterThan(0);
});
```

### Integration Test Pattern

```javascript
it('should debug complete GOAP workflow', async () => {
  const debugger = container.resolve(tokens.IGOAPDebugger);

  // Start comprehensive debugging
  debugger.startTrace('actor-1');

  // Execute full turn
  await goapController.decideTurn(actor, world);

  // Generate report
  const report = debugger.generateReport('actor-1');

  // Log for manual inspection
  console.log(report);

  // Programmatic assertions
  const plan = debugger.inspectPlanJSON('actor-1');
  expect(plan).not.toBeNull();
  expect(plan.plan.tasks.length).toBeGreaterThan(0);

const trace = debugger.stopTrace('actor-1');
expect(trace.events.length).toBeGreaterThan(0);
});

## Planning State Assertions

`PlanningStateView` now instruments every heuristic/operator lookup. When a JSON Logic path or `has_component` query references data that is missing from the symbolic state, the helper emits a `goap:state_miss` event, increments the Planning State Diagnostics counters shown in `GOAPDebugger.generateReport()`, and describes the last five misses. When you want those warnings to fail tests immediately, run suites with `GOAP_STATE_ASSERT=1`:

```bash
GOAP_STATE_ASSERT=1 npm run test:integration -- goap
```

This flag causes `PlanningStateView` to throw as soon as it records a miss, making it trivial to pinpoint which goal/heuristic referenced the bad path. The event log and debugger output both link back to this section so future contributors know how to enable the stricter mode.
`generateReportJSON()` mirrors this metadata via `diagnosticsMeta.planningState`, letting dashboards show that a miss just occurred (fresh) versus no misses being observed recently (stale = `true`).
```

## Implementation Notes

### Verified Codebase State

**Debug Infrastructure** (all files exist):
- ✅ `src/goap/debug/planInspector.js`
- ✅ `src/goap/debug/stateDiffViewer.js`
- ✅ `src/goap/debug/refinementTracer.js`
- ✅ `src/goap/debug/goapDebugger.js`

**Test Files** (all exist):
- ✅ `tests/unit/goap/debug/planInspector.test.js`
- ✅ `tests/unit/goap/debug/stateDiffViewer.test.js`
- ✅ `tests/unit/goap/debug/refinementTracer.test.js`
- ✅ `tests/unit/goap/debug/goapDebugger.test.js`
- ✅ `tests/integration/goap/debug/stateDiffViewerIntegration.test.js`
- ✅ `tests/integration/goap/debug/refinementTracerIntegration.test.js`
- ✅ `tests/integration/goap/debug/goapDebuggerIntegration.test.js`

**DI Configuration**:
- ✅ Token `IGOAPDebugger` exists at `tokens-core.js:369`
- ✅ Registration in `goapRegistrations.js:281-290`
- ✅ Dependencies: GoapController, PlanInspector, StateDiffViewer, RefinementTracer, Logger

**GoapController Debug API** (verified methods exist):
- ✅ `getActivePlan(actorId)` at line 1105
- ✅ `getFailedGoals(actorId)` at line 1133
- ✅ `getFailedTasks(actorId)` at line 1175
- ✅ `getCurrentTask(actorId)` at line 1210

**GOAP Events** (verified in `goapEvents.js`):
- ✅ `TASK_REFINED` (line 69)
- ✅ `REFINEMENT_STEP_STARTED` (line 105)
- ✅ `REFINEMENT_STEP_COMPLETED` (line 111)
- ✅ `REFINEMENT_STEP_FAILED` (line 117)
- ✅ `REFINEMENT_STATE_UPDATED` (line 123)
- ✅ `STATE_MISS` (line 132) — emitted whenever `PlanningStateView` cannot find a requested path/component

**Debug Tool Methods** (verified):
- ✅ PlanInspector: `inspect()`, `inspectJSON()`
- ✅ StateDiffViewer: `diff()`, `visualize()`, `diffJSON()`
- ✅ RefinementTracer: `startCapture()`, `stopCapture()`, `getTrace()`, `format()`
- ✅ GOAPDebugger: Delegates to all sub-tools with convenience wrapper methods

### Method Name Reference

**Important**: GOAPDebugger provides convenience wrapper methods that delegate to the underlying tools:

- `debugger.inspectPlan()` → `planInspector.inspect()`
- `debugger.inspectPlanJSON()` → `planInspector.inspectJSON()`
- `debugger.showStateDiff()` → `stateDiffViewer.visualize()`
- `debugger.showStateDiffJSON()` → `stateDiffViewer.diffJSON()`
- `debugger.startTrace()` → `refinementTracer.startCapture()`
- `debugger.stopTrace()` → `refinementTracer.stopCapture()`

This allows users to use intuitive method names while maintaining clean separation in the underlying tool implementations.

## Debugging Multi-Action Scenarios

**See Dedicated Guide**: [`debugging-multi-action.md`](./debugging-multi-action.md)

Multi-action planning scenarios require specialized debugging workflows. This section provides quick reference for common multi-action debugging tasks. For comprehensive workflows, see the dedicated guide.

### Quick Reference

**Common Multi-Action Issues**:

1. **Planning fails for multi-action scenario**
   - Check task reduces distance: `distance(after) < distance(before)`
   - Verify reuse limit not exceeded: `taskUsageCount < task.maxReuse`
   - Check cost/action limits: `estimatedCost < goal.maxCost`

2. **Plan has too many/few tasks**
   - Verify task effect magnitude in `planning_effects`
   - Check for clamping/overflow in numeric constraints
   - Review reuse limits in task definitions

3. **Wrong tasks selected**
   - Verify structural gates (preconditions)
   - Check task costs (planner prefers cheaper)
   - Review heuristic accuracy

### Key Debugging Commands

```javascript
// Enable debug logging
logger.setLevel('debug');

// Check distance reduction
const heuristicRegistry = container.resolve(tokens.IHeuristicRegistry);
const initialDistance = heuristicRegistry.calculate(
  'goal-distance',
  initialState,
  goal
);

// Simulate task and check new distance
const effectsSimulator = container.resolve(tokens.IPlanningEffectsSimulator);
const successorState = effectsSimulator.simulateEffects(
  initialState,
  task.planningEffects,
  { actor: { id: actorId } }
);

const newDistance = heuristicRegistry.calculate(
  'goal-distance',
  successorState,
  goal
);

console.log('Distance Reduced:', newDistance < initialDistance);

// Inspect plan structure
const debugger = container.resolve(tokens.IGOAPDebugger);
const plan = debugger.inspectPlan(actorId);
console.log(plan);
```

### Multi-Action Debugging Workflow

1. **Enable Debug Logging**: Set logger to 'debug' level
2. **Check Planning Events**: Look for `goap:planning_failed` events
3. **Verify Task Library**: Ensure applicable tasks exist after structural gates
4. **Test Distance Reduction**: Verify each task reduces heuristic distance
5. **Inspect Plan Structure**: Check task count, order, and parameters
6. **Analyze State Progression**: Use StateDiffViewer for step-by-step changes

**For Complete Workflows**: See [`debugging-multi-action.md`](./debugging-multi-action.md)

## References

- Implementation: `src/goap/debug/`
- Events: `src/goap/events/goapEvents.js`
- Controller: `src/goap/controllers/goapController.js`
- Spec: `specs/goap-system-specs.md`
- Multi-Action Debugging: [`docs/goap/debugging-multi-action.md`](./debugging-multi-action.md)
- Multi-Action Planning: [`docs/goap/multi-action-planning.md`](./multi-action-planning.md)
- Parent Ticket: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
