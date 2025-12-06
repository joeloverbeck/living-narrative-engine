# Debugging Multi-Action Planning

This guide provides comprehensive workflows for debugging multi-action planning scenarios in the GOAP system. Use this when plans fail, produce unexpected results, or need performance optimization.

## Quick Diagnostics

### Step 1: Enable Debug Logging

```javascript
// Create logger with debug level
const logger = createLogger({ level: 'debug' });

// Pass to planner (usually via DI container)
const planner = container.resolve(tokens.IGoapPlanner);
```

**What to Look For**:

- Task selection decisions
- State transitions
- Distance calculations
- Cost comparisons

### Step 2: Check Planning Events

```javascript
// Get all events from event bus
const events = eventBus.getAll();

// Filter for planning failures
const failures = events.filter((e) => e.type === 'goap:planning_failed');

// Analyze failure reasons
failures.forEach((f) => {
  console.log('Failure Reason:', f.payload.reason);
  console.log('Actor ID:', f.payload.actorId);
  console.log('Goal ID:', f.payload.goalId);
  console.log('Timestamp:', f.payload.timestamp);
});
```

**Common Failure Reasons**:

- `'NO_APPLICABLE_TASKS'` - Task library empty after structural gates
- `'COST_LIMIT_EXCEEDED'` - Estimated cost > maxCost
- `'ACTION_LIMIT_EXCEEDED'` - Plan length > maxActions
- `'SEARCH_EXHAUSTED'` - No path to goal found

### Step 3: Inspect Plan Structure

```javascript
// Find successful planning event
const planCreated = events.find((e) => e.type === 'goap:planning_completed');

if (planCreated) {
  console.log('Task Count:', planCreated.payload.planLength);
  console.log(
    'Tasks:',
    planCreated.payload.tasks.map((t) => t.id)
  );
  console.log('Actor ID:', planCreated.payload.actorId);
  console.log('Goal ID:', planCreated.payload.goalId);

  // Detailed task inspection
  planCreated.payload.tasks.forEach((task, index) => {
    console.log(`Task ${index + 1}:`, task.id);
    console.log('  Cost:', task.cost);
    console.log('  Params:', task.boundParams);
  });
}
```

**What to Verify**:

- Task count matches expectations
- Tasks are in logical order
- Bound parameters are correct entities
- Total cost is reasonable

## Using GOAP Debugger (Advanced)

### Setup Debugger

```javascript
// Import debug tools
import GOAPDebugger from './src/goap/debug/goapDebugger.js';
import PlanInspector from './src/goap/debug/planInspector.js';
import StateDiffViewer from './src/goap/debug/stateDiffViewer.js';
import RefinementTracer from './src/goap/debug/refinementTracer.js';

// RECOMMENDED: Use DI container
const goapDebugger = container.resolve(tokens.IGOAPDebugger);

// OR: Manual instantiation (testing only)
const goapDebugger = new GOAPDebugger({
  goapController: container.resolve(tokens.IGoapController),
  planInspector: new PlanInspector({
    goapController: container.resolve(tokens.IGoapController),
    dataRegistry: container.resolve(tokens.IDataRegistry),
    entityManager: container.resolve(tokens.IEntityManager),
    entityDisplayDataProvider: container.resolve(
      tokens.IEntityDisplayDataProvider
    ),
    logger: logger,
  }),
  stateDiffViewer: new StateDiffViewer({ logger: logger }),
  refinementTracer: new RefinementTracer({
    eventBus: container.resolve(tokens.IEventBus),
    logger: logger,
  }),
  logger: logger,
});

// Start tracing for an actor
goapDebugger.startTrace(actorId);
```

### Capture Planning Trace

```javascript
try {
  // Execute decision-making
  await controller.decideTurn(actor, world);
} catch (err) {
  console.error('Decision failed:', err);

  // Generate comprehensive text report
  const report = goapDebugger.generateReport(actorId);
  console.log(report); // Formatted text output

  // OR: Get structured JSON report
  const jsonReport = goapDebugger.generateReportJSON(actorId);
  console.log('Plan:', jsonReport.plan);
  console.log('Failures:', jsonReport.failures);
  console.log('Trace:', jsonReport.trace);
  console.log('Current Goal:', jsonReport.currentGoal);
}
```

**Report Contains**:

