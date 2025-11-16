# MODIFY_COMPONENT Planner Support Specification

## 1. Executive Summary

This specification defines the enhancement of the GOAP planner to support backward chaining with MODIFY_COMPONENT operations, particularly for numeric constraint satisfaction. Currently, the planner can only reason about ADD_COMPONENT and REMOVE_COMPONENT operations when working backward from goals to find applicable actions. This limitation prevents the planner from solving common game scenarios involving numeric state changes (e.g., hunger, health, money, progress counters).

**Key Objectives:**
- Enable planner to reason about numeric state modifications during backward search
- Support numeric comparison operators (>, <, >=, <=, ==) in goal conditions
- Maintain consistency with existing planning architecture
- Ensure type safety and proper edge case handling

**Impact:**
- Enables more natural modeling of game mechanics (hunger systems, resource management)
- Reduces workarounds using ADD/REMOVE components for numeric changes
- Improves planning quality through more accurate heuristics

**Estimated Effort:** 9-13 hours across 3 implementation phases

## 2. Current State Analysis

### What Works Today

**PlanningEffectsSimulator** (`src/goap/planner/planningEffectsSimulator.js`, lines 350-434):
- Already simulates MODIFY_COMPONENT effects during forward simulation
- Supports three modification modes:
  - `set`: Direct value assignment
  - `increment`: Addition to existing value
  - `decrement`: Subtraction from existing value
- Properly handles component field updates
- Used during A* search to simulate state transitions

**Example Working Forward Simulation:**
```javascript
// Task effect
{
  type: 'MODIFY_COMPONENT',
  parameters: {
    entityId: 'actor',
    componentId: 'core:needs',
    modifications: { hunger: 20 },
    mode: 'set'
  }
}

// State before: { hunger: 80 }
// State after:  { hunger: 20 }
```

### Critical Gap

**GoalDistanceHeuristic** (`src/goap/planner/goalDistanceHeuristic.js`):
- Only counts missing/unwanted components
- Cannot calculate distance for numeric conditions
- Returns 0 distance for numeric goals (treats them as satisfied)

**Example Problem:**
```javascript
// Goal: hunger <= 30
// Current state: hunger = 80
// Distance calculation: 0 (incorrect!)
// Should be: 50 (difference needed to satisfy)
```

**GoapPlanner** (`src/goap/planner/goapPlanner.js`):
- Cannot determine if action brings us closer to numeric goal
- Cannot identify applicable actions for numeric constraint satisfaction
- Lacks mechanism to evaluate numeric preconditions during backward search

### Test Case Evidence

**External Goal Satisfaction Test** (`tests/integration/goap/replanning.integration.test.js`, lines 157-249):
```javascript
// Currently skipped because planner cannot handle this scenario
const goal = {
  relevance: { '>': [{ var: 'actor.components.core:needs.hunger' }, 50] },
  goalState: { '<=': [{ var: 'actor.components.core:needs.hunger' }, 30] }
};

const eatTask = {
  planningEffects: [{
    type: 'MODIFY_COMPONENT',
    parameters: {
      entityId: 'actor',
      componentId: 'core:needs',
      modifications: { hunger: 20 },
      mode: 'set'
    }
  }]
};
```

## 3. Problem Statement

### Core Issues

1. **Backward Chaining Gap**: Planner cannot identify actions that reduce numeric distances to goals
2. **Heuristic Blindness**: Cannot estimate how far state is from satisfying numeric conditions
3. **Applicability Testing**: Cannot determine if MODIFY_COMPONENT action is relevant to numeric goal

### Use Cases Blocked

- **Hunger/Thirst Systems**: Goals like "hunger <= 20" with eating actions that reduce hunger
- **Resource Accumulation**: Goals like "gold >= 100" with gathering actions that increase gold
- **Health Management**: Goals like "health >= 50" with healing actions
- **Progress Counters**: Goals like "quest_progress >= 90%" with task completion actions
- **Stat Requirements**: Goals like "strength >= 15" for equipment/activity prerequisites

### Example Scenario That Fails Today

