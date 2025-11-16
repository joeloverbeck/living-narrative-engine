# MULACTPLAFIX-004: Edge Case Handling for Multi-Action Planning

**Status**: Ready for Implementation
**Priority**: MEDIUM
**Phase**: Phase 2/3 - Robustness
**Estimated Effort**: 5 hours
**Dependencies**: MULACTPLAFIX-001
**Blocks**: None

## Objective

Implement comprehensive edge case handling for multi-action planning scenarios including overshoot detection, equality goal validation, impossibility detection, and wrong-direction task filtering.

## Scope

This ticket covers **four major edge case categories**:

1. **Overshoot Scenarios** (inequality vs equality goals)
2. **Impossible Goals** (wrong direction, insufficient effect)
3. **Goal Type Detection** (equality, inequality, complex logic)
4. **State Validation** (clamping, overflow/underflow)

## Edge Case Categories

### 1. Overshoot Scenarios

#### Case 1A: Inequality Goal with Acceptable Overshoot

**Scenario**:
```javascript
// State: hunger = 15
// Task: eat (-60 hunger)
// Goal: hunger ≤ 10

// After eat: 15 - 60 = -45 → clamped to 0
// Goal check: 0 ≤ 10 → TRUE ✓
```

**Decision**: **ALLOW** overshoot for inequality goals (`≤`, `≥`, `<`, `>`)

**Rationale**: Inequality goals are satisfied by any value in range

#### Case 1B: Equality Goal with Unacceptable Overshoot

**Scenario**:
```javascript
// State: gold = 76
// Task: mine (+25 gold)
// Goal: gold = 100

// After mine: 76 + 25 = 101 ≠ 100 ✗
```

**Decision**: **DETECT** impossibility for equality goals that can't be achieved exactly

**Rationale**: Equality requires exact value, overshoot fails goal

### 2. Impossible Goals

#### Case 2A: Task Effect Wrong Direction

**Scenario**:
```javascript
// State: hunger = 100
// Task: eat_more (+20 hunger) ← WRONG DIRECTION!
// Goal: hunger ≤ 10

// After task: distance INCREASES (100 → 120)
```

**Decision**: Task marked as **non-reusable** by `#isTaskReusable()`

**Detection**: `successorDistance >= currentDistance` in reusability check

#### Case 2B: Task Effect Too Small

**Scenario**:
```javascript
// State: hunger = 100
// Task: nibble (-1 hunger)
// Goal: hunger ≤ 10, maxCost: 50

// Need 90 actions * cost 10 = 900 >> 50
```

**Decision**: Fail planning via **cost limit** (handled by MULACTPLAFIX-003)

**Detection**: Estimated cost exceeds `goal.maxCost`

#### Case 2C: No Applicable Tasks

**Scenario**:
```javascript
// State: hunger = 100
// Tasks: [eat] (requires: inventory contains food)
// Inventory: empty
// Goal: hunger ≤ 10
```

**Decision**: Fail planning with **search exhausted**

**Detection**: No tasks pass structural gates

### 3. Goal Type Detection

Need to distinguish goal types for overshoot handling:

```javascript
// Equality
{ '==': [{ var: 'state.actor.components.core_needs.hunger' }, 10] }

// Inequality
{ '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] }
{ '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] }

// Complex (multiple constraints)
{
  and: [
    { '<=': [{ var: 'hunger' }, 10] },
    { '>=': [{ var: 'health' }, 80] }
  ]
}
```

### 4. State Validation

Already handled by `PlanningEffectsSimulator` ✓:
- Overflow/underflow detection (lines 421-470)
- Value clamping to valid ranges
- Dual-format state sync

## Implementation Details

### Files to Modify

1. **`src/goap/planner/goapPlanner.js`** (overshoot detection)
2. **`src/goap/planner/goalTypeDetector.js`** (NEW - goal type analysis)

### Changes Required

#### 1. Create Goal Type Detector Utility

**File**: `src/goap/planner/goalTypeDetector.js` (NEW)