- Current plan (if any)
- Recent failures (goals and tasks)
- Refinement trace (task → action translation)
- Current goal state

### Analyze State Progression

```javascript
// Create state diff viewer
const stateDiffViewer = new StateDiffViewer({ logger: logger });

// Capture states before and after task
const beforeState = captureState(actor, world);

// Simulate task application
const afterState = effectsSimulator.simulateEffects(
  beforeState,
  task.planningEffects,
  { actor: { id: actorId } }
);

// Compute differences
const diff = stateDiffViewer.diff(beforeState, afterState);

// Visualize as formatted text
const visualized = stateDiffViewer.visualize(diff, {
  taskName: 'task:consume_item',
  stepNumber: 1,
});
console.log(visualized);

// OR: Get structured JSON
const jsonDiff = stateDiffViewer.diffJSON(beforeState, afterState, {
  taskName: 'task:consume_item',
});
console.log('Added Fields:', jsonDiff.changes.added);
console.log('Modified Fields:', jsonDiff.changes.modified);
console.log('Removed Fields:', jsonDiff.changes.removed);
console.log('Summary:', jsonDiff.summary);
```

**Use Cases**:

- Verify task effects are applied correctly
- Debug unexpected state changes
- Understand why tasks are/aren't applicable

## Common Debugging Scenarios

### Scenario 1: Planning Fails (No Plan Found)

**Symptoms**: `goap:planning_failed` event with reason in payload

**Debugging Steps**:

1. **Check Initial State vs Goal**:

   ```javascript
   const initialState = captureState(actor, world);
   const goal = {
     goalState: {
       /* ... */
     },
   };

   // Verify fields exist that goal references
   const goalFields = extractFieldsFromGoal(goal.goalState);
   goalFields.forEach((field) => {
     const value = getNestedValue(initialState, field);
     console.log(`${field}:`, value);
   });
   ```

2. **Verify Tasks Exist That Modify Relevant Fields**:

   ```javascript
   const taskLibrary = buildTaskLibrary(actor, tasks);
   console.log(
     'Available Tasks:',
     taskLibrary.map((t) => t.id)
   );

   // Check if any task affects goal fields
   taskLibrary.forEach((task) => {
     const affectedFields = task.planningEffects.map((e) => e.path);
     console.log(`${task.id} affects:`, affectedFields);
   });
   ```

3. **Check Structural Gates**:

   ```javascript
   // Test if tasks pass structural gates
   tasks.forEach((task) => {
     if (task.structural_gates) {
       const passes = jsonLogic.apply(task.structural_gates, {
         actor: initialState.actor,
         world: initialState.world,
       });
       console.log(`${task.id} structural gates:`, passes);
     }
   });
   ```

4. **Verify Tasks Reduce Distance**:

   ```javascript
   const heuristicRegistry = container.resolve(tokens.IHeuristicRegistry);
   const effectsSimulator = container.resolve(tokens.IPlanningEffectsSimulator);

   // Calculate initial distance
   const initialDistance = heuristicRegistry.calculate(
     'goal-distance',
     initialState,
     goal
   );
   console.log('Initial Distance:', initialDistance);

   // Test each task
   taskLibrary.forEach((task) => {
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

     console.log(`${task.id}:`, {
       before: initialDistance,
       after: newDistance,
       reduces: newDistance < initialDistance,
     });
   });
   ```

### Scenario 2: Wrong Number of Tasks

**Symptoms**: Plan has fewer/more tasks than expected

**Debugging Steps**:

1. **Calculate Expected Task Count Manually**:

   ```javascript
   // For numeric goals
   const currentValue = getNestedValue(
     initialState,
     'actor.components.core_needs.hunger'
   );
   const targetValue = 10; // From goal
   const distance = currentValue - targetValue;

   // From task definition
   const taskEffect = 60; // Amount task reduces hunger
   const expectedTasks = Math.ceil(distance / taskEffect);

   console.log('Expected Tasks:', expectedTasks);
   console.log('Actual Tasks:', plan.tasks.length);
   console.log('Difference:', plan.tasks.length - expectedTasks);
   ```