```javascript
// Actor state
actor.components['core:needs'] = { hunger: 80 };

// Goal: Reduce hunger
goal.goalState = { '<=': [{ var: 'actor.components.core:needs.hunger' }, 30] };

// Available action: Eat (reduces hunger by 60)
task.planningEffects = [{
  type: 'MODIFY_COMPONENT',
  parameters: {
    entityId: 'actor',
    componentId: 'core:needs',
    modifications: { hunger: -60 },  // decrement mode
    mode: 'decrement'
  }
}];

// Current behavior: Planner fails to find solution
// Expected behavior: Planner selects "eat" action (80 - 60 = 20, satisfies <= 30)
```

## 4. Proposed Solution Architecture

### High-Level Approach

Add numeric constraint evaluation capability to the planning system while maintaining existing component-based reasoning. Introduce a new evaluator component that specializes in numeric comparisons, integrate it into existing heuristic and planner logic.

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     GoapPlanner                         │
│  - Uses NumericConstraintEvaluator for applicability    │
│  - Checks if action reduces numeric distance to goal    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├──> NumericConstraintEvaluator (NEW)
                     │    - Evaluates >, <, >=, <=, ==
                     │    - Calculates numeric distances
                     │    - Determines constraint satisfaction
                     │
                     ├──> GoalDistanceHeuristic (ENHANCED)
                     │    - Calculates component distance (existing)
                     │    - Calculates numeric distance (NEW)
                     │    - Returns combined distance metric
                     │
                     └──> PlanningEffectsSimulator (ENHANCED)
                          - Forward simulation (existing)
                          - Type safety validation (NEW)
                          - Edge case handling (NEW)
```

### Integration Points

1. **GoapPlanner._isActionApplicable()**: Check if action reduces numeric distance
2. **GoalDistanceHeuristic.calculateDistance()**: Add numeric distance calculation
3. **PlanningEffectsSimulator**: Enhance type safety and validation
4. **JsonLogicEvaluationService**: Use existing numeric comparison operators

## 5. Technical Design

### 5.1 NumericConstraintEvaluator

**Purpose**: Specialized component for evaluating numeric constraints and calculating distances.

**Location**: `src/goap/planner/numericConstraintEvaluator.js`

**Responsibilities**:
- Evaluate numeric comparison operators (>, <, >=, <=, ==)
- Calculate distance from current value to satisfying constraint
- Extract numeric values from JSON Logic expressions
- Determine if constraint is satisfied

**API Design**:

```javascript
class NumericConstraintEvaluator {
  constructor({ jsonLogicEvaluator, logger }) {
    this.#jsonLogicEvaluator = jsonLogicEvaluator;
    this.#logger = logger;
  }

  /**
   * Evaluates if a constraint is satisfied
   * @param {object} constraint - JSON Logic expression
   * @param {object} context - Current state context
   * @returns {boolean} True if constraint satisfied
   */
  evaluateConstraint(constraint, context) {
    return this.#jsonLogicEvaluator.evaluate(constraint, context);
  }

  /**
   * Calculates distance to satisfy constraint
   * @param {object} constraint - JSON Logic numeric constraint
   * @param {object} context - Current state context
   * @returns {number|null} Distance value or null if not numeric
   */
  calculateDistance(constraint, context) {
    const parsed = this.#parseNumericConstraint(constraint);
    if (!parsed) return null;

    const { operator, varPath, targetValue } = parsed;
    const currentValue = this.#extractValue(varPath, context);

    if (typeof currentValue !== 'number' || typeof targetValue !== 'number') {
      return null;
    }

    return this.#computeDistance(operator, currentValue, targetValue);
  }

  /**
   * Determines if constraint is numeric type
   * @param {object} constraint - JSON Logic expression
   * @returns {boolean} True if numeric constraint
   */
  isNumericConstraint(constraint) {
    const numericOps = ['>', '<', '>=', '<=', '=='];
    const keys = Object.keys(constraint || {});
    return keys.some(key => numericOps.includes(key));
  }

