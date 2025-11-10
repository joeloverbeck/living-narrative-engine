# ANAPRETEST-003: Enforce JSON Logic Operator Registration

**Phase:** 1 (Core Infrastructure)
**Priority:** P1 (High)
**Effort:** Medium (2-3 days)
**Impact:** High - Prevents silent failures from missing whitelist entries
**Status:** Not Started

## Context

**Original Issue (RESOLVED):** The `hasOtherActorsAtLocation` operator was fully implemented and registered in `jsonLogicCustomOperators.js` but was missing from the `ALLOWED_OPERATIONS` whitelist in `jsonLogicEvaluationService.js`. This was fixed in commit f786635 (Mon Nov 10 2025).

**Current Status:** The immediate problem is resolved - `hasOtherActorsAtLocation` is now in the whitelist (line 139 of `jsonLogicEvaluationService.js`).

**Remaining Issue:** Manual synchronization is still required between operator registration and validation whitelist, with no automated checks. This creates risk of the same problem recurring with future operators.

**Root Cause:** Manual synchronization required between operator registration and validation whitelist, with no automated checks.

**Impact:** Future operators can be implemented and registered but silently fail due to missing whitelist entry, causing hard-to-debug prerequisite failures.

**Reference:** Report lines 164-192, commit f786635

## Solution Overview

Add automatic validation to catch operator registration/whitelist synchronization errors:

### Approach: Pragmatic Validation (Not Full Auto-Generation)

Due to the current DI architecture and initialization order, we're implementing **validation** rather than **auto-generation**:

1. **Track Registered Operators**
   - Add `#registeredOperators` Set to `JsonLogicCustomOperators` class
   - Track operators as they're registered via helper method
   - Expose via public `getRegisteredOperators()` method

2. **Expose Whitelist**
   - Move `ALLOWED_OPERATIONS` from local const to class property in `JsonLogicEvaluationService`
   - Add `getAllowedOperations()` public method for external access
   - Maintain same validation logic

3. **Automatic Validation**
   - Validate operator registration at end of `JsonLogicCustomOperators.registerOperators()`
   - Compare registered operators against evaluation service whitelist
   - Fail fast when operators are registered but not whitelisted
   - Provide clear error messages with remediation steps

4. **Validation Tests**
   - Create test to verify all registered operators are in whitelist
   - Test that unregistered operators are rejected
   - Test the original bug scenario (operator registered but not whitelisted)
   - Ensure validation doesn't break existing functionality

### Why Not Full Auto-Generation?

Full auto-generation of the whitelist from registered operators would require:
- Circular dependency: `JsonLogicEvaluationService` needs `JsonLogicCustomOperators`
- Initialization order changes in DI container
- Security review process changes (implicit vs explicit approval)

The pragmatic approach provides **fail-fast validation** without architectural changes.

## Current Architecture

### Actual Implementation (Class-Based)

```
src/logic/
├── jsonLogicCustomOperators.js              # Class: JsonLogicCustomOperators
│   └── registerOperators(jsonLogicEvaluationService)  # Instance method
├── jsonLogicEvaluationService.js            # Class: JsonLogicEvaluationService
│   ├── addOperation(name, func)             # Registers with json-logic-js
│   ├── #validateJsonLogic(rule)             # Has ALLOWED_OPERATIONS const
│   └── evaluate(rule, context)              # Validates then evaluates
└── operators/                               # Operator implementations
    ├── hasOtherActorsAtLocationOperator.js  # Class: HasOtherActorsAtLocationOperator
    ├── hasPartOfTypeOperator.js             # Class: HasPartOfTypeOperator
    └── ...                                  # Other operator classes
```

### Registration Flow (Current)

```
1. JsonLogicCustomOperators instantiated with dependencies
2. registerOperators(evaluationService) called
3. For each operator:
   - Instantiate operator class (e.g., new HasPartOfTypeOperator())
   - Call evaluationService.addOperation(name, wrapperFunc)
4. addOperation() calls jsonLogic.add_operation(name, func)
5. No tracking of registered operators
```

### Validation Flow (Current)

