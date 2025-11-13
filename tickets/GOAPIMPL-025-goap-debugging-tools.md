# GOAPIMPL-025: GOAP Debugging Tools

**Priority**: MEDIUM
**Estimated Effort**: 2-3 hours
**Dependencies**: GOAPIMPL-021 (GOAP Controller)

## Description

Create debugging and visualization tools for GOAP system: plan inspector, state diff viewer, search space visualizer, refinement tracer. These tools help developers and modders understand and debug GOAP behavior.

Good debugging tools are essential for working with complex AI systems - they turn black boxes into glass boxes.

## Acceptance Criteria

- [ ] Plan inspector shows task sequence with parameters
- [ ] State diff viewer shows world state changes between planning nodes
- [ ] Search space visualizer shows explored nodes and paths
- [ ] Refinement tracer shows step-by-step method execution
- [ ] Tools accessible via debug API or console commands
- [ ] Clear, actionable output format
- [ ] Tools work with real GOAP execution
- [ ] Documentation for using debug tools

## Files to Create

### Debug Tools
- `src/goap/debug/planInspector.js` - Inspect plans and task sequences
- `src/goap/debug/stateDiffViewer.js` - Visualize state changes
- `src/goap/debug/searchSpaceVisualizer.js` - Visualize planning search
- `src/goap/debug/refinementTracer.js` - Trace refinement execution
- `src/goap/debug/goapDebugger.js` - Main debug API

### Tests
- `tests/unit/goap/debug/goapDebugger.test.js` - Debug tool tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register debugger

### GOAP Components
- Optionally add debug hooks to planner, refinement engine, etc.

## Testing Requirements

### Manual Testing (primary)
- Test inspector with various plans
- Test state diff accuracy
- Test visualizer output readability
- Test tracer with complex refinements

### Unit Tests
- Test inspector formatting
- Test state diff calculation
- Test visualizer data structures
- Test tracer event collection

## Tool 1: Plan Inspector

### Purpose
Display plan in human-readable format

### Output Example
```
=== GOAP Plan: Achieve 'stay_fed' ===
Goal Priority: 10
Plan Length: 3 tasks
Estimated Cost: 3.0

Tasks:
  1. [gather_resources]
     Parameters:
       - resourceType: "food"
       - location: "forest-1" (entity-456)
     Preconditions: actor.in_location && resources_available
     Effects: actor.has_resources = true

  2. [transport_resources]
     Parameters:
       - from: "forest-1" (entity-456)
       - to: "camp-1" (entity-789)
     Preconditions: actor.has_resources
     Effects: resources.location = camp-1

  3. [consume_nourishing_item]
     Parameters:
       - item: "food-1" (entity-123)
     Preconditions: actor.hungry && item.accessible
     Effects: actor.hungry = false

=== End Plan ===
```

### API
```javascript
planInspector.inspect(plan, options = {});
// Returns formatted string

planInspector.inspectCurrent(actor);
// Inspects actor's current active plan
```

## Tool 2: State Diff Viewer

### Purpose
Show what changed between planning nodes

### Output Example
```
=== State Diff: Node 5 → Node 6 ===
Task Applied: gather_resources

Added Facts:
  + actor-1:core:has_resources = true
  + actor-1:inventory:items[] += "wood-pile-1"

Modified Facts:
  ~ actor-1:core:located_at: "forest-1" → "camp-1"
  ~ wood-pile-1:items:count: 0 → 5

Removed Facts:
  - forest-1:resources:available = true

=== End Diff ===
```

### API
```javascript
stateDiffViewer.diff(nodeA, nodeB);
// Returns diff object with added/modified/removed

stateDiffViewer.visualize(diff);
// Returns formatted string
```

## Tool 3: Search Space Visualizer

### Purpose
Visualize A* search for debugging planning

### Output Example (ASCII art)
```
=== GOAP Search Space ===
Start State (g=0, h=3, f=3)
  ├─ gather_resources (g=1, h=2, f=3) [EXPLORED]
  │  ├─ transport_resources (g=2, h=1, f=3) [EXPLORED]
  │  │  └─ consume_item (g=3, h=0, f=3) [GOAL] ✓
  │  └─ consume_item (g=2, h=1, f=3) [SKIPPED - preconditions]
  └─ hunt_animal (g=1, h=2.5, f=3.5) [NOT EXPLORED]

Nodes Explored: 4
Nodes Generated: 5
Solution Found: YES
Path Length: 3
Search Time: 23ms

=== End Search ===
```

