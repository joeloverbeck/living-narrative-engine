# APPGRAOCCSYS-006: Create hasFreeGrabbingAppendages JSON Logic Operator

**Status**: ✅ COMPLETED

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
| `src/logic/jsonLogicEvaluationService.js` | Add `hasFreeGrabbingAppendages` to `#allowedOperations` whitelist |

## Out of Scope

- DO NOT create operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT modify any entity files
- DO NOT modify any action files
- DO NOT create conditions (handled in APPGRAOCCSYS-009)
- DO NOT create utility functions (handled in APPGRAOCCSYS-003)

## Implementation Details

### Operator Implementation (`src/logic/operators/hasFreeGrabbingAppendagesOperator.js`)

**Note**: This operator follows the pattern established by `IsHungryOperator` and `HasComponentOperator`.
It does NOT extend a base class (there is no `BaseOperator`). Instead, it uses:
- `resolveEntityPath` and `hasValidEntityId` from `../utils/entityPathResolver.js`
- `jsonLogic` from `json-logic-js` for evaluating JSON Logic expressions in entityPath
- `countFreeGrabbingAppendages` from `../../utils/grabbingUtils.js`

```javascript
/**
 * @file JSON Logic operator that checks if entity has free grabbing appendages
 * @module HasFreeGrabbingAppendagesOperator
 * @description Checks if an entity has at least N free (unlocked) grabbing appendages
 */

import { resolveEntityPath, hasValidEntityId } from '../utils/entityPathResolver.js';
import jsonLogic from 'json-logic-js';
import { countFreeGrabbingAppendages } from '../../utils/grabbingUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class HasFreeGrabbingAppendagesOperator
 * @description Checks if an entity has at least N free grabbing appendages
 *
 * Usage: {"hasFreeGrabbingAppendages": ["actor", 2]}
 * Usage: {"hasFreeGrabbingAppendages": [{"var": "entity.id"}, 1]}
 * Returns: true if the entity has at least requiredCount free grabbing appendages
 */
export class HasFreeGrabbingAppendagesOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'hasFreeGrabbingAppendages';

  /**
   * Creates a new HasFreeGrabbingAppendagesOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error('HasFreeGrabbingAppendagesOperator: Missing required dependencies');
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters [entityPath, requiredCount]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if the entity has at least requiredCount free grabbing appendages
   */
  evaluate(params, context) {
    // Implementation follows IsHungryOperator pattern for entity resolution
    // See full implementation in created file
  }
}
```

### Registration in jsonLogicCustomOperators.js

Add import at the top of the file (with other operator imports):
```javascript
import { HasFreeGrabbingAppendagesOperator } from './operators/hasFreeGrabbingAppendagesOperator.js';
```

In the `registerOperators` method, add operator instantiation (with other operator instantiations):
```javascript
const hasFreeGrabbingAppendagesOp = new HasFreeGrabbingAppendagesOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});
```

Add operator registration (with other registrations):
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

### Whitelist in jsonLogicEvaluationService.js

Add the operator name to the `#allowedOperations` Set in the constructor:
```javascript
// In the #allowedOperations initialization, add:
'hasFreeGrabbingAppendages',
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

1. Follows the standalone class pattern used by `IsHungryOperator`, `HasComponentOperator` (no base class)
2. Uses `countFreeGrabbingAppendages` from grabbingUtils (does not duplicate logic)
3. Uses `resolveEntityPath` and `hasValidEntityId` from `../utils/entityPathResolver.js` for entity resolution
4. Is registered in `jsonLogicCustomOperators.js`
5. Is whitelisted in `jsonLogicEvaluationService.js` `#allowedOperations` Set
6. Does not modify entity state - read-only evaluation
7. Handles missing entities gracefully (returns false)

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

---

## Outcome

### Implementation Summary

**Completed Date**: 2025-01-25

#### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` | 225 | Full operator implementation following `IsHungryOperator` pattern |
| `tests/unit/logic/operators/hasFreeGrabbingAppendagesOperator.test.js` | 448 | Comprehensive unit tests (36 test cases) |

#### Files Modified
| File | Change |
|------|--------|
| `src/logic/jsonLogicCustomOperators.js` | Added import, instantiation, and registration |
| `src/logic/jsonLogicEvaluationService.js` | Added `'hasFreeGrabbingAppendages'` to whitelist |
| `tests/unit/logic/jsonLogicOperatorRegistration.test.js` | Updated expected operator count (16→17) and added to expected operators list |
| `tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js` | Added `'hasFreeGrabbingAppendages'` to expected operators list |

### Ticket Corrections Made

Original ticket assumptions that were corrected before implementation:

1. **No `BaseOperator` class**: The ticket originally implied operators extend a base class. Corrected to note operators are standalone classes using utility imports.
2. **Missing whitelist entry**: Added `jsonLogicEvaluationService.js` to "Files to Modify" section for the whitelist update.
3. **Entity resolution pattern**: Clarified that operators use `resolveEntityPath` and `hasValidEntityId` from `../utils/entityPathResolver.js`, not from a base class.

### Test Results

- **Unit tests**: 36/36 passing
- **Logic tests**: 2502/2502 passing
- **ESLint**: 0 errors (warnings are pre-existing in unrelated code)

### Test Coverage Details

The test suite covers:

| Category | Tests | Description |
|----------|-------|-------------|
| Constructor | 4 | Dependency validation |
| Sufficient Appendages | 3 | Return true when entity has enough |
| Insufficient Appendages | 3 | Return false when entity has fewer |
| Default RequiredCount | 3 | Defaults to 1, handles non-numeric |
| Entity Resolution | 6 | Context paths, self, objects, nested paths |
| Error Handling | 9 | Invalid params, null, undefined, empty strings |
| Edge Cases | 4 | Zero count, large count, fractional, negative |
| Logging | 2 | Debug messages for success/failure |
| Integration Patterns | 2 | Typical action context patterns |

### Invariants Verified

- [x] Follows standalone class pattern (no base class)
- [x] Uses `countFreeGrabbingAppendages` from grabbingUtils
- [x] Uses `resolveEntityPath` and `hasValidEntityId` from entityPathResolver
- [x] Registered in `jsonLogicCustomOperators.js`
- [x] Whitelisted in `jsonLogicEvaluationService.js`
- [x] Read-only evaluation (no entity state modifications)
- [x] Handles missing entities gracefully (returns false)
