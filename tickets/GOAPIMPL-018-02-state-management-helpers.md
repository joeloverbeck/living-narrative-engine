# GOAPIMPL-018-02: State Management Helpers

**Parent Ticket**: GOAPIMPL-018 (GOAP A* Algorithm)
**Priority**: HIGH
**Estimated Effort**: 1.5 hours
**Dependencies**: None

## Description

Implement helper methods for managing planning state: state hashing for deduplication, goal satisfaction checking, and evaluation context building for JSON Logic conditions.

**Critical for**: State deduplication (prevents infinite loops), goal detection (plan termination), and condition evaluation (preconditions, goal states).

## Acceptance Criteria

- [ ] State hashing produces consistent, sorted JSON strings
- [ ] Goal satisfaction correctly evaluates JSON Logic conditions
- [ ] Evaluation context built correctly from planning state
- [ ] Handles malformed states gracefully (returns false/null)
- [ ] Handles evaluation errors gracefully (logs, returns false)
- [ ] 90%+ test coverage (functions/lines), 80%+ branch coverage

## Files to Create/Modify

### Modify (add private methods to GoapPlanner)
- `src/goap/planner/goapPlanner.js` - Add helper methods (~150 lines)

### Tests
- `tests/unit/goap/planner/goapPlanner.stateHelpers.test.js` - State helper tests (~200 lines)

## Implementation Details

### Method 1: State Hashing

```javascript
/**
 * Create deterministic hash of planning state for deduplication
 *
 * Uses sorted keys to ensure consistent hashing regardless of key insertion order.
 * Critical for closed set duplicate detection in A* search.
 *
 * @param {object} state - Planning state hash
 * @returns {string} JSON string hash
 * @private
 *
 * @example
 * const state = {
 *   'entity-1:core:health': 50,
 *   'entity-1:core:hungry': true
 * };
 * const hash = this.#hashState(state);
 * // Returns: '{"entity-1:core:health":50,"entity-1:core:hungry":true}'
 */
#hashState(state) {
  if (!state || typeof state !== 'object') {
    this.#logger.warn('Invalid state for hashing', { state });
    return JSON.stringify({});
  }

  try {
    // Sort keys for deterministic hashing
    const sortedKeys = Object.keys(state).sort();
    const sortedState = {};

    for (const key of sortedKeys) {
      sortedState[key] = state[key];
    }

    return JSON.stringify(sortedState);
  } catch (err) {
    this.#logger.error('State hashing failed', err, { state });
    return JSON.stringify({});
  }
}
```

**Key Points**:
- **Sorted keys**: Ensures `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` produce same hash
- **JSON.stringify()**: Creates string representation for Set.has() lookup
- **Error handling**: Returns empty object hash on failure (conservative)

### Method 2: Goal Satisfaction Check

```javascript
/**
 * Check if current state satisfies goal condition
 *
 * Evaluates goal.goalState JSON Logic condition against planning state.
 * Used to detect when A* search has reached the goal.
 *
 * @param {object} state - Current planning state
 * @param {object} goal - Goal definition with goalState condition
 * @returns {boolean} True if goal satisfied
 * @private
 *
 * @example
 * const goal = {
 *   goalState: { '==': [{ 'var': 'actor.core.hungry' }, false] }
 * };
 * const satisfied = this.#goalSatisfied(state, goal);
 */
#goalSatisfied(state, goal) {
  if (!goal || !goal.goalState) {
    this.#logger.warn('Invalid goal structure', { goal });
    return false;
  }

  try {
    // Build evaluation context from state
    const context = this.#buildEvaluationContext(state);

    // Evaluate goal condition
    const result = this.#jsonLogicService.evaluateCondition(
      goal.goalState,
      context
    );

    this.#logger.debug('Goal satisfaction check', {
      goalId: goal.id,
      satisfied: result,
    });

    return !!result; // Coerce to boolean
  } catch (err) {
    this.#logger.error('Goal evaluation error', err, {
      goalId: goal.id,
      state,
    });
    return false; // Conservative: assume not satisfied
  }
}
```

**Key Points**:
- **Conservative on error**: Returns `false` if evaluation fails
- **Boolean coercion**: Ensures return value is always boolean
- **Logging**: Debug for successes, error for failures

### Method 3: Evaluation Context Building