  #parseNumericConstraint(constraint) {
    // Extract operator, variable path, and target value
    // Returns { operator, varPath, targetValue } or null
  }

  #computeDistance(operator, currentValue, targetValue) {
    switch (operator) {
      case '>':
      case '>=':
        return currentValue >= targetValue ? 0 : targetValue - currentValue;
      case '<':
      case '<=':
        return currentValue <= targetValue ? 0 : currentValue - targetValue;
      case '==':
        return Math.abs(currentValue - targetValue);
      default:
        return null;
    }
  }

  #extractValue(varPath, context) {
    // Use JSON Logic var resolution
    return this.#jsonLogicEvaluator.evaluate({ var: varPath }, context);
  }
}
```

### 5.2 Enhanced GoalDistanceHeuristic

**Changes Required**:

```javascript
// In src/goap/planner/goalDistanceHeuristic.js

class GoalDistanceHeuristic {
  constructor({ jsonLogicEvaluator, numericConstraintEvaluator, logger }) {
    this.#jsonLogicEvaluator = jsonLogicEvaluator;
    this.#numericConstraintEvaluator = numericConstraintEvaluator; // NEW
    this.#logger = logger;
  }

  calculateDistance(state, goal) {
    // Existing component-based distance calculation
    let componentDistance = this.#calculateComponentDistance(state, goal);

    // NEW: Numeric constraint distance calculation
    let numericDistance = this.#calculateNumericDistance(state, goal);

    // Combined distance (both must be satisfied)
    return componentDistance + numericDistance;
  }

  #calculateNumericDistance(state, goal) {
    const context = { actor: state.actor, world: state.world };
    
    // Check if goalState has numeric constraints
    if (!this.#numericConstraintEvaluator.isNumericConstraint(goal.goalState)) {
      return 0; // No numeric constraints
    }

    // Calculate distance to satisfy numeric constraint
    const distance = this.#numericConstraintEvaluator.calculateDistance(
      goal.goalState,
      context
    );

    return distance !== null ? distance : 0;
  }

  // Existing #calculateComponentDistance method unchanged
}
```

### 5.3 Enhanced GoapPlanner

**Changes Required**:

```javascript
// In src/goap/planner/goapPlanner.js

class GoapPlanner {
  #isActionApplicable(taskId, currentState, goal) {
    const task = this.#gameDataRepository.getTask(taskId);
    if (!task) return false;

    // Existing precondition check
    if (!this.#checkPlanningPreconditions(task, currentState)) {
      return false;
    }

    // NEW: Check if action reduces distance to goal
    return this.#actionReducesDistance(task, currentState, goal);
  }

  #actionReducesDistance(task, currentState, goal) {
    // Simulate applying task effects
    const nextState = this.#planningEffectsSimulator.simulateEffects(
      currentState,
      task.planningEffects || []
    );

    // Calculate distances
    const currentDistance = this.#heuristicRegistry
      .getGoalDistanceHeuristic()
      .calculateDistance(currentState, goal);

    const nextDistance = this.#heuristicRegistry
      .getGoalDistanceHeuristic()
      .calculateDistance(nextState, goal);

    // Action is applicable if it reduces distance
    return nextDistance < currentDistance;
  }

  // Existing methods unchanged
}
```

### 5.4 Enhanced PlanningEffectsSimulator

**Type Safety & Validation Enhancements**:

```javascript
// In src/goap/planner/planningEffectsSimulator.js

#simulateModifyComponent(entityId, effect, simulatedState) {
  const { componentId, modifications, mode = 'set' } = effect.parameters;

  // NEW: Type validation
  if (!this.#validateModificationTypes(modifications, componentId, simulatedState)) {
    this.#logger.warn('Type mismatch in MODIFY_COMPONENT', {
      componentId,
      modifications,
      entityId
    });
    return simulatedState; // Skip invalid modification
  }

  // Existing simulation logic
  const entity = simulatedState[entityId];
  if (!entity || !entity.components[componentId]) {
    return simulatedState;
  }

  const component = { ...entity.components[componentId] };

  for (const [field, value] of Object.entries(modifications)) {
    // NEW: Edge case handling
    const result = this.#applyModification(component[field], value, mode);
    if (result !== null) {
      component[field] = result;
    }
  }

  // Return updated state
  return {
    ...simulatedState,
    [entityId]: {
      ...entity,
      components: {
        ...entity.components,
        [componentId]: component
      }
    }
  };
}

