# GRAPREFORACT-008: Create Integration Tests for Items Mod Grabbing Prerequisites

## Summary

Create 4 integration test files to verify the grabbing prerequisites added in GRAPREFORACT-004:
- `drink_entirely_prerequisites.test.js`
- `drink_from_prerequisites.test.js`
- `pick_up_item_prerequisites.test.js`
- `take_from_container_prerequisites.test.js`

All 4 actions require **1 free appendage**.

## Background

Each action with grabbing prerequisites requires a dedicated integration test file following the established pattern from `wield_threateningly_prerequisites.test.js`. All items mod actions require exactly **1 free appendage**.

**Reference Test**: `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`

## Files to Create

| File | Action Tested |
|------|---------------|
| `tests/integration/mods/items/drink_entirely_prerequisites.test.js` | `items:drink_entirely` |
| `tests/integration/mods/items/drink_from_prerequisites.test.js` | `items:drink_from` |
| `tests/integration/mods/items/pick_up_item_prerequisites.test.js` | `items:pick_up_item` |
| `tests/integration/mods/items/take_from_container_prerequisites.test.js` | `items:take_from_container` |

## Test Structure (All 4 Files)

Each test file must follow this structure:

### Header Template

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for [action_name] action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage
 *
 * @see data/mods/items/actions/[action_file].action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREFORACT-008-items-mod-tests.md
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import [actionImport] from '../../../../data/mods/items/actions/[action_file].action.json';
import actorHasFreeGrabbingCondition from '../../../../data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json';

// Mock grabbingUtils to control the free appendage count
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));
```

## Required Test Scenarios (Same for All 4 Files)

### 1. Action Definition Structure

```javascript
describe('action definition structure', () => {
  test('should have prerequisites array defined');
  test('should reference anatomy:actor-has-free-grabbing-appendage condition');
  test('should have failure_message for user feedback');
  test('should preserve other action properties');
});
```

### 2. Success Scenarios (1-appendage)

```javascript
describe('prerequisite evaluation - free grabbing appendage available', () => {
  test('should pass when actor has exactly one free grabbing appendage');
  test('should pass when actor has multiple free grabbing appendages');
  test('should pass for actor with two hands both free');
});
```

### 3. Failure Scenarios

```javascript
describe('prerequisite evaluation - no free grabbing appendage', () => {
  test('should fail when actor has zero free grabbing appendages');
  test('should fail when all appendages are locked (holding items)');
});
```

### 4. Edge Cases

```javascript
describe('edge cases', () => {
  test('should handle missing actor gracefully');
  test('should handle actor with no grabbing appendages');
});
```

### 5. Condition Definition Validation

```javascript
describe('condition definition validation', () => {
  test('should use hasFreeGrabbingAppendages operator with parameter 1');
  test('condition ID should match what the action references');
});
```

## Mock Setup Pattern (1-appendage)

```javascript
// In tests - control free appendage count:
mockCountFreeGrabbingAppendages.mockReturnValue(0); // FAIL
mockCountFreeGrabbingAppendages.mockReturnValue(1); // PASS
mockCountFreeGrabbingAppendages.mockReturnValue(2); // PASS
mockCountFreeGrabbingAppendages.mockReturnValue(4); // PASS
```

## Action-Specific Properties to Verify

Each test must verify that the action-specific properties are preserved:

### drink_entirely
- ID: `items:drink_entirely`
- Template: `drink entirety of {primary}`
- Required components on primary: `items:drinkable`, `items:liquid_container`
- Forbidden components on primary: `items:empty`

### drink_from
- ID: `items:drink_from`
- Template: `drink from {primary}`
- Required components on primary: `items:drinkable`, `items:liquid_container`
- Forbidden components on primary: `items:empty`

### pick_up_item
- ID: `items:pick_up_item`
- Template: `pick up {item}`
- Required components on actor: `items:inventory`
- Forbidden components on actor: `positioning:bending_over`, `positioning:being_fucked_vaginally`

### take_from_container
- ID: `items:take_from_container`
- Template: `take {secondary.name} from {primary.name}`
- Required components on actor: `items:inventory`
- Forbidden components on actor: `positioning:sitting_on`
- Has `generateCombinations: true`

## Out of Scope

- **DO NOT** modify any action JSON files
- **DO NOT** modify any condition JSON files
- **DO NOT** modify source code in `src/`
- **DO NOT** create unit tests (only integration tests)
- **DO NOT** modify existing test files

## Acceptance Criteria

### Tests Must Pass
- [ ] `npm run test:integration -- --testPathPattern="drink_entirely_prerequisites"` passes
- [ ] `npm run test:integration -- --testPathPattern="drink_from_prerequisites"` passes
- [ ] `npm run test:integration -- --testPathPattern="pick_up_item_prerequisites"` passes
- [ ] `npm run test:integration -- --testPathPattern="take_from_container_prerequisites"` passes

### Test Coverage Requirements
- [ ] Each test file covers all 5 test scenario groups listed above
- [ ] Tests verify 1-appendage requirement (fails with 0, passes with 1+)
- [ ] Tests verify the exact condition ID `anatomy:actor-has-free-grabbing-appendage`
- [ ] Tests verify action structure preservation including action-specific properties

### Invariants That Must Remain True
- [ ] No modifications to action files
- [ ] No modifications to condition files
- [ ] No modifications to source code
- [ ] Test patterns match the reference implementation

## Verification Commands

```bash
# Run specific test files
npm run test:integration -- --testPathPattern="drink_entirely_prerequisites"
npm run test:integration -- --testPathPattern="drink_from_prerequisites"
npm run test:integration -- --testPathPattern="pick_up_item_prerequisites"
npm run test:integration -- --testPathPattern="take_from_container_prerequisites"

# Run all items mod prerequisite tests
npm run test:integration -- --testPathPattern="mods/items.*prerequisites"

# Run all items mod tests
npm run test:integration -- --testPathPattern="mods/items"

# Check test files exist
ls -la tests/integration/mods/items/*prerequisites*.test.js
```

## Dependencies

- **Depends on**: GRAPREFORACT-004 (action file modifications must be complete)
- **Blocked by**: GRAPREFORACT-004
- **Blocks**: Nothing

## Directory Note

The `tests/integration/mods/items/` directory already exists and contains other item-related tests. New test files should be added alongside existing files.
