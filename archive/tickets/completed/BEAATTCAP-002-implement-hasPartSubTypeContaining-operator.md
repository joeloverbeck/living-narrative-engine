# BEAATTCAP-002: Implement HasPartSubTypeContaining JSON Logic Operator

**Status**: ✅ COMPLETED

## Summary

Create a new JSON Logic operator `hasPartSubTypeContaining` that checks if an entity has any body part whose `subType` contains a specified substring. This enables matching multiple beak types ("beak", "chicken_beak", "tortoise_beak") with a single condition.

## Motivation

Existing operators (`hasPartOfType`, `hasPartWithComponentValue`) use strict equality matching. To support the peck action for all beak types, we need substring matching on the `subType` field.

## Files to Touch

| File                                                                  | Change Type                          |
| --------------------------------------------------------------------- | ------------------------------------ |
| `src/logic/operators/hasPartSubTypeContainingOperator.js`             | **Create**                           |
| `src/logic/jsonLogicCustomOperators.js`                               | Modify - add import and registration |
| `tests/unit/logic/operators/hasPartSubTypeContainingOperator.test.js` | **Create**                           |

## Out of Scope

- **DO NOT** modify existing operator classes
- **DO NOT** modify `BaseBodyPartOperator.js`
- **DO NOT** change DI token files (operator is registered via `jsonLogicCustomOperators.js` pattern)
- **DO NOT** add schema changes
- **DO NOT** modify other registration files

## Implementation Details

### 1. Create Operator Class

**File**: `src/logic/operators/hasPartSubTypeContainingOperator.js`

```javascript
/**
 * @module HasPartSubTypeContainingOperator
 * @description Operator that checks if an entity has any body parts with subType containing a substring
 */

import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';

/**
 * @class HasPartSubTypeContainingOperator
 * @augments BaseBodyPartOperator
 * @description Checks if an entity has any body parts with subType containing a substring
 * Usage: {"hasPartSubTypeContaining": ["actor", "beak"]}
 */
export class HasPartSubTypeContainingOperator extends BaseBodyPartOperator {
  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {import('../../anatomy/bodyGraphService.js').BodyGraphService} dependencies.bodyGraphService
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor(dependencies) {
    super(dependencies, 'hasPartSubTypeContaining');
  }

  /**
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {string} rootId - The root ID from body component
   * @param {Array} params - [substring] where substring is the text to search for in subType
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The body component
   * @returns {boolean} True if entity has at least one part with subType containing the substring
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    const [substring] = params;

    if (!substring || typeof substring !== 'string') {
      this.logger.warn(`hasPartSubTypeContaining: Invalid substring parameter`);
      return false;
    }

    const lowerSubstring = substring.toLowerCase();

    this.logger.debug(
      `hasPartSubTypeContaining called with entityPath='${context._currentPath || 'unknown'}', substring='${substring}'`
    );

    // Build the cache for this anatomy if not already built
    this.bodyGraphService.buildAdjacencyCache(rootId);

    // Get all body parts and check subType
    const allParts = this.bodyGraphService.getAllParts(rootId);

    const matchingParts = allParts.filter((part) => {
      const subType = part.subType;
      return (
        subType &&
        typeof subType === 'string' &&
        subType.toLowerCase().includes(lowerSubstring)
      );
    });

    this.logger.debug(
      `hasPartSubTypeContaining(${entityId}, ${substring}) = ${matchingParts.length > 0} ` +
        `(found ${matchingParts.length} parts)`
    );

    return matchingParts.length > 0;
  }
}
```

### 2. Register Operator

**File**: `src/logic/jsonLogicCustomOperators.js`

Add import at top of file (after line 24):

```javascript
import { HasPartSubTypeContainingOperator } from './operators/hasPartSubTypeContainingOperator.js';
```

Add operator instantiation (around line 125, after `hasPartOfTypeWithComponentValueOp`):

```javascript
const hasPartSubTypeContainingOp = new HasPartSubTypeContainingOperator({
  entityManager: this.#entityManager,
  bodyGraphService: this.#bodyGraphService,
  logger: this.#logger,
});
```

Add operator registration (around line 295, after `hasPartOfTypeWithComponentValue` registration):