#validateModificationTypes(modifications, componentId, state) {
  // Check if field exists and types match
  for (const [field, value] of Object.entries(modifications)) {
    if (typeof value !== 'number') {
      return false; // Only numeric modifications supported
    }
  }
  return true;
}

#applyModification(currentValue, modValue, mode) {
  if (typeof currentValue !== 'number') {
    return null; // Cannot modify non-numeric field
  }

  switch (mode) {
    case 'set':
      return modValue;
    case 'increment':
      return currentValue + modValue;
    case 'decrement':
      return currentValue - modValue;
    default:
      this.#logger.warn('Unknown modification mode', { mode });
      return null;
  }
}
```

## 6. Schema & Data Structure Updates

### Task Schema Enhancement

**File**: `data/schemas/task.schema.json`

**Add Mode Documentation** (optional clarification):

```json
{
  "planningEffects": {
    "type": "array",
    "items": {
      "anyOf": [
        { "$ref": "./operations/addComponent.schema.json" },
        { "$ref": "./operations/removeComponent.schema.json" },
        {
          "$ref": "./operations/modifyComponent.schema.json",
          "description": "Supported modes: 'set' (default), 'increment', 'decrement'"
        }
      ]
    }
  }
}
```

### Goal Schema

**File**: `data/schemas/goal.schema.json`

**No changes required** - already supports arbitrary JSON Logic expressions including numeric comparisons.

### MODIFY_COMPONENT Operation Schema

**File**: `data/schemas/operations/modifyComponent.schema.json`

**Add Mode Enum** (if not present):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MODIFY_COMPONENT Operation",
  "type": "object",
  "properties": {
    "type": {
      "const": "MODIFY_COMPONENT"
    },
    "parameters": {
      "type": "object",
      "properties": {
        "entityId": { "type": "string" },
        "componentId": { "type": "string" },
        "modifications": {
          "type": "object",
          "additionalProperties": { "type": "number" }
        },
        "mode": {
          "type": "string",
          "enum": ["set", "increment", "decrement"],
          "default": "set"
        }
      },
      "required": ["entityId", "componentId", "modifications"]
    }
  },
  "required": ["type", "parameters"]
}
```

## 7. Implementation Approach

### Phase 1: Core Infrastructure (3-5 hours)

**Tasks:**
1. Create `NumericConstraintEvaluator` class
   - Implement constraint parsing
   - Implement distance calculation
   - Add unit tests (20+ test cases)

2. Enhance `GoalDistanceHeuristic`
   - Integrate `NumericConstraintEvaluator`
   - Add numeric distance calculation
   - Update unit tests

3. Update Dependency Injection
   - Register `NumericConstraintEvaluator` in container
   - Update heuristic factory dependencies

**Validation:**
- Run `npm run test:unit -- src/goap/planner/numericConstraintEvaluator.test.js`
- Run `npm run test:unit -- src/goap/planner/goalDistanceHeuristic.test.js`

### Phase 2: Planner Integration (4-5 hours)

**Tasks:**
1. Enhance `GoapPlanner._isActionApplicable()`
   - Add distance reduction check
   - Handle edge cases (equal distance, invalid states)

2. Enhance `PlanningEffectsSimulator`
   - Add type validation
   - Improve edge case handling
   - Add detailed logging

3. Integration testing
   - Activate and fix "External Goal Satisfaction" test
   - Create additional numeric goal scenarios
   - Test with hunger, health, gold systems

**Validation:**
- Run `npm run test:integration -- tests/integration/goap/replanning.integration.test.js`
- Verify test passes without `.skip`

### Phase 3: Documentation & Polish (2-3 hours)

**Tasks:**
1. Update GOAP system documentation
   - Add MODIFY_COMPONENT planning guide
   - Document numeric constraint patterns
   - Add example scenarios

