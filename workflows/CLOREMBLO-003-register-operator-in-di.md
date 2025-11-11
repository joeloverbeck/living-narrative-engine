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

**File**: `src/logic/jsonLogicCustomOperators.js`

**Changes Required**:

1. **Import the Operator** (at top of file):
```javascript
import { IsRemovalBlockedOperator } from './operators/isRemovalBlockedOperator.js';
```

2. **Instantiate Operator in `registerOperators()` method** (around line 115):
```javascript
const isRemovalBlockedOp = new IsRemovalBlockedOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});
```

3. **Register with JSON Logic Engine** (around line 287):
```javascript
// Register isRemovalBlocked operator
this.#registerOperator(
  'isRemovalBlocked',
  function (actorPath, targetItemPath) {
    // 'this' is the evaluation context
    return isRemovalBlockedOp.evaluate([actorPath, targetItemPath], this);
  },
  jsonLogicEvaluationService
);
```

### Design Rationale

1. **Centralized Registration**: All custom operators are registered in one place (`JsonLogicCustomOperators`)
2. **Service Encapsulation**: The `JsonLogicCustomOperators` service manages operator lifecycle and registration
3. **Testability**: Operators can be tested in isolation with mocked dependencies
4. **Consistency**: Follows existing operator registration pattern used by 11+ other operators
5. **Automatic Validation**: Registered operators are automatically validated against whitelist

---

## Implementation Tasks

### 1. Locate Registration File

Custom JSON Logic operators are registered in `src/logic/jsonLogicCustomOperators.js`. This service is instantiated in `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` (lines 391-414).

### 2. Add Operator Import

At the top of `src/logic/jsonLogicCustomOperators.js` (around line 14), add:

```javascript
import { IsRemovalBlockedOperator } from './operators/isRemovalBlockedOperator.js';
```

### 3. Instantiate Operator

In the `registerOperators(jsonLogicEvaluationService)` method (around line 115), add the operator instantiation:

```javascript
const isRemovalBlockedOp = new IsRemovalBlockedOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});
```

### 4. Register with JSON Logic

After all operator instantiations (around line 287, before the VALIDATION comment), add:

```javascript
// Register isRemovalBlocked operator
this.#registerOperator(
  'isRemovalBlocked',
  function (actorPath, targetItemPath) {
    // 'this' is the evaluation context
    return isRemovalBlockedOp.evaluate([actorPath, targetItemPath], this);
  },
  jsonLogicEvaluationService
);
```

### 5. Create Integration Tests

**File**: `tests/integration/logic/operators/isRemovalBlockedOperator.integration.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import { IsRemovalBlockedOperator } from '../../../../src/logic/operators/isRemovalBlockedOperator.js';
import EntityManagerIntegrationTestBed from '../../../common/entities/entityManagerIntegrationTestBed.js';

describe('IsRemovalBlocked Operator integration with EntityManager', () => {
  let testBed;
  let entityManager;
  let actorDefinition;
  let wearableDefinition;
  let actor;
  let belt;
  let pants;
  let operator;

  const registerDefinition = (definition) => {
    testBed.registry.store('entityDefinitions', definition.id, definition);
  };

  const createWearable = async (instanceId, components = {}) => {
    const instance = await entityManager.createEntityInstance(
      wearableDefinition.id,
      { instanceId }
    );

    for (const [componentId, data] of Object.entries(components)) {
      await entityManager.addComponent(instance.id, componentId, data);
    }

    return instance;
  };

  const equipItem = async (actorId, itemId, slot, layer) => {
    const equipment = entityManager.getComponentData(actorId, 'clothing:equipment') || {
      equipped: {},
    };

    if (!equipment.equipped[slot]) {
      equipment.equipped[slot] = {};
    }
    if (!equipment.equipped[slot][layer]) {
      equipment.equipped[slot][layer] = [];
    }

    if (!Array.isArray(equipment.equipped[slot][layer])) {
      equipment.equipped[slot][layer] = [equipment.equipped[slot][layer]];
    }

    equipment.equipped[slot][layer].push(itemId);

    await entityManager.addComponent(actorId, 'clothing:equipment', equipment);
  };

  const evaluate = (contextOverrides = {}) => {
    const context = {
      actor: { id: actor.id },
      targetItem: { id: pants.id },
      ...contextOverrides,
    };
    return operator.evaluate(['actor', 'targetItem'], context);
  };

  beforeEach(async () => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;

    actorDefinition = new EntityDefinition('integration:actor', {
      description: 'integration actor',
      components: {},
    });

    wearableDefinition = new EntityDefinition('integration:wearable', {
      description: 'integration wearable item',
      components: {},
    });

    registerDefinition(actorDefinition);
    registerDefinition(wearableDefinition);

    actor = await entityManager.createEntityInstance(actorDefinition.id, {
      instanceId: 'actor-1',
    });

    belt = await createWearable('belt-1', {
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

    pants = await createWearable('pants-1', {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    // Initialize equipment component
    await entityManager.addComponent(actor.id, 'clothing:equipment', {
      equipped: {},
    });

    operator = new IsRemovalBlockedOperator({
      entityManager,
      logger: testBed.logger,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should return false when actor has no equipment', () => {
    expect(evaluate()).toBe(false);
  });

  it('should return false when target item is not wearable', async () => {
    const nonWearable = await entityManager.createEntityInstance(
      wearableDefinition.id,
      { instanceId: 'non-wearable' }
    );

    const context = {
      actor: { id: actor.id },
      targetItem: { id: nonWearable.id },
    };

    expect(operator.evaluate(['actor', 'targetItem'], context)).toBe(false);
  });

  it('should return true when removal is blocked by slot rules', async () => {
    // Equip belt first (blocks pants removal)
    await equipItem(actor.id, belt.id, 'torso_lower', 'accessories');
    // Equip pants
    await equipItem(actor.id, pants.id, 'legs', 'base');

    expect(evaluate()).toBe(true);
  });

  it('should return false when no items block removal', async () => {
    // Only equip pants (no blockers)
    await equipItem(actor.id, pants.id, 'legs', 'base');

    expect(evaluate()).toBe(false);
  });

  it('should handle operator with invalid arguments', () => {
    const context = {
      actor: null,
      targetItem: null,
    };

    expect(operator.evaluate(['actor', 'targetItem'], context)).toBe(false);
  });
});
```

