# GOAPIMPL-018: GOAP A* Algorithm (CORRECTED)

**Priority**: CRITICAL
**Estimated Effort**: 6-7 hours (updated from 4-5)
**Dependencies**: GOAPIMPL-015 ✅, GOAPIMPL-016 ✅, GOAPIMPL-017 ✅

## Description

Create GOAP planner using A* search algorithm. Searches state space to find sequence of tasks that achieves goal. Handles parametrized tasks, precondition evaluation, and plan construction.

This is the core GOAP planning algorithm - the "brain" that figures out which tasks to execute to achieve a goal.

**CORRECTED**: This ticket has been updated based on validation against actual codebase implementation and specifications. Key corrections:
- Removed non-existent ITaskLibraryConstructor dependency
- Fixed service names (IScopeEngine, JsonLogicEvaluationService)
- Added missing IEntityManager dependency
- Removed unnecessary planConstructor.js (functionality in PlanningNode)
- Enhanced algorithm with state hashing and duplicate detection
- Corrected parameter binding approach
- Fixed test file naming pattern

## Acceptance Criteria

- [ ] A* search with open list (priority queue) and closed list (state hash set)
- [ ] Goal satisfaction checking (all goal conditions met)
- [ ] Task precondition evaluation for applicable tasks
- [ ] Planning scope evaluation for task parameter binding
- [ ] State transition with planning effects simulation
- [ ] Plan path reconstruction from goal node (via PlanningNode.getPath())
- [ ] Configurable search limits (max nodes, max time, max depth)
- [ ] Handles unsolvable goals gracefully (returns null)
- [ ] State deduplication with proper hashing
- [ ] Open list duplicate detection (better path replaces worse)
- [ ] Parameter binding failure handling
- [ ] Logs search progress for debugging
- [ ] 90%+ test coverage (functions/lines), 80%+ branch coverage

## Files to Create

### Main Implementation
- `src/goap/planner/goapPlanner.js` - Main A* planning algorithm

### Tests
- `tests/unit/goap/planner/goapPlanner.test.js` - Unit tests
- `tests/integration/goap/aStarPlanning.integration.test.js` - Integration tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add IGoapPlanner token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register planner

## Testing Requirements

### Unit Tests
- [ ] Test simple goal achievement (single task)
- [ ] Test multi-task plans
- [ ] Test parametrized task planning with scope evaluation
- [ ] Test unsolvable goal handling (returns null)
- [ ] Test search limits enforcement (nodes, time, depth)
- [ ] Test plan reconstruction via PlanningNode.getPath()
- [ ] Test goal satisfaction checking
- [ ] Test precondition evaluation
- [ ] Test state deduplication (hash-based closed set)
- [ ] Test open list duplicate handling
- [ ] Test parameter binding failures
- [ ] Test empty task library (no applicable tasks)
- [ ] Test heuristic calculation errors (fallback to Infinity)

### Integration Tests
- [ ] Test planning with real tasks from core mod
- [ ] Test planning with complex goals
- [ ] Test planning with knowledge-limited scopes
- [ ] Test planning performance with various heuristics
- [ ] Test plan correctness (simulated execution satisfies goal)
- [ ] Test parameter binding with real scope definitions
- [ ] Test world state access via EntityManager

## A* Planning Algorithm