2. Create modding guide section
   - How to define numeric goals
   - Best practices for MODIFY_COMPONENT effects
   - Common pitfalls and solutions

3. Add JSDoc comments
   - Document new methods
   - Update existing method docs
   - Add usage examples

**Deliverables:**
- `docs/goap/numeric-constraints-guide.md`
- Updated `specs/goap-system-specs.md`
- Comprehensive JSDoc coverage

## 8. Testing Strategy

### Unit Tests

**NumericConstraintEvaluator** (`tests/unit/goap/planner/numericConstraintEvaluator.test.js`):
```javascript
describe('NumericConstraintEvaluator', () => {
  describe('calculateDistance', () => {
    it('should calculate distance for > constraint', () => {
      // Current: 30, Goal: > 50 → Distance: 20
    });

    it('should calculate distance for <= constraint', () => {
      // Current: 80, Goal: <= 30 → Distance: 50
    });

    it('should return 0 when constraint already satisfied', () => {
      // Current: 20, Goal: <= 30 → Distance: 0
    });

    it('should return null for non-numeric constraints', () => {
      // Constraint: { has_component: [...] } → null
    });

    it('should handle missing fields gracefully', () => {
      // Field not in context → null
    });
  });

  describe('isNumericConstraint', () => {
    it('should identify numeric operators', () => {
      // >, <, >=, <=, == → true
    });

    it('should reject non-numeric operators', () => {
      // and, or, has_component → false
    });
  });
});
```

**GoalDistanceHeuristic** (enhanced tests):
```javascript
describe('GoalDistanceHeuristic - Numeric Constraints', () => {
  it('should combine component and numeric distances', () => {
    // Component distance: 1, Numeric distance: 50 → Total: 51
  });

  it('should handle goals with only numeric constraints', () => {
    // No component requirements, only hunger <= 30
  });

  it('should handle goals with only component constraints', () => {
    // Existing behavior preserved
  });
});
```

### Integration Tests

**External Goal Satisfaction** (activate and fix):
```javascript
// File: tests/integration/goap/replanning.integration.test.js
// Line 157: Remove .skip

it('should handle goal satisfied externally between turns', async () => {
  // Setup hunger system
  const { controller, entityManager } = await createGoapTestSetup({
    tasks: {
      test: {
        eat: {
          id: 'test:eat',
          planningEffects: [{
            type: 'MODIFY_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'core:needs',
              modifications: { hunger: -60 },
              mode: 'decrement'
            }
          }]
        }
      }
    }
  });

  // Create actor with hunger
  const actorId = entityManager.createEntity('test:actor');
  entityManager.addComponent(actorId, 'core:needs', { hunger: 80 });

  // Register goal
  const goal = createTestGoal({
    id: 'test:hunger_goal',
    relevance: { '>': [{ var: 'actor.components.core:needs.hunger' }, 50] },
    goalState: { '<=': [{ var: 'actor.components.core:needs.hunger' }, 30] }
  });

  // Execute first turn - should select eat action
  await controller.executeTurn(actorId);

  // Verify plan selected eat action
  const plan = controller.getActivePlan();
  expect(plan.tasks).toContainEqual(expect.objectContaining({ id: 'test:eat' }));
});
```

**New Test Cases**:
```javascript
describe('MODIFY_COMPONENT Planning', () => {
  it('should plan gold accumulation', async () => {
    // Goal: gold >= 100
    // Current: 30
    // Action: mine (+25 gold)
    // Expected: Plan with 3x mine actions
  });

  it('should plan healing', async () => {
    // Goal: health >= 80
    // Current: 40
    // Action: heal (+30 health)
    // Expected: Plan with 2x heal actions
  });

  it('should handle impossible numeric goals', async () => {
    // Goal: hunger <= 10
    // Current: 100
    // Action: eat (-20 hunger)
    // Cannot satisfy (would need 5 actions but cost too high)
    // Expected: Planning fails gracefully
  });
});
```

### Performance Tests