```
1. evaluate(rule, context) called on JsonLogicEvaluationService
2. #validateJsonLogic(rule) called with local ALLOWED_OPERATIONS const
3. Recursively checks all operators in rule against whitelist
4. Throws if disallowed operator found
5. If valid, evaluates rule with jsonLogic.apply()
```

## Proposed Changes

```
src/logic/
├── jsonLogicCustomOperators.js              # Modified: Add tracking & validation
├── jsonLogicEvaluationService.js            # Modified: Expose whitelist access
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

**Current Implementation:** Class-based with instance method `registerOperators(jsonLogicEvaluationService)`

**Changes Needed:**
1. Add private `#registeredOperators` Set to track registered operators
2. Create helper method `#registerOperator(name, implementation, evaluationService)`
3. Add public method `getRegisteredOperators()` for external access
4. Add validation call after all operators registered

```javascript
// src/logic/jsonLogicCustomOperators.js

import { BaseService } from '../utils/serviceBase.js';
import { HasPartWithComponentValueOperator } from './operators/hasPartWithComponentValueOperator.js';
// ... other imports ...
import { validateOperatorWhitelist } from './operatorRegistrationValidator.js';

/**
 * @class JsonLogicCustomOperators
 * @description Service responsible for registering custom JSON Logic operators
 */
export class JsonLogicCustomOperators extends BaseService {
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {BodyGraphService} */
  #bodyGraphService;
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {Set<string>} Track registered operators */
  #registeredOperators = new Set();

  constructor({ logger, bodyGraphService, entityManager }) {
    super();
    this.#logger = this._init('JsonLogicCustomOperators', logger, {
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: [
          'hasPartWithComponentValue',
          'findPartsByType',
          'getAllParts',
          'buildAdjacencyCache',
        ],
      },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
      },
    });

    this.#bodyGraphService = bodyGraphService;
    this.#entityManager = entityManager;

    this.#logger.debug('JsonLogicCustomOperators initialized');
  }

  /**
   * Helper to register operator and track it
   * @private
   */
  #registerOperator(name, implementation, evaluationService) {
    evaluationService.addOperation(name, implementation);
    this.#registeredOperators.add(name);
  }

  /**
   * Registers all custom operators with the JsonLogicEvaluationService
   *
   * @param {JsonLogicEvaluationService} jsonLogicEvaluationService
   */
  registerOperators(jsonLogicEvaluationService) {
    this.#logger.debug('Registering custom JSON Logic operators');

    // Clear previous registrations
    this.#registeredOperators.clear();

    // Create operator instances
    const hasPartWithComponentValueOp = new HasPartWithComponentValueOperator({
      entityManager: this.#entityManager,
      bodyGraphService: this.#bodyGraphService,
      logger: this.#logger,
    });

    // ... create other operators ...

    // Register operators using helper (tracks automatically)
    this.#registerOperator(
      'hasPartWithComponentValue',
      function (entityPath, componentId, propertyPath, expectedValue) {
        return hasPartWithComponentValueOp.evaluate(
          [entityPath, componentId, propertyPath, expectedValue],
          this
        );
      },
      jsonLogicEvaluationService
    );

    // ... register other operators similarly ...

    // VALIDATION: Ensure all registered operators are whitelisted
    const allowedOps = jsonLogicEvaluationService.getAllowedOperations();
    validateOperatorWhitelist(this.#registeredOperators, allowedOps, this.#logger);

    this.#logger.info('Custom JSON Logic operators registered successfully', {
      count: this.#registeredOperators.size,
      operators: Array.from(this.#registeredOperators).sort()
    });
  }

  /**
   * Get set of all registered custom operators.
   * @returns {Set<string>} Set of registered operator names
   */
  getRegisteredOperators() {
    return new Set(this.#registeredOperators);
  }

  /**
   * Clears all operator caches - useful for testing
   */
  clearCaches() {
    this.#logger.debug('Clearing custom operator caches');
    if (this.isSocketCoveredOp) {
      this.isSocketCoveredOp.clearCache();
    }
  }
}

export default JsonLogicCustomOperators;
```

### Step 3: Modify JsonLogicEvaluationService to Expose Whitelist