### High-Level Process
```javascript
plan(actorId, goal, initialState, options = {}) {
  // 1. Initialize search
  const openList = new PriorityQueue();  // Min-heap on f-score
  const closedSet = new Set();           // State hashes (not objects!)
  const heuristicName = options.heuristic || 'goal-distance';

  const startNode = new PlanningNode({
    state: initialState,
    gScore: 0,
    hScore: this.#heuristicRegistry.calculate(
      heuristicName,
      initialState,
      goal,
      taskLibrary
    ),
    parent: null,
    task: null,
    taskParameters: null
  });

  openList.push(startNode);

  // Search limits
  const limits = {
    maxNodes: options.maxNodes || 1000,
    maxTime: options.maxTime || 5000,
    maxDepth: options.maxDepth || 20
  };
  const startTime = Date.now();
  let nodesExplored = 0;

  // 2. A* search loop
  while (!openList.isEmpty()) {
    const current = openList.pop();

    // 3. Check goal satisfaction
    if (this.#goalSatisfied(current.state, goal)) {
      this.#logger.info(`Plan found after ${nodesExplored} nodes`, {
        planLength: current.getPath().length,
        cost: current.gScore
      });
      return current.getPath();  // SUCCESS via PlanningNode.getPath()
    }

    // 4. State deduplication
    const stateHash = this.#hashState(current.state);
    if (closedSet.has(stateHash)) {
      continue; // Already explored this state
    }
    closedSet.add(stateHash);
    nodesExplored++;

    // 5. Check search limits
    if (nodesExplored > limits.maxNodes) {
      this.#logger.warn(`Search limit: max nodes ${limits.maxNodes}`);
      return null;  // FAIL - too many nodes
    }
    if (Date.now() - startTime > limits.maxTime) {
      this.#logger.warn(`Search limit: timeout ${limits.maxTime}ms`);
      return null;  // FAIL - timeout
    }
    if (current.gScore > limits.maxDepth) {
      this.#logger.debug(`Depth limit: ${limits.maxDepth}`);
      continue; // Skip too-deep paths
    }

    // 6. Get task library for actor
    const taskLibrary = this.#getTaskLibrary(actorId);

    // 7. Generate successors
    const applicableTasks = this.#getApplicableTasks(
      current.state,
      actorId,
      taskLibrary
    );

    for (const task of applicableTasks) {
      // 8. Bind task parameters via scope evaluation
      const boundParameters = this.#bindTaskParameters(
        task,
        current.state,
        actorId
      );

      // 9. Handle binding failures
      if (!boundParameters) {
        this.#logger.debug(`Cannot bind parameters for task ${task.id}`);
        continue; // Skip this task
      }

      // 10. Simulate effects
      const simulationResult = this.#planningEffectsSimulator.simulateEffects(
        current.state,
        task.planningEffects,
        {
          actor: actorId,
          task: { id: task.id, params: boundParameters }
        }
      );

      if (!simulationResult.success) {
        this.#logger.debug(`Failed to simulate effects for ${task.id}`);
        continue; // Skip on simulation failure
      }

      const newState = simulationResult.state;

      // 11. Skip if already explored
      const newStateHash = this.#hashState(newState);
      if (closedSet.has(newStateHash)) {
        continue;
      }

      // 12. Calculate scores
      const newGScore = current.gScore + (task.cost || 10);
      const newHScore = this.#heuristicRegistry.calculate(
        heuristicName,
        newState,
        goal,
        taskLibrary
      );

      // 13. Create successor node
      const successor = new PlanningNode({
        state: newState,
        gScore: newGScore,
        hScore: newHScore,
        parent: current,
        task: task,
        taskParameters: boundParameters
      });

      // 14. Check for duplicates in open list
      const existingIdx = openList.findIndex(node =>
        this.#hashState(node.state) === newStateHash
      );

      if (existingIdx !== -1) {
        // State already in open list
        const existing = openList.get(existingIdx);
        if (existing.gScore <= successor.gScore) {
          continue; // Existing path is better
        }
        // Replace with better path
        openList.remove(existingIdx);
      }

      // 15. Add to open list
      openList.push(successor);
    }
  }

  // 16. Goal unreachable
  this.#logger.warn('Goal unreachable - no solution found', {
    nodesExplored,
    goal
  });
  return null;  // FAIL - no solution
}
```

### State Hashing (Critical for Deduplication)
```javascript
#hashState(state) {
  // Sort keys for consistent hashing
  const sortedKeys = Object.keys(state).sort();
  const sortedState = {};
  for (const key of sortedKeys) {
    sortedState[key] = state[key];
  }
  return JSON.stringify(sortedState);
}
```

### Goal Satisfaction Check
```javascript
#goalSatisfied(state, goal) {
  // goal.goalState is a JSON Logic condition
  const context = this.#buildEvaluationContext(state);

  try {
    return this.#jsonLogicService.evaluateCondition(
      goal.goalState,
      context
    );
  } catch (err) {
    this.#logger.error('Goal evaluation error', err);
    return false; // Conservative: assume not satisfied
  }
}

#buildEvaluationContext(state) {
  // Convert state hash format to evaluation context
  // state: { "entity-123:core:hungry": true, "entity-123:core:health": 50 }
  // context: { actor: { core: { hungry: true, health: 50 } }, ... }

  // Implementation will parse state keys and reconstruct entity structure
  // This requires access to EntityManager to get full entity data
  // Placeholder for now - detailed implementation in actual code
  return { /* structured context */ };
}
```