**Benchmark** (`tests/performance/goap/numericPlanning.performance.test.js`):
```javascript
it('should plan with numeric constraints efficiently', async () => {
  const startTime = performance.now();

  // Plan 10 different numeric goals
  for (let i = 0; i < 10; i++) {
    await planner.createPlan(actorId, numericGoals[i]);
  }

  const duration = performance.now() - startTime;
  expect(duration).toBeLessThan(1000); // < 1 second for 10 plans
});
```

## 9. Edge Cases & Error Handling

### Edge Cases to Handle

1. **Non-Numeric Fields**:
   ```javascript
   // Attempting to modify string field numerically
   modifications: { name: 42 }
   // Expected: Log warning, skip modification
   ```

2. **Missing Components**:
   ```javascript
   // Modifying component that doesn't exist
   componentId: 'core:needs' // Actor doesn't have this component
   // Expected: Simulation returns unchanged state
   ```

3. **Overflow/Underflow**:
   ```javascript
   // Numeric overflow
   current: Number.MAX_SAFE_INTEGER
   modification: +1000
   // Expected: Clamp or handle gracefully
   ```

4. **Invalid Mode**:
   ```javascript
   mode: 'multiply' // Not a supported mode
   // Expected: Log warning, treat as 'set'
   ```

5. **Constraint Ambiguity**:
   ```javascript
   // Multiple numeric constraints in AND
   goalState: {
     and: [
       { '>=': [{ var: 'actor.components.core:needs.hunger' }, 20] },
       { '<=': [{ var: 'actor.components.core:needs.hunger' }, 30] }
     ]
   }
   // Expected: Calculate distance for each, sum them
   ```

6. **Impossible Constraints**:
   ```javascript
   // Constraint can never be satisfied
   goalState: {
     and: [
       { '>': [{ var: 'x' }, 50] },
       { '<': [{ var: 'x' }, 30] }
     ]
   }
   // Expected: Return Infinity or very large distance
   ```

### Error Handling Patterns

```javascript
// In NumericConstraintEvaluator
try {
  const distance = this.calculateDistance(constraint, context);
  return distance !== null ? distance : 0;
} catch (error) {
  this.#logger.error('Failed to calculate numeric distance', {
    constraint,
    error: error.message
  });
  return 0; // Treat as satisfied to avoid blocking planning
}

// In PlanningEffectsSimulator
if (!this.#validateModificationTypes(modifications, componentId, state)) {
  this.#logger.warn('Type validation failed for MODIFY_COMPONENT', {
    componentId,
    modifications,
    entityId
  });
  return simulatedState; // Return unchanged state
}
```

## 10. Migration Considerations

### Backward Compatibility

**Existing Content**: No changes required to existing task/goal definitions. All existing content continues to work.

**Opt-In**: Numeric constraint planning is automatically enabled when goals use numeric operators.

**Graceful Degradation**: If numeric constraint evaluation fails, system falls back to existing behavior (returns 0 distance).

### Data Migration

**Not Required** - This is purely an enhancement to planner logic. No data schema changes break existing content.

### Testing Migration

**External Goal Satisfaction Test**:
- Remove `.skip` from line 157 in `tests/integration/goap/replanning.integration.test.js`
- Verify test passes with new implementation
- No test data changes needed

## 11. Example: Complete Hunger Goal

### Scenario Definition

```javascript
// Actor state
const actor = {
  id: 'player',
  components: {
    'core:needs': {
      hunger: 80,
      thirst: 40
    },
    'core:inventory': {
      items: ['bread', 'water']
    }
  }
};

// Goal: Satisfy hunger
const hungerGoal = {
  id: 'core:satisfy_hunger',
  relevance: {
    '>': [{ var: 'actor.components.core:needs.hunger' }, 50]
  },
  goalState: {
    '<=': [{ var: 'actor.components.core:needs.hunger' }, 30]
  },
  priority: 0.8
};

// Available task: Eat bread
const eatBreadTask = {
  id: 'core:eat_bread',
  cost: 5,
  planningPreconditions: [
    {
      description: 'Actor must have bread',
      condition: {
        in: ['bread', { var: 'actor.components.core:inventory.items' }]
      }
    }
  ],
  planningEffects: [
    {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:needs',
        modifications: { hunger: -60 },
        mode: 'decrement'
      }
    },
    {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entityId: 'actor',
        componentId: 'core:inventory',
        modifications: { items: ['bread'] },
        mode: 'remove' // Hypothetical - not in current spec
      }
    }
  ]
};
```