**File:** `src/logic/jsonLogicEvaluationService.js` (modify)

**Current Implementation:** `ALLOWED_OPERATIONS` is a local const inside `#validateJsonLogic` method

**Problem:** The whitelist is hardcoded and not accessible from outside for validation

**Changes Needed:**
1. Move `ALLOWED_OPERATIONS` from local const to private class property `#allowedOperations`
2. Add public method `getAllowedOperations()` to expose the whitelist
3. Keep same validation logic, just use `this.#allowedOperations` instead of local const

**Note:** We're NOT auto-generating from registered operators (that would require dependency injection changes). Instead, we're just exposing the existing whitelist for validation.

```javascript
// src/logic/jsonLogicEvaluationService.js

import jsonLogic from 'json-logic-js';
import { ServiceSetup } from '../utils/serviceInitializerUtils.js';
import { BaseService } from '../utils/serviceBase.js';
// ... other imports ...

class JsonLogicEvaluationService extends BaseService {
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {IGameDataRepository} */
  #gameDataRepository;
  /** @private @type {Set<string>} Allowed JSON Logic operations */
  #allowedOperations;

  constructor({ logger, gameDataRepository, serviceSetup } = {}) {
    super();
    const setup = serviceSetup ?? new ServiceSetup();
    this.#logger = setup.setupService('JsonLogicEvaluationService', logger);

    // ... existing gameDataRepository setup ...

    // Initialize allowed operations whitelist
    this.#allowedOperations = new Set([
      // Comparison operators
      '==', '===', '!=', '!==', '>', '>=', '<', '<=',
      // Logical operators
      'and', 'or', 'not', '!', '!!',
      // Conditional
      'if',
      // Data access
      'var', 'missing', 'missing_some',
      // Object operations
      'has',
      // Array operations
      'in', 'cat', 'substr', 'merge',
      // Math operations
      '+', '-', '*', '/', '%', 'min', 'max',
      // String operations
      'toLowerCase', 'toUpperCase',
      // Type checks
      'some', 'none', 'all',
      // Special
      'log',
      // Custom operations
      'condition_ref',
      // Anatomy/body part operators
      'hasPartWithComponentValue',
      'hasBodyPartWithComponentValue',
      'hasPartOfType',
      'hasPartOfTypeWithComponentValue',
      // Clothing/equipment operators
      'hasClothingInSlot',
      'hasClothingInSlotLayer',
      'isSocketCovered',
      // Location/actor operators
      'hasOtherActorsAtLocation',
      // Furniture/positioning operators
      'hasSittingSpaceToRight',
      'canScootCloser',
      'isClosestLeftOccupant',
      'isClosestRightOccupant',
      // Test operators
      'throw_error_operator',
    ]);

    // Register built-in custom operators
    this.addOperation('not', (a) => !a);
    this.addOperation('has', (object, property) => {
      if (object && typeof object === 'object') {
        return property in object;
      }
      return false;
    });

    this.#logger.debug('JsonLogicEvaluationService initialized.', {
      allowedOperationCount: this.#allowedOperations.size
    });
  }

  /**
   * Get the set of allowed operations.
   * @returns {Set<string>} Copy of allowed operation names
   */
  getAllowedOperations() {
    return new Set(this.#allowedOperations);
  }

  /**
   * Check if an operator is allowed.
   * @param {string} operatorName - Operator name
   * @returns {boolean} True if operator is allowed
   */
  isOperatorAllowed(operatorName) {
    return this.#allowedOperations.has(operatorName);
  }

  /**
   * Validates a JSON Logic rule to ensure it only uses allowed operations.
   * @private
   * @param {any} rule - The rule to validate
   * @param {Set<string>} seenObjects - Track objects to prevent circular references
   * @param {number} depth - Current recursion depth
   * @throws {Error} If rule contains disallowed operations or exceeds depth limit
   */
  #validateJsonLogic(rule, seenObjects = new Set(), depth = 0) {
    const MAX_DEPTH = 50;

    if (depth > MAX_DEPTH) {
      throw new Error(
        `JSON Logic validation error: Maximum nesting depth (${MAX_DEPTH}) exceeded`
      );
    }

    // Handle null/undefined
    if (rule === null || rule === undefined) {
      return;
    }

    // Handle primitives
    if (typeof rule !== 'object') {
      return;
    }

    // Handle circular references
    if (seenObjects.has(rule)) {
      throw new Error('JSON Logic validation error: Circular reference detected');
    }
    seenObjects.add(rule);

    try {
      // Handle arrays
      if (Array.isArray(rule)) {
        for (const item of rule) {
          this.#validateJsonLogic(item, seenObjects, depth + 1);
        }
        return;
      }

      // Handle objects - check operations
      const keys = Object.keys(rule);

      // Check for dangerous properties
      // ... existing security checks ...

      // For single-key objects, check if it's a valid operation
      if (keys.length === 1) {
        const operation = keys[0];
        if (!this.#allowedOperations.has(operation)) {
          throw new Error(
            `JSON Logic validation error: Disallowed operation '${operation}'`
          );
        }
      }

      // Recursively validate all values
      for (const key of keys) {
        this.#validateJsonLogic(rule[key], seenObjects, depth + 1);
      }
    } finally {
      seenObjects.delete(rule);
    }
  }

  // ... rest of class implementation ...
}

export default JsonLogicEvaluationService;
```

