# HUNMETSYS-011: JSON Logic Operators - Hunger Detection

**Status:** Not Started  
**Phase:** 3 - GOAP Integration  
**Priority:** High  
**Estimated Effort:** 4 hours  
**Dependencies:** HUNMETSYS-002 (Hunger State component)

## Objective

Implement `is_hungry` JSON Logic custom operator to detect hunger states for GOAP goal preconditions and action prerequisites.

## Context

GOAP goals and action prerequisites need to check if an entity is hungry to decide when to seek food. The `is_hungry` operator provides a clean abstraction over the underlying hunger_state component, returning a simple boolean based on state thresholds.

**Key Behavior:**
- Returns `true` if state is "hungry", "starving", or "critical"
- Returns `false` if state is "satiated", "neutral", or "gluttonous"
- Returns `false` if entity missing hunger_state component

## Files to Touch

### New Files (2)
1. **`src/logic/operators/isHungryOperator.js`**
   - Implement IsHungryOperator class
   - Check hunger_state.state field
   - Return boolean

2. **`tests/unit/logic/operators/isHungryOperator.test.js`**
   - Test all hunger states
   - Test missing component
   - Test entity resolution

### Modified Files (1)
1. **`src/logic/jsonLogicCustomOperators.js`**
   - Import and register IsHungryOperator
   - Add to operator registry

## Implementation Details

### isHungryOperator.js
```javascript
/**
 * @file JSON Logic operator that checks if entity is hungry
 */

import { resolveEntityReference } from '../utils/entityReferenceResolver.js';
import { assertPresent } from '../../utils/dependencyUtils.js';

/**
 * Custom operator: is_hungry
 * Returns true if entity's hunger_state is "hungry", "starving", or "critical"
 *
 * @example
 * { "is_hungry": ["actor"] }
 * { "is_hungry": ["{event.payload.entityId}"] }
 */
export class IsHungryOperator {
  #entityManager;
  #logger;
  #operatorName = 'is_hungry';

  /**
   * @param {Object} params
   * @param {Object} params.entityManager - Entity manager service
   * @param {Object} params.logger - Logger service
   */
  constructor({ entityManager, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(logger, 'logger is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Get operator name
   * @returns {string} Operator name
   */
  get name() {
    return this.#operatorName;
  }

  /**
   * Evaluate is_hungry operator
   *
   * @param {Array} params - [entityRef]
   * @param {Object} context - Evaluation context
   * @returns {boolean} True if entity is hungry/starving/critical
   */
  evaluate(params, context) {
    // Validate params
    if (!Array.isArray(params) || params.length !== 1) {
      this.#logger.error(`is_hungry requires exactly 1 parameter, got ${params?.length || 0}`);
      return false;
    }

    try {
      // Resolve entity reference
      const entityId = resolveEntityReference(params[0], context);

      // Get hunger_state component
      const hungerState = this.#entityManager.getComponent(
        entityId,
        'metabolism:hunger_state'
      );

      // If no hunger state component, entity is not hungry
      if (!hungerState) {
        this.#logger.debug(
          `Entity ${entityId} missing metabolism:hunger_state component, returning false`
        );
        return false;
      }

      // Check if state indicates hunger
      const hungryStates = ['hungry', 'starving', 'critical'];
      const isHungry = hungryStates.includes(hungerState.state);

      this.#logger.debug(
        `Entity ${entityId} hunger check: state=${hungerState.state}, isHungry=${isHungry}`
      );

      return isHungry;
    } catch (err) {
      this.#logger.error(`Error evaluating is_hungry operator:`, err);
      return false;
    }
  }
}
```

### isHungryOperator.test.js
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IsHungryOperator } from '../../../../src/logic/operators/isHungryOperator.js';
import { createTestBed } from '../../../common/testBed.js';

