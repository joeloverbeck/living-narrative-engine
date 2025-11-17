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

// Stop trace
debugger.stopTrace('actor-123');
```

## Planner Contract Checklist

- Use `tests/common/mocks/createGoapPlannerMock.js` for any GOAP planner doubles. The factory ships with `plan()` and `getLastFailure()` wired to the same defaults required by `GoapController`.
- Immediately call `expectGoapPlannerMock(mock)` after instantiating a test double. It mirrors the runtime dependency validator so tests fail locally instead of during E2E runs.
- When `GoapController` boots it emits `goap:dependency_validated` telemetry and the debugger prints a **Dependency Contracts** section. That block lists required vs provided methods plus timestamps, making mock drift obvious inside `npm run test:e2e -- --report-goap-debug` logs.
- Any `GOAP_DEPENDENCY_WARN` log means a mock bypassed the factory or a dependency is missing methods. CI greps for this string to fail builds before the regression spreads.
- GOAP integration harnesses should call `setup.registerPlanningActor(actor)` and `setup.buildPlanningState(actor)` instead of wiring the entity manager manually. This keeps `SimpleEntityManager`, the dual-format planning state, and the new task validation guardrails perfectly in sync.

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
- Feed the hash into the **State Diff Viewer** before/after a task to verify whether the expected `entityId:componentId` entries exist. If a key is missing, `HasComponentOperator` will intentionally fall back to the runtime `EntityManager`.
- Inspect `state.actor.components` (and the flattened aliases with underscores) in the diff output to ensure colon-based component IDs stay mirrored—those mirrors are what allow JSON Logic expressions like `state.actor.components.core_needs.hunger` to resolve without helper glue.

This workflow keeps component-aware planning observable without ad-hoc logging and reaffirms that `#buildEvaluationContext` is the extension point for any future preprocessing.

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