### Planning Execution

**Step 1: Goal Selection**
```javascript
// Controller selects hungerGoal (relevance 0.8, condition satisfied: 80 > 50)
```

**Step 2: Distance Calculation (Initial State)**
```javascript
// NumericConstraintEvaluator.calculateDistance()
constraint: { '<=': [{ var: 'actor.components.core:needs.hunger' }, 30] }
currentValue: 80
targetValue: 30
distance: 80 - 30 = 50 // Need to reduce hunger by 50
```

**Step 3: Action Applicability Check**
```javascript
// GoapPlanner._isActionApplicable('core:eat_bread', currentState, hungerGoal)

// Check preconditions
precondition: { in: ['bread', { var: 'actor.components.core:inventory.items' }] }
result: true (bread in inventory)

// Simulate effect
simulatedState.actor.components['core:needs'].hunger = 80 - 60 = 20

// Calculate new distance
newDistance: 20 <= 30 → distance = 0 (satisfied)

// Action reduces distance: 50 → 0
result: true (action is applicable)
```

**Step 4: Plan Creation**
```javascript
// Planner creates plan
plan = {
  goal: hungerGoal,
  tasks: [
    { id: 'core:eat_bread', cost: 5 }
  ],
  totalCost: 5
}
```

**Step 5: Execution**
```javascript
// RefinementEngine executes task
// ComponentMutationService applies actual modifications
// Final state: hunger = 20 (goal satisfied)
```

## 12. Documentation Requirements

### Files to Create/Update

1. **`docs/goap/numeric-constraints-guide.md`** (NEW)
   - How numeric constraint planning works
   - Supported operators and semantics
   - Best practices for defining numeric goals
   - Common patterns (hunger, health, resources)
   - Troubleshooting guide

2. **`specs/goap-system-specs.md`** (UPDATE)
   - Add section: "Numeric Constraint Planning"
   - Document MODIFY_COMPONENT backward chaining
   - Update "Planning Effects" section
   - Add example scenarios

3. **JSDoc Comments** (UPDATE)
   - `src/goap/planner/numericConstraintEvaluator.js` - Full documentation
   - `src/goap/planner/goalDistanceHeuristic.js` - Update calculateDistance
   - `src/goap/planner/goapPlanner.js` - Document _isActionApplicable changes
   - `src/goap/planner/planningEffectsSimulator.js` - Document validation

### Code Documentation Example

```javascript
/**
 * Calculates the distance from current state to satisfying a numeric constraint.
 * 
 * Supports standard comparison operators:
 * - `>`, `>=`: Distance is (target - current) if current < target, else 0
 * - `<`, `<=`: Distance is (current - target) if current > target, else 0
 * - `==`: Distance is absolute difference
 * 
 * @param {object} constraint - JSON Logic numeric constraint (e.g., { '>': [{ var: 'x' }, 50] })
 * @param {object} context - State context for variable resolution
 * @returns {number|null} Numeric distance or null if not applicable
 * 
 * @example
 * // Current hunger: 80, Goal: hunger <= 30
 * const distance = evaluator.calculateDistance(
 *   { '<=': [{ var: 'actor.components.core:needs.hunger' }, 30] },
 *   { actor: { components: { 'core:needs': { hunger: 80 } } } }
 * );
 * // Returns: 50 (need to reduce by 50)
 */
calculateDistance(constraint, context) {
  // Implementation
}
```

## 13. Success Metrics

### Functional Success

- ✅ "External Goal Satisfaction" integration test passes without `.skip`
- ✅ All existing GOAP tests continue to pass
- ✅ `NumericConstraintEvaluator` achieves 90%+ code coverage
- ✅ `GoalDistanceHeuristic` achieves 85%+ code coverage
- ✅ New integration tests for hunger/health/gold scenarios pass

