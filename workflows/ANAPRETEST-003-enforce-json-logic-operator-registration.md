# ANAPRETEST-003: Enforce JSON Logic Operator Registration

**Phase:** 1 (Core Infrastructure)
**Priority:** P1 (High)
**Effort:** Medium (2-3 days)
**Impact:** High - Prevents silent failures from missing whitelist entries
**Status:** Not Started

## Context

The `hasOtherActorsAtLocation` operator was fully implemented and registered in `jsonLogicCustomOperators.js` but was missing from the `ALLOWED_OPERATIONS` whitelist in `jsonLogicEvaluationService.js`. This caused silent failures where prerequisites were evaluated but operators weren't called.

**Root Cause:** Manual synchronization required between operator registration and validation whitelist, with no automated checks.

**Impact:** Operators can be implemented and registered but silently fail due to missing whitelist entry, causing hard-to-debug prerequisite failures.

**Reference:** Report lines 164-192

## Solution Overview

Automate operator registration validation to eliminate manual synchronization:

1. **Automated Whitelist Generation**
   - Generate `ALLOWED_OPERATIONS` from registered operators at initialization
   - Remove manual whitelist maintenance
   - Add validation to ensure all registered operators are allowed

2. **Registration-Time Validation**
   - Validate operator registration during `JsonLogicCustomOperators.registerOperators()`
   - Fail fast when operators are registered but not whitelisted
   - Provide clear error messages with remediation steps

3. **Validation Tests**
   - Create test to verify all registered operators are in whitelist
   - Test that unregistered operators are rejected
   - Ensure validation doesn't break existing functionality

## File Structure

```
src/logic/
├── jsonLogicCustomOperators.js              # Modified: Add validation
├── jsonLogicEvaluationService.js            # Modified: Auto-generate whitelist
└── operatorRegistrationValidator.js         # NEW: Validation utility

tests/unit/logic/
├── jsonLogicOperatorRegistration.test.js    # NEW: Registration tests
└── operatorWhitelistValidation.test.js      # NEW: Whitelist tests

docs/development/
└── json-logic-operator-guide.md             # NEW: Operator development guide
```

## Detailed Implementation Steps

### Step 1: Create Operator Registration Validator

**File:** `src/logic/operatorRegistrationValidator.js`

```javascript
/**
 * @file Operator Registration Validator
 * @description Validates JSON Logic operator registration and whitelist synchronization
 */

/**
 * Validate that all registered operators are in the allowed operations set.
 *
 * @param {Set<string>} registeredOperators - Set of registered operator names
 * @param {Set<string>} allowedOperations - Set of whitelisted operator names
 * @param {Object} logger - Logger for diagnostic output
 * @throws {Error} If registered operators are not whitelisted
 */
export function validateOperatorWhitelist(registeredOperators, allowedOperations, logger) {
  const missingOperators = [];
  const extraOperators = [];

  // Check for operators that are registered but not whitelisted
  for (const operator of registeredOperators) {
    if (!allowedOperations.has(operator)) {
      missingOperators.push(operator);
    }
  }

  // Check for operators that are whitelisted but not registered
  for (const operator of allowedOperations) {
    // Skip standard json-logic-js operators
    if (isStandardOperator(operator)) {
      continue;
    }

    if (!registeredOperators.has(operator)) {
      extraOperators.push(operator);
    }
  }

  // Log warnings for extra operators (not critical)
  if (extraOperators.length > 0) {
    logger.warn(
      'Operators in ALLOWED_OPERATIONS whitelist but not registered',
      {
        operators: extraOperators,
        note: 'These may be legacy operators that were removed. Consider cleaning up the whitelist.'
      }
    );
  }

  // Throw error for missing operators (critical)
  if (missingOperators.length > 0) {
    const message =
      `Custom operators are registered but not in ALLOWED_OPERATIONS whitelist.\n` +
      `\n` +
      `Missing operators: ${missingOperators.join(', ')}\n` +
      `\n` +
      `To fix: Add these operators to ALLOWED_OPERATIONS in JsonLogicEvaluationService:\n` +
      `\n` +
      `const ALLOWED_OPERATIONS = new Set([\n` +
      `  // ... existing operators ...\n` +
      missingOperators.map(op => `  '${op}',`).join('\n') + '\n' +
      `]);\n`;

    logger.error('Operator whitelist validation failed', {
      missingOperators,
      totalRegistered: registeredOperators.size,
      totalAllowed: allowedOperations.size
    });

    throw new Error(message);
  }
}

