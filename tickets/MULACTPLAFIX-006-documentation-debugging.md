# MULACTPLAFIX-006: Documentation and Debugging Tools

**Status**: Ready for Implementation
**Priority**: MEDIUM
**Phase**: Phase 4 - Documentation
**Estimated Effort**: 6 hours
**Dependencies**: MULACTPLAFIX-001, MULACTPLAFIX-002, MULACTPLAFIX-003, MULACTPLAFIX-004, MULACTPLAFIX-005
**Blocks**: None

## Objective

Create comprehensive documentation for multi-action planning and enhance debugging tools to diagnose multi-action scenarios. Establish knowledge base for future developers and provide debugging workflows for production issues.

## Scope

This ticket covers **three documentation categories**:

1. **Technical Documentation** (2 new files, 2 updates)
2. **Debugging Workflows** (1 comprehensive guide)
3. **API Documentation** (JSDoc enhancements)

## Documentation Deliverables

### 1. Multi-Action Planning Guide

**File**: `docs/goap/multi-action-planning.md` (NEW)

**Content Outline**:

```markdown
# Multi-Action Planning Guide

## Overview
- What is multi-action planning?
- When is it needed?
- How does it work?

## Core Concepts

### Task Reusability
- Distance reduction check
- Reuse limits (maxReuse)
- Structural gates vs reusability

### Heuristic Enhancement
- Action count estimation
- Admissibility proof
- Performance benefits

### Stopping Criteria
- Cost limits (maxCost)
- Action count limits (maxActions)
- Impossibility detection

## Usage Examples

### Example 1: Resource Accumulation
```javascript
// Scenario: Gather 100 gold with mine task (+25 gold)
const goal = {
  id: 'gather_gold',
  goalState: { '>=': [{ var: 'state.actor.components.core_resources.gold' }, 100] },
  maxCost: 50,        // Reasonable cost limit
  maxActions: 10      // Prevent excessive plans
};

// Expected plan: 4 mine actions (0 → 25 → 50 → 75 → 100)
```

### Example 2: Stat Management
```javascript
// Scenario: Reduce hunger from 100 to ≤ 10
const goal = {
  id: 'reduce_hunger',
  goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] }
};

// Task: eat (-60 hunger, cost 5)
// Expected plan: 2 eat actions (100 → 40 → -20/clamped to 0)
```

### Example 3: Multi-Field Goals
```javascript
// Scenario: Hunger ≤ 10 AND Health ≥ 80
const goal = {
  goalState: {
    and: [
      { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] },
      { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] }
    ]
  }
};

// Expected: Mixed plan with eat + heal actions
```

## Configuration Options

### Task Configuration
```javascript
{
  id: 'test:eat',
  cost: 5,
  maxReuse: 10,      // Optional: limit task reuse (default: 10)
  planningEffects: [/* ... */]
}
```

### Goal Configuration
```javascript
{
  id: 'test:goal',
  goalState: { /* JSON Logic */ },
  maxCost: 50,       // Optional: max plan cost (default: Infinity)
  maxActions: 20,    // Optional: max plan length (default: 20)
  allowOvershoot: true  // Optional: for inequality goals
}
```

## Edge Cases

### Overshoot Scenarios
- Inequality goals (≤, ≥): Overshoot allowed
- Equality goals (=): Overshoot NOT allowed
- Automatic detection via goal type analysis

### Impossible Goals
- Wrong direction tasks: Detected via distance check
- Insufficient effect: Caught by cost limit
- No applicable tasks: Planning fails gracefully

### Performance Considerations
- Large action counts (20+ actions): Use performance profiling
- Complex goals: Monitor node expansion
- Heuristic accuracy: Verify admissibility

## Troubleshooting

### Common Issues

**Issue 1**: Planning fails for multi-action scenario
**Solution**:
1. Check task reduces distance: `distance(after) < distance(before)`
2. Verify reuse limit not exceeded: `taskUsageCount < task.maxReuse`
3. Check cost/action limits: `estimatedCost < goal.maxCost`

**Issue 2**: Plan has too many actions
**Solution**:
1. Lower `goal.maxActions` limit
2. Increase task effect magnitude
3. Use more effective tasks

**Issue 3**: Wrong tasks selected
**Solution**:
1. Verify structural gates (preconditions)
2. Check task costs (prefer cheaper)
3. Review heuristic accuracy

## Performance Tuning

### Optimize Planning Speed
- Use enhanced heuristic (MULACTPLAFIX-002)
- Set reasonable cost/action limits
- Profile with debugging tools

### Reduce Memory Usage
- Limit max plan length
- Clean up closed states periodically
- Use efficient state hashing

## References
- GOAP System Specs: `specs/goap-system-specs.md`
- Debugging Tools: `docs/goap/debugging-tools.md`
- Numeric Constraints: `docs/goap/numeric-constraints.md`
```