### Applicable Tasks Filter
```javascript
#getApplicableTasks(state, actorId, taskLibrary) {
  const context = this.#buildEvaluationContext(state);

  return taskLibrary.filter(task => {
    // Check structural gates (if present)
    if (task.structuralGates) {
      try {
        const gatesPassed = this.#jsonLogicService.evaluateCondition(
          task.structuralGates.condition,
          context
        );
        if (!gatesPassed) {
          return false;
        }
      } catch (err) {
        this.#logger.debug(`Structural gates failed for ${task.id}`, err);
        return false;
      }
    }

    // Check planning preconditions
    if (task.planningPreconditions && task.planningPreconditions.length > 0) {
      return task.planningPreconditions.every(precond => {
        try {
          return this.#jsonLogicService.evaluateCondition(
            precond.condition,
            context
          );
        } catch (err) {
          this.#logger.debug(`Precondition failed for ${task.id}`, err);
          return false;
        }
      });
    }

    return true; // No preconditions means always applicable
  });
}
```

### Parameter Binding (CORRECTED)
```javascript
#bindTaskParameters(task, state, actorId) {
  // Get planning scope definition
  const scopeId = task.planningScope;
  const scopeDefinition = this.#gameDataRepository.getScope(scopeId);

  if (!scopeDefinition) {
    this.#logger.error(`Planning scope not found: ${scopeId}`);
    return null;
  }

  // Build scope evaluation context
  const scopeContext = {
    actor: actorId,
    // Add other context as needed for scope evaluation
  };

  // Evaluate scope to get candidate entities
  try {
    const scopeResult = this.#scopeEngine.evaluate(
      scopeDefinition,
      scopeContext
    );

    // Extract parameters from scope output variables
    const boundParameters = {};

    // Scope returns { variables: { item: [entity1, entity2], location: [loc1] } }
    for (const [varName, entities] of Object.entries(scopeResult.variables || {})) {
      if (entities && entities.length > 0) {
        // Optimistic binding: use first candidate
        boundParameters[varName] = entities[0];
      } else {
        // Cannot bind this parameter
        this.#logger.debug(`No entities for parameter ${varName} in scope ${scopeId}`);
        return null;
      }
    }

    return boundParameters;

  } catch (err) {
    this.#logger.error(`Scope evaluation failed for ${scopeId}`, err);
    return null;
  }
}
```

### Task Library Construction
```javascript
#getTaskLibrary(actorId) {
  // Get all tasks from GameDataRepository
  const allTasks = this.#gameDataRepository.getAllTasks();

  // Filter by structural gates
  const actor = this.#entityManager.getEntity(actorId);
  const context = { actor };

  return allTasks.filter(task => {
    if (!task.structuralGates) {
      return true; // No gates means always relevant
    }

    try {
      return this.#jsonLogicService.evaluateCondition(
        task.structuralGates.condition,
        context
      );
    } catch (err) {
      this.#logger.debug(`Structural gates failed for ${task.id}`, err);
      return false;
    }
  });
}
```

## Plan Structure