2. **Check Task Effect Magnitude**:

   ```javascript
   // Inspect task's planning_effects
   const task = dataRegistry.get('tasks', 'test:eat');
   const effects = task.planningEffects;

   effects.forEach((effect) => {
     console.log('Operation:', effect.op);
     console.log('Path:', effect.path);
     console.log('Amount:', effect.amount);
   });
   ```

3. **Verify Reuse Limits**:

   ```javascript
   // Count task reuses in plan
   const taskCounts = new Map();
   plan.tasks.forEach((task) => {
     const count = taskCounts.get(task.id) || 0;
     taskCounts.set(task.id, count + 1);
   });

   // Compare against maxReuse
   taskCounts.forEach((count, taskId) => {
     const taskDef = dataRegistry.get('tasks', taskId);
     const maxReuse = taskDef.maxReuse || 10;
     console.log(`${taskId}: ${count}/${maxReuse}`);
   });
   ```

4. **Check for Clamping/Overflow**:
   ```javascript
   // Simulate plan execution step by step
   let state = initialState;
   plan.tasks.forEach((task, index) => {
     state = effectsSimulator.simulateEffects(state, task.planningEffects, {
       actor: { id: actorId },
     });

     const value = getNestedValue(state, 'actor.components.core_needs.hunger');
     console.log(`After task ${index + 1}:`, value);
   });
   ```

### Scenario 3: Cost/Task Limit Exceeded

**Symptoms**: `goap:planning_failed` with specific reason

**Debugging Steps**:

1. **Check Estimated Cost vs Limit**:

   ```javascript
   const heuristicRegistry = container.resolve(tokens.IHeuristicRegistry);

   // Heuristic estimates distance (not cost directly)
   const estimatedDistance = heuristicRegistry.calculate(
     'goal-distance',
     initialState,
     goal
   );

   // Get limits from goal definition
   const goalDef = dataRegistry.getGoalDefinition(goal.id);
   const maxCost = goalDef.maxCost || Infinity;
   const maxActions = goalDef.maxActions || 20;

   console.log('Estimated Distance:', estimatedDistance);
   console.log('Max Cost:', maxCost);
   console.log('Max Actions:', maxActions);

   // Check feasibility
   console.log('Appears Feasible:', estimatedDistance < Infinity);
   ```

2. **Verify Task Costs**:

   ```javascript
   // List task costs
   taskLibrary.forEach((task) => {
     console.log(`${task.id}: cost=${task.cost}`);
   });

   // Calculate theoretical minimum cost
   const cheapestTask = Math.min(...taskLibrary.map((t) => t.cost));
   const minCost = expectedTasks * cheapestTask;
   console.log('Theoretical Min Cost:', minCost);
   console.log('Within Limit:', minCost <= maxCost);
   ```

3. **Consider Alternatives**:

   ```javascript
   // Option 1: Increase limits
   goalDef.maxCost = 100; // From 50
   goalDef.maxActions = 15; // From 10

   // Option 2: Use more effective tasks
   // (add task with larger effect magnitude)

   // Option 3: Reduce required change
   // (adjust goal to be less strict)
   ```

## Performance Profiling

### Measure Planning Time

```javascript
const startTime = performance.now();

const plan = await planner.plan(actorId, goal, tasks, initialState);

const endTime = performance.now();
const planningTime = endTime - startTime;

console.log('Planning Time:', planningTime.toFixed(2), 'ms');

// Benchmark thresholds
if (planningTime > 1000) {
  console.warn('Planning very slow (>1s)');
} else if (planningTime > 100) {
  console.warn('Planning slow (>100ms)');
}
```

### Track Node Expansion

```javascript
// Add custom metric tracking (requires planner modification)
let nodesExpanded = 0;
let nodesPruned = 0;

// In planner A* loop (for debugging only)
while (open.length > 0) {
  nodesExpanded++;

  const current = open.pop();

  // ... check if pruned
  if (shouldPrune) {
    nodesPruned++;
    continue;
  }

  // ... rest of search logic
}

console.log('Nodes Expanded:', nodesExpanded);
console.log('Nodes Pruned:', nodesPruned);
console.log(
  'Expansion Efficiency:',
  ((nodesPruned / nodesExpanded) * 100).toFixed(1),
  '%'
);
```

### Memory Usage

