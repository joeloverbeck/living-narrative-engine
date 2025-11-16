# GOAPIMPL-025: GOAP Debugging Tools

**Priority**: MEDIUM
**Estimated Effort**: 3-4 hours (UPDATED: +1 hour for API additions)
**Dependencies**: GOAPIMPL-021 (GOAP Controller) ✅ COMPLETE

## Description

Create debugging and visualization tools for GOAP system: plan inspector, state diff viewer, search space visualizer, refinement tracer. These tools help developers and modders understand and debug GOAP behavior by consuming existing GOAP events and providing read-only inspection of internal state.

Good debugging tools are essential for working with complex AI systems - they turn black boxes into glass boxes.

## Acceptance Criteria

- [ ] Plan inspector shows task sequence with parameters
- [ ] State diff viewer shows world state changes between planning states
- [ ] Search space visualizer shows explored nodes and paths (requires planner changes)
- [ ] Refinement tracer shows step-by-step method execution (requires new events)
- [ ] Tools accessible via debug API
- [ ] Clear, actionable output format
- [ ] Tools work with real GOAP execution
- [ ] Documentation for using debug tools

## Files to Create

### Debug Tools
- `src/goap/debug/planInspector.js` - Inspect plans and task sequences (via GoapController API)
- `src/goap/debug/stateDiffViewer.js` - Visualize state changes (planning state hashes)
- `src/goap/debug/searchSpaceVisualizer.js` - Visualize planning search (requires planner changes)
- `src/goap/debug/refinementTracer.js` - Trace refinement execution (via events)
- `src/goap/debug/goapDebugger.js` - Main debug API (event-driven)

### Tests
- `tests/unit/goap/debug/goapDebugger.test.js` - Debug tool tests
- `tests/unit/goap/debug/planInspector.test.js` - Plan inspector tests
- `tests/unit/goap/debug/stateDiffViewer.test.js` - State diff tests
- `tests/unit/goap/debug/refinementTracer.test.js` - Tracer tests

## Files to Modify

### GOAP Controller (Debug API)
- `src/goap/controllers/goapController.js` - Add debug inspection methods:
  - `getActivePlan(actorId)` - Returns active plan or null
  - `getFailedGoals(actorId)` - Returns goal failure history
  - `getFailedTasks(actorId)` - Returns task failure history
  - `getCurrentTask(actorId)` - Returns current task from plan

### GOAP Planner (Search Capture)
- `src/goap/planner/goapPlanner.js` - Add optional search metadata capture:
  - Track explored nodes (closed set)
  - Track frontier nodes (open set)
  - Track node expansion order
  - Return search metadata with plan result

### GOAP Events (Step-Level Events)
- `src/goap/events/goapEvents.js` - Add new events:
  - `REFINEMENT_STEP_STARTED` - Step execution begins
  - `REFINEMENT_STEP_COMPLETED` - Step execution succeeds
  - `REFINEMENT_STEP_FAILED` - Step execution fails
  - `REFINEMENT_STATE_UPDATED` - Local state modified

### Refinement Engine (Event Dispatch)
- `src/goap/refinement/refinementEngine.js` - Dispatch step events during execution

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IGOAPDebugger: 'IGOAPDebugger'`
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register debugger with dependencies

## Testing Requirements

### Manual Testing (primary)
- Test inspector with various plans (listening to events)
- Test state diff accuracy (planning state hashes)
- Test visualizer output readability (if search capture implemented)
- Test tracer with complex refinements (consuming step events)

### Unit Tests
- Test inspector formatting (plan structure from GoapController)
- Test state diff calculation (symbolic state hashes)
- Test event listener registration and handling
- Test tracer event collection and formatting

## Tool 1: Plan Inspector

### Purpose
Display active plan in human-readable format by reading from GoapController

### Output Example
```
=== GOAP Plan: Achieve 'stay_fed' ===
Actor: actor-123
Goal Priority: 10
Plan Length: 3 tasks
Created: 1234567890
Last Validated: 1234567892

Tasks:
  1. [consume_nourishing_item] (COMPLETED)
     Parameters:
       - item: "food-1" (entity-123)

  2. [gather_resources] (CURRENT)
     Parameters:
       - resourceType: "food"
       - location: "forest-1" (entity-456)

  3. [transport_resources] (PENDING)
     Parameters:
       - from: "forest-1" (entity-456)
       - to: "camp-1" (entity-789)

Failure Tracking:
  Failed Goals: 0
  Failed Tasks: 0
  Recursion Depth: 0

=== End Plan ===
```

### API
```javascript
planInspector.inspect(goapController, actorId);
// Reads plan via goapController.getActivePlan(actorId)
// Returns formatted string