/**
 * Check if operator is a standard json-logic-js operator.
 *
 * @param {string} operator - Operator name
 * @returns {boolean} True if standard operator
 */
function isStandardOperator(operator) {
  const standardOperators = new Set([
    // Standard json-logic-js operators
    'var', 'missing', 'missing_some',
    'if', '==', '===', '!=', '!==',
    '!', '!!', 'or', 'and',
    '>', '>=', '<', '<=',
    'max', 'min', '+', '-', '*', '/', '%',
    'map', 'filter', 'reduce', 'all', 'none', 'some',
    'merge', 'in', 'cat', 'substr', 'log'
  ]);

  return standardOperators.has(operator);
}

/**
 * Generate allowed operations set from registered operators.
 *
 * @param {Set<string>} registeredOperators - Set of registered operator names
 * @param {Array<string>} additionalOperators - Additional standard operators to include
 * @returns {Set<string>} Complete set of allowed operations
 */
export function generateAllowedOperations(registeredOperators, additionalOperators = []) {
  const allowed = new Set();

  // Add all registered custom operators
  for (const operator of registeredOperators) {
    allowed.add(operator);
  }

  // Add standard json-logic-js operators
  const standardOps = [
    'var', 'missing', 'missing_some',
    'if', '==', '===', '!=', '!==',
    '!', '!!', 'or', 'and',
    '>', '>=', '<', '<=',
    'max', 'min', '+', '-', '*', '/', '%',
    'map', 'filter', 'reduce', 'all', 'none', 'some',
    'merge', 'in', 'cat', 'substr', 'log'
  ];

  for (const op of standardOps) {
    allowed.add(op);
  }

  // Add any additional operators
  for (const op of additionalOperators) {
    allowed.add(op);
  }

  return allowed;
}
```

### Step 2: Modify JsonLogicCustomOperators to Track Registrations

**File:** `src/logic/jsonLogicCustomOperators.js` (modify)

```javascript
/**
 * @file JSON Logic Custom Operators
 * @description Register custom operators for json-logic-js with validation
 */

import jsonLogic from 'json-logic-js';
import { validateOperatorWhitelist } from './operatorRegistrationValidator.js';

/**
 * Track all registered custom operators.
 * @type {Set<string>}
 */
const REGISTERED_OPERATORS = new Set();

/**
 * Register all custom operators with json-logic-js.
 *
 * @param {Object} dependencies - Service dependencies
 * @param {Object} dependencies.entityManager - Entity manager instance
 * @param {Object} dependencies.logger - Logger instance
 * @param {Object} dependencies.evaluationService - JSON Logic evaluation service (for validation)
 */
export function registerOperators({ entityManager, logger, evaluationService }) {
  // Clear previous registrations
  REGISTERED_OPERATORS.clear();

  // Register each custom operator
  registerOperator('hasPartOfType', hasPartOfTypeOperator({ entityManager, logger }));
  registerOperator('hasPartWithState', hasPartWithStateOperator({ entityManager, logger }));
  registerOperator('hasClothingInSlot', hasClothingInSlotOperator({ entityManager, logger }));
  registerOperator('hasOtherActorsAtLocation', hasOtherActorsAtLocationOperator({ entityManager, logger }));
  registerOperator('component_present', componentPresentOperator({ entityManager, logger }));
  // ... register other operators ...

  // VALIDATION: Ensure all registered operators are whitelisted
  if (evaluationService && evaluationService.getAllowedOperations) {
    const allowedOps = evaluationService.getAllowedOperations();
    validateOperatorWhitelist(REGISTERED_OPERATORS, allowedOps, logger);
  }

  logger.info('Registered custom JSON Logic operators', {
    count: REGISTERED_OPERATORS.size,
    operators: Array.from(REGISTERED_OPERATORS).sort()
  });
}

/**
 * Register a single operator with json-logic-js and track it.
 *
 * @param {string} name - Operator name
 * @param {Function} implementation - Operator implementation
 */
function registerOperator(name, implementation) {
  jsonLogic.add_operation(name, implementation);
  REGISTERED_OPERATORS.add(name);
}

/**
 * Get set of all registered custom operators.
 *
 * @returns {Set<string>} Set of registered operator names
 */
export function getRegisteredOperators() {
  return new Set(REGISTERED_OPERATORS);
}

/**
 * Check if an operator is registered.
 *
 * @param {string} operatorName - Operator name to check
 * @returns {boolean} True if operator is registered
 */