### Step 4: Create Registration Validation Tests

**File:** `tests/unit/logic/jsonLogicOperatorRegistration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { JsonLogicCustomOperators } from '../../../src/logic/jsonLogicCustomOperators.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { validateOperatorWhitelist } from '../../../src/logic/operatorRegistrationValidator.js';

describe('JSON Logic Operator Registration', () => {
  let logger;
  let entityManager;
  let bodyGraphService;
  let gameDataRepository;
  let customOperators;
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

    bodyGraphService = {
      hasPartWithComponentValue: jest.fn(() => false),
      findPartsByType: jest.fn(() => []),
      getAllParts: jest.fn(() => []),
      buildAdjacencyCache: jest.fn()
    };

    gameDataRepository = {
      getConditionDefinition: jest.fn(() => null)
    };
  });

  describe('Operator Registration', () => {
    it('should register all custom operators', () => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository
      });

      customOperators.registerOperators(evaluationService);

      const registered = customOperators.getRegisteredOperators();

      expect(registered.size).toBeGreaterThan(0);
      expect(registered.has('hasPartOfType')).toBe(true);
      expect(registered.has('hasClothingInSlot')).toBe(true);
      expect(registered.has('hasOtherActorsAtLocation')).toBe(true);
    });

    it('should track registered operators', () => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository
      });

      customOperators.registerOperators(evaluationService);

      const registered = customOperators.getRegisteredOperators();
      const operatorNames = Array.from(registered).sort();

      expect(operatorNames).toContain('hasPartOfType');
      expect(operatorNames).toContain('hasPartWithComponentValue');
      expect(operatorNames.length).toBeGreaterThan(3);
    });
  });

  describe('Whitelist Synchronization', () => {
    beforeEach(() => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository
      });

      customOperators.registerOperators(evaluationService);
    });

    it('should have all registered operators in evaluation service whitelist', () => {
      const registered = customOperators.getRegisteredOperators();
      const allowed = evaluationService.getAllowedOperations();

      // All registered operators should be allowed
      for (const operator of registered) {
        expect(allowed.has(operator)).toBe(true);
      }
    });

    it('should include standard json-logic-js operators in whitelist', () => {
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
      const mockRegisteredOps = new Set(['hasOtherActorsAtLocation', 'hasPartOfType']);
      const mockAllowedOps = new Set(['hasPartOfType']); // Missing hasOtherActorsAtLocation

      expect(() => {
        validateOperatorWhitelist(mockRegisteredOps, mockAllowedOps, logger);
      }).toThrow('hasOtherActorsAtLocation');
    });
  });

  describe('Operator Validation', () => {
    beforeEach(() => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository
      });

      customOperators.registerOperators(evaluationService);
    });

    it('should allow registered custom operators in expressions', () => {
      const logic = {
        hasPartOfType: ['actor', 'hand']
      };

      // Note: evaluate() calls #validateJsonLogic internally
      expect(() => evaluationService.evaluate(logic, {})).not.toThrow();
    });

    it('should reject unregistered operators', () => {
      const logic = {
        unknownOperator: ['actor', 'data']
      };

      expect(() => evaluationService.evaluate(logic, {})).toThrow('unknownOperator');
    });

    it('should validate nested expressions with custom operators', () => {
      const logic = {
        and: [
          { hasPartOfType: ['actor', 'hand'] },
          { hasClothingInSlot: ['actor', 'torso'] }
        ]
      };

      expect(() => evaluationService.evaluate(logic, {})).not.toThrow();
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

Add registration in `JsonLogicCustomOperators.registerOperators()` method:

```javascript
// In src/logic/jsonLogicCustomOperators.js
import { MyCustomOperator } from './operators/myCustomOperator.js';