```javascript
// Register hasPartSubTypeContaining operator
this.#registerOperator(
  'hasPartSubTypeContaining',
  function (entityPath, substring) {
    // 'this' is the evaluation context
    return hasPartSubTypeContainingOp.evaluate([entityPath, substring], this);
  },
  jsonLogicEvaluationService
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests**: Create `tests/unit/logic/operators/hasPartSubTypeContainingOperator.test.js`

```javascript
describe('HasPartSubTypeContainingOperator', () => {
  describe('execute', () => {
    it('should return true when body part subType contains substring exactly', () => {
      // subType: 'beak', substring: 'beak' → true
    });

    it('should return true when body part subType contains substring as part of larger string', () => {
      // subType: 'chicken_beak', substring: 'beak' → true
    });

    it('should return true for tortoise_beak with substring beak', () => {
      // subType: 'tortoise_beak', substring: 'beak' → true
    });

    it('should return false when no body parts contain substring', () => {
      // subType: 'arm', substring: 'beak' → false
    });

    it('should return false when entity has no body parts', () => {
      // empty body parts array → false
    });

    it('should be case-insensitive', () => {
      // subType: 'CHICKEN_BEAK', substring: 'beak' → true
    });

    it('should return false for missing entityPath', () => {
      // null entityPath → false with warning
    });

    it('should return false for missing substring', () => {
      // null substring → false with warning
    });

    it('should return false for non-string substring', () => {
      // substring: 123 → false with warning
    });
  });
});
```

2. **Integration Test**: Operator is callable via JSON Logic evaluation
   ```bash
   npm run test:unit -- --testPathPattern="hasPartSubTypeContaining"
   ```

### Invariants That Must Remain True

1. **Existing Operators Unchanged**: All existing body part operators continue to work identically
2. **BaseBodyPartOperator Contract**: New operator follows the same pattern as `HasPartOfTypeOperator`
3. **No Side Effects**: Operator is read-only, doesn't modify entity data
4. **Logging Consistency**: Uses same logging patterns as existing operators

## Verification Commands

```bash
# Run unit tests for the new operator
npm run test:unit -- --testPathPattern="hasPartSubTypeContaining" --verbose

# Run all operator unit tests to ensure no regressions
npm run test:unit -- --testPathPattern="operators" --silent

# Type checking
npm run typecheck
```

## Dependencies

- None (uses existing infrastructure)

## Blocked By

- None

## Blocks

- BEAATTCAP-003 (scope needs this operator for filtering)

---

## Outcome

**Completed**: 2024

### What Was Actually Changed vs Originally Planned

| Planned                                      | Actual                                      | Notes                                                            |
| -------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Create `hasPartSubTypeContainingOperator.js` | ✅ Created as planned                       | Exact implementation as specified                                |
| Modify `jsonLogicCustomOperators.js`         | ✅ Modified as planned                      | Added import, instantiation, and registration                    |
| Create unit tests                            | ✅ Created with 19 tests                    | Exceeded planned coverage                                        |
| **Not in ticket**: Add to whitelist          | ✅ Added to `jsonLogicEvaluationService.js` | Required for operator to work - discovered during implementation |

### Additional Work Required

The ticket did not mention that operators must be added to the `#allowedOperations` whitelist in `src/logic/jsonLogicEvaluationService.js`. This was discovered during implementation and added:

```javascript
// Body part substring matching operators
'hasPartSubTypeContaining',
```

### Test Summary

**19 unit tests created** covering:

- Exact substring match (`'beak'` in `'beak'`)
- Partial substring match (`'beak'` in `'chicken_beak'`)
- Tortoise beak variant (`'beak'` in `'tortoise_beak'`)
- No match scenarios
- Empty body parts array
- Case-insensitivity (both subType and search term)
- Missing entity path handling
- Missing/null/undefined substring handling
- Non-string substring handling
- Missing body component
- Missing root in body component
- Error handling (graceful failure)
- Invalid parameters (missing substring)
- Nested entity paths (`event.actor`)
- Body parts without subType property
- Body parts with non-string subType
- Multiple beaks of different types

**Results**: All 19 new tests pass, 646 total operator tests pass (no regressions)

### Files Modified/Created

| File                                                                  | Action               |
| --------------------------------------------------------------------- | -------------------- |
| `src/logic/operators/hasPartSubTypeContainingOperator.js`             | Created              |
| `src/logic/jsonLogicCustomOperators.js`                               | Modified             |
| `src/logic/jsonLogicEvaluationService.js`                             | Modified (whitelist) |
| `tests/unit/logic/operators/hasPartSubTypeContainingOperator.test.js` | Created              |