planInspector.formatTask(task, taskDefinition);
// Formats individual task with definition metadata
```

## Tool 2: State Diff Viewer

### Purpose
Show what changed between planning states (symbolic hashes, not nodes)

### Output Example
```
=== State Diff: Before Task → After Task ===
Task Applied: gather_resources (params: { resourceType: "food", location: "forest-1" })

Added Facts:
  + actor.state.has_resources = true
  + actor.inventory.items[0] = "wood-pile-1"

Modified Facts:
  ~ actor.state.located_at: "forest-1" → "camp-1"
  ~ world.entities["wood-pile-1"].count: 0 → 5

Removed Facts:
  - world.locations["forest-1"].resources.available = true

=== End Diff ===
```

### API
```javascript
stateDiffViewer.diff(beforeState, afterState);
// Compares symbolic state hashes
// Returns diff object with added/modified/removed

stateDiffViewer.visualize(diff);
// Returns formatted string
```

### Important Notes
- Works with **planning state hashes** (symbolic key-value pairs)
- NOT with ECS components (different abstraction level)
- Uses PlanningEffectsSimulator output for simulation diffs

## Tool 3: Search Space Visualizer

### Purpose
Visualize A* search for debugging planning (requires planner modifications)

### Output Example (ASCII art)
```
=== GOAP Search Space ===
Heuristic: goal-distance
Max Nodes: 1000
Nodes Explored: 4
Nodes Generated: 5

Start State (g=0, h=3, f=3)
  ├─ gather_resources (g=1, h=2, f=3) [EXPLORED]
  │  ├─ transport_resources (g=2, h=1, f=3) [EXPLORED]
  │  │  └─ consume_item (g=3, h=0, f=3) [GOAL] ✓
  │  └─ consume_item (g=2, h=1, f=3) [SKIPPED - preconditions]
  └─ hunt_animal (g=1, h=2.5, f=3.5) [NOT EXPLORED]

Solution Found: YES
Path Length: 3
Search Time: 23ms

=== End Search ===
```

### API
```javascript
searchSpaceVisualizer.visualize(searchMetadata);
// Requires searchMetadata from modified GoapPlanner
// Returns formatted tree

searchSpaceVisualizer.exportDot(searchMetadata);
// Returns Graphviz DOT format for visualization
```

### Planner Modifications Required
GoapPlanner needs to optionally capture:
- All explored nodes (closed set)
- All frontier nodes (open set)
- Node expansion order
- Parent pointers for path reconstruction

## Tool 4: Refinement Tracer

### Purpose
Trace refinement method execution step-by-step via events

### Output Example
```
=== Refinement Trace: consume_nourishing_item ===
Actor: actor-123
Method Selected: eating_nearby_food
Method Applicability: actor.has_food && food.nearby

Events Captured:
[12:34:56.001] TASK_REFINED: taskId=consume_nourishing_item, stepsGenerated=2
[12:34:56.002] REFINEMENT_STEP_STARTED: step=0, actionId=pick_up_item
[12:34:56.003] REFINEMENT_STATE_UPDATED: pickedItem="food-1"
[12:34:56.004] REFINEMENT_STEP_COMPLETED: step=0, success=true
[12:34:56.005] REFINEMENT_STEP_STARTED: step=1, actionId=eat_food
[12:34:56.006] REFINEMENT_STEP_COMPLETED: step=1, success=true

Refinement Complete
Actions Generated: 2
  1. pick_up_item(item: "food-1")
  2. eat_food(item: "food-1")

=== End Trace ===
```

### API
```javascript
refinementTracer.startCapture(actorId);
// Begins listening to refinement events for actor

refinementTracer.stopCapture(actorId);
// Stops listening and returns captured trace

refinementTracer.format(trace);
// Returns formatted string
```

### Event-Based Design
Listens to existing and new GOAP events:
- `TASK_REFINED` (existing)
- `REFINEMENT_FAILED` (existing)
- `REFINEMENT_STEP_STARTED` (NEW - requires implementation)
- `REFINEMENT_STEP_COMPLETED` (NEW - requires implementation)
- `REFINEMENT_STEP_FAILED` (NEW - requires implementation)
- `REFINEMENT_STATE_UPDATED` (NEW - requires implementation)

## Main Debug API

### GOAPDebugger Interface
```javascript
class GOAPDebugger {
  constructor({ goapController, goapPlanner, eventBus, dataRegistry, logger })

  // Plan inspection (via GoapController API)
  inspectPlan(actorId);
  inspectCurrentGoal(actorId);
  getFailureHistory(actorId);

  // State visualization (from planning state hashes)
  showStateDiff(beforeState, afterState);