export class JsonLogicCustomOperators extends BaseService {
  // ... existing code ...

  registerOperators(jsonLogicEvaluationService) {
    this.#logger.debug('Registering custom JSON Logic operators');
    this.#registeredOperators.clear();

    // Create operator instance
    const myCustomOp = new MyCustomOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    // Register using helper (tracks automatically)
    this.#registerOperator(
      'myCustomOperator',
      function (entityPath, expectedValue) {
        return myCustomOp.evaluate([entityPath, expectedValue], this);
      },
      jsonLogicEvaluationService
    );

    // ... register other operators ...

    // Validation happens automatically at end of method
    const allowedOps = jsonLogicEvaluationService.getAllowedOperations();
    validateOperatorWhitelist(this.#registeredOperators, allowedOps, this.#logger);
  }
}
```

### Step 3: Add to ALLOWED_OPERATIONS Whitelist

**MANUAL STEP REQUIRED** (for now):

Add the operator to the `#allowedOperations` Set in `JsonLogicEvaluationService` constructor:

```javascript
// In src/logic/jsonLogicEvaluationService.js constructor
this.#allowedOperations = new Set([
  // ... existing operators ...
  // Custom operations - your new operator
  'myCustomOperator',  // <-- ADD THIS
  // ... rest of operators ...
]);
```

**Validation** (automatic):

After adding to whitelist, validation happens automatically:
1. ✅ Operator added to `#registeredOperators` set when registered
2. ✅ `validateOperatorWhitelist()` called at end of `registerOperators()`
3. ✅ Throws error if operator is registered but not in `#allowedOperations`
4. ✅ Throws error if operator is in whitelist but not registered

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

❌ **Don't manually track registrations** - Automatic via `#registerOperator()` helper
❌ **Don't worry about forgetting validation** - Automatic at end of `registerOperators()`
❌ **Don't silent fail on missing whitelist** - Throws error immediately

### What You Still Need to Do

✅ **Implement operator logic** - Create operator class in `src/logic/operators/`
✅ **Register operator** - Add to `JsonLogicCustomOperators.registerOperators()`
✅ **Add to whitelist** - Add operator name to `#allowedOperations` in `JsonLogicEvaluationService`
✅ **Write tests** - In `tests/unit/logic/operators/`
✅ **Document usage** - Add to this guide or operator JSDoc

### Why Still Manual?

The current implementation requires manual whitelist updates because:

1. **Dependency Injection Complexity**: Auto-generation would require passing `JsonLogicCustomOperators` to `JsonLogicEvaluationService` constructor, which creates circular dependencies in the DI setup.

2. **Initialization Order**: `JsonLogicEvaluationService` is created before operators are registered, so the whitelist must exist before registration.

3. **Security Considerations**: Explicit whitelist provides security review checkpoint - all operators must be explicitly approved.

**Future Enhancement**: A fully auto-generated approach would require DI architecture changes to resolve initialization order and circular dependencies.

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

## Improvement from Current System

The enhancement adds automatic validation to the existing manual process:

**Before (Current - No Validation):**
1. Implement operator in `src/logic/operators/`
2. Register in `JsonLogicCustomOperators.registerOperators()`
3. Manually add to `ALLOWED_OPERATIONS` whitelist
4. ⚠️ If you forget step 3, silent failure occurs

