# JSON Logic Custom Operator Development Guide

## Overview

This guide explains how to create, register, and validate custom JSON Logic operators in the Living Narrative Engine.

## Quick Reference

When adding a new operator, follow these 4 steps:

1. **Implement** operator class in `src/logic/operators/`
2. **Register** operator in `JsonLogicCustomOperators.registerOperators()`
3. **Whitelist** operator in `JsonLogicEvaluationService` constructor
4. **Test** operator in `tests/unit/logic/operators/`

**Validation happens automatically** - if you forget step 3, the system will throw a clear error at initialization.

## Operator Registration Process

### Step 1: Implement Operator Class

Create the operator implementation in `src/logic/operators/`:

```javascript
// src/logic/operators/myCustomOperator.js

import { BaseOperator } from './baseOperator.js';

/**
 * Custom operator: myCustomOperator
 *
 * Usage: { "myCustomOperator": ["entity", "value"] }
 *
 * @description Checks if entity has specific property value
 */
export class MyCustomOperator extends BaseOperator {
  constructor({ entityManager, logger }) {
    super({ logger });
    this.entityManager = entityManager;
  }

  /**
   * Evaluate the operator
   *
   * @param {Array} args - Operator arguments [entityPath, expectedValue]
   * @param {Object} context - Evaluation context with data
   * @returns {boolean} Result of operation
   */
  evaluate(args, context) {
    const [entityPath, expectedValue] = args;

    // Get entity from context using path
    const entity = this.resolveEntity(entityPath, context);
    if (!entity) {
      return false;
    }

    // Implement operator logic
    const componentData = this.entityManager.getComponentData(
      entity.id,
      'core:my_component'
    );

    return componentData?.value === expectedValue;
  }
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

    // ... existing operator registrations ...

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

    // ... rest of registrations ...

    // Validation happens automatically at end of method
    const allowedOps = jsonLogicEvaluationService.getAllowedOperations();
    validateOperatorWhitelist(this.#registeredOperators, allowedOps, this.#logger);
  }
}
```

### Step 3: Add to ALLOWED_OPERATIONS Whitelist

**⚠️ MANUAL STEP REQUIRED** (for now):

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

**✅ Validation** (automatic):

After adding to whitelist, validation happens automatically:
1. ✅ Operator added to `#registeredOperators` set when registered
2. ✅ `validateOperatorWhitelist()` called at end of `registerOperators()`
3. ✅ Throws error if operator is registered but not in `#allowedOperations`
4. ✅ Warns if operator is in whitelist but not registered

### Step 4: Write Tests

Create tests in `tests/unit/logic/operators/`:

```javascript
// tests/unit/logic/operators/myCustomOperator.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MyCustomOperator } from '../../../../src/logic/operators/myCustomOperator.js';

describe('MyCustomOperator', () => {
  let operator;
  let entityManager;
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = {
      getComponentData: jest.fn(),
    };

    operator = new MyCustomOperator({ entityManager, logger });
  });

  it('should return true when entity has matching value', () => {
    const context = {
      entity: { id: 'entity-1' },
    };

    entityManager.getComponentData.mockReturnValue({ value: 'expected' });

    const result = operator.evaluate(['entity', 'expected'], context);

    expect(result).toBe(true);
    expect(entityManager.getComponentData).toHaveBeenCalledWith(
      'entity-1',
      'core:my_component'
    );
  });

  it('should return false when entity has different value', () => {
    const context = {
      entity: { id: 'entity-1' },
    };

    entityManager.getComponentData.mockReturnValue({ value: 'different' });

    const result = operator.evaluate(['entity', 'expected'], context);

    expect(result).toBe(false);
  });

  it('should return false when entity not found', () => {
    const context = {};

    const result = operator.evaluate(['entity', 'expected'], context);

    expect(result).toBe(false);
  });
});
```

## Automatic Validation

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. JsonLogicCustomOperators.registerOperators()            │
│    - Calls #registerOperator() for each custom operator    │
│    - Adds operator name to #registeredOperators set        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. End of registerOperators()                              │
│    - Calls getAllowedOperations() on evaluation service    │
│    - Calls validateOperatorWhitelist()                     │
│    - Compares registered vs allowed operators              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. validateOperatorWhitelist()                             │
│    - Throws error if operator registered but not whitelisted│
│    - Warns if operator whitelisted but not registered      │
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

### Missing Whitelist Entry

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
Error: JSON Logic validation error: Disallowed operation 'unknownOperator'
```

## Improvement from Current System

The enhancement adds automatic validation to the existing manual process:

**Before (No Validation):**
1. Implement operator in `src/logic/operators/`
2. Register in `JsonLogicCustomOperators.registerOperators()`
3. Manually add to `ALLOWED_OPERATIONS` whitelist
4. ⚠️ If you forget step 3, silent failure occurs

**After (With Validation):**
1. Implement operator in `src/logic/operators/`
2. Register in `JsonLogicCustomOperators.registerOperators()` using `#registerOperator()` helper
3. Manually add to `ALLOWED_OPERATIONS` whitelist
4. ✅ `validateOperatorWhitelist()` called automatically
5. ✅ If you forget step 3, immediate error with clear message

