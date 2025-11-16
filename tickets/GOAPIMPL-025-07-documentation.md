# GOAPIMPL-025-07: GOAP Debugging Tools Documentation

**Parent Ticket**: GOAPIMPL-025 (GOAP Debugging Tools)
**Priority**: LOW
**Estimated Effort**: 1 hour
**Dependencies**: All other GOAPIMPL-025 tickets

## Description

Create comprehensive documentation for GOAP debugging tools, including usage guides, examples, troubleshooting tips, and integration with the testing workflow. This documentation ensures developers can effectively debug GOAP behavior during development and testing.

**Reference**:
- Parent ticket: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Spec: `specs/goap-system-specs.md` lines 507-516

## Acceptance Criteria

- [ ] Usage guide with examples
- [ ] API reference for all tools
- [ ] Troubleshooting section
- [ ] Integration with test workflow documented
- [ ] Performance considerations documented
- [ ] Documentation updated in docs/goap/

## Documentation Structure

### File to Create

`docs/goap/debugging-tools.md`

```markdown
# GOAP Debugging Tools

**Status**: ✅ Complete
**Last Updated**: 2025-11-16

## Overview

The GOAP debugging tools provide comprehensive inspection and tracing capabilities for the GOAP system. These tools help developers understand planning behavior, refinement execution, and diagnose issues during development and testing.

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
- `inspectPlan(actorId)` - Returns formatted plan text
- `inspectPlanJSON(actorId)` - Returns plan as JSON object

**Example Output**:
```
=== GOAP Plan: Achieve 'stay_fed' ===
Actor: actor-123
Goal: Maintain nourishment
Goal Priority: 10
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

### State Diff Viewer

**Purpose**: Visualize changes to planning state during task simulation.

**IMPORTANT**: Works with **planning state hashes** (symbolic key-value pairs), not ECS components.

**Methods**:
- `showStateDiff(beforeState, afterState, options)` - Returns formatted diff
- `showStateDiffJSON(beforeState, afterState)` - Returns diff as JSON

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

### Refinement Tracer

**Purpose**: Capture step-by-step refinement method execution.

**Methods**:
- `startTrace(actorId)` - Begin capturing events
- `stopTrace(actorId)` - Stop and return trace
- `getTrace(actorId)` - Get current trace without stopping
- `formatTrace(trace)` - Format trace as text

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
for (const failure of failures.failedGoals) {
  console.log(`  ${failure.goalId}: ${failure.reason}`);
  console.log(`  Timestamp: ${new Date(failure.timestamp).toISOString()}`);
}

console.log(`Failed Tasks: ${failures.failedTasks.length}`);
for (const failure of failures.failedTasks) {
  console.log(`  ${failure.taskId}: ${failure.reason}`);
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

## References

- Implementation: `src/goap/debug/`
- Events: `src/goap/events/goapEvents.js`
- Controller: `src/goap/controllers/goapController.js`
- Spec: `specs/goap-system-specs.md`
- Parent Ticket: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
```

### File to Update

`docs/goap/IMPLEMENTATION-STATUS.md`

Add new section:

```markdown
### Debugging Tools ✅ COMPLETE

**Status**: Fully implemented and tested
**Tickets**: GOAPIMPL-025-01 through GOAPIMPL-025-07

**Components**:
- Plan Inspector (`src/goap/debug/planInspector.js`)
- State Diff Viewer (`src/goap/debug/stateDiffViewer.js`)
- Refinement Tracer (`src/goap/debug/refinementTracer.js`)
- GOAP Debugger (`src/goap/debug/goapDebugger.js`)

**Features**:
- Active plan inspection with entity resolution
- Planning state diff visualization
- Step-by-step refinement tracing
- Unified debug API with combined reporting
- Full event-driven architecture

**DI Integration**:
- Token: `IGOAPDebugger` (tokens-core.js)
- Registration: goapRegistrations.js
- Dependencies: GoapController, EventBus, DataRegistry, EntityManager

**Documentation**: `docs/goap/debugging-tools.md`
```

## Testing Requirements

### Documentation Validation

1. **Accuracy Check**:
   - Verify all code examples are correct
   - Test all API examples in console
   - Validate output examples match actual output

2. **Completeness Check**:
   - All debug tools documented
   - All methods have examples
   - Troubleshooting covers common issues

3. **Integration Check**:
   - Test workflow examples work end-to-end
   - Verify integration with testing patterns

## Manual Testing

1. **Follow Quick Start**:
   - Execute quick start example
   - Verify output matches documentation

2. **Test Advanced Examples**:
   - Run each advanced usage example
   - Verify behavior is as documented

3. **Troubleshooting Validation**:
   - Intentionally trigger each issue
   - Verify solutions work

## Success Validation

✅ **Done when**:
- `docs/goap/debugging-tools.md` created
- `docs/goap/IMPLEMENTATION-STATUS.md` updated
- All code examples tested
- All output examples verified
- Troubleshooting section validated
- Documentation reviewed for clarity
- Links to relevant files correct

## References

- Parent: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- All GOAPIMPL-025 sub-tickets
- Existing docs: `docs/goap/IMPLEMENTATION-STATUS.md`
- Spec: `specs/goap-system-specs.md`