### 2. Debugging Workflows Guide

**File**: `docs/goap/debugging-multi-action.md` (NEW)

**Content Outline**:

```markdown
# Debugging Multi-Action Planning

## Quick Diagnostics

### Step 1: Enable Debug Logging
```javascript
const planner = new GoapPlanner({
  logger: createLogger({ level: 'debug' })  // Enable debug logs
});
```

### Step 2: Check Planning Events
```javascript
const events = eventBus.getAll();

// Look for PLANNING_FAILED events
const failures = events.filter(e => e.type === GOAP_EVENTS.PLANNING_FAILED);

// Analyze failure reasons
failures.forEach(f => {
  console.log('Failure Reason:', f.payload.reason);
  console.log('Details:', f.payload.details);
});
```

### Step 3: Inspect Plan Structure
```javascript
const planCreated = events.find(e => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

if (planCreated) {
  console.log('Action Count:', planCreated.payload.plan.actions.length);
  console.log('Total Cost:', planCreated.payload.plan.totalCost);
  console.log('Actions:', planCreated.payload.plan.actions.map(a => a.id));
}
```

## Using GOAP Debugger (Advanced)

### Setup Debugger
```javascript
import { GOAPDebugger } from './goap/debugging/goapDebugger.js';
import { PlanInspector } from './goap/debugging/planInspector.js';
import { StateDiffViewer } from './goap/debugging/stateDiffViewer.js';

const goapDebugger = new GOAPDebugger({
  goapController: controller,
  planInspector: new PlanInspector(),
  stateDiffViewer: new StateDiffViewer(),
  logger
});

goapDebugger.startTrace(actorId);
```

### Capture Planning Trace
```javascript
try {
  await controller.decideTurn(actor, world);
} catch (err) {
  // Generate comprehensive report
  const report = goapDebugger.generateReport(actorId);

  console.log('Planning Trace:');
  console.log('- Nodes Expanded:', report.nodesExpanded);
  console.log('- Tasks Considered:', report.tasksConsidered);
  console.log('- Failure Reason:', report.failureReason);
}
```

### Analyze State Progression
```javascript
// View state changes at each step
const stateDiff = stateDiffViewer.visualize(beforeState, afterState);

console.log('State Changes:');
console.log('- Added:', stateDiff.added);
console.log('- Modified:', stateDiff.modified);
console.log('- Removed:', stateDiff.removed);
```

## Common Debugging Scenarios

### Scenario 1: Planning Fails (No Plan Found)

**Symptoms**: `PLANNING_FAILED` event with reason `search_exhausted`

**Debugging Steps**:
1. Check initial state vs goal
2. Verify tasks exist that modify relevant fields
3. Check structural gates (preconditions)
4. Verify tasks reduce distance

**Example**:
```javascript
// Check distance to goal
const initialDistance = heuristicRegistry.calculate(
  'goal-distance',
  initialState,
  goal
);

console.log('Initial Distance:', initialDistance);

// Simulate task application
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

console.log('Distance After Task:', newDistance);
console.log('Reduces Distance:', newDistance < initialDistance);
```

### Scenario 2: Wrong Number of Actions

**Symptoms**: Plan has fewer/more actions than expected

**Debugging Steps**:
1. Calculate expected action count manually
2. Check task effect magnitude
3. Verify reuse limits
4. Check for clamping/overflow

**Example**:
```javascript
// Manual calculation
const distance = initialValue - targetValue;
const taskEffect = 60;  // From task definition
const expectedActions = Math.ceil(distance / taskEffect);

console.log('Expected Actions:', expectedActions);
console.log('Actual Actions:', plan.actions.length);

// Check reuse limits
const taskReuses = plan.actions.filter(a => a.id === 'test:eat').length;
const maxReuse = task.maxReuse || 10;

console.log('Task Reuses:', taskReuses, '/', maxReuse);
```

### Scenario 3: Cost/Action Limit Exceeded

**Symptoms**: `PLANNING_FAILED` with reason `cost_limit_exceeded` or `action_limit_exceeded`

**Debugging Steps**:
1. Check estimated cost vs limit
2. Verify task costs
3. Consider increasing limits or using more effective tasks

**Example**:
```javascript
const estimatedCost = heuristicRegistry.calculate(
  'goal-distance',
  initialState,
  goal,
  { availableTasks: taskLibrary }
);

const maxCost = goal.maxCost || Infinity;

console.log('Estimated Cost:', estimatedCost);
console.log('Max Cost:', maxCost);
console.log('Within Limit:', estimatedCost <= maxCost);
```

## Performance Profiling

### Measure Planning Time
```javascript
const startTime = performance.now();
const plan = await planner.plan(actorId, goal, tasks, initialState);
const endTime = performance.now();

console.log('Planning Time:', endTime - startTime, 'ms');
```

### Track Node Expansion
```javascript
// Add custom metric tracking
let nodesExpanded = 0;

// In planner (for debugging)
while (open.length > 0) {
  nodesExpanded++;
  // ... search logic
}

console.log('Nodes Expanded:', nodesExpanded);
```

### Memory Usage
```javascript
const initialMemory = process.memoryUsage().heapUsed;

await planner.plan(actorId, goal, tasks, initialState);

const finalMemory = process.memoryUsage().heapUsed;
const delta = (finalMemory - initialMemory) / 1024 / 1024;

console.log('Memory Delta:', delta.toFixed(2), 'MB');
```

## Troubleshooting Checklist

- [ ] Verify initial state has fields referenced in goal
- [ ] Check tasks modify the correct fields
- [ ] Verify structural gates evaluate correctly
- [ ] Confirm tasks reduce distance to goal
- [ ] Check reuse limits (maxReuse)
- [ ] Verify cost/action limits (maxCost, maxActions)
- [ ] Test with debug logging enabled
- [ ] Profile planning time and memory usage
- [ ] Compare actual vs expected plan structure

## Tools Reference

### GOAPDebugger API
- `startTrace(actorId)`: Begin tracing planning for actor
- `stopTrace(actorId)`: Stop tracing
- `generateReport(actorId)`: Generate comprehensive report
- `getFailureHistory(actorId)`: Get all planning failures
- `inspectPlanJSON(actorId)`: Get plan structure as JSON

### PlanInspector API
- `inspect(actorId)`: Analyze plan structure
- `getActionTypes()`: Count actions by type
- `validatePlan(plan, goal)`: Verify plan satisfies goal

### StateDiffViewer API
- `visualize(beforeState, afterState)`: Show state differences
- `formatDiff(diff)`: Format diff for display

## References
- GOAP Debugging Tools: `docs/goap/debugging-tools.md`
- Multi-Action Planning: `docs/goap/multi-action-planning.md`
```

### 3. Update Existing Documentation

#### 3.1 Update: `docs/goap/debugging-tools.md`

Add new section:

```markdown
## Debugging Multi-Action Scenarios

See dedicated guide: [Debugging Multi-Action Planning](./debugging-multi-action.md)

### Quick Reference

**Common Issues**:
- Planning fails: Check task applicability and distance reduction
- Too many/few actions: Verify task effect magnitude and reuse limits
- Cost exceeded: Review estimated cost vs limits

**Key Debugging Commands**:
```javascript
// Enable debug logging
logger.setLevel('debug');

// Check distance reduction
const reduces = heuristicRegistry.calculate(...);

// Inspect plan structure
const plan = planInspector.inspect(actorId);
```

**See Full Guide**: [Debugging Multi-Action Planning](./debugging-multi-action.md)
```

#### 3.2 Update: `docs/goap/README.md`

Add links to new documentation:

```markdown
## GOAP Documentation

### Core Concepts
- [GOAP System Overview](./goap-system-overview.md)
- [Planning Algorithm](./planning-algorithm.md)
- **[Multi-Action Planning](./multi-action-planning.md)** ← NEW

### Development
- [Debugging Tools](./debugging-tools.md)
- **[Debugging Multi-Action Scenarios](./debugging-multi-action.md)** ← NEW
- [Testing Guide](./testing-guide.md)

### Advanced Topics
- [Numeric Constraints](./numeric-constraints.md)
- [Heuristic Functions](./heuristic-functions.md)
- [Performance Optimization](./performance-optimization.md)
```

### 4. JSDoc Enhancements

Update JSDoc comments in modified files:

**`src/goap/planner/goapPlanner.js`**:

```javascript
/**
 * GOAP Planner - A* search-based goal-oriented action planning.
 *
 * Features:
 * - Multi-action planning with task reuse
 * - Numeric goal support with distance heuristics
 * - Configurable cost and action limits
 * - Comprehensive debugging support
 *
 * @see docs/goap/multi-action-planning.md for usage guide
 * @see docs/goap/debugging-multi-action.md for troubleshooting
 */
class GoapPlanner {
  // ... existing code
}
```

**`src/goap/planner/goalDistanceHeuristic.js`**:

```javascript
/**
 * Enhanced heuristic for multi-action planning.
 *
 * Estimates number of actions needed to reach goal, not just distance.
 * Maintains A* admissibility while improving search guidance.
 *
 * @see docs/goap/multi-action-planning.md#heuristic-enhancement
 */
```

## Testing Requirements

### Documentation Validation

**Manual Review**:
- [ ] All code examples compile without errors
- [ ] All file paths resolve correctly
- [ ] All cross-references link correctly
- [ ] Markdown formatting valid (no broken tables, lists)
- [ ] Examples match actual API signatures

**Automated Checks** (optional):
```bash
# Markdown linting
npx markdownlint docs/goap/

# Link checking
npx markdown-link-check docs/goap/**/*.md
```

### Code Example Testing

Extract code examples and verify they work:

```javascript
// docs/goap/examples/multi-action-examples.test.js
describe('Documentation Examples', () => {
  it('should execute Example 1: Resource Accumulation', async () => {
    // Copy code from docs
    // Verify it executes correctly
  });

  it('should execute Example 2: Stat Management', async () => {
    // Copy code from docs
  });

  it('should execute Example 3: Multi-Field Goals', async () => {
    // Copy code from docs
  });
});
```

## Acceptance Criteria

### Documentation Completeness

- [ ] `multi-action-planning.md` created with all sections
- [ ] `debugging-multi-action.md` created with comprehensive workflows
- [ ] `debugging-tools.md` updated with multi-action section
- [ ] `README.md` updated with new doc links
- [ ] All code examples tested and verified working

### Code Documentation

- [ ] JSDoc comments enhanced in modified files
- [ ] All public methods have complete JSDoc
- [ ] All configuration options documented
- [ ] Cross-references to documentation added

### Quality Standards

- [ ] Markdown passes linting (markdownlint)
- [ ] All links resolve correctly
- [ ] Code examples compile and run
- [ ] Screenshots/diagrams included where helpful
- [ ] Clear, concise writing style

## Related Files

**Creates**:
- `docs/goap/multi-action-planning.md` (NEW)
- `docs/goap/debugging-multi-action.md` (NEW)

**Updates**:
- `docs/goap/debugging-tools.md` (add section)
- `docs/goap/README.md` (add links)
- `src/goap/planner/goapPlanner.js` (JSDoc)
- `src/goap/planner/goalDistanceHeuristic.js` (JSDoc)

**Optional**:
- `docs/goap/examples/multi-action-examples.test.js` (executable examples)

## Notes

- **Documentation is critical for long-term maintainability**
- Focus on practical examples and troubleshooting workflows
- Include common pitfalls and solutions
- Link to related tickets for implementation details
- Consider adding diagrams for complex concepts (state machines, search trees)

## Success Metrics

1. **Completeness**: All multi-action planning concepts documented
2. **Clarity**: New developers can understand multi-action planning from docs
3. **Usability**: Debugging workflows reduce issue resolution time by 50%+
4. **Accuracy**: 100% of code examples execute correctly
5. **Discoverability**: Clear navigation from main GOAP docs to multi-action guides
