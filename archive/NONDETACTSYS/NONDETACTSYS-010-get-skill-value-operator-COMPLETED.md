# NONDETACTSYS-010: Create getSkillValue JSON Logic Operator

## Status: ✅ COMPLETED

## Summary

Create a custom JSON Logic operator `getSkillValue` that retrieves skill values from entity components. This operator enables conditions and modifiers to reference skill values in JSON Logic expressions.

## Files to Create

| File                                                       | Purpose                              |
| ---------------------------------------------------------- | ------------------------------------ |
| `src/logic/operators/getSkillValueOperator.js`             | Operator class implementation        |
| `tests/unit/logic/operators/getSkillValueOperator.test.js` | Comprehensive unit tests (~30 tests) |

## Files to Modify

| File                                    | Change                                    |
| --------------------------------------- | ----------------------------------------- |
| `src/logic/jsonLogicCustomOperators.js` | Import and register GetSkillValueOperator |

## Implementation Details

### getSkillValueOperator.js (Class-Based Pattern)

**Note**: This follows the established class-based operator pattern used throughout the codebase (see `hasFreeGrabbingAppendagesOperator.js`, `hasComponentOperator.js`).

```javascript
/**
 * @file getSkillValue JSON Logic operator
 * @description Retrieves skill values from entity components for use in conditions
 * @see specs/non-deterministic-actions-system.md
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';
import jsonLogic from 'json-logic-js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class GetSkillValueOperator
 * @description Retrieves skill values from entity components
 *
 * Usage: {"getSkillValue": ["actor", "skills:melee_skill", "value", 0]}
 * Returns: The skill value or the default value if not found
 */
export class GetSkillValueOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'getSkillValue';

  /**
   * Creates a new GetSkillValueOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error('GetSkillValueOperator: Missing required dependencies');
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - [entityPath, componentId, propertyPath?, defaultValue?]
   * @param {object} context - Evaluation context
   * @returns {number} Skill value or default
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length < 2) {
        this.#logger.warn(
          `${this.#operatorName}: Invalid parameters. Expected [entityPath, componentId, propertyPath?, defaultValue?], got ${JSON.stringify(params)}`
        );
        return 0;
      }

      const [
        entityPath,
        componentId,
        propertyPath = 'value',
        defaultValue = 0,
      ] = params;

      // Resolve entity using standard pattern
      const entityId = this.#resolveEntityFromPath(entityPath, context);
      if (entityId === null) {
        return defaultValue;
      }

      // Get component data
      const componentData = this.#entityManager.getComponentData(
        entityId,
        componentId
      );
      if (componentData === null || componentData === undefined) {
        this.#logger.debug(
          `${this.#operatorName}: Component ${componentId} not found on entity ${entityId}, returning default ${defaultValue}`
        );
        return defaultValue;
      }

      // Extract value from property path
      const value = this.#extractPropertyValue(componentData, propertyPath);
      const result = value !== undefined ? value : defaultValue;

      this.#logger.debug(
        `${this.#operatorName}: Entity ${entityId}, component ${componentId}, path ${propertyPath} = ${result}`
      );

      return result;
    } catch (error) {
      this.#logger.error(
        `${this.#operatorName}: Error during evaluation`,
        error
      );
      return 0;
    }
  }

  /**
   * Resolves entity ID from path using standard resolution pattern
   * @private
   */
  #resolveEntityFromPath(entityPath, context) {
    // ... (entity resolution logic using resolveEntityPath utility)
  }

  /**
   * Extracts value from nested property path
   * @private
   */
  #extractPropertyValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}
```

### JSON Logic Usage

```json
// Get actor's melee skill
{ "getSkillValue": ["actor", "skills:melee_skill", "value", 0] }

// Get target's defense skill with custom default
{ "getSkillValue": ["target", "skills:defense_skill", "value", 10] }

// Use in a comparison condition
{
  ">=": [
    { "getSkillValue": ["actor", "skills:melee_skill", "value", 0] },
    50
  ]
}

// Use in conditional modifier
{
  "if": [
    { ">=": [{ "getSkillValue": ["actor", "skills:melee_skill", "value", 0] }, 80] },
    { "+": [{ "var": "baseChance" }, 10] },
    { "var": "baseChance" }
  ]
}
```

### jsonLogicCustomOperators.js Modification

```javascript
// 1. Add import at top of file
import { GetSkillValueOperator } from './operators/getSkillValueOperator.js';

// 2. In registerOperators() method, instantiate operator
const getSkillValueOp = new GetSkillValueOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});

// 3. Register with wrapper function
this.#registerOperator(
  'getSkillValue',
  function (entityPath, componentId, propertyPath, defaultValue) {
    return getSkillValueOp.evaluate(
      [entityPath, componentId, propertyPath, defaultValue],
      this
    );
  },
  jsonLogicEvaluationService
);
```

## Out of Scope

- **DO NOT** modify any action definitions
- **DO NOT** modify the SkillResolverService (use entityManager directly)
- **DO NOT** create integration tests (unit tests only)
- **DO NOT** implement modifier collection logic

## Acceptance Criteria

### Tests That Must Pass

```bash
# Unit tests for the operator
npm run test:unit -- --testPathPattern="getSkillValueOperator"

# Type checking
npm run typecheck

