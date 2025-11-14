# GOAPIMPL-018-03: Task Library Construction

**Parent Ticket**: GOAPIMPL-018 (GOAP A* Algorithm)
**Priority**: HIGH
**Estimated Effort**: 1 hour
**Dependencies**: GOAPIMPL-018-02 (needs evaluation context for structural gates)

## Description

Implement task library construction for an actor: load all tasks from GameDataRepository and filter by structural gates to build the actor's available task set for planning.

**Purpose**: Determines which planning tasks are relevant for a specific actor based on their capabilities, knowledge, and world state. This is the first filtering layer before precondition evaluation.

## Acceptance Criteria

- [ ] Loads all tasks from GameDataRepository
- [ ] Evaluates structural gates for each task
- [ ] Returns filtered task library (only applicable tasks)
- [ ] Handles tasks without structural gates (includes them)
- [ ] Handles structural gate evaluation errors gracefully
- [ ] Logs debug info for gate filtering decisions
- [ ] 90%+ test coverage (functions/lines), 80%+ branch coverage

## Files to Modify

### Implementation
- `src/goap/planner/goapPlanner.js` - Add `#getTaskLibrary()` method (~60 lines)

### Tests
- `tests/unit/goap/planner/goapPlanner.taskLibrary.test.js` - Task library tests (~150 lines)

## Implementation Details

### Method: Get Task Library

```javascript
/**
 * Build task library for actor by filtering all tasks through structural gates
 *
 * Structural gates are coarse "is this task even relevant?" filters based on:
 * - Actor capabilities (e.g., biology:can_eat, core:instrument_knowledge)
 * - World knowledge (e.g., knows instruments exist)
 * - Permanent attributes (e.g., is_musician, is_combatant)
 *
 * Different from preconditions which check "can I do this RIGHT NOW?"
 *
 * @param {string} actorId - Actor entity ID
 * @returns {Array<object>} Filtered task definitions
 * @private
 *
 * @example
 * const tasks = this.#getTaskLibrary('actor-123');
 * // Returns: [
 * //   { id: 'core:consume_nourishing_item', ... },
 * //   { id: 'core:find_shelter', ... }
 * // ]
 */
#getTaskLibrary(actorId) {
  // 1. Get all tasks from repository
  const allTasks = this.#gameDataRepository.getAllGoalDefinitions();

  if (!allTasks || allTasks.length === 0) {
    this.#logger.warn('No tasks available in repository');
    return [];
  }

  this.#logger.debug(`Filtering ${allTasks.length} tasks for actor ${actorId}`);

  // 2. Get actor entity for structural gate evaluation
  const actor = this.#entityManager.getEntity(actorId);

  if (!actor) {
    this.#logger.error(`Actor not found: ${actorId}`);
    return [];
  }

  // 3. Build evaluation context
  const context = {
    actor: actor,
    // Future: add world-level facts if needed
  };

  // 4. Filter by structural gates
  const filteredTasks = allTasks.filter(task => {
    // Tasks without structural gates are always relevant
    if (!task.structuralGates || !task.structuralGates.condition) {
      this.#logger.debug(`Task ${task.id} has no structural gates, including`);
      return true;
    }

    try {
      // Evaluate structural gate condition
      const passed = this.#jsonLogicService.evaluateCondition(
        task.structuralGates.condition,
        context
      );

      if (passed) {
        this.#logger.debug(`Task ${task.id} structural gates passed`);
      } else {
        this.#logger.debug(`Task ${task.id} structural gates failed, excluding`);
      }

      return passed;

    } catch (err) {
      this.#logger.error(`Structural gate evaluation failed for ${task.id}`, err, {
        condition: task.structuralGates.condition,
      });
      return false; // Conservative: exclude on error
    }
  });

  this.#logger.info(`Task library for ${actorId}: ${filteredTasks.length} / ${allTasks.length} tasks`);

  return filteredTasks;
}
```

**Key Points**:
- **GameDataRepository**: Use `getAllGoalDefinitions()` to get all tasks (tasks are stored as goal definitions)
- **Structural gates vs preconditions**:
  - **Structural**: "Could this actor EVER do this task?" (permanent capabilities)
  - **Preconditions**: "Can this actor do this task RIGHT NOW?" (current state)