### Returned Plan
```javascript
[
  {
    taskId: "core:gather_resources",
    parameters: {
      resourceType: "entity-wood-1",  // Bound entity ID
      location: "entity-forest-1"
    }
  },
  {
    taskId: "core:build_shelter",
    parameters: {
      location: "entity-camp-1",
      materials: "entity-wood-pile-1"
    }
  }
]
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 296-310 - **PRIMARY REFERENCE** - State space search
- `specs/goap-system-specs.md` lines 411-435 - Core GOAP description
- `specs/goap-system-specs.md` lines 139-161 - Knowledge-limited planning

### Implementation References
- A* algorithm (Wikipedia, AI textbooks)
- GOAP papers (Jeff Orkin, MIT)
- STRIPS planning systems
- `src/goap/planner/planningNode.js` - Node structure and path reconstruction

### Schema References
- `data/schemas/task.schema.json` - Task structure (preconditions, effects, cost, planningScope)
- `data/schemas/goal.schema.json` - Goal structure (relevance, goalState, priority)
- `data/schemas/refinement-method.schema.json` - Refinement methods (not used by planner)

## Implementation Notes

### Priority Queue (Open List)
Use min-heap ordered by f-score (g + h):
- Lower f-score = higher priority
- Ensures optimal path is found first

**Implementation Options**:
1. Check `package.json` for existing heap library
2. If none exists, implement simple binary heap (~80-100 lines):
   ```javascript
   class MinHeap {
     constructor(compareFn) { /* ... */ }
     push(item) { /* ... */ }
     pop() { /* ... */ }
     findIndex(predicate) { /* ... */ }
     remove(index) { /* ... */ }
     get(index) { /* ... */ }
     isEmpty() { /* ... */ }
   }
   ```
3. Comparator: `(a, b) => a.fScore - b.fScore`

**Rationale**: Avoid external dependency if possible; simple heap implementation is well-understood and maintainable.

### State Deduplication (Closed Set)
Use Set with state hash (sorted JSON string):
```javascript
const stateHash = JSON.stringify(sortKeys(state));
closedSet.add(stateHash);
```

**Prevents re-exploring identical states**, critical for algorithm termination.

**Performance**: O(1) lookup after O(n log n) key sorting (acceptable for planning state sizes).

### Open List Duplicate Detection
Check if state already in open list before adding:
```javascript
const existingIdx = openList.findIndex(node =>
  hashState(node.state) === newStateHash
);
if (existingIdx !== -1 && openList.get(existingIdx).gScore <= newGScore) {
  continue; // Existing path is better
}
```

**Ensures optimal paths** by replacing worse paths with better ones.

### Search Limits
```javascript
const limits = {
  maxNodes: 1000,     // Max nodes explored
  maxTime: 5000,      // Max time in ms
  maxDepth: 20        // Max plan length (g-score)
};
```

**Prevents runaway search** in large/infinite spaces. Limits should be configurable via options parameter.

### Task Cost
Use task cost as edge weight:
```javascript
newGScore = current.gScore + (task.cost || 10);
```

**Default cost**: 10 per task (from task.schema.json default)
**Custom costs**: Tasks can specify 1-100 for expensive/preferred tasks

### Parameter Binding Strategies
1. **Optimistic**: Use first candidate from scope (fast, may fail at execution)
2. **Complete**: Try all combinations (slow, thorough) - future enhancement
3. **Heuristic**: Order candidates by desirability (e.g., nearest, cheapest) - future enhancement

**Start with optimistic** for MVP (matches ticket scope).

### Knowledge-Limited State Representation
State includes knowledge facts:
```javascript
{
  "entity-123:core:known_to": ["actor-456", "actor-789"],
  "entity-123:core:visible": true,
  "entity-456:core:hungry": true,
  "entity-456:core:health": 50
}
```

**Scope evaluation MUST filter** by `core:known_to` component to prevent omniscience.

### Error Handling
Use GOAP error hierarchy:
```javascript
import PlanningError from '../errors/planningError.js';