```javascript
/**
 * Detect the type of goal constraint (equality, inequality, complex).
 *
 * @file goalTypeDetector.js
 */

/**
 * Detect goal type from goal state JSON Logic expression.
 *
 * @param {object} goalState - JSON Logic goal expression
 * @returns {'equality'|'inequality'|'complex'|'unknown'} Goal type
 */
export function detectGoalType(goalState) {
  if (!goalState || typeof goalState !== 'object') {
    return 'unknown';
  }

  // Equality operators
  if (goalState['=='] || goalState['===']) {
    return 'equality';
  }

  // Inequality operators
  if (goalState['<'] || goalState['<='] || goalState['>'] || goalState['>='] || goalState['!=']) {
    return 'inequality';
  }

  // Complex operators (and, or, not)
  if (goalState.and || goalState.or || goalState.not) {
    return 'complex';
  }

  return 'unknown';
}

/**
 * Check if overshoot is allowed for this goal type.
 *
 * @param {object} goalState - JSON Logic goal expression
 * @returns {boolean} True if overshoot allowed
 */
export function allowsOvershoot(goalState) {
  const type = detectGoalType(goalState);

  switch (type) {
    case 'inequality':
      return true;  // ≤, ≥, <, > allow overshoot

    case 'equality':
      return false;  // == requires exact value

    case 'complex':
      // Conservative: disallow overshoot for complex goals
      // Could be enhanced to analyze nested constraints
      return false;

    default:
      return true;  // Default: allow (conservative for planning)
  }
}

/**
 * Extract target value from equality goal (if applicable).
 *
 * @param {object} goalState - JSON Logic goal expression
 * @returns {number|null} Target value or null if not equality goal
 */
export function extractEqualityTarget(goalState) {
  if (goalState['==']) {
    const [left, right] = goalState['=='];
    // Assume right side is constant
    return typeof right === 'number' ? right : null;
  }

  if (goalState['===']) {
    const [left, right] = goalState['==='];
    return typeof right === 'number' ? right : null;
  }

  return null;
}

export default {
  detectGoalType,
  allowsOvershoot,
  extractEqualityTarget
};
```

#### 2. Add Equality Goal Validation (Optional Enhancement)

**File**: `src/goap/planner/goapPlanner.js`

Add method to check if exact value achievable:

```javascript
/**
 * Check if exact equality goal can be achieved with available tasks.
 *
 * @param {object} task - Task to check
 * @param {object} currentState - Current world state
 * @param {object} goal - Equality goal
 * @returns {boolean} True if exact value achievable
 * @private
 */
#canAchieveExactValue(task, currentState, goal) {
  const targetValue = extractEqualityTarget(goal.goalState);

  if (targetValue === null) {
    // Not an equality goal
    return true;
  }

  // Get current value of the field being modified
  // This requires parsing task.planningEffects to find which field is modified
  // and extracting current value from state

  // For now, return true (optimistic)
  // Full implementation would:
  // 1. Parse task effect to get field and modification
  // 2. Extract current value from state
  // 3. Calculate if N applications can reach exact value

  return true;
}
```

**Note**: Full equality validation is **complex** and **optional**. Can be deferred to future ticket.

#### 3. Add Overshoot Logging

In `#isTaskReusable()`, add diagnostic logging:

```javascript
#isTaskReusable(task, currentNode, goal) {
  // ... existing distance reduction check ...

  if (successorDistance >= currentDistance) {
    const goalType = detectGoalType(goal.goalState);

    this.#logger.debug('Task does not reduce distance', {
      taskId: task.id,
      currentDistance,
      successorDistance,
      goalType,
      allowsOvershoot: allowsOvershoot(goal.goalState)
    });

    return false;
  }

  // ... rest of method
}
```

### Testing Requirements

#### Unit Tests

**File**: `tests/unit/goap/planner/goalTypeDetector.test.js` (NEW)

```javascript
import { detectGoalType, allowsOvershoot, extractEqualityTarget } from '../../../../src/goap/planner/goalTypeDetector.js';

describe('goalTypeDetector', () => {
  describe('detectGoalType()', () => {
    it('should detect equality goals', () => {
      const goal = { '==': [{ var: 'hunger' }, 10] };
      expect(detectGoalType(goal)).toBe('equality');
    });

    it('should detect inequality goals', () => {
      const goal = { '<=': [{ var: 'hunger' }, 10] };
      expect(detectGoalType(goal)).toBe('inequality');
    });

    it('should detect complex goals', () => {
      const goal = {
        and: [
          { '<=': [{ var: 'hunger' }, 10] },
          { '>=': [{ var: 'health' }, 80] }
        ]
      };
      expect(detectGoalType(goal)).toBe('complex');
    });

    it('should return unknown for invalid input', () => {
      expect(detectGoalType(null)).toBe('unknown');
      expect(detectGoalType({})).toBe('unknown');
    });
  });

  describe('allowsOvershoot()', () => {
    it('should allow overshoot for inequality goals', () => {
      expect(allowsOvershoot({ '<=': [{ var: 'x' }, 10] })).toBe(true);
      expect(allowsOvershoot({ '>=': [{ var: 'x' }, 10] })).toBe(true);
    });

    it('should not allow overshoot for equality goals', () => {
      expect(allowsOvershoot({ '==': [{ var: 'x' }, 10] })).toBe(false);
    });

    it('should not allow overshoot for complex goals', () => {
      const goal = { and: [{ '<=': [{ var: 'x' }, 10] }] };
      expect(allowsOvershoot(goal)).toBe(false);
    });
  });

  describe('extractEqualityTarget()', () => {
    it('should extract target value from equality goal', () => {
      const goal = { '==': [{ var: 'hunger' }, 10] };
      expect(extractEqualityTarget(goal)).toBe(10);
    });

    it('should return null for inequality goals', () => {
      const goal = { '<=': [{ var: 'hunger' }, 10] };
      expect(extractEqualityTarget(goal)).toBe(null);
    });
  });
});
```