- **Conservative on error**: Exclude task if gate evaluation fails
- **No gates = always relevant**: Tasks without structural gates are universally applicable

### Structural Gate Examples

**Example 1: Eating Task**
```javascript
{
  id: 'core:consume_nourishing_item',
  structuralGates: {
    condition: {
      'has_component': ['actor', 'biology:can_eat']
    }
  }
}
```
- Only actors with `biology:can_eat` component can use this task
- Excludes robots, ghosts, etc.

**Example 2: Musical Task**
```javascript
{
  id: 'music:play_instrument',
  structuralGates: {
    condition: {
      'and': [
        { 'has_component': ['actor', 'core:instrument_knowledge'] },
        { '>': [{ 'var': 'actor.core.instrument_knowledge.skill_level' }, 0] }
      ]
    }
  }
}
```
- Requires `core:instrument_knowledge` component AND skill > 0
- Excludes actors who don't know about instruments

**Example 3: No Structural Gates**
```javascript
{
  id: 'world:move_to_location',
  // No structuralGates - all actors can move
}
```

## Testing Requirements

### Unit Test Cases (12+)

**Basic Filtering**:
1. Returns all tasks when actor passes all gates
2. Excludes tasks when actor fails gates
3. Includes tasks without structural gates
4. Returns empty array when no tasks available
5. Returns empty array when actor not found

**Structural Gate Evaluation**:
6. Evaluates has_component conditions correctly
7. Evaluates complex AND/OR conditions
8. Evaluates component field value conditions

**Error Handling**:
9. Handles gate evaluation errors (excludes task, logs error)
10. Handles null/undefined tasks gracefully
11. Handles malformed gate conditions

**Logging**:
12. Logs task counts (filtered vs total)
13. Logs individual gate decisions at debug level
14. Logs errors for failed evaluations

### Mock Setup
```javascript
// Mock GameDataRepository
const mockRepository = {
  getAllGoalDefinitions: jest.fn(() => [
    {
      id: 'core:consume_item',
      structuralGates: {
        condition: { 'has_component': ['actor', 'biology:can_eat'] }
      }
    },
    {
      id: 'world:move',
      // No structural gates
    }
  ])
};

// Mock EntityManager
const mockEntityManager = {
  getEntity: jest.fn((id) => ({
    id: id,
    components: {
      'biology:can_eat': {}
    }
  }))
};
```

## Integration Points

### Dependencies
- `GameDataRepository.getAllGoalDefinitions()` - Load all tasks
- `IEntityManager.getEntity()` - Get actor entity
- `JsonLogicEvaluationService.evaluateCondition()` - Evaluate gates
- `ILogger` - Logging

### Used By
- `GoapPlanner.plan()` (GOAPIMPL-018-05) - Build task library before planning
- `GoapPlanner.#getApplicableTasks()` (GOAPIMPL-018-04) - Further filtering by preconditions

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Tasks filtered correctly by structural gates
- Tasks without gates always included
- Errors handled gracefully (conservative exclusion)
- Logging provides useful debug information
- Code follows project conventions (ESLint passes)
- JSDoc documentation complete

## Implementation Notes

### Structural Gates vs Preconditions

| Aspect | Structural Gates | Planning Preconditions |
|--------|------------------|------------------------|
| **When** | Task library construction (once per plan) | Every node expansion (many times) |
| **Purpose** | "Is this task relevant for this actor?" | "Can I do this task in this state?" |
| **Evaluated against** | Actor entity (permanent attributes) | Planning state (current world facts) |
| **Examples** | `has_component: biology:can_eat`, `is_musician` | `actor.hungry == true`, `has_item_in_inventory` |
| **Performance** | Infrequent, can be slower | Frequent, must be fast |

### Common Pitfalls
- ❌ Confusing structural gates with preconditions (different evaluation contexts)
- ❌ Not handling missing structural gates (should include task)
- ❌ Throwing errors instead of excluding tasks (breaks planning)
- ❌ Using planning state instead of actor entity for gate evaluation

### Future Enhancements
- **Caching**: Cache task library per actor if structural gates are expensive
- **World-level gates**: Add world facts to gate context (e.g., "are instruments available in world?")
- **Dynamic loading**: Load tasks on-demand instead of all at once

---

**Next Ticket**: GOAPIMPL-018-04 (Parameter Binding via Scopes)