export function isOperatorRegistered(operatorName) {
  return REGISTERED_OPERATORS.has(operatorName);
}
```

### Step 3: Modify JsonLogicEvaluationService for Auto-Generation

**File:** `src/logic/jsonLogicEvaluationService.js` (modify)

```javascript
/**
 * @file JSON Logic Evaluation Service
 * @description Validates and evaluates JSON Logic expressions
 */

import { generateAllowedOperations } from './operatorRegistrationValidator.js';

class JsonLogicEvaluationService {
  #logger;
  #allowedOperations;

  constructor({ logger, customOperators }) {
    this.#logger = logger;

    // AUTO-GENERATE allowed operations from registered custom operators
    const registeredOps = customOperators?.getRegisteredOperators() || new Set();
    this.#allowedOperations = generateAllowedOperations(registeredOps);

    this.#logger.info('Initialized JSON Logic evaluation service', {
      allowedOperationCount: this.#allowedOperations.size
    });
  }

  /**
   * Get the set of allowed operations.
   *
   * @returns {Set<string>} Set of allowed operation names
   */
  getAllowedOperations() {
    return new Set(this.#allowedOperations);
  }

  /**
   * Check if an operator is allowed.
   *
   * @param {string} operatorName - Operator name
   * @returns {boolean} True if operator is allowed
   */
  isOperatorAllowed(operatorName) {
    return this.#allowedOperations.has(operatorName);
  }

  /**
   * Validate JSON Logic expression recursively.
   *
   * @param {*} logic - JSON Logic expression to validate
   * @throws {Error} If expression contains disallowed operators
   */
  #validateJsonLogic(logic) {
    if (typeof logic !== 'object' || logic === null) {
      return;
    }

    if (Array.isArray(logic)) {
      logic.forEach(item => this.#validateJsonLogic(item));
      return;
    }

    for (const [operator, args] of Object.entries(logic)) {
      if (!this.#allowedOperations.has(operator)) {
        const message =
          `Disallowed JSON Logic operator: "${operator}"\n` +
          `\n` +
          `Allowed operators: ${Array.from(this.#allowedOperations).sort().join(', ')}\n` +
          `\n` +
          `If this is a custom operator, ensure it is:\n` +
          `1. Registered in JsonLogicCustomOperators.registerOperators()\n` +
          `2. Added to ALLOWED_OPERATIONS in JsonLogicEvaluationService`;

        this.#logger.error('JSON Logic validation failed', {
          operator,
          allowedCount: this.#allowedOperations.size
        });

        throw new Error(message);
      }

      // Recursively validate arguments
      if (Array.isArray(args)) {
        args.forEach(arg => this.#validateJsonLogic(arg));
      } else {
        this.#validateJsonLogic(args);
      }
    }
  }

  // ... rest of class implementation ...
}
```

### Step 4: Create Registration Validation Tests

**File:** `tests/unit/logic/jsonLogicOperatorRegistration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerOperators, getRegisteredOperators } from '../../../src/logic/jsonLogicCustomOperators.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