**After (Enhanced - With Validation):**
1. Implement operator in `src/logic/operators/`
2. Register in `JsonLogicCustomOperators.registerOperators()` using `#registerOperator()` helper
3. Manually add to `ALLOWED_OPERATIONS` whitelist
4. ✅ `validateOperatorWhitelist()` called automatically
5. ✅ If you forget step 3, immediate error with clear message

**Key Benefit:** Same manual process, but with fail-fast validation that prevents silent failures.

## References

- **Operator Registry:** `src/logic/jsonLogicCustomOperators.js`
- **Evaluation Service:** `src/logic/jsonLogicEvaluationService.js`
- **Validation Utility:** `src/logic/operatorRegistrationValidator.js`
- **Tests:** `tests/unit/logic/jsonLogicOperatorRegistration.test.js`
- **Report:** `reports/anatomy-prerequisite-test-fixes-2025-01.md` (lines 164-192)
```

## Acceptance Criteria

### Code Changes
- [ ] Operator registration validator created (`src/logic/operatorRegistrationValidator.js`)
  - [ ] `validateOperatorWhitelist()` function
  - [ ] `generateAllowedOperations()` function (for tests)
  - [ ] `isStandardOperator()` helper function
- [ ] `JsonLogicCustomOperators` modified to track registered operators
  - [ ] Private `#registeredOperators` Set added
  - [ ] Private `#registerOperator()` helper method
  - [ ] Public `getRegisteredOperators()` method
  - [ ] `registerOperators()` updated to use helper and validate
- [ ] `JsonLogicEvaluationService` modified to expose whitelist
  - [ ] `ALLOWED_OPERATIONS` moved from local const to `#allowedOperations` class property
  - [ ] Public `getAllowedOperations()` method added
  - [ ] Public `isOperatorAllowed()` method added (optional but useful)
  - [ ] `#validateJsonLogic()` updated to use `this.#allowedOperations`

### Testing
- [ ] Registration validation tests created (`tests/unit/logic/jsonLogicOperatorRegistration.test.js`)
  - [ ] Tests verify operator tracking
  - [ ] Tests verify whitelist synchronization
  - [ ] Tests simulate the original bug (operator registered but not whitelisted)
  - [ ] Tests verify validation throws clear errors
- [ ] All existing tests pass (no regressions)
- [ ] Error messages provide clear remediation steps

### Documentation
- [ ] Operator development guide created at `docs/development/json-logic-operator-guide.md`
- [ ] Guide includes:
  - [ ] Operator registration process (4 steps: implement, register, whitelist, test)
  - [ ] Explanation of why manual whitelist is still needed
  - [ ] Automatic validation explanation
  - [ ] Error message examples
  - [ ] Comparison of before/after behavior
- [ ] CLAUDE.md updated with reference to operator guide (optional)

### Validation
- [ ] Manual test: Add new operator without whitelist entry → should throw clear error
- [ ] Manual test: Add whitelist entry without registering → should warn
- [ ] Integration test: Existing operators continue to work correctly

## Implementation Notes

**Key Design Decisions:**

1. **Validation over Auto-Generation**: Add validation to manual process to catch errors early without changing DI architecture
2. **Fail-Fast**: Validate during `registerOperators()` rather than at first usage
3. **Clear Errors**: Provide actionable error messages with remediation steps
4. **Minimal Changes**: Work within existing class-based architecture

**Testing Strategy:**

1. Unit tests verify registration tracking in `JsonLogicCustomOperators`
2. Tests verify whitelist exposure in `JsonLogicEvaluationService`
3. Tests verify `validateOperatorWhitelist()` utility function
4. Tests simulate the original bug (operator registered but not whitelisted)
5. Integration tests ensure no regressions with existing operators

**Architecture Constraints:**

- `JsonLogicEvaluationService` is instantiated before operators are registered
- Circular dependency if evaluation service needs custom operators service
- Manual whitelist provides explicit security review point
- Future refactor could enable full auto-generation with DI changes

**Performance Considerations:**

- Validation only runs once at initialization (negligible impact)
- Operator tracking uses Set (O(1) lookups)
- No runtime performance impact after initialization

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