### 6. Run Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/logic/operators/isRemovalBlockedOperator.integration.test.js --no-coverage --silent
```

Target: All tests pass.

---

## Validation

### Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/logic/operators/isRemovalBlockedOperator.integration.test.js --no-coverage --silent
```

Expected: All tests pass.

### Type Checking

```bash
npm run typecheck
```

Expected: No errors.

### ESLint

```bash
npx eslint src/logic/jsonLogicCustomOperators.js tests/integration/logic/operators/isRemovalBlockedOperator.integration.test.js
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
const jsonLogic = window.game.container.resolve('JsonLogicEvaluationService');
const result = jsonLogic.apply({
  isRemovalBlocked: ['actor', 'targetItem']
}, { actor: { id: 'test-actor' }, targetItem: { id: 'test-item' } });
console.log('Operator works:', typeof result === 'boolean');
```

---

## Acceptance Criteria

- [ ] `IsRemovalBlockedOperator` imported in `jsonLogicCustomOperators.js`
- [ ] Operator instantiated with correct dependencies in `registerOperators()` method
- [ ] Operator registered with JSON Logic engine using `#registerOperator()` helper
- [ ] Integration tests created and passing
- [ ] Operator can be used in JSON Logic expressions
- [ ] Negation works correctly (for `can-remove-item` condition)
- [ ] ESLint passes on modified files
- [ ] Type checking passes
- [ ] Manual verification successful

---

## Notes

- Follow existing operator registration patterns in `JsonLogicCustomOperators` class
- See other operators (e.g., `HasClothingInSlotOperator`, `IsSocketCoveredOperator`) as examples
- The operator name `isRemovalBlocked` should match the name used in conditions
- Operators are instantiated in the `registerOperators()` method with class-level dependencies
- The `#registerOperator()` helper automatically tracks registered operators
- Integration tests should use `EntityManagerIntegrationTestBed` and directly instantiate the operator

---

## Common Pitfalls

**Pitfall**: Adding operator to wrong file (e.g., creating a new registration file)
**Solution**: All custom JSON Logic operators go in `JsonLogicCustomOperators` class

**Pitfall**: Wrong operator name in `#registerOperator()`
**Solution**: Use `isRemovalBlocked` (camelCase) consistently

**Pitfall**: Missing dependencies during instantiation
**Solution**: Operators in `JsonLogicCustomOperators` use `this.#entityManager` and `this.#logger`

**Pitfall**: Not using the evaluation context properly
**Solution**: The wrapper function should use `function` keyword (not arrow) so `this` refers to evaluation context

**Pitfall**: Forgetting to add operator to validation whitelist
**Solution**: The `validateOperatorWhitelist()` call at the end of `registerOperators()` will catch this

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
