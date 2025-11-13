# GOAPIMPL-018: GOAP A* Algorithm

**Priority**: CRITICAL
**Estimated Effort**: 4-5 hours
**Dependencies**: GOAPIMPL-015, GOAPIMPL-016, GOAPIMPL-017

## Description

Create GOAP planner using A* search algorithm. Searches state space to find sequence of tasks that achieves goal. Handles parametrized tasks, precondition evaluation, and plan construction.

This is the core GOAP planning algorithm - the "brain" that figures out which tasks to execute to achieve a goal.

## Acceptance Criteria

- [ ] A* search with open list (priority queue) and closed list
- [ ] Goal satisfaction checking (all goal conditions met)
- [ ] Task precondition evaluation for applicable tasks
- [ ] Planning scope query for task parameter binding
- [ ] State transition with planning effects simulation
- [ ] Plan path reconstruction from goal node
- [ ] Configurable search limits (max nodes, timeout)
- [ ] Handles unsolvable goals gracefully (returns null)
- [ ] Logs search progress for debugging
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/planner/goapPlanner.js` - Main A* planning algorithm
- `src/goap/planner/planConstructor.js` - Plan reconstruction from search path

### Tests
- `tests/unit/goap/planner/goapPlanner.test.js` - Unit tests
- `tests/integration/goap/planning.integration.test.js` - Integration tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add planner tokens
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register planner

## Testing Requirements

### Unit Tests
- [ ] Test simple goal achievement (single task)
- [ ] Test multi-task plans
- [ ] Test parametrized task planning
- [ ] Test unsolvable goal handling (returns null)
- [ ] Test search limits enforcement
- [ ] Test plan reconstruction
- [ ] Test goal satisfaction checking
- [ ] Test precondition evaluation

### Integration Tests
- [ ] Test planning with real tasks from examples
- [ ] Test planning with complex goals
- [ ] Test planning with knowledge-limited scopes
- [ ] Test planning performance with various heuristics
- [ ] Test plan correctness (simulated execution satisfies goal)

## A* Planning Algorithm

### High-Level Process
```javascript
plan(actor, goal, initialState) {
  // 1. Initialize search
  const openList = new PriorityQueue();  // Min-heap on f-score
  const closedList = new Set();

  const startNode = new PlanningNode({
    state: initialState,
    gScore: 0,
    hScore: calculateHeuristic(initialState, goal),
    parent: null,
    task: null
  });

  openList.push(startNode);

  // 2. A* search loop
  while (!openList.isEmpty()) {
    const current = openList.pop();

    // 3. Check goal satisfaction
    if (goalSatisfied(current.state, goal)) {
      return current.getPath();  // SUCCESS
    }

    // 4. Mark as explored
    closedList.add(current.state);

    // 5. Generate successors
    const applicableTasks = getApplicableTasks(
      current.state,
      actor,
      taskLibrary
    );

    for (const task of applicableTasks) {
      // 6. Bind task parameters
      const boundParameters = bindTaskParameters(
        task,
        current.state,
        actor
      );

      // 7. Simulate effects
      const newState = simulateEffects(
        current.state,
        task.planningEffects,
        boundParameters
      );

      // 8. Skip if already explored
      if (closedList.has(newState)) continue;

      // 9. Calculate scores
      const newGScore = current.gScore + task.cost;
      const newHScore = calculateHeuristic(newState, goal);

      // 10. Create successor node
      const successor = new PlanningNode({
        state: newState,
        gScore: newGScore,
        hScore: newHScore,
        parent: current,
        task: task,
        taskParameters: boundParameters
      });

      // 11. Add to open list
      openList.push(successor);
    }

    // 12. Check search limits
    if (closedList.size > MAX_NODES) {
      return null;  // FAIL - too many nodes
    }
  }

  // 13. Goal unreachable
  return null;  // FAIL - no solution
}
```

### Goal Satisfaction Check
```javascript
goalSatisfied(state, goal) {
  for (const condition of goal.conditions) {
    if (!evaluateCondition(condition, state)) {
      return false;
    }
  }
  return true;
}
```

### Applicable Tasks Filter
```javascript
getApplicableTasks(state, actor, taskLibrary) {
  return taskLibrary.filter(task => {
    // Check preconditions with current state
    return task.preconditions.every(condition =>
      evaluateCondition(condition, state)
    );
  });
}
```

### Parameter Binding
```javascript
bindTaskParameters(task, state, actor) {
  const boundParams = {};

  for (const [paramName, scopeExpr] of task.parameterScopes) {
    // Evaluate scope expression to find entities
    const candidates = evaluateScope(scopeExpr, state, actor);

    if (candidates.length > 0) {
      // Use first candidate (planning is optimistic)
      boundParams[paramName] = candidates[0];
    } else {
      // Cannot bind parameter - task not applicable
      return null;
    }
  }

  return boundParams;
}
```

## Plan Structure

### Returned Plan
```javascript
[
  {
    taskId: "core:gather_resources",
    parameters: {
      resourceType: "wood",
      location: "entity-forest-1"
    }
  },
  {
    taskId: "core:build_shelter",
    parameters: {
      location: "entity-camp-1",
      materials: "entity-wood-pile"
    }
  }
]
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 296-310 - **PRIMARY REFERENCE** - State space search
- `specs/goap-system-specs.md` lines 411-435 - Core GOAP description

