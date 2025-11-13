# GOAPIMPL-017: GOAP Heuristic Functions

**Priority**: MEDIUM
**Estimated Effort**: 2-3 hours
**Dependencies**: GOAPIMPL-015 (Planning Node Structure)

## Description

Create heuristic functions for A* search in GOAP planner. Includes goal-distance estimator, relaxed planning graph, and configurable heuristic selection.

Heuristics guide the A* search toward the goal efficiently. A good heuristic dramatically reduces the number of nodes explored.

## Acceptance Criteria

- [ ] Goal-distance heuristic implemented (count unsatisfied conditions)
- [ ] Relaxed planning graph heuristic implemented (ignore negative effects)
- [ ] Heuristic registry supports selection by name
- [ ] All heuristics are admissible (never overestimate cost)
- [ ] Heuristics provide useful guidance (not too pessimistic)
- [ ] Heuristic calculation is fast (< 1ms per call)
- [ ] Comprehensive documentation of heuristic algorithms
- [ ] 90%+ test coverage

## Files to Create

### Heuristic Implementations
- `src/goap/planner/heuristics/goalDistanceHeuristic.js` - Simple goal distance
- `src/goap/planner/heuristics/relaxedPlanningGraphHeuristic.js` - Advanced RPG heuristic
- `src/goap/planner/heuristics/heuristicRegistry.js` - Heuristic selection

### Tests
- `tests/unit/goap/planner/heuristics/goalDistanceHeuristic.test.js`
- `tests/unit/goap/planner/heuristics/relaxedPlanningGraphHeuristic.test.js`
- `tests/unit/goap/planner/heuristics/heuristicRegistry.test.js`

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add heuristic tokens
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register heuristics

## Testing Requirements

### Unit Tests
- [ ] Test goal-distance calculation with various states
- [ ] Test relaxed planning graph construction
- [ ] Test heuristic admissibility (h <= actual cost)
- [ ] Test heuristic with satisfied goals (returns 0)
- [ ] Test heuristic with unsatisfiable goals
- [ ] Test heuristic registry selection
- [ ] Test heuristic performance (timing)
- [ ] Compare heuristic accuracy

## Heuristic 1: Goal Distance (Simple)

### Algorithm
Count number of unsatisfied goal conditions:
```javascript
calculateGoalDistance(state, goal) {
  let unsatisfiedCount = 0;

  for (const condition of goal.conditions) {
    if (!isConditionSatisfied(condition, state)) {
      unsatisfiedCount++;
    }
  }

  return unsatisfiedCount;
}
```

### Properties
- **Admissible**: Yes (each condition requires ≥1 action)
- **Informed**: Weakly (ignores interaction between conditions)
- **Fast**: O(n) where n = number of conditions
- **Best for**: Simple goals with independent conditions

### Example
```javascript
Goal: actor is not hungry AND actor has shelter
State: actor is hungry, no shelter

Unsatisfied: 2 conditions
Heuristic: 2.0
```

## Heuristic 2: Relaxed Planning Graph (Advanced)

### Algorithm
Build planning graph ignoring negative effects:
```javascript
calculateRPG(state, goal, tasks) {
  // 1. Initialize graph with current state
  let layer = 0;
  let currentFacts = new Set(state);

  // 2. Expand layers until goal satisfied
  while (!goalSatisfied(goal, currentFacts)) {
    layer++;

    // 3. Find applicable tasks (ignoring negative effects)
    const applicableTasks = tasks.filter(task =>
      preconditionsSatisfied(task, currentFacts)
    );

    // 4. Add positive effects to facts
    for (const task of applicableTasks) {
      for (const effect of task.positiveEffects) {
        currentFacts.add(effect);
      }
    }

    // 5. Check for unsolvable goal
    if (layer > MAX_LAYERS) {
      return Infinity;  // Unsolvable
    }
  }

  return layer;  // Minimum actions needed (optimistic)
}
```

### Properties
- **Admissible**: Yes (relaxed problem is easier)
- **Informed**: Strongly (considers task interactions)
- **Fast**: O(layers × tasks) - reasonable for small domains
- **Best for**: Complex goals with interdependent conditions

### Example
```javascript
Goal: have shelter
State: no resources, no shelter

Layer 0: [no resources]
Layer 1: [gather_resources task applicable] → [have resources]
Layer 2: [build_shelter task applicable] → [have shelter] ✓

Heuristic: 2.0 (minimum 2 actions)
```

## Heuristic Registry

### API
```javascript
class HeuristicRegistry {
  register(name, heuristic) {
    this.heuristics.set(name, heuristic);
  }

  get(name) {
    return this.heuristics.get(name);
  }

  calculate(name, state, goal, tasks) {
    const heuristic = this.get(name);
    return heuristic.calculate(state, goal, tasks);
  }
}
```

### Built-in Heuristics
```javascript
registry.register('goal-distance', goalDistanceHeuristic);
registry.register('rpg', relaxedPlanningGraphHeuristic);
registry.register('zero', () => 0);  // Dijkstra (no heuristic)
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 465-473 - Handle explosion with heuristics

### Academic Papers
- "STRIPS Planning" - Fikes & Nilsson, 1971 (foundation)
- "Fast Planning Through Planning Graph Analysis" - Blum & Furst, 1997 (RPG)
- "Goal-Oriented Action Planning" - Jeff Orkin, MIT (GOAP for games)

### Implementation References
- A* algorithm documentation
- STRIPS planning systems
- Graphplan algorithm

## Implementation Notes

### Admissibility Requirement
A heuristic h is admissible if:
```
h(state, goal) ≤ actual_cost(state, goal)
```

This ensures A* finds optimal solutions.

To ensure admissibility:
- Never overestimate required actions
- Count minimum possible actions
- Ignore obstacles (optimistic assumption)

### Heuristic Trade-offs

**Goal Distance**:
- Pros: Fast, simple, always admissible
- Cons: Uninformed (doesn't consider task costs)

**Relaxed Planning Graph**:
- Pros: Informed (considers task structure)
- Cons: Slower, more complex

**Zero Heuristic** (Dijkstra):
- Pros: Guaranteed optimal
- Cons: Explores entire state space (slow)

### Performance Optimization
- Cache heuristic calculations per state
- Use incremental RPG construction
- Precompute task dependency graph
- Limit RPG depth to prevent runaway computation

### Configuration
Allow planner to select heuristic:
```javascript
const planner = new GOAPPlanner({
  heuristic: 'rpg',  // or 'goal-distance' or 'zero'
  maxRPGLayers: 10
});
```

## Integration Points

### Required Services (inject)
- Task library (for RPG heuristic)
- Logger

### Used By (future)
- GOAPIMPL-018 (GOAP Planner) - Calculate h-scores for nodes

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Both heuristics implemented and tested
- Admissibility verified empirically
- Heuristic registry works correctly
- Performance is acceptable (< 1ms per calculation)
- Documentation explains algorithms and trade-offs
- Service integrates with DI container
