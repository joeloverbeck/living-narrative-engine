# GRAPREFORACT-005: Create Integration Tests for Clothing Mod Grabbing Prerequisites

## Summary

Create 2 integration test files to verify the grabbing prerequisites added in GRAPREFORACT-001 work correctly:
- `remove_clothing_prerequisites.test.js`
- `remove_others_clothing_prerequisites.test.js`

## Background

Each action with grabbing prerequisites requires a dedicated integration test file following the established pattern from `wield_threateningly_prerequisites.test.js`. Both clothing actions require **2 free appendages**.

**Reference Test**: `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`

## Files to Create

| File | Action Tested |
|------|---------------|
| `tests/integration/mods/clothing/remove_clothing_prerequisites.test.js` | `clothing:remove_clothing` |
| `tests/integration/mods/clothing/remove_others_clothing_prerequisites.test.js` | `clothing:remove_others_clothing` |

## Test Structure (Both Files)

Each test file must follow this structure, adapted for 2-appendage requirements:

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for [action_name] action prerequisites
 * @description Tests that the action correctly requires two free grabbing appendages
 *
 * @see data/mods/clothing/actions/[action_name].action.json
 * @see data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json
 * @see tickets/GRAPREFORACT-005-clothing-mod-tests.md
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import [actionImport] from '../../../../data/mods/clothing/actions/[action_file].action.json';
import actorHasTwoFreeGrabbingCondition from '../../../../data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json';

// Mock grabbingUtils to control the free appendage count
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));
```

## Required Test Scenarios

### 1. Action Definition Structure

```javascript
describe('action definition structure', () => {
  test('should have prerequisites array defined');
  test('should reference anatomy:actor-has-two-free-grabbing-appendages condition');
  test('should have failure_message for user feedback');
  test('should preserve other action properties');
});
```

### 2. Success Scenarios (Free Appendages Available)

```javascript
describe('prerequisite evaluation - two free grabbing appendages available', () => {
  test('should pass when actor has exactly two free grabbing appendages');
  test('should pass when actor has more than two free grabbing appendages');
});
```

### 3. Failure Scenarios (Insufficient Appendages)

```javascript
describe('prerequisite evaluation - insufficient free appendages', () => {
  test('should fail when actor has zero free grabbing appendages');
  test('should fail when actor has only one free grabbing appendage');
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
  test('should use hasFreeGrabbingAppendages operator with correct parameters (2)');
  test('condition ID should match what the action references');
});
```

## Mock Setup Pattern

Follow the reference implementation exactly:

```javascript
// Mock grabbingUtils to control free appendage count
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

// In beforeEach:
const grabbingUtils = await import('../../../../src/utils/grabbingUtils.js');
mockCountFreeGrabbingAppendages = grabbingUtils.countFreeGrabbingAppendages;

// In tests - control free appendage count:
mockCountFreeGrabbingAppendages.mockReturnValue(0); // No free hands - SHOULD FAIL
mockCountFreeGrabbingAppendages.mockReturnValue(1); // One free hand - SHOULD FAIL (need 2)
mockCountFreeGrabbingAppendages.mockReturnValue(2); // Both hands free - SHOULD PASS
mockCountFreeGrabbingAppendages.mockReturnValue(4); // Multiple (e.g., octopod) - SHOULD PASS
```

## Out of Scope

- **DO NOT** modify any action JSON files
- **DO NOT** modify any condition JSON files
- **DO NOT** modify source code in `src/`
- **DO NOT** create unit tests (only integration tests)
- **DO NOT** modify existing test files

## Acceptance Criteria

### Tests Must Pass
- [ ] `npm run test:integration -- --testPathPattern="remove_clothing_prerequisites"` passes
- [ ] `npm run test:integration -- --testPathPattern="remove_others_clothing_prerequisites"` passes

### Test Coverage Requirements
- [ ] Each test file covers all 5 test scenario groups listed above
- [ ] Tests verify both success (2+ appendages) and failure (<2 appendages) cases
- [ ] Tests verify the exact condition ID `anatomy:actor-has-two-free-grabbing-appendages`
- [ ] Tests verify action structure preservation

### Invariants That Must Remain True
- [ ] No modifications to action files
- [ ] No modifications to condition files
- [ ] No modifications to source code
- [ ] Test patterns match the reference implementation

## Verification Commands

```bash
# Run specific test files
npm run test:integration -- --testPathPattern="remove_clothing_prerequisites"
npm run test:integration -- --testPathPattern="remove_others_clothing_prerequisites"

# Run all clothing mod tests
npm run test:integration -- --testPathPattern="mods/clothing"

# Check test files exist
ls -la tests/integration/mods/clothing/*prerequisites*.test.js
```

## Dependencies

- **Depends on**: GRAPREFORACT-001 (action file modifications must be complete)
- **Blocked by**: GRAPREFORACT-001
- **Blocks**: Nothing

## Directory Structure Note

Ensure `tests/integration/mods/clothing/` directory exists before creating test files. If it doesn't exist, create it.
