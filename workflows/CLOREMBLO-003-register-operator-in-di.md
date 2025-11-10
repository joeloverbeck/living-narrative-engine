# CLOREMBLO-003: Register IsRemovalBlocked Operator in DI Container

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 1-2 hours
**Phase**: 2 - Core Logic

---

## Overview

Register the `IsRemovalBlockedOperator` in the dependency injection container and integrate it with the JSON Logic engine. This enables the operator to be used in condition expressions and scope resolution logic throughout the system.

---

## Background

The `IsRemovalBlockedOperator` must be registered in two places:
1. **DI Container**: As a factory that creates instances with proper dependencies
2. **JSON Logic Engine**: As a custom operation named `isRemovalBlocked`

This allows the operator to be used in JSON Logic expressions like:
```json
{
  "isRemovalBlocked": ["{actorId}", "{targetItemId}"]
}
```

---

## Requirements

### DI Container Registration

**File**: `src/dependencyInjection/registrations/jsonLogicRegistrations.js`

**Changes Required**:

1. **Import the Operator**:
```javascript
import IsRemovalBlockedOperator from '../../logic/operators/isRemovalBlockedOperator.js';
```

2. **Register Factory in DI Container**:
```javascript
// In the registration function (e.g., registerJsonLogicOperators)
container.registerFactory(
  'IsRemovalBlockedOperator',
  (c) => new IsRemovalBlockedOperator({
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
  })
);
```

3. **Register with JSON Logic Engine**:
```javascript
// After creating the operator instance
const jsonLogic = container.resolve(tokens.IJSONLogic);
const isRemovalBlockedOperator = container.resolve('IsRemovalBlockedOperator');

jsonLogic.addOperation('isRemovalBlocked', (args, data) =>
  isRemovalBlockedOperator.evaluate(args, data)
);
```

### Design Rationale

1. **Factory Pattern**: Operator is created by the DI container with proper dependencies
2. **Lazy Resolution**: Operator is only created when needed
3. **Testability**: Dependencies can be mocked for testing
4. **Consistency**: Follows existing operator registration pattern
5. **Encapsulation**: JSON Logic engine doesn't know about DI internals

---

## Implementation Tasks

### 1. Locate Registration File

The JSON Logic operators are registered in `src/dependencyInjection/registrations/jsonLogicRegistrations.js`. If this file doesn't exist, check for similar registration files in the `src/dependencyInjection/registrations/` directory.

### 2. Add Operator Import

At the top of the registration file, add:

```javascript
import IsRemovalBlockedOperator from '../../logic/operators/isRemovalBlockedOperator.js';
```

### 3. Register Factory

Find the function that registers JSON Logic operators (likely named `registerJsonLogicOperators` or similar). Add the factory registration:

```javascript
container.registerFactory(
  'IsRemovalBlockedOperator',
  (c) => new IsRemovalBlockedOperator({
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
  })
);
```

### 4. Register with JSON Logic

After the factory registration, add the JSON Logic operation:

```javascript
const jsonLogic = container.resolve(tokens.IJSONLogic);
const isRemovalBlockedOperator = container.resolve('IsRemovalBlockedOperator');

jsonLogic.addOperation('isRemovalBlocked', (args, data) =>
  isRemovalBlockedOperator.evaluate(args, data)
);
```

### 5. Create Integration Tests