describe('JSON Logic Operator Registration', () => {
  let logger;
  let entityManager;
  let evaluationService;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    entityManager = {
      getEntities: jest.fn(() => []),
      getComponentData: jest.fn(() => null),
      hasComponent: jest.fn(() => false)
    };
  });

  describe('Operator Registration', () => {
    it('should register all custom operators', () => {
      registerOperators({ entityManager, logger });

      const registered = getRegisteredOperators();

      expect(registered.size).toBeGreaterThan(0);
      expect(registered.has('hasPartOfType')).toBe(true);
      expect(registered.has('hasClothingInSlot')).toBe(true);
      expect(registered.has('hasOtherActorsAtLocation')).toBe(true);
    });

    it('should track registered operators', () => {
      registerOperators({ entityManager, logger });

      const registered = getRegisteredOperators();
      const operatorNames = Array.from(registered).sort();

      expect(operatorNames).toContain('hasPartOfType');
      expect(operatorNames).toContain('component_present');
      expect(operatorNames.length).toBeGreaterThan(3);
    });
  });

  describe('Whitelist Synchronization', () => {
    it('should have all registered operators in evaluation service whitelist', () => {
      // Register operators first
      registerOperators({ entityManager, logger });

      // Create evaluation service (auto-generates whitelist)
      evaluationService = new JsonLogicEvaluationService({
        logger,
        customOperators: { getRegisteredOperators }
      });

      const registered = getRegisteredOperators();
      const allowed = evaluationService.getAllowedOperations();

      // All registered operators should be allowed
      for (const operator of registered) {
        expect(allowed.has(operator)).toBe(true);
      }
    });

    it('should include standard json-logic-js operators in whitelist', () => {
      evaluationService = new JsonLogicEvaluationService({
        logger,
        customOperators: { getRegisteredOperators }
      });

      const allowed = evaluationService.getAllowedOperations();

      // Standard operators
      expect(allowed.has('var')).toBe(true);
      expect(allowed.has('if')).toBe(true);
      expect(allowed.has('==')).toBe(true);
      expect(allowed.has('and')).toBe(true);
      expect(allowed.has('or')).toBe(true);
    });

    it('should fail validation when operator is registered but not whitelisted', () => {
      // This test simulates the bug that was fixed
      const mockGetRegisteredOperators = () => new Set(['hasOtherActorsAtLocation', 'hasPartOfType']);
      const mockAllowedOps = new Set(['hasPartOfType']); // Missing hasOtherActorsAtLocation

      expect(() => {
        validateOperatorWhitelist(mockGetRegisteredOperators(), mockAllowedOps, logger);
      }).toThrow('hasOtherActorsAtLocation');
    });
  });

  describe('Operator Validation', () => {
    beforeEach(() => {
      registerOperators({ entityManager, logger });
      evaluationService = new JsonLogicEvaluationService({
        logger,
        customOperators: { getRegisteredOperators }
      });
    });

    it('should allow registered custom operators in expressions', () => {
      const logic = {
        hasPartOfType: ['actor', 'hand']
      };

      expect(() => evaluationService.validate(logic)).not.toThrow();
    });

    it('should reject unregistered operators', () => {
      const logic = {
        unknownOperator: ['actor', 'data']
      };

      expect(() => evaluationService.validate(logic)).toThrow('unknownOperator');
    });

    it('should validate nested expressions with custom operators', () => {
      const logic = {
        and: [
          { hasPartOfType: ['actor', 'hand'] },
          { component_present: ['actor', 'positioning:standing'] }
        ]
      };

      expect(() => evaluationService.validate(logic)).not.toThrow();
    });
  });
});
```

### Step 5: Create Operator Development Guide

**File:** `docs/development/json-logic-operator-guide.md`

```markdown
# JSON Logic Custom Operator Development Guide

## Overview

This guide explains how to create, register, and validate custom JSON Logic operators in the Living Narrative Engine.

## Operator Registration Process

### Step 1: Implement Operator Function

Create the operator implementation in `src/logic/operators/`:

```javascript
// src/logic/operators/myCustomOperator.js

/**
 * Custom operator: myCustomOperator
 *
 * Usage: { "myCustomOperator": ["entity", "value"] }
 */
export function myCustomOperator({ entityManager, logger }) {
  return (entityId, expectedValue) => {
    // Implementation
    const entity = entityManager.getEntityInstance(entityId);
    // ... operator logic ...
    return result;
  };
}
```

### Step 2: Register Operator

Add registration in `jsonLogicCustomOperators.js`:

```javascript
import { myCustomOperator } from './operators/myCustomOperator.js';

export function registerOperators({ entityManager, logger, evaluationService }) {
  // ... existing operators ...

  registerOperator('myCustomOperator', myCustomOperator({ entityManager, logger }));

  // Validation happens automatically
}
```

### Step 3: Validation (Automatic)

**NO MANUAL WHITELIST UPDATE NEEDED!**

The operator is automatically:
1. ✅ Added to `REGISTERED_OPERATORS` set
2. ✅ Included in `ALLOWED_OPERATIONS` via auto-generation
3. ✅ Validated during initialization

### Step 4: Write Tests

Create tests in `tests/unit/logic/operators/`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { myCustomOperator } from '../../../../src/logic/operators/myCustomOperator.js';

describe('myCustomOperator', () => {
  it('should evaluate correctly', () => {
    const operator = myCustomOperator({ entityManager, logger });
    const result = operator('entity-1', 'expected-value');
    expect(result).toBe(true);
  });
});
```

## Automatic Validation

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. JsonLogicCustomOperators.registerOperators()            │
│    - Calls registerOperator() for each custom operator     │
│    - Adds operator name to REGISTERED_OPERATORS set        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. JsonLogicEvaluationService constructor                  │
│    - Calls generateAllowedOperations(REGISTERED_OPERATORS)  │
│    - Auto-generates ALLOWED_OPERATIONS set                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. validateOperatorWhitelist()                             │
│    - Compares REGISTERED_OPERATORS vs ALLOWED_OPERATIONS   │
│    - Throws error if mismatch found                        │
│    - Provides clear remediation steps                      │
└─────────────────────────────────────────────────────────────┘
```