#### Integration Tests

**File**: `tests/integration/goap/edgeCases.integration.test.js` (NEW)

```javascript
describe('GOAP Edge Cases', () => {
  describe('Overshoot handling', () => {
    it('should allow overshoot for inequality goals', async () => {
      // hunger: 15, task: -60, goal: ≤ 10
      // After: -45 → 0 (satisfies ≤ 10)
      // Expected: Plan with 1 action
    });

    it('should handle exact equality goals', async () => {
      // gold: 75, task: +25, goal: = 100
      // After: 100 (exact)
      // Expected: Plan with 1 action
    });
  });

  describe('Impossible goals', () => {
    it('should detect wrong direction tasks', async () => {
      // hunger: 100, task: +20, goal: ≤ 10
      // Task increases hunger (wrong direction)
      // Expected: PLANNING_FAILED
    });

    it('should detect insufficient task effect', async () => {
      // hunger: 100, task: -1, goal: ≤ 0, maxCost: 50
      // Need 100 actions * cost 10 = 1000 > 50
      // Expected: PLANNING_FAILED (cost_limit_exceeded)
    });

    it('should handle no applicable tasks', async () => {
      // No tasks pass structural gates
      // Expected: PLANNING_FAILED (search_exhausted)
    });
  });

  describe('Complex goals', () => {
    it('should handle multiple numeric constraints', async () => {
      // Goal: hunger ≤ 10 AND health ≥ 80
      // Tasks: eat (-60 hunger), heal (+30 health)
      // Expected: Plan with 2 eat + 3 heal
    });
  });
});
```

### Acceptance Criteria

- [ ] `goalTypeDetector.js` utility created with 3 exported functions
- [ ] `detectGoalType()` correctly identifies equality, inequality, complex goals
- [ ] `allowsOvershoot()` returns correct boolean for each goal type
- [ ] `extractEqualityTarget()` extracts numeric target from equality goals
- [ ] Overshoot logging added to `#isTaskReusable()`
- [ ] All unit tests pass with 80%+ coverage
- [ ] Integration tests verify edge case handling
- [ ] Code passes ESLint validation
- [ ] JSDoc comments for all functions

### Edge Cases to Handle

1. **Null/Undefined Goals**: Return 'unknown', allow overshoot
2. **Empty Goal State**: Return 'unknown', allow overshoot
3. **Nested Operators**: Complex goals may have nested equality/inequality
4. **Multiple Operators**: Goal with both == and <= (malformed, treat as complex)
5. **Non-Numeric Targets**: Equality with string/boolean targets (out of scope)

### Code Quality Checklist

- [ ] Pure functions (no side effects)
- [ ] Comprehensive input validation
- [ ] Clear JSDoc with examples
- [ ] Unit tests for all edge cases
- [ ] Performance: O(1) for simple goals, O(n) for complex nested goals
- [ ] No dependencies (standalone utility module)

## Related Files

**Creates**:
- `src/goap/planner/goalTypeDetector.js` (NEW)

**Modifies**:
- `src/goap/planner/goapPlanner.js` (optional logging)

**Tests**:
- `tests/unit/goap/planner/goalTypeDetector.test.js` (NEW)
- `tests/integration/goap/edgeCases.integration.test.js` (NEW)

## Notes

- **Goal type detection** is primarily diagnostic at this stage
- **Equality validation** is optional and can be deferred
- **Wrong direction** already handled by distance reduction check in MULACTPLAFIX-001
- **Overshoot** is naturally handled by goal satisfaction check
- This ticket adds **visibility and diagnostics**, not critical functionality

## Future Enhancements

1. **Exact Value Planning**: Smart planning for equality goals to avoid overshoot
2. **Partial Effect Support**: Tasks with variable effects based on state
3. **Multi-Field Coordination**: Planning for goals affecting multiple fields simultaneously
4. **Negative Effect Detection**: Warn when task moves away from goal

## Success Metrics

1. **Diagnostic Coverage**: 100% of edge cases logged with clear messages
2. **Test Coverage**: 90%+ coverage for goalTypeDetector utility
3. **User Experience**: Clear error messages for impossible goals
4. **Robustness**: No crashes on malformed or edge-case goals