### API
```javascript
searchSpaceVisualizer.visualize(searchResult);
// Returns formatted tree

searchSpaceVisualizer.exportDot(searchResult);
// Returns Graphviz DOT format for visualization
```

## Tool 4: Refinement Tracer

### Purpose
Trace refinement method execution step-by-step

### Output Example
```
=== Refinement Trace: consume_nourishing_item ===
Method Selected: eating_nearby_food
Applicability: actor.has_food && food.nearby

Step 1: [primitive_action] pick_up_item
  Target Bindings:
    item: task.params.item → "food-1" (entity-123)
  Execution: SUCCESS
  Store Result As: pickedItem
  Local State: { pickedItem: "food-1" }

Step 2: [conditional]
  Condition: { "var": "refinement.localState.pickedItem" }
  Evaluation: TRUE
  Branch: THEN

  Step 2.1: [primitive_action] eat_food
    Target Bindings:
      item: refinement.localState.pickedItem → "food-1"
    Execution: SUCCESS
    Store Result As: eatingResult
    Local State: { pickedItem: "food-1", eatingResult: { success: true } }

Refinement Complete
Actions Generated: 2
  1. pick_up_item(item: "food-1")
  2. eat_food(item: "food-1")

=== End Trace ===
```

### API
```javascript
refinementTracer.trace(task, context);
// Returns trace object

refinementTracer.format(trace);
// Returns formatted string

refinementTracer.enable();
refinementTracer.disable();
// Enable/disable tracing (performance impact)
```

## Main Debug API

### GOAPDebugger Interface
```javascript
class GOAPDebugger {
  // Plan inspection
  inspectPlan(actor);
  inspectCurrentGoal(actor);

  // State visualization
  showStateDiff(nodeA, nodeB);
  showWorldState(actor);

  // Search visualization
  visualizeSearch(searchResult);
  exportSearchGraph(searchResult, format = 'dot');

  // Refinement tracing
  startTrace();
  stopTrace();
  getTrace(taskId);

  // Combined report
  generateReport(actor);
  // Returns comprehensive debug report
}
```

### Usage Example
```javascript
// In console or debug script
const debugger = container.resolve('GOAPDebugger');

// Inspect current plan
debugger.inspectPlan(actor);

// Enable refinement tracing
debugger.startTrace();

// Execute turn
await goapController.decideTurn(actor, world);

// View trace
const trace = debugger.getTrace('consume_nourishing_item');
console.log(debugger.format(trace));
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 507-516 - **PRIMARY REFERENCE** - Invest in GOAP tooling

## Implementation Notes

### Performance Impact
- Debug tools should be **opt-in** (don't slow down production)
- Use feature flags or environment variables
- Consider lazy evaluation of debug output

### Output Formats
- **Console**: Human-readable text
- **JSON**: Machine-readable for tools
- **DOT**: Graph visualization (Graphviz)
- **HTML**: Web-based visualization (advanced)

### Integration with Logging
Debug tools complement logging:
- **Logging**: Continuous monitoring, production use
- **Debug tools**: Interactive debugging, development use

### Visualization Libraries
For advanced visualization:
- **vis.js**: JavaScript graph visualization
- **D3.js**: Data visualization
- **Graphviz**: Graph layout engine

### Debug Command Registration
Register debug commands:
```javascript
commandRegistry.register('/goap-inspect', (actor) => {
  return debugger.inspectPlan(actor);
});

commandRegistry.register('/goap-trace', (actor, taskId) => {
  return debugger.getTrace(taskId);
});
```

## Integration Points

### Required Services (inject)
- `IGOAPController` - Access to planning/refinement
- `ILogger` - Logging integration

### Optional Services
- `ICommandRegistry` - Register debug commands

## Success Validation

✅ **Done when**:
- All debug tools implemented and working
- Tools provide clear, actionable output
- Manual testing confirms tools are useful
- Tools accessible via debug API
- Performance impact is minimal (when not tracing)
- Documentation explains how to use tools
- Unit tests validate tool logic