### What You Don't Need to Do

❌ **Don't manually update ALLOWED_OPERATIONS** - Auto-generated
❌ **Don't add to validation whitelist** - Automatic
❌ **Don't worry about synchronization** - Validated at initialization

### What You Still Need to Do

✅ **Implement operator logic** - In `src/logic/operators/`
✅ **Register operator** - Call `registerOperator()` in `jsonLogicCustomOperators.js`
✅ **Write tests** - In `tests/unit/logic/operators/`
✅ **Document usage** - Add to this guide or operator JSDoc

## Error Messages

### Missing Whitelist Entry (Old Behavior)

**Before this change**, forgetting to add to whitelist caused:

```
Silent failure - prerequisite evaluated but operator not called
```

**After this change**, you get:

```
Error: Custom operators are registered but not in ALLOWED_OPERATIONS whitelist.

Missing operators: myCustomOperator

To fix: Add these operators to ALLOWED_OPERATIONS in JsonLogicEvaluationService:

const ALLOWED_OPERATIONS = new Set([
  // ... existing operators ...
  'myCustomOperator',
]);
```

### Unregistered Operator Usage

If you try to use an operator that isn't registered:

```
Error: Disallowed JSON Logic operator: "unknownOperator"

Allowed operators: and, component_present, hasClothingInSlot, hasOtherActorsAtLocation, ...

If this is a custom operator, ensure it is:
1. Registered in JsonLogicCustomOperators.registerOperators()
2. Added to ALLOWED_OPERATIONS in JsonLogicEvaluationService
```

## Migration from Manual Whitelist

If you have existing operators that were manually added to whitelist:

1. ✅ Verify operator is registered in `jsonLogicCustomOperators.js`
2. ✅ Remove manual entry from `ALLOWED_OPERATIONS` (will be auto-generated)
3. ✅ Run tests to verify everything works
4. ✅ Done!

## References

- **Operator Registry:** `src/logic/jsonLogicCustomOperators.js`
- **Evaluation Service:** `src/logic/jsonLogicEvaluationService.js`
- **Validation Utility:** `src/logic/operatorRegistrationValidator.js`
- **Tests:** `tests/unit/logic/jsonLogicOperatorRegistration.test.js`
- **Report:** `reports/anatomy-prerequisite-test-fixes-2025-01.md` (lines 164-192)
```

## Acceptance Criteria

- [ ] Operator registration validator created (`operatorRegistrationValidator.js`)
- [ ] `JsonLogicCustomOperators` modified to track registered operators
- [ ] `JsonLogicEvaluationService` modified to auto-generate `ALLOWED_OPERATIONS`
- [ ] Validation occurs automatically during initialization (fail-fast)
- [ ] Registration tests created and passing
- [ ] All existing tests pass (no regressions)
- [ ] Error messages provide clear remediation steps
- [ ] Operator development guide created at `docs/development/json-logic-operator-guide.md`
- [ ] Guide includes:
  - Operator registration process (4 steps)
  - Automatic validation explanation
  - Error message examples
  - Migration guide from manual whitelist

## Implementation Notes

**Key Design Decisions:**

1. **Auto-generation over Manual**: Generate `ALLOWED_OPERATIONS` from `REGISTERED_OPERATORS` to eliminate sync issues
2. **Fail-fast**: Validate during initialization rather than at first usage
3. **Clear Errors**: Provide actionable error messages with remediation steps

**Testing Strategy:**

1. Unit tests verify registration tracking
2. Tests verify whitelist auto-generation
3. Tests simulate the original bug (missing whitelist entry)
4. Integration tests ensure no regressions

**Migration Considerations:**

- Existing manual `ALLOWED_OPERATIONS` entries can be removed
- All custom operators must be registered via `registerOperators()`
- Standard json-logic-js operators automatically included

## Dependencies

**Requires:**
- None (standalone improvement)

**Blocks:**
- Future operator development (will use new automated system)

## References

- **Report Section:** Suggestion #3 - Enforce JSON Logic Operator Registration
- **Report Lines:** 164-192
- **Fixed Issue:** `hasOtherActorsAtLocation` missing from `ALLOWED_OPERATIONS`
- **Related Files:**
  - `src/logic/jsonLogicCustomOperators.js`
  - `src/logic/jsonLogicEvaluationService.js`
  - `src/logic/operators/hasOtherActorsAtLocationOperator.js`
