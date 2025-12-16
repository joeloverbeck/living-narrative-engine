# JSOLOGCUSOPEREF-007: Create BaseOperator Abstract Class

**Priority**: 🟢 Medium
**Estimated Effort**: 3 hours
**Phase**: 3 - Medium-Priority Improvements

---

## Summary

Seven standalone operators don't extend any base class and duplicate common patterns: entity path resolution, error handling, logging, and parameter validation. Creating a `BaseOperator` abstract class will reduce duplication and ensure consistency.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/operators/base/baseOperator.js` | Create - abstract base class |
| `src/logic/operators/hasComponentOperator.js` | Modify - extend BaseOperator |
| `src/logic/operators/hasDamageCapabilityOperator.js` | Modify - extend BaseOperator |
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` | Modify - extend BaseOperator |
| `src/logic/operators/canActorGrabItemOperator.js` | Modify - extend BaseOperator |
| `src/logic/operators/isItemBeingGrabbedOperator.js` | Modify - extend BaseOperator |
| `src/logic/operators/getSkillValueOperator.js` | Modify - extend BaseOperator |
| `src/logic/operators/isActorLocationLitOperator.js` | Modify - extend BaseOperator |
| `tests/unit/logic/operators/base/baseOperator.test.js` | Create - unit tests |

---

## Out of Scope

**DO NOT modify:**
- Existing base classes (`BaseBodyPartOperator`, `BaseFurnitureOperator`, `BaseEquipmentOperator`)
- Operators that already extend base classes
- DI registration files
- Integration test files

---

## Implementation Details

### Step 1: Create BaseOperator Class

```javascript
// src/logic/operators/base/baseOperator.js

/**
 * @abstract
 * Base class for JSON Logic operators.
 * Provides common functionality for error handling, logging, and entity resolution.
 */
export class BaseOperator {
  #logger;
  #entityManager;
  #operatorName;

  /**
   * @param {Object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IEntityManager} dependencies.entityManager
   * @param {string} operatorName - Name used in error messages
   */
  constructor({ logger, entityManager }, operatorName) {
    if (new.target === BaseOperator) {
      throw new Error('BaseOperator is abstract and cannot be instantiated directly');
    }
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#operatorName = operatorName;
  }

  get logger() {
    return this.#logger;
  }

  get entityManager() {
    return this.#entityManager;
  }

  get operatorName() {
    return this.#operatorName;
  }

  /**
   * Main evaluation entry point with error handling.
   * @param {Array} params - Operator parameters
   * @param {Object} context - Evaluation context
   * @returns {*} Evaluation result
   */
  evaluate(params, context) {
    try {
      return this.evaluateInternal(params, context);
    } catch (error) {
      this.#logger.error(`${this.#operatorName}: Evaluation error`, error);
      return this.getDefaultOnError();
    }
  }

  /**
   * @abstract
   * Internal evaluation logic. Must be implemented by subclasses.
   */
  evaluateInternal(params, context) {
    throw new Error('evaluateInternal must be implemented by subclass');
  }

  /**
   * Default return value when an error occurs.
   * Override in subclass if different default is needed.
   */
  getDefaultOnError() {
    return false;
  }

  /**
   * Resolves an entity path to an entity ID.
   * @param {string|Object} entityPath - Path like "actor" or direct entity reference
   * @param {Object} context - Evaluation context
   * @returns {string|null} Entity ID or null if not found
   */
  resolveEntityId(entityPath, context) {
    if (typeof entityPath === 'string') {
      const resolved = context[entityPath];
      return typeof resolved === 'string' ? resolved : resolved?.id ?? null;
    }
    return entityPath?.id ?? null;
  }

  /**
   * Validates that required parameters are present.
   * @param {Array} params - Parameters to validate
   * @param {number} requiredCount - Minimum required parameter count
   * @param {string} usage - Usage string for error message
   * @returns {boolean} True if valid
   */
  validateParams(params, requiredCount, usage) {
    if (!Array.isArray(params) || params.length < requiredCount) {
      this.#logger.warn(`${this.#operatorName}: Invalid parameters. Usage: ${usage}`);
      return false;
    }
    return true;
  }
}

export default BaseOperator;
```

### Step 2: Update Standalone Operators

Example for `HasComponentOperator`:

```javascript
// Before
export class HasComponentOperator {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  evaluate(params, context) {
    try {
      // ... implementation
    } catch (error) {
      this.#logger.error('has_component: Error', error);
      return false;
    }
  }
}

// After
import { BaseOperator } from './base/baseOperator.js';

export class HasComponentOperator extends BaseOperator {
  constructor(dependencies) {
    super(dependencies, 'has_component');
  }

  evaluateInternal(params, context) {
    // ... implementation (without try-catch, handled by base)
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/logic/operators/base/baseOperator.test.js
npm run test:unit -- tests/unit/logic/operators/
npm run test:integration -- tests/integration/logic/
```

### Specific Test Assertions

1. **BaseOperator unit tests**:
   - Cannot instantiate directly (abstract)
   - `evaluate()` catches errors and logs them
   - `resolveEntityId()` handles various input formats
   - `validateParams()` returns false for invalid params

2. **Migrated operators**:
   - All existing tests pass without modification
   - Error handling behavior unchanged
   - Logging behavior unchanged

### Invariants That Must Remain True

1. **Operator behavior**: All 7 operators behave identically before and after
2. **Error handling**: Errors still logged and return false
3. **No breaking changes**: Operators can be used exactly as before
4. **Abstract enforcement**: BaseOperator cannot be instantiated

---

## Verification Commands

```bash
# Run base operator tests
npm run test:unit -- tests/unit/logic/operators/base/baseOperator.test.js --verbose

# Run all standalone operator tests
npm run test:unit -- tests/unit/logic/operators/hasComponentOperator.test.js tests/unit/logic/operators/hasDamageCapabilityOperator.test.js --verbose

# Lint new files
npx eslint src/logic/operators/base/baseOperator.js

# Full regression check
npm run test:ci
```

---

## Notes

- Migrate operators one at a time, running tests after each
- The existing base classes (`BaseBodyPartOperator`, etc.) may benefit from extending `BaseOperator` in a future ticket
- Consider whether `getDefaultOnError()` should be configurable per operator
- Document the migration in code comments for future operator developers