describe('IsHungryOperator', () => {
  let testBed;
  let operator;

  beforeEach(() => {
    testBed = createTestBed();
    operator = new IsHungryOperator({
      entityManager: testBed.entityManager,
      logger: testBed.logger
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Hungry States', () => {
    it('should return true for hungry state', () => {
      // Arrange
      const entityId = 'actor_1';
      testBed.entityManager.addComponent(entityId, 'metabolism:hunger_state', {
        state: 'hungry',
        energy_percentage: 25
      });

      // Act
      const result = operator.evaluate([entityId], testBed.context);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for starving state', () => {
      // Arrange
      const entityId = 'actor_1';
      testBed.entityManager.addComponent(entityId, 'metabolism:hunger_state', {
        state: 'starving',
        energy_percentage: 5
      });

      // Act
      const result = operator.evaluate([entityId], testBed.context);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for critical state', () => {
      // Arrange
      const entityId = 'actor_1';
      testBed.entityManager.addComponent(entityId, 'metabolism:hunger_state', {
        state: 'critical',
        energy_percentage: 0
      });

      // Act
      const result = operator.evaluate([entityId], testBed.context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Non-Hungry States', () => {
    it('should return false for satiated state', () => {
      // Arrange
      const entityId = 'actor_1';
      testBed.entityManager.addComponent(entityId, 'metabolism:hunger_state', {
        state: 'satiated',
        energy_percentage: 90
      });

      // Act
      const result = operator.evaluate([entityId], testBed.context);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for neutral state', () => {
      // Arrange
      const entityId = 'actor_1';
      testBed.entityManager.addComponent(entityId, 'metabolism:hunger_state', {
        state: 'neutral',
        energy_percentage: 50
      });

      // Act
      const result = operator.evaluate([entityId], testBed.context);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for gluttonous state', () => {
      // Arrange
      const entityId = 'actor_1';
      testBed.entityManager.addComponent(entityId, 'metabolism:hunger_state', {
        state: 'gluttonous',
        energy_percentage: 120
      });

      // Act
      const result = operator.evaluate([entityId], testBed.context);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Missing Component', () => {
    it('should return false when entity missing hunger_state', () => {
      // Arrange
      const entityId = 'actor_1';
      // No component added

      // Act
      const result = operator.evaluate([entityId], testBed.context);

      // Assert
      expect(result).toBe(false);
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('missing metabolism:hunger_state')
      );
    });
  });

  describe('Entity Reference Resolution', () => {
    it('should resolve entity reference from context', () => {
      // Arrange
      const entityId = 'actor_1';
      testBed.entityManager.addComponent(entityId, 'metabolism:hunger_state', {
        state: 'hungry',
        energy_percentage: 20
      });

      testBed.context.event = {
        payload: { entityId }
      };

      // Act
      const result = operator.evaluate(['{event.payload.entityId}'], testBed.context);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle "self" reference', () => {
      // Arrange
      const entityId = 'actor_1';
      testBed.entityManager.addComponent(entityId, 'metabolism:hunger_state', {
        state: 'starving',
        energy_percentage: 8
      });

      testBed.context.self = entityId;

      // Act
      const result = operator.evaluate(['self'], testBed.context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return false for invalid parameter count', () => {
      // Act
      const result = operator.evaluate([], testBed.context);

      // Assert
      expect(result).toBe(false);
      expect(testBed.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('requires exactly 1 parameter')
      );
    });

    it('should return false when entity resolution fails', () => {
      // Act
      const result = operator.evaluate(['{invalid.reference}'], testBed.context);

      // Assert
      expect(result).toBe(false);
      expect(testBed.logger.error).toHaveBeenCalled();
    });
  });

  describe('Operator Properties', () => {
    it('should have correct operator name', () => {
      expect(operator.name).toBe('is_hungry');
    });
  });
});
```

### Registration in jsonLogicCustomOperators.js
```javascript
// Add import
import { IsHungryOperator } from './operators/isHungryOperator.js';

// In register function
export function registerCustomOperators({ entityManager, logger, ... }) {
  // ... existing operators ...

  // Hunger detection operator
  const isHungryOperator = new IsHungryOperator({ entityManager, logger });
  jsonLogic.add_operation(isHungryOperator.name, (params, context) =>
    isHungryOperator.evaluate(params, context)
  );

  // ... rest of registration ...
}
```

## Out of Scope

**Not Included:**
- ❌ Threshold calculation (handled in UPDATE_HUNGER_STATE)
- ❌ Energy percentage calculation (not needed for this operator)
- ❌ State effects application (handled by other systems)
- ❌ GOAP goal implementation (HUNMETSYS-013)
- ❌ Predicted energy logic (HUNMETSYS-012)

**Future Extensions:**
- Hunger severity levels (very hungry, moderately hungry)
- Configurable state thresholds
- Time-since-last-meal tracking

## Acceptance Criteria

**Must Have:**
- ✅ IsHungryOperator class implemented
- ✅ Returns true for hungry/starving/critical states
- ✅ Returns false for satiated/neutral/gluttonous states
- ✅ Returns false for missing hunger_state component
- ✅ Handles entity reference resolution
- ✅ Handles "self" reference
- ✅ Registered in jsonLogicCustomOperators.js
- ✅ All unit tests pass with 90%+ coverage
- ✅ Error handling for invalid params
- ✅ Error handling for resolution failures

**Nice to Have:**
- Consider: Hunger severity levels (return number instead of boolean)
- Consider: Configurable threshold states

## Testing Strategy

### Unit Tests
```bash
npm run test:unit tests/unit/logic/operators/isHungryOperator.test.js
```

### Coverage Target
- **Branches:** 90%+
- **Functions:** 100%
- **Lines:** 90%+

### Manual Validation
1. **Integration Test (Manual):**
   - Create entity with hungry state
   - Evaluate `{ "is_hungry": ["entity_id"] }`
   - Verify returns true

2. **GOAP Integration (Future):**
   - Create goal with is_hungry precondition
   - Verify goal activates when hungry
   - Verify goal doesn't activate when satiated

## Invariants

**Operator Contract:**
1. Always returns boolean (never throws)
2. Handles missing components gracefully (returns false)
3. Logs errors but doesn't throw
4. Accepts exactly 1 parameter (entity reference)

**State Mapping:**
```
hungry → true
starving → true
critical → true
satiated → false
neutral → false
gluttonous → false
(missing component) → false
```

**Entity Resolution:**
- Direct ID: "actor_123"
- Self reference: "self"
- Template reference: "{event.payload.entityId}"
- Actor reference: "actor" (via context)
- Target reference: "target" (via context)

## Edge Cases

1. **Missing hunger_state Component:**
   - Returns false (entity not metabolic)
   - Logs debug message
   - Doesn't throw error

2. **Invalid hunger_state Value:**
   - Unlikely (schema-validated)
   - Would return false (not in hungry states array)

3. **Null/Undefined Entity Reference:**
   - Caught by resolveEntityReference
   - Returns false, logs error

4. **Context Missing Required Fields:**
   - resolveEntityReference handles gracefully
   - Returns false, logs error

## References

- **Spec:** Section "GOAP Integration" (p. 21-23)
- **Spec:** Section "Custom JSON Logic Operators" (p. 21)
- **Previous:** HUNMETSYS-002 (Hunger State component)
- **Next:** HUNMETSYS-012 (Predicted energy operators)

## Notes

**Design Decision:**
- Simple boolean return (not severity levels) keeps GOAP logic clean
- If severity needed, can create separate operator later
- Hunger states are schema-validated, so enum values guaranteed

**GOAP Usage:**
```json
{
  "preconditions": {
    "is_hungry": ["self"]
  }
}
```

**Condition Usage:**
```json
{
  "logic": {
    "is_hungry": ["{event.payload.actorId}"]
  }
}
```