### Performance Success

- ✅ Planning with numeric constraints completes in < 100ms for simple goals
- ✅ No performance regression in existing component-based planning
- ✅ Heuristic calculation overhead < 5ms per goal

### Quality Success

- ✅ All ESLint checks pass
- ✅ TypeScript type checking passes
- ✅ No new warnings in test output
- ✅ Documentation complete and accurate

### User Experience Success

- ✅ Modders can define numeric goals without workarounds
- ✅ Clear error messages for invalid numeric constraints
- ✅ Examples available for common numeric patterns

## 14. Timeline Estimate

### Detailed Breakdown

**Phase 1: Core Infrastructure** (3-5 hours)
- NumericConstraintEvaluator implementation: 2 hours
- Unit tests (20+ cases): 1 hour
- GoalDistanceHeuristic integration: 1 hour
- DI registration and testing: 0.5 hours

**Phase 2: Planner Integration** (4-5 hours)
- GoapPlanner enhancement: 1.5 hours
- PlanningEffectsSimulator improvements: 1 hour
- Integration testing: 1.5 hours
- Bug fixes and edge cases: 1 hour

**Phase 3: Documentation & Polish** (2-3 hours)
- Numeric constraints guide: 1 hour
- Spec updates: 0.5 hours
- JSDoc comments: 0.5 hours
- Code review and cleanup: 1 hour

**Total Estimate**: 9-13 hours

### Dependencies

- No blocking dependencies
- Can be implemented incrementally
- Each phase builds on previous phase
- Testing can proceed in parallel with documentation

## 15. Open Questions & Risks

### Open Questions

1. **Complex Numeric Constraints**:
   - How to handle constraints with multiple variables? (e.g., `{ '>': [{ var: 'x' }, { var: 'y' }] }`)
   - Current approach: Only support variable-to-constant comparisons
   - Future: May need to expand to variable-to-variable

2. **Floating Point Precision**:
   - Should we use epsilon comparisons for equality?
   - Current approach: Exact numeric comparison
   - Risk: Floating point rounding errors

3. **Composite Goals**:
   - How to prioritize when goal has both component and numeric requirements?
   - Current approach: Sum distances (both must be satisfied)
   - Alternative: Weighted combination

4. **Negative Effects**:
   - What if action increases distance to goal? (e.g., eating increases hunger temporarily)
   - Current approach: Action not considered applicable
   - Alternative: Allow if eventual net reduction

### Risks

**Risk 1: Performance Impact**
- **Severity**: Medium
- **Probability**: Low
- **Mitigation**: Benchmark during Phase 2, optimize if needed
- **Fallback**: Add flag to disable numeric constraint evaluation

**Risk 2: Complex Goal Expressions**
- **Severity**: Medium
- **Probability**: Medium
- **Mitigation**: Start with simple comparisons, document limitations
- **Fallback**: Return null distance for unsupported patterns

**Risk 3: Integration Complexity**
- **Severity**: High
- **Probability**: Low
- **Mitigation**: Comprehensive unit testing before integration
- **Fallback**: Feature flag to enable/disable per goal

**Risk 4: Backward Compatibility**
- **Severity**: High
- **Probability**: Very Low
- **Mitigation**: Ensure existing tests pass, no breaking changes
- **Fallback**: None needed (additive enhancement)

### Assumptions

1. Numeric constraints use JSON Logic comparison operators (>, <, >=, <=, ==)
2. MODIFY_COMPONENT operations work on numeric fields only
3. Goal state is a single numeric constraint (not complex expressions)
4. Planning preconditions can reference numeric fields
5. JsonLogicEvaluationService correctly evaluates numeric comparisons

---

**Document Status**: Draft Specification
**Last Updated**: 2025-01-16
**Related Files**: 
- `specs/goap-system-specs.md`
- `tests/integration/goap/replanning.integration.test.js`
- `src/goap/planner/planningEffectsSimulator.js`
