# Specification: Add Free Grabbing Appendage Prerequisites to 5 Actions

## Overview

This specification documents the addition of free grabbing appendage prerequisites to 5 action files. All actions require at least 1 free grabbing appendage (hand/tentacle/claw) to perform.

### Scope

- **5 action files** to modify
- **5 test files** to create (prerequisite evaluation + action discovery tests)
- Uses existing `anatomy:actor-has-free-grabbing-appendage` condition

### Related Files

- Operator: `src/logic/operators/hasFreeGrabbingAppendagesOperator.js`
- Condition: `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json`
- Test pattern: `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`
- Testing guide: `docs/testing/mod-testing-guide.md`

---

## JSON Changes

### 1. `data/mods/violence/actions/slap.action.json`

**Change Type**: ADD `prerequisites` array after `forbidden_components`

**Current State (lines 13-15)**:

```json
  "forbidden_components": {
    "actor": ["positioning:hugging", "positioning:giving_blowjob", "positioning:doing_complex_performance", "positioning:bending_over"]
  },
  "template": "slap {target}",
```

**New State**:

```json
  "forbidden_components": {
    "actor": ["positioning:hugging", "positioning:giving_blowjob", "positioning:doing_complex_performance", "positioning:bending_over"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to slap someone."
    }
  ],
  "template": "slap {target}",
```

---

### 2. `data/mods/violence/actions/sucker_punch.action.json`

**Change Type**: ADD `prerequisites` array after `forbidden_components`

**Current State (lines 13-15)**:

```json
  "forbidden_components": {
    "actor": ["positioning:hugging", "positioning:giving_blowjob", "positioning:doing_complex_performance", "positioning:bending_over"]
  },
  "template": "sucker-punch {target}",
```

**New State**:

```json
  "forbidden_components": {
    "actor": ["positioning:hugging", "positioning:giving_blowjob", "positioning:doing_complex_performance", "positioning:bending_over"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to throw a punch."
    }
  ],
  "template": "sucker-punch {target}",
```

---

### 3. `data/mods/seduction/actions/brush_hair_back_coyly.action.json`

**Change Type**: INSERT new prerequisite at INDEX 0 of existing `prerequisites` array

**Current State (lines 12-25)**:

```json
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "hair"]
      },
      "failure_message": "You need hair to perform this action."
    },
    {
      "logic": {
        "hasOtherActorsAtLocation": ["actor"]
      },
      "failure_message": "There is nobody here to draw attention from."
    }
  ],
```

**New State**:

```json
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to brush your hair."
    },
    {
      "logic": {
        "hasPartOfType": ["actor", "hair"]
      },
      "failure_message": "You need hair to perform this action."
    },
    {
      "logic": {
        "hasOtherActorsAtLocation": ["actor"]
      },
      "failure_message": "There is nobody here to draw attention from."
    }
  ],
```

---

### 4. `data/mods/containers/actions/put_in_container.action.json`

**Change Type**: ADD `prerequisites` array after `required_components`

**Current State (lines 7-10)**:

```json
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
```

**New State**:

```json
  "required_components": {
    "actor": ["items:inventory"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to put an item in a container."
    }
  ],
  "targets": {
```

---

### 5. `data/mods/items/actions/give_item.action.json`

**Change Type**: ADD `prerequisites` array after `forbidden_components`

**Current State (lines 10-13)**:

```json
  "forbidden_components": {
    "actor": ["positioning:bending_over"]
  },
  "targets": {
```

**New State**:

```json
  "forbidden_components": {
    "actor": ["positioning:bending_over"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to give an item."
    }
  ],
  "targets": {
```

---

## Test Specifications

### Test Files to Create

| #   | Test File Path                                                                 | Action Under Test                 |
| --- | ------------------------------------------------------------------------------ | --------------------------------- |
| 1   | `tests/integration/mods/violence/slap_prerequisites.test.js`                   | `violence:slap`                   |
| 2   | `tests/integration/mods/violence/sucker_punch_prerequisites.test.js`           | `violence:sucker_punch`           |
| 3   | `tests/integration/mods/seduction/brush_hair_back_coyly_prerequisites.test.js` | `seduction:brush_hair_back_coyly` |
| 4   | `tests/integration/mods/items/put_in_container_prerequisites.test.js`          | `containers:put_in_container`          |
| 5   | `tests/integration/mods/items/give_item_prerequisites.test.js`                 | `items:give_item`                 |

### Test Structure Template

Each test file should follow the pattern from `wield_threateningly_prerequisites.test.js`:

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for {ACTION_ID} action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage
 *
 * @see {ACTION_FILE_PATH}
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import actionDefinition from '{ACTION_IMPORT_PATH}';
import actorHasFreeGrabbingCondition from '../../../../data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json';

jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));
```

### Required Test Suites

#### Suite 1: Action Definition Structure

```javascript
describe('action definition structure', () => {
  test('should have prerequisites array defined');
  test('should reference anatomy:actor-has-free-grabbing-appendage condition');
  test('should have failure_message for user feedback');
  test('should preserve other action properties');
});
```

#### Suite 2: Prerequisite Evaluation - Pass Cases

```javascript
describe('prerequisite evaluation - free grabbing appendage available', () => {
  test('should pass when actor has exactly one free grabbing appendage');
  test('should pass when actor has multiple free grabbing appendages');
  test('should pass for actor with two hands both free');
});
```

#### Suite 3: Prerequisite Evaluation - Fail Cases

```javascript
describe('prerequisite evaluation - no free grabbing appendage', () => {
  test('should fail when actor has zero free grabbing appendages');
  test('should fail when all appendages are locked (holding items)');
});
```

#### Suite 4: Edge Cases

```javascript
describe('edge cases', () => {
  test('should handle missing actor gracefully');
  test('should handle actor with no grabbing appendages');
});
```

#### Suite 5: Condition Definition Validation

```javascript
describe('condition definition validation', () => {
  test('should use hasFreeGrabbingAppendages operator with parameter 1');
  test('condition ID should match what the action references');
});
```

#### Suite 6: Action Discovery (Additional Test File or Suite)

For comprehensive coverage, add discovery tests using `ModTestFixture`:

```javascript
describe('action discovery - grabbing prerequisite', () => {
  test(
    'should appear in available actions when actor has free grabbing appendage'
  );
  test(
    'should NOT appear in available actions when actor has no free grabbing appendages'
  );
  test('should NOT appear when all appendages are occupied');
});
```

### Action-Specific Test Assertions

#### slap.action.json

```javascript
test('should preserve other action properties', () => {
  expect(slapAction.id).toBe('violence:slap');
  expect(slapAction.template).toBe('slap {target}');
  expect(slapAction.targets.primary.scope).toBe('core:actors_in_location');
});
```

#### sucker_punch.action.json

```javascript
test('should preserve other action properties', () => {
  expect(suckerPunchAction.id).toBe('violence:sucker_punch');
  expect(suckerPunchAction.template).toBe('sucker-punch {target}');
  expect(suckerPunchAction.targets.primary.scope).toBe(
    'core:actors_in_location'
  );
});
```

#### brush_hair_back_coyly.action.json (Multiple Prerequisites)

```javascript
describe('multiple prerequisites', () => {
  test('should have three prerequisites total', () => {
    expect(brushHairAction.prerequisites.length).toBe(3);
  });

  test('grabbing prerequisite should be first in array', () => {
    expect(brushHairAction.prerequisites[0].logic.condition_ref).toBe(
      'anatomy:actor-has-free-grabbing-appendage'
    );
  });

  test('should preserve existing hasPartOfType prerequisite', () => {
    expect(brushHairAction.prerequisites[1].logic.hasPartOfType).toEqual([
      'actor',
      'hair',
    ]);
  });

  test('should preserve existing hasOtherActorsAtLocation prerequisite', () => {
    expect(
      brushHairAction.prerequisites[2].logic.hasOtherActorsAtLocation
    ).toBeDefined();
  });
});
```

#### put_in_container.action.json

```javascript
test('should preserve other action properties', () => {
  expect(putInContainerAction.id).toBe('containers:put_in_container');
  expect(putInContainerAction.generateCombinations).toBe(true);
  expect(putInContainerAction.targets.primary.scope).toBe(
    'containers-core:open_containers_at_location'
  );
  expect(putInContainerAction.targets.secondary.scope).toBe(
    'items:actor_inventory_items'
  );
});
```

#### give_item.action.json

```javascript
test('should preserve other action properties', () => {
  expect(giveItemAction.id).toBe('items:give_item');
  expect(giveItemAction.generateCombinations).toBe(true);
  expect(giveItemAction.targets.primary.scope).toBe('core:actors_in_location');
  expect(giveItemAction.forbidden_components.actor).toContain(
    'positioning:bending_over'
  );
});
```

---

## Implementation Checklist

### Phase 1: JSON Changes

- [ ] Modify `slap.action.json` - add prerequisites array
- [ ] Modify `sucker_punch.action.json` - add prerequisites array
- [ ] Modify `brush_hair_back_coyly.action.json` - insert at index 0
- [ ] Modify `put_in_container.action.json` - add prerequisites array
- [ ] Modify `give_item.action.json` - add prerequisites array
- [ ] Run `npm run validate` to verify schema compliance

### Phase 2: Test Creation

- [ ] Create `slap_prerequisites.test.js`
- [ ] Create `sucker_punch_prerequisites.test.js`
- [ ] Create `brush_hair_back_coyly_prerequisites.test.js`
- [ ] Create `put_in_container_prerequisites.test.js`
- [ ] Create `give_item_prerequisites.test.js`

### Phase 3: Validation

- [ ] All tests pass: `npm run test:integration -- --testPathPattern="prerequisites"`
- [ ] Schema validation passes: `npm run validate`
- [ ] ESLint passes on new test files
- [ ] Each action works correctly in-game with grabbing logic

---

## Verification Commands

```bash
# Validate all mod files
npm run validate

# Run all prerequisite tests
npm run test:integration -- --testPathPattern="prerequisites"

# Run specific test files
NODE_ENV=test npx jest tests/integration/mods/violence/slap_prerequisites.test.js --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/violence/sucker_punch_prerequisites.test.js --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/seduction/brush_hair_back_coyly_prerequisites.test.js --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/items/put_in_container_prerequisites.test.js --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/items/give_item_prerequisites.test.js --no-coverage --verbose

# Lint new test files
npx eslint tests/integration/mods/violence/*_prerequisites.test.js \
           tests/integration/mods/seduction/*_prerequisites.test.js \
           tests/integration/mods/items/*_prerequisites.test.js
```

---

## Notes

### Why `condition_ref` Over Direct Operator?

1. **Reusability**: The condition is already used by `weapons:wield_threateningly`
2. **Maintainability**: Changes to grabbing logic update all actions automatically
3. **Consistency**: Follows established pattern in the codebase
4. **Testability**: Condition is already unit tested

### Ordering of Prerequisites (brush_hair_back_coyly)

The grabbing prerequisite is added FIRST (index 0) because:

1. Physical capability checks should precede contextual checks
2. "Can't use hands" is a clearer failure reason than "nobody around"
3. Matches the logical order: can you do it → should you do it