```javascript
/**
 * Build JSON Logic evaluation context from planning state
 *
 * Converts flat state hash format to nested object structure for JSON Logic.
 * Enables conditions like { 'var': 'actor.core.hungry' } to resolve correctly.
 *
 * @param {object} state - Planning state hash
 * @returns {object} Evaluation context
 * @private
 *
 * @example
 * const state = {
 *   'entity-1:core:hungry': true,
 *   'entity-1:core:health': 50
 * };
 * const context = this.#buildEvaluationContext(state);
 * // Returns: {
 * //   'entity-1': {
 * //     core: { hungry: true, health: 50 }
 * //   }
 * // }
 */
#buildEvaluationContext(state) {
  if (!state || typeof state !== 'object') {
    this.#logger.warn('Invalid state for context building', { state });
    return {};
  }

  const context = {};

  try {
    for (const [key, value] of Object.entries(state)) {
      // Parse key format: "entityId:componentId" or "entityId:componentId:field"
      const parts = key.split(':');

      if (parts.length < 2) {
        this.#logger.debug('Invalid state key format', { key });
        continue;
      }

      const [entityId, componentId, ...fieldPath] = parts;

      // Initialize entity if needed
      if (!context[entityId]) {
        context[entityId] = {};
      }

      // Initialize component if needed
      if (!context[entityId][componentId]) {
        context[entityId][componentId] = {};
      }

      // Set value
      if (fieldPath.length === 0) {
        // Simple component: "entity:component" => value
        context[entityId][componentId] = value;
      } else {
        // Nested field: "entity:component:field" => value
        const field = fieldPath.join(':'); // Rejoin in case field has colons
        context[entityId][componentId][field] = value;
      }
    }

    return context;
  } catch (err) {
    this.#logger.error('Context building failed', err, { state });
    return {};
  }
}
```

**Key Points**:
- **Nested structure**: Converts flat `entity:component:field` to `{ entity: { component: { field: value } } }`
- **Flexible field paths**: Handles fields with colons (rejoins with `:`)
- **Graceful degradation**: Skips invalid keys, returns partial context on error

## Testing Requirements

### Unit Test Cases (15+)

**State Hashing**:
1. Produces consistent hash for same state
2. Different order of keys produces same hash
3. Different values produce different hashes
4. Handles empty state
5. Handles null/undefined state (returns empty hash)
6. Handles deeply nested values
7. Handles arrays and objects in values

**Goal Satisfaction**:
8. Returns true when goal satisfied
9. Returns false when goal not satisfied
10. Handles missing goal.goalState (returns false)
11. Handles evaluation errors gracefully (returns false)
12. Coerces truthy/falsy to boolean
13. Logs errors appropriately

**Context Building**:
14. Converts simple components correctly (`entity:component`)
15. Converts nested fields correctly (`entity:component:field`)
16. Handles fields with colons in path
17. Handles empty state (returns empty context)
18. Handles invalid key formats (skips them)
19. Builds complex multi-entity contexts
20. Handles null/undefined state (returns empty context)

### Integration with Existing Code
- Use `JsonLogicEvaluationService` for condition evaluation
- Follow state format from `PlanningNode` and `PlanningEffectsSimulator`
- Match logging patterns from other GOAP services

## State Format Reference

### Flat State Hash (Input)
```javascript
{
  'entity-123:core:hungry': true,
  'entity-123:core:health': 50,
  'entity-123:core:known_to': ['actor-456'],
  'entity-456:core:inventory': ['item-789']
}
```

### Nested Evaluation Context (Output)
```javascript
{
  'entity-123': {
    core: {
      hungry: true,
      health: 50,
      known_to: ['actor-456']
    }
  },
  'entity-456': {
    core: {
      inventory: ['item-789']
    }
  }
}
```

## Goal State Examples

### Simple Goal
```javascript
{
  id: 'core:reduce_hunger',
  goalState: {
    '==': [{ 'var': 'actor.core.hungry' }, false]
  }
}
```

### Complex Goal
```javascript
{
  id: 'core:be_healthy',
  goalState: {
    'and': [
      { '>': [{ 'var': 'actor.core.health' }, 75] },
      { '==': [{ 'var': 'actor.core.hungry' }, false] }
    ]
  }
}
```

## Integration Points

### Used By
- `GoapPlanner.plan()` (GOAPIMPL-018-05) - Main A* loop
  - State hashing for closed set
  - Goal satisfaction for termination
  - Context building for precondition evaluation

### Dependencies
- `JsonLogicEvaluationService` - Condition evaluation
- `ILogger` - Error and debug logging

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- State hashing produces consistent results
- Goal satisfaction correctly evaluates conditions
- Context building handles all state formats
- Error cases handled gracefully
- Code follows project conventions (ESLint passes)
- JSDoc documentation complete

## Implementation Notes

### Performance Considerations
- **State hashing**: O(n log n) due to key sorting (acceptable for planning state sizes ~100-1000 keys)
- **Context building**: O(n) linear scan (efficient)
- **Caching opportunity**: Could cache state hashes if performance becomes issue (future optimization)

### Common Pitfalls
- ❌ Not sorting keys in state hash (causes duplicate detection failures)
- ❌ Throwing errors instead of returning false (breaks A* search flow)
- ❌ Not handling nested field paths with colons
- ❌ Building context incorrectly (prevents condition evaluation)

---

**Next Ticket**: GOAPIMPL-018-03 (Task Library Construction)
