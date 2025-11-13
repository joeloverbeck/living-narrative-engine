# GOAPIMPL-015: Planning Node Structure

**Priority**: HIGH
**Estimated Effort**: 2-3 hours
**Dependencies**: GOAPIMPL-007 (Context Assembly)

## Description

Create PlanningNode data structure representing states in GOAP search space. Includes world state snapshot, accumulated cost, heuristic estimate, parent reference, and task that generated it.

Planning nodes are the fundamental building blocks of the A* search algorithm used by the GOAP planner.

## Acceptance Criteria

- [ ] Node stores world state as symbolic facts (key-value pairs)
- [ ] Node tracks accumulated cost (g-score) from start
- [ ] Node tracks heuristic estimate (h-score) to goal
- [ ] Node calculates f-score (g + h) for A* priority
- [ ] Node references parent node for plan reconstruction
- [ ] Node stores task that transitioned to this state
- [ ] Node supports state comparison for duplicate detection
- [ ] Nodes are immutable (functional programming style)
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/planner/planningNode.js` - Node data structure

### Tests
- `tests/unit/goap/planner/planningNode.test.js` - Unit tests

## Files to Modify

None (pure data structure)

## Testing Requirements

### Unit Tests
- [ ] Test node creation with initial state
- [ ] Test g-score calculation
- [ ] Test h-score storage
- [ ] Test f-score calculation (g + h)
- [ ] Test state comparison (equality check)
- [ ] Test parent reference chain
- [ ] Test path reconstruction from node to root
- [ ] Test immutability (mutations don't affect original)
- [ ] Test state diff calculation

## Node Structure

### Data Model
```javascript
class PlanningNode {
  constructor({
    state,           // World state (symbolic facts)
    gScore,          // Accumulated cost from start
    hScore,          // Heuristic estimate to goal
    parent,          // Parent node reference
    task,            // Task that led to this state
    taskParameters   // Bound parameters for task
  }) {
    this.state = Object.freeze({...state});
    this.gScore = gScore;
    this.hScore = hScore;
    this.fScore = gScore + hScore;
    this.parent = parent;
    this.task = task;
    this.taskParameters = taskParameters;
    Object.freeze(this);
  }

  // State comparison
  stateEquals(other) {
    return deepEqual(this.state, other.state);
  }

  // Path reconstruction
  getPath() {
    const path = [];
    let current = this;
    while (current.parent) {
      path.unshift({
        task: current.task,
        parameters: current.taskParameters
      });
      current = current.parent;
    }
    return path;
  }

  // State diff
  getStateDiff(other) {
    return {
      added: /* keys in this.state not in other */,
      removed: /* keys in other not in this.state */,
      changed: /* keys with different values */
    };
  }
}
```

### State Representation
World state is stored as flat key-value object:
```javascript
{
  "entity-123:core:hungry": true,
  "entity-123:core:health": 50,
  "entity-456:core:located_at": "room-1",
  "entity-789:items:count": 3
}
```

Key format: `entityId:componentName:propertyPath`

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 296-310 - **PRIMARY REFERENCE** - State space search algorithm

### Implementation References
- Standard A* algorithm documentation
- GOAP papers (e.g., "Goal-Oriented Action Planning" by Jeff Orkin)

## Implementation Notes

### Immutability
Nodes must be immutable to ensure:
- Safe state comparison
- Correct duplicate detection
- Reliable path reconstruction
- Thread-safety if needed

Use `Object.freeze()` to enforce immutability.

### State Comparison
Two nodes have equal states if:
- Same keys present
- Same values for all keys

Order doesn't matter. Use deep equality check.

### F-Score Calculation
```javascript
fScore = gScore + hScore

where:
- gScore = actual cost from start to this node
- hScore = estimated cost from this node to goal
- fScore = total estimated cost (used for A* priority queue)
```

Lower f-score = higher priority in search.

### Path Reconstruction
Follow parent references backward:
```javascript
node → parent → parent → ... → root (null parent)
```

Collect tasks and parameters along the way.
Result: ordered list of tasks to execute.

### Memory Considerations
Each node stores:
- Full world state snapshot (~1-10 KB)
- Parent reference
- Task reference
- Scores

For large search spaces (1000+ nodes), consider:
- State compression
- Shared state storage
- Garbage collection of explored nodes

### Performance Optimization
- Cache state comparison results
- Use hash codes for quick equality checks
- Implement efficient state diff algorithm

## Integration Points

### Used By (future)
- GOAPIMPL-018 (GOAP Planner) - Main search algorithm
- GOAPIMPL-017 (Heuristic Evaluator) - Calculate h-scores
- GOAPIMPL-016 (Effects Simulator) - Generate successor nodes

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Node creation and immutability verified
- State comparison works correctly
- Path reconstruction produces correct task sequences
- F-score calculation is accurate
- Documentation explains node structure and usage