**File**: `tests/integration/logic/operators/isRemovalBlockedOperatorDI.integration.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('IsRemovalBlocked Operator DI Integration', () => {
  let testBed;

  beforeEach(async () => {
    testBed = createTestBed();
    await testBed.initialize();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should resolve operator from DI container', () => {
    // Arrange
    const container = testBed.getContainer();

    // Act
    const operator = container.resolve('IsRemovalBlockedOperator');

    // Assert
    expect(operator).toBeDefined();
    expect(operator.evaluate).toBeInstanceOf(Function);
  });

  it('should register operator with JSON Logic engine', () => {
    // Arrange
    const container = testBed.getContainer();
    const jsonLogic = container.resolve('IJSONLogic');

    // Create test entities
    const actorId = testBed.createEntity('actor1', ['clothing:equipment']);
    const beltId = testBed.createEntity('belt1', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });
    const pantsId = testBed.createEntity('pants1', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    // Equip items
    testBed.equipItem(actorId, beltId);
    testBed.equipItem(actorId, pantsId);

    // Act: Use operator through JSON Logic
    const result = jsonLogic.apply(
      { isRemovalBlocked: [actorId, pantsId] },
      {}
    );

    // Assert
    expect(result).toBe(true);
  });

  it('should work with negation in JSON Logic', () => {
    // Arrange
    const container = testBed.getContainer();
    const jsonLogic = container.resolve('IJSONLogic');

    const actorId = testBed.createEntity('actor1', ['clothing:equipment']);
    const shirtId = testBed.createEntity('shirt1', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      },
    });

    testBed.equipItem(actorId, shirtId);

    // Act: Use operator with negation (for can-remove-item condition)
    const result = jsonLogic.apply(
      { '!': { isRemovalBlocked: [actorId, shirtId] } },
      {}
    );

    // Assert
    expect(result).toBe(true); // Not blocked = can remove
  });

  it('should handle operator errors gracefully', () => {
    // Arrange
    const container = testBed.getContainer();
    const jsonLogic = container.resolve('IJSONLogic');

    // Act: Use operator with invalid arguments
    const result = jsonLogic.apply(
      { isRemovalBlocked: [null, null] },
      {}
    );

    // Assert
    expect(result).toBe(false); // Fails safe
  });
});
```

### 6. Run Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/logic/operators/isRemovalBlockedOperatorDI.integration.test.js
```

Target: All tests pass.

---

## Validation

### Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/logic/operators/isRemovalBlockedOperatorDI.integration.test.js
```

Expected: All tests pass.

### Type Checking

```bash
npm run typecheck
```

Expected: No errors.

### ESLint

```bash
npx eslint src/dependencyInjection/registrations/jsonLogicRegistrations.js
```

Expected: No warnings or errors.

### Manual Verification

1. Start the application:
```bash
npm run dev
```

2. In browser console, verify operator is registered:
```javascript
// Check if operator exists in JSON Logic
const jsonLogic = window.game.container.resolve('IJSONLogic');
const result = jsonLogic.apply({
  isRemovalBlocked: ['actor1', 'item1']
}, {});
console.log('Operator works:', typeof result === 'boolean');
```

---

## Acceptance Criteria

- [ ] `IsRemovalBlockedOperator` imported in registration file
- [ ] Factory registered in DI container
- [ ] Operator registered with JSON Logic engine
- [ ] Factory resolves operator with correct dependencies
- [ ] Integration tests created and passing
- [ ] Operator can be used in JSON Logic expressions
- [ ] Negation works correctly (for `can-remove-item` condition)
- [ ] ESLint passes on modified files
- [ ] Type checking passes
- [ ] Manual verification successful

---

## Notes

- Follow existing operator registration patterns in the codebase
- Ensure operator is registered AFTER JSON Logic engine is created
- The operator name `isRemovalBlocked` should match the name used in conditions
- Factory pattern ensures proper dependency injection
- Integration tests verify end-to-end operator functionality

---

## Common Pitfalls

**Pitfall**: Registering operator before JSON Logic engine is created
**Solution**: Check registration order; JSON Logic must exist first

**Pitfall**: Wrong operator name in `addOperation()`
**Solution**: Use `isRemovalBlocked` (camelCase) consistently

**Pitfall**: Missing dependencies in factory
**Solution**: Verify `entityManager` and `logger` are both resolved

**Pitfall**: Operator not testable in isolation
**Solution**: Use factory pattern so dependencies can be mocked

---

## Example Usage After Registration

### In Condition Expressions

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "clothing:can-remove-item",
  "type": "inline",
  "expression": {
    "!": {
      "isRemovalBlocked": ["{actorId}", "{targetId}"]
    }
  }
}
```

### In Complex Logic

```json
{
  "and": [
    {
      "!": {
        "isRemovalBlocked": ["{actorId}", "{targetId}"]
      }
    },
    {
      "hasComponent": ["{targetId}", "clothing:wearable"]
    }
  ]
}
```

---

## Related Tickets

- **CLOREMBLO-002**: Implement IsRemovalBlockedOperator (prerequisite)
- **CLOREMBLO-004**: Integrate blocking logic into slotAccessResolver (uses this)
- **CLOREMBLO-005**: Create can-remove-item condition (uses this)
- **CLOREMBLO-007**: Create comprehensive test suite (validates this)