**Key Benefit:** Same manual process, but with fail-fast validation that prevents silent failures.

## Testing Best Practices

### Unit Tests

Test the operator in isolation:

```javascript
describe('MyCustomOperator', () => {
  it('should handle expected case', () => {
    // Test normal operation
  });

  it('should handle edge cases', () => {
    // Test null, undefined, empty values
  });

  it('should handle errors gracefully', () => {
    // Test error conditions
  });
});
```

### Integration Tests

Test the operator in context:

```javascript
describe('MyCustomOperator Integration', () => {
  it('should work in JSON Logic expressions', () => {
    const logic = { myCustomOperator: ['entity', 'value'] };
    const result = evaluationService.evaluate(logic, context);
    expect(result).toBe(true);
  });

  it('should work in nested expressions', () => {
    const logic = {
      and: [
        { myCustomOperator: ['entity', 'value'] },
        { hasPartOfType: ['entity', 'hand'] }
      ]
    };
    const result = evaluationService.evaluate(logic, context);
    expect(result).toBe(true);
  });
});
```

### Registration Tests

Registration tests are automatically provided in `jsonLogicOperatorRegistration.test.js`. Your operator will be validated as part of the suite.

## Common Pitfalls

### ❌ Forgetting Whitelist Entry

**Symptom**: Error at initialization: "Custom operators are registered but not in ALLOWED_OPERATIONS whitelist"

**Fix**: Add operator to `#allowedOperations` in `JsonLogicEvaluationService` constructor

### ❌ Operator Name Mismatch

**Symptom**: Operator not found when evaluating rules

**Fix**: Ensure operator name matches exactly in:
- Registration call: `this.#registerOperator('myOperator', ...)`
- Whitelist entry: `'myOperator'`
- Usage in rules: `{ "myOperator": [...] }`

### ❌ Not Using Helper Method

**Symptom**: Operator works but validation fails

**Fix**: Use `this.#registerOperator()` instead of directly calling `jsonLogicEvaluationService.addOperation()`

### ❌ Missing Operator Tests

**Symptom**: Operator works in development but breaks in production

**Fix**: Always write comprehensive unit tests for new operators

## References

- **Operator Registry:** `src/logic/jsonLogicCustomOperators.js`
- **Evaluation Service:** `src/logic/jsonLogicEvaluationService.js`
- **Validation Utility:** `src/logic/operatorRegistrationValidator.js`
- **Registration Tests:** `tests/unit/logic/jsonLogicOperatorRegistration.test.js`
- **Workflow:** `workflows/ANAPRETEST-003-enforce-json-logic-operator-registration.md`

## Example: Adding a New Operator

Let's walk through adding a `hasTag` operator:

### 1. Implement Operator

```javascript
// src/logic/operators/hasTagOperator.js

import { BaseOperator } from './baseOperator.js';

export class HasTagOperator extends BaseOperator {
  constructor({ entityManager, logger }) {
    super({ logger });
    this.entityManager = entityManager;
  }

  evaluate(args, context) {
    const [entityPath, tagName] = args;
    const entity = this.resolveEntity(entityPath, context);

    if (!entity) return false;

    const tags = this.entityManager.getComponentData(entity.id, 'core:tags');
    return tags?.tags?.includes(tagName) ?? false;
  }
}
```

### 2. Register Operator

```javascript
// In src/logic/jsonLogicCustomOperators.js

import { HasTagOperator } from './operators/hasTagOperator.js';

// In registerOperators():
const hasTagOp = new HasTagOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});

this.#registerOperator(
  'hasTag',
  function (entityPath, tagName) {
    return hasTagOp.evaluate([entityPath, tagName], this);
  },
  jsonLogicEvaluationService
);
```

### 3. Add to Whitelist

```javascript
// In src/logic/jsonLogicEvaluationService.js constructor

this.#allowedOperations = new Set([
  // ... existing operators ...
  'hasTag',  // <-- ADD THIS
  // ...
]);
```

### 4. Write Tests

```javascript
// tests/unit/logic/operators/hasTagOperator.test.js

describe('HasTagOperator', () => {
  it('should return true when entity has tag', () => {
    // Test implementation
  });

  it('should return false when entity does not have tag', () => {
    // Test implementation
  });
});
```

### 5. Run Tests

```bash
NODE_ENV=test npx jest tests/unit/logic/jsonLogicOperatorRegistration.test.js
NODE_ENV=test npx jest tests/unit/logic/operators/hasTagOperator.test.js
```

✅ If validation passes, your operator is properly integrated!

## Summary

The operator registration system now provides:

- ✅ **Automatic tracking** of registered operators
- ✅ **Fail-fast validation** at initialization
- ✅ **Clear error messages** with remediation steps
- ✅ **Warning for stale whitelist entries**
- ✅ **Security via explicit whitelist**

This prevents the class of bugs where operators are implemented and registered but fail silently due to missing whitelist entries.

---

**Last Updated:** 2025-11-10
**Related Workflow:** ANAPRETEST-003