### Implementation References
- A* algorithm (Wikipedia, textbooks)
- GOAP papers (Jeff Orkin, MIT)
- STRIPS planning systems

### Schema References
- `data/schemas/task.schema.json` - Task structure (preconditions, effects, cost)
- `data/schemas/goal.schema.json` - Goal structure

## Implementation Notes

### Priority Queue (Open List)
Use min-heap ordered by f-score (g + h):
- Lower f-score = higher priority
- Ensures optimal path is found first

Libraries:
- JavaScript: `heap-js` or custom implementation
- Native: Array with sort (slower but simpler)

### State Deduplication (Closed List)
Use Set or Map with state hash:
```javascript
const stateHash = JSON.stringify(sortedState);
closedList.add(stateHash);
```

Prevents re-exploring identical states.

### Search Limits
```javascript
const limits = {
  maxNodes: 1000,     // Max nodes explored
  maxTime: 5000,      // Max time in ms
  maxDepth: 20        // Max plan length
};
```

Prevents runaway search in large/infinite spaces.

### Task Cost
Use task cost as edge weight:
```javascript
newGScore = current.gScore + task.cost;
```

Default cost: 1.0 per task
Custom costs for expensive/preferred tasks

### Parameter Binding Strategies
1. **Optimistic**: Use first candidate (fast, may fail)
2. **Complete**: Try all combinations (slow, thorough)
3. **Heuristic**: Order candidates by desirability

Start with optimistic for MVP.

### Optimizations
- **Early goal check**: Check goal before expansion
- **Heuristic caching**: Cache h-scores per state
- **Lazy parameter binding**: Bind only when needed
- **Parallel expansion**: Explore successors in parallel (advanced)

### Logging
Log for debugging:
- Nodes expanded
- Goal checks
- Applicable tasks
- Parameter bindings
- Search limits hit
- Final plan length

## Integration Points

### Required Services (inject)
- `IPlanningEffectsSimulator` (GOAPIMPL-016) - Simulate effects
- `IHeuristicRegistry` (GOAPIMPL-017) - Calculate heuristics
- `ITaskLibraryConstructor` (GOAPIMPL-019) - Get actor task library
- `IScopeDslEngine` - Evaluate parameter scopes
- `IJsonLogicService` - Evaluate preconditions/goals
- `ILogger` - Logging

### Used By (future)
- GOAPIMPL-021 (GOAP Controller) - Main planning entry point

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate planning with real tasks
- Simple goals solved correctly
- Complex goals solved optimally
- Unsolvable goals handled gracefully
- Search limits prevent runaway computation
- Plans reconstruct correctly from goal node
- Service integrates with DI container
- Documentation explains algorithm and configuration