# Lint
npx eslint src/logic/operators/getSkillValueOperator.js
```

### Required Test Cases (~30 tests across 7 describe blocks)

**Note**: Test pattern follows `hasFreeGrabbingAppendagesOperator.test.js` structure.

#### 1. Constructor Tests (4 tests)

- Should initialize with required dependencies
- Should throw error if entityManager is missing
- Should throw error if logger is missing
- Should throw error if both dependencies are missing

#### 2. Basic Retrieval Tests (4 tests)

- Returns skill value when component exists
- Returns default when component missing
- Returns default when entity not found
- Handles nested property paths (e.g., `stats.strength`)

#### 3. Default Values Tests (4 tests)

- Should default propertyPath to "value" when not provided
- Should default defaultValue to 0 when not provided
- Should use custom default value when component missing
- Should handle non-numeric default values gracefully

#### 4. Entity Reference Resolution Tests (6 tests)

- Resolves entity reference from context (actor path)
- Handles "self" reference
- Resolves entity object with id
- Handles direct entity ID strings
- Resolves nested entity paths like entity.target
- Handles target path resolution

#### 5. Error Handling Tests (8 tests)

- Returns 0 for no parameters
- Returns 0 for null parameters
- Returns 0 for undefined parameters
- Returns default when entity path does not exist in context
- Returns 0 for invalid entity path type (number)
- Returns 0 for invalid entity path type (boolean)
- Returns default when entity resolution produces null
- Handles exceptions gracefully and returns 0

#### 6. Edge Cases Tests (5 tests)

- Zero skill value returns 0 (not default)
- Large skill values handled correctly
- Negative skill values handled correctly
- Empty string property path returns default
- Whitespace-only entityId handled correctly

#### 7. Logging Tests (3 tests)

- Logs debug message for successful skill retrieval
- Logs debug message when component not found
- Logs error for exceptions during evaluation

### Invariants That Must Remain True

- [x] Operator follows JSON Logic operator patterns
- [x] All existing JSON Logic operations unaffected
- [x] Entity reference resolution matches existing patterns
- [x] Operator is stateless (pure function)
- [x] Unit test coverage >= 90%
- [x] No modifications to existing operators

## Dependencies

- **Depends on**: NONDETACTSYS-001 (skill components for meaningful tests)
- **Blocked by**: Nothing (can mock in tests)
- **Blocks**: NONDETACTSYS-011 (ActionFormattingStage may use this for chance calculation)

## Reference Files

| File                                                                   | Purpose                    |
| ---------------------------------------------------------------------- | -------------------------- |
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js`             | Operator pattern reference |
| `src/logic/operators/isRemovalBlockedOperator.js`                      | Entity resolution pattern  |
| `src/logic/jsonLogicCustomOperators.js`                                | Registration location      |
| `tests/unit/logic/operators/hasFreeGrabbingAppendagesOperator.test.js` | Test pattern               |

---

## Outcome

### What Was Actually Changed vs Originally Planned

#### Ticket Corrections Made First

The original ticket contained several incorrect assumptions about codebase patterns that were corrected before implementation:

1. **Entity Resolution Pattern**: Ticket originally showed manual switch/case logic for entity resolution. Corrected to use existing `resolveEntityPath` utility from `src/logic/utils/entityPathResolver.js`.

2. **Implementation Pattern**: Ticket correctly specified class-based pattern which matched codebase conventions.

3. **Registration Pattern**: Registration code was updated to use `#registerOperator()` helper method.

#### Files Created

| File                                                       | Description                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/logic/operators/getSkillValueOperator.js`             | 249 lines - Full operator implementation with entity resolution, component data retrieval, nested property path extraction |
| `tests/unit/logic/operators/getSkillValueOperator.test.js` | 523 lines - **40 tests** across 8 describe blocks (exceeded the 30 test target)                                            |

#### Files Modified

| File                                    | Change                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/logic/jsonLogicCustomOperators.js` | Added import and registration of GetSkillValueOperator (lines 23, 205-208, 427-437) |

#### Test Coverage

**40 tests** across 8 describe blocks (exceeding the ~30 test target):

| Describe Block                               | Tests | Status |
| -------------------------------------------- | ----- | ------ |
| Constructor                                  | 4     | ✅     |
| Basic Retrieval                              | 4     | ✅     |
| Default Values                               | 4     | ✅     |
| Entity Reference Resolution                  | 6     | ✅     |
| Error Handling                               | 9     | ✅     |
| Edge Cases                                   | 6     | ✅     |
| Logging                                      | 3     | ✅     |
| Integration with JSON Logic context patterns | 4     | ✅     |

All 40 tests pass.

#### Validation Results

```
✅ npm run test:unit -- --testPathPattern="getSkillValueOperator" → 40 passed
✅ npm run typecheck → Pre-existing errors in CLI files only (not related to this change)
✅ npx eslint src/logic/operators/getSkillValueOperator.js → No errors
```

#### Key Implementation Details

- Uses `resolveEntityPath` and `hasValidEntityId` from existing `entityPathResolver.js` utility
- Supports JSON Logic expressions via `jsonLogic.apply()` for dynamic entity resolution
- Handles multiple entity path formats: strings, objects with id, "self" reference, nested paths
- Extracts nested property values via dot notation (e.g., `stats.strength`)
- Returns appropriate defaults (0) on errors, maintains fail-safe behavior
- Comprehensive logging at debug/warn/error levels