// Usage
throw new PlanningError(
  'Search limit exceeded: explored 1000 nodes',
  { maxNodes: 1000, goal, actorId }
);
```

**Log, don't throw** for recoverable errors (parameter binding failure, scope evaluation error).

### Logging
Log for debugging:
- Nodes expanded (every N nodes or at debug level)
- Goal checks (when satisfied or failed)
- Applicable tasks (count per expansion)
- Parameter bindings (successful and failed)
- Search limits hit (always log)
- Final plan length and cost (always log)
- State hashes (debug level only)

### Optimizations (Future Enhancements)
- **Early goal check**: ✓ Already in algorithm (line 3)
- **Heuristic caching**: Cache h-scores per state hash
- **Lazy parameter binding**: Bind only when creating successor
- **Parallel expansion**: Explore successors in parallel (advanced)
- **Incremental goal checking**: Check only changed facts
- **Bidirectional search**: Meet in middle (complex, large speedup)

## Integration Points

### Required Services (inject via DI)

**CORRECTED - All service names verified against codebase**:

```javascript
constructor({
  planningEffectsSimulator,   // IPlanningEffectsSimulator (GOAPIMPL-016)
  heuristicRegistry,           // IHeuristicRegistry (GOAPIMPL-017)
  gameDataRepository,          // GameDataRepository - task library access
  scopeEngine,                 // IScopeEngine - scope evaluation
  jsonLogicService,            // JsonLogicEvaluationService - condition evaluation
  entityManager,               // IEntityManager - entity/component access
  logger                       // ILogger - logging
}) {
  // Validate all dependencies with validateDependency()
  // Store in private fields
}
```

**Service Interfaces**:
- `IPlanningEffectsSimulator`: `simulateEffects(state, effects, context)`
- `IHeuristicRegistry`: `calculate(name, state, goal, tasks)`
- `GameDataRepository`: `getAllTasks()`, `getScope(scopeId)`
- `IScopeEngine`: `evaluate(scopeDefinition, context)`
- `JsonLogicEvaluationService`: `evaluateCondition(condition, context)`
- `IEntityManager`: `getEntity(entityId)`, `hasEntity(entityId)`
- `ILogger`: `debug()`, `info()`, `warn()`, `error()`

### Used By (future tickets)
- GOAPIMPL-021 (GOAP Controller) - Main planning entry point
- GOAPIMPL-022 (GOAP Decision Provider) - Integration with turn system

## Dependency Injection Registration

### Token Definition
Add to `src/dependencyInjection/tokens/tokens-core.js` after line 347:

```javascript
// GOAP Planner (GOAPIMPL-018)
IGoapPlanner: 'IGoapPlanner',
```

### Service Registration
Add to `src/dependencyInjection/registrations/goapRegistrations.js` after HeuristicRegistry:

```javascript
// GOAP Planner (GOAPIMPL-018)
// A* search planner for goal-directed task sequence planning
// Evaluates tasks against world state and constructs optimal plans
container.register(tokens.IGoapPlanner, GoapPlanner, {
  dependencies: [
    tokens.IPlanningEffectsSimulator,
    tokens.IHeuristicRegistry,
    tokens.GameDataRepository,
    tokens.IScopeEngine,
    tokens.JsonLogicEvaluationService,
    tokens.IEntityManager,
    tokens.ILogger,
  ],
  lifecycle: 'singleton',
});
```

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage (functions/lines), 80%+ branches
- Integration tests validate planning with real tasks from core mod
- Simple goals solved correctly (verified against expected plans)
- Complex goals solved optimally (verified cost is minimal)
- Unsolvable goals handled gracefully (returns null, logs reason)
- Search limits prevent runaway computation (timeout and node limit tested)
- Plans reconstruct correctly from goal node via PlanningNode.getPath()
- State deduplication prevents revisiting states (closed set verified)
- Open list duplicate detection ensures optimal paths (test scenario included)
- Parameter binding failures handled gracefully (null checks, logging)
- Service integrates with DI container (registration successful, resolution works)
- Documentation explains algorithm, state format, and configuration
- All code follows project conventions (ESLint passes, formatting correct)
- Knowledge-limited state representation works (scope filtering by core:known_to)

## Implementation Checklist

### Phase 1: Core Structure (2 hours)
- [ ] Create GoapPlanner class with constructor and DI validation
- [ ] Implement state hashing helper
- [ ] Implement priority queue (heap) or import library
- [ ] Implement plan() method skeleton
- [ ] Add DI token and registration

### Phase 2: Algorithm Implementation (2 hours)
- [ ] Implement goal satisfaction check
- [ ] Implement applicable tasks filter
- [ ] Implement parameter binding via scope evaluation
- [ ] Implement A* search loop with state deduplication
- [ ] Implement open list duplicate detection
- [ ] Add search limit enforcement

### Phase 3: Integration (1 hour)
- [ ] Implement task library construction
- [ ] Implement evaluation context building
- [ ] Connect to PlanningEffectsSimulator
- [ ] Connect to HeuristicRegistry
- [ ] Add comprehensive logging

### Phase 4: Testing (1-2 hours)
- [ ] Write unit tests (13+ test cases)
- [ ] Write integration tests (7+ test cases)
- [ ] Verify coverage targets met
- [ ] Test with real tasks from core mod

### Phase 5: Documentation & Cleanup (30 min)
- [ ] Add JSDoc comments
- [ ] Document state format and hashing strategy
- [ ] Document parameter binding approach
- [ ] Run ESLint and fix issues
- [ ] Final review against specs

---

## Corrections Applied

This ticket was validated against the actual codebase on 2025-11-14. Key corrections:

1. **Removed non-existent dependency**: ITaskLibraryConstructor → GameDataRepository
2. **Fixed service names**: IScopeDslEngine → IScopeEngine, IJsonLogicService → JsonLogicEvaluationService
3. **Added missing dependency**: IEntityManager (required for entity access)
4. **Removed unnecessary file**: planConstructor.js (PlanningNode.getPath() handles this)
5. **Enhanced algorithm**: Added state hashing, duplicate detection, parameter binding failure handling
6. **Corrected scope evaluation**: Updated to use IScopeEngine with proper context
7. **Fixed test file name**: planning.integration.test.js → aStarPlanning.integration.test.js
8. **Added error handling**: PlanningError usage, graceful fallbacks
9. **Documented knowledge-limited planning**: State format includes core:known_to filtering

See `/home/joeloverbeck/projects/living-narrative-engine/reports/GOAPIMPL-018-validation-report.md` for full validation analysis.
