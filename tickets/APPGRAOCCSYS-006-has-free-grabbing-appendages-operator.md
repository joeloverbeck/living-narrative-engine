# APPGRAOCCSYS-006: Create hasFreeGrabbingAppendages JSON Logic Operator

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create the `hasFreeGrabbingAppendages` custom JSON Logic operator that checks if an actor has at least N free grabbing appendages. This operator is used in action prerequisites to validate that an actor can grab/wield items before presenting the action as available.

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema)
- APPGRAOCCSYS-003 (grabbingUtils utility functions)

## Files to Create

| File | Purpose |
|------|---------|
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` | Operator implementation |
| `tests/unit/logic/operators/hasFreeGrabbingAppendagesOperator.test.js` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/logic/jsonLogicCustomOperators.js` | Import and register the new operator |

## Out of Scope

- DO NOT create operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT modify any entity files
- DO NOT modify any action files
- DO NOT create conditions (handled in APPGRAOCCSYS-009)
- DO NOT create utility functions (handled in APPGRAOCCSYS-003)

## Implementation Details

### Operator Implementation (`src/logic/operators/hasFreeGrabbingAppendagesOperator.js`)

```javascript
/**
 * @module HasFreeGrabbingAppendagesOperator
 * @description Operator that checks if an entity has at least N free grabbing appendages
 */

import { BaseOperator } from './base/BaseOperator.js';
import { countFreeGrabbingAppendages } from '../../utils/grabbingUtils.js';

/**
 * @class HasFreeGrabbingAppendagesOperator
 * @augments BaseOperator
 * @description Checks if an entity has at least N free (unlocked) grabbing appendages
 * Usage: {"hasFreeGrabbingAppendages": ["actor", 2]}
 */
export class HasFreeGrabbingAppendagesOperator extends BaseOperator {
  /** @private @type {import('../../interfaces/IEntityManager.js').IEntityManager} */
  #entityManager;
  /** @private @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    super('hasFreeGrabbingAppendages');
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Evaluates whether the entity has at least N free grabbing appendages
   *
   * @param {Array} params - [entityPath, requiredCount]
   * @param {object} context - JSON Logic evaluation context
   * @returns {boolean} True if entity has at least requiredCount free grabbing appendages
   */
  evaluate(params, context) {
    const [entityPath, requiredCount = 1] = params;

    // Resolve entity ID from path
    const entityId = this.resolveEntityPath(entityPath, context);
    if (!entityId) {
      this.#logger.warn(`hasFreeGrabbingAppendages: Could not resolve entity path '${entityPath}'`);
      return false;
    }

    const freeCount = countFreeGrabbingAppendages(this.#entityManager, entityId);

    this.#logger.debug(
      `hasFreeGrabbingAppendages(${entityId}, ${requiredCount}): free=${freeCount}, result=${freeCount >= requiredCount}`
    );

    return freeCount >= requiredCount;
  }
}
```

### Registration in jsonLogicCustomOperators.js

Add import at the top of the file:
```javascript
import { HasFreeGrabbingAppendagesOperator } from './operators/hasFreeGrabbingAppendagesOperator.js';
```

In the `registerOperators` method, add operator instantiation:
```javascript
const hasFreeGrabbingAppendagesOp = new HasFreeGrabbingAppendagesOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});
```

Add operator registration:
```javascript
// Register hasFreeGrabbingAppendages operator
this.#registerOperator(
  'hasFreeGrabbingAppendages',
  function (entityPath, requiredCount) {
    // 'this' is the evaluation context
    return hasFreeGrabbingAppendagesOp.evaluate([entityPath, requiredCount], this);
  },
  jsonLogicEvaluationService
);
```

### Usage Example

```json
{
  "hasFreeGrabbingAppendages": ["actor", 2]
}
```

This checks if the actor has at least 2 free grabbing appendages.

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests**: `tests/unit/logic/operators/hasFreeGrabbingAppendagesOperator.test.js`
   - [ ] Returns true when entity has enough free grabbing appendages
   - [ ] Returns false when entity has insufficient free grabbing appendages
   - [ ] Returns false when entity has no grabbing appendages
   - [ ] Returns false when entity cannot be resolved
   - [ ] Defaults requiredCount to 1 when not provided
   - [ ] Handles locked vs unlocked appendages correctly
   - [ ] Logs debug messages for evaluation results

2. **Integration Tests** (verify registration):
   - [ ] `npm run test:ci` passes
   - [ ] Operator is accessible via JSON Logic evaluation

3. **Existing Tests**: `npm run test:unit` should pass

### Invariants That Must Remain True

1. Extends `BaseOperator` pattern used by other operators
2. Uses `countFreeGrabbingAppendages` from grabbingUtils (does not duplicate logic)
3. Follows entity path resolution pattern from existing operators
4. Is registered in `jsonLogicCustomOperators.js`
5. Does not modify entity state - read-only evaluation
6. Handles missing entities gracefully (returns false)

## Test File Template

```javascript
// tests/unit/logic/operators/hasFreeGrabbingAppendagesOperator.test.js
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HasFreeGrabbingAppendagesOperator } from '../../../../src/logic/operators/hasFreeGrabbingAppendagesOperator.js';

// Mock the grabbingUtils module
jest.unstable_mockModule('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn()
}));

describe('HasFreeGrabbingAppendagesOperator', () => {
  let operator;
  let mockLogger;
  let mockEntityManager;
  let mockCountFreeGrabbingAppendages;

  beforeEach(async () => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    mockEntityManager = {
      getComponentData: jest.fn()
    };

    // Get the mock function
    const grabbingUtils = await import('../../../../src/utils/grabbingUtils.js');
    mockCountFreeGrabbingAppendages = grabbingUtils.countFreeGrabbingAppendages;
    mockCountFreeGrabbingAppendages.mockReset();

    operator = new HasFreeGrabbingAppendagesOperator({
      entityManager: mockEntityManager,
      logger: mockLogger
    });
  });

  describe('evaluate', () => {
    it('should return true when entity has enough free appendages', () => {
      mockCountFreeGrabbingAppendages.mockReturnValue(2);
      const context = { actor: 'actor_1' };

      const result = operator.evaluate(['actor', 2], context);

      expect(result).toBe(true);
      expect(mockCountFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should return false when entity has insufficient free appendages', () => {
      mockCountFreeGrabbingAppendages.mockReturnValue(1);
      const context = { actor: 'actor_1' };

      const result = operator.evaluate(['actor', 2], context);

      expect(result).toBe(false);
    });

    it('should default requiredCount to 1 when not provided', () => {
      mockCountFreeGrabbingAppendages.mockReturnValue(1);
      const context = { actor: 'actor_1' };

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });

    it('should return false when entity cannot be resolved', () => {
      const context = {};  // No actor in context

      const result = operator.evaluate(['actor', 1], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when entity has zero free appendages', () => {
      mockCountFreeGrabbingAppendages.mockReturnValue(0);
      const context = { actor: 'actor_1' };

      const result = operator.evaluate(['actor', 1], context);

      expect(result).toBe(false);
    });
  });
});
```

## Verification Commands

```bash
# Run operator tests
npm run test:unit -- tests/unit/logic/operators/hasFreeGrabbingAppendagesOperator.test.js

# Check integration
npm run test:ci

# Type check
npm run typecheck

# Lint modified files
npx eslint src/logic/operators/hasFreeGrabbingAppendagesOperator.js src/logic/jsonLogicCustomOperators.js
```