```javascript
// Node.js environment only
const initialMemory = process.memoryUsage().heapUsed;

await planner.plan(actorId, goal, tasks, initialState);

const finalMemory = process.memoryUsage().heapUsed;
const deltaBytes = finalMemory - initialMemory;
const deltaMB = deltaBytes / 1024 / 1024;

console.log('Memory Delta:', deltaMB.toFixed(2), 'MB');

// Warning thresholds
if (deltaMB > 50) {
  console.warn('High memory usage (>50MB)');
}
```

## Troubleshooting Checklist

Use this checklist when debugging multi-action planning issues:

- [ ] **Initial state contains fields referenced in goal**
  - Verify all goal state paths exist in initial state
- [ ] **Tasks exist that modify the correct fields**
  - At least one task affects each goal field
- [ ] **Structural gates evaluate correctly**
  - All expected tasks pass structural gates
  - No unexpected tasks are included
- [ ] **Tasks reduce distance to goal**
  - Each task application decreases heuristic distance
  - No "wrong direction" tasks in library
- [ ] **Reuse limits are not exceeded**
  - Task count ≤ maxReuse for each task type
- [ ] **Cost/action limits are reasonable**
  - maxCost allows for expected plan length
  - maxActions accommodates required tasks
- [ ] **Debug logging is enabled**
  - Logger level set to 'debug'
  - Planner emits detailed logs
- [ ] **Planning time and memory usage are acceptable**
  - Planning completes in <1 second
  - Memory usage <50MB for typical scenarios
- [ ] **Actual vs expected plan structure matches**
  - Task count, order, and parameters as expected

## Tools Reference

### GOAPDebugger API

```javascript
// Start/stop tracing
startTrace(actorId); // Begin capturing refinement trace
stopTrace(actorId); // Stop and return trace
getTrace(actorId); // Get current trace without stopping
formatTrace(trace); // Format trace as human-readable text

// Reporting
generateReport(actorId); // Generate comprehensive text report
generateReportJSON(actorId); // Generate structured JSON report

// Plan inspection
inspectPlan(actorId); // Get formatted plan text
inspectPlanJSON(actorId); // Get plan structure as JSON
inspectCurrentGoal(actorId); // Get current goal for actor

// Failure analysis
getFailureHistory(actorId); // Get failed goals and tasks with nested arrays

// State diff
showStateDiff(beforeState, afterState, options); // Show formatted diff
showStateDiffJSON(beforeState, afterState, options); // Get diff as JSON
```

### PlanInspector API

```javascript
// Plan inspection
inspect(actorId)       // Return formatted plan text
inspectJSON(actorId)   // Return plan as JSON object

// JSON structure:
{
  tasks: Array<{id, cost, boundParams}>,
  goal: Object,
  failures: Array<{goalId, failures: Array<{reason, timestamp}>}>
}
```

### StateDiffViewer API

```javascript
// Compute differences
diff(beforeState, afterState)  // Returns {added, modified, removed}

// Visualize
visualize(diff, options)       // Format diff as text
// Options: { taskName, stepNumber }

// JSON output
diffJSON(beforeState, afterState, options)  // Returns diff with summary
// JSON structure:
{
  changes: {
    added: Array<{path, value}>,
    modified: Array<{path, before, after}>,
    removed: Array<{path, value}>
  },
  summary: { addedCount, modifiedCount, removedCount }
}
```

### HeuristicRegistry API

```javascript
// Calculate distance to goal
calculate(heuristicName, state, goal);
// heuristicName: 'goal-distance' | 'rpg' | 'zero'
// Returns: number (estimated distance)

// Get heuristic instance
get(heuristicName);
// Returns: heuristic object with calculate() method
```

### PlanningEffectsSimulator API

```javascript
// Simulate task effects
simulateEffects(state, effects, context);
// state: Current planning node state
// effects: Array of planning_effects operations
// context: { actor: { id: actorId } }
// Returns: New state after effects applied
```

## References

- **GOAP Debugging Tools**: [`docs/goap/debugging-tools.md`](./debugging-tools.md) - General debug tool reference
- **Multi-Action Planning**: [`docs/goap/multi-action-planning.md`](./multi-action-planning.md) - Concepts and usage guide
- **GOAP System Specs**: [`specs/goap-system-specs.md`](../../specs/goap-system-specs.md) - Complete architecture
- **Task Loading**: [`docs/goap/task-loading.md`](./task-loading.md) - How tasks are loaded and structured