  // Search visualization (if planner capture enabled)
  visualizeSearch(searchMetadata);
  exportSearchGraph(searchMetadata, format = 'dot');

  // Refinement tracing (via events)
  startTrace(actorId);
  stopTrace(actorId);
  getTrace(actorId);

  // Event monitoring
  listenToEvents(actorId, callback);
  stopListening(actorId);

  // Combined report
  generateReport(actorId);
  // Returns comprehensive debug report
}
```

### Usage Example
```javascript
// In console or debug script
const debugger = container.resolve(tokens.IGOAPDebugger);

// Inspect current plan (reads from GoapController)
const plan = debugger.inspectPlan('actor-123');
console.log(plan);

// Enable refinement tracing (listens to events)
debugger.startTrace('actor-123');

// Execute turn
await goapController.decideTurn(actor, world);

// View trace
const trace = debugger.getTrace('actor-123');
console.log(trace);

// Stop tracing
debugger.stopTrace('actor-123');
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 507-516 - **PRIMARY REFERENCE** - Invest in GOAP tooling

### Existing Implementation
- `src/goap/controllers/goapController.js` - Controller with active plan
- `src/goap/events/goapEvents.js` - Event system (already complete)
- `src/goap/planner/goapPlanner.js` - A* planner (needs search capture)
- `src/goap/refinement/refinementEngine.js` - Refinement orchestrator
- `src/goap/planner/planningEffectsSimulator.js` - State transformation
- `src/dependencyInjection/registrations/goapRegistrations.js` - DI setup

## Implementation Notes

### Performance Impact
- Debug tools should be **opt-in** (don't slow down production)
- Event listeners should be added/removed dynamically
- Search capture should be disabled by default
- Consider feature flags for debug mode

### Output Formats
- **Console**: Human-readable text (primary)
- **JSON**: Machine-readable for tools (secondary)
- **DOT**: Graph visualization (Graphviz) for search space

### Integration with Logging
Debug tools complement logging:
- **Logging**: Continuous monitoring, production use
- **Debug tools**: Interactive debugging, development use

### Event-Driven Design
Debug tools are **event consumers**:
- Listen to GOAP events from EventBus
- No direct coupling to GOAP internals
- Capture event sequences for analysis
- Can be enabled/disabled at runtime

## Integration Points

### Required Services (inject)
- `IGoapController` - Access to plan state (NEW API methods needed)
- `IGoapPlanner` - Access to planning (search capture optional)
- `IRefinementEngine` - Refinement orchestration (dispatches events)
- `IEventBus` - GOAP event consumption
- `IDataRegistry` - Access to goals/tasks definitions
- `IEntityManager` - Access to actor entities
- `ILogger` - Logging integration

### Optional Features
- Search space capture (requires planner changes)
- Step-level tracing (requires new events)

## Success Validation

✅ **Done when**:
- All debug tools implemented and working
- Tools consume existing GOAP events
- GoapController debug API added
- Plan inspector shows plan structure correctly
- State diff viewer handles symbolic state hashes
- Tools provide clear, actionable output
- Manual testing confirms tools are useful
- Performance impact is minimal (opt-in design)
- Documentation explains how to use tools
- Unit tests validate tool logic
- Integration with existing event system verified

## Prerequisites Before Implementation

### Required API Changes

1. **GoapController Debug API** (src/goap/controllers/goapController.js):
   ```javascript
   getActivePlan(actorId)     // Returns plan or null
   getFailedGoals(actorId)    // Returns failure history
   getFailedTasks(actorId)    // Returns failure history
   getCurrentTask(actorId)    // Returns current task
   ```

2. **New GOAP Events** (src/goap/events/goapEvents.js):
   ```javascript
   REFINEMENT_STEP_STARTED
   REFINEMENT_STEP_COMPLETED
   REFINEMENT_STEP_FAILED
   REFINEMENT_STATE_UPDATED
   ```

3. **Optional: Planner Search Capture** (src/goap/planner/goapPlanner.js):
   - Add `captureSearch: boolean` option to plan() method
   - Return search metadata with plan result

### Implementation Order

1. Add GoapController debug API (required for plan inspector)
2. Add new events to goapEvents.js (required for refinement tracer)
3. Update RefinementEngine to dispatch step events
4. Implement debug tools (consume events + API)
5. Add DI token and registration
6. Create tests
7. Document usage

## Notes

- This workflow was validated against current codebase on 2025-11-16
- See `claudedocs/workflow-validation-GOAPIMPL-025.md` for validation details
- GOAP event system already exists and is complete
- Plan structure is private in GoapController - requires new API
- State diff works with symbolic state hashes, not ECS components
- Search visualization requires planner modifications
- Refinement tracing requires new step-level events
