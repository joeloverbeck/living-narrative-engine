# GRAPREFORACT-006: Create Integration Tests for Distress Mod Grabbing Prerequisites

## Summary

Create 2 integration test files to verify the grabbing prerequisites added in GRAPREFORACT-002:
- `bury_face_in_hands_prerequisites.test.js` - tests **2-appendage** requirement
- `clutch_onto_upper_clothing_prerequisites.test.js` - tests **1-appendage** requirement

## Background

Each action with grabbing prerequisites requires a dedicated integration test file. The distress mod has two actions with **different appendage requirements**, so the tests must reflect this difference.

**Reference Test**: `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`

## Files to Create

| File | Action Tested | Appendages |
|------|---------------|------------|
| `tests/integration/mods/distress/bury_face_in_hands_prerequisites.test.js` | `distress:bury_face_in_hands` | 2 |
| `tests/integration/mods/distress/clutch_onto_upper_clothing_prerequisites.test.js` | `distress:clutch_onto_upper_clothing` | 1 |

## Test File: bury_face_in_hands_prerequisites.test.js

### Header

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for bury_face_in_hands action prerequisites
 * @description Tests that the action correctly requires two free grabbing appendages
 *
 * @see data/mods/distress/actions/bury_face_in_hands.action.json
 * @see data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json
 * @see tickets/GRAPREFORACT-006-distress-mod-tests.md
 */
```

### Required Test Scenarios (2-appendage)

```javascript
describe('distress:bury_face_in_hands prerequisites', () => {
  describe('action definition structure', () => {
    test('should have prerequisites array defined');
    test('should reference anatomy:actor-has-two-free-grabbing-appendages condition');
    test('should have failure_message for user feedback');
    test('should preserve other action properties');
  });

  describe('prerequisite evaluation - two free grabbing appendages available', () => {
    test('should pass when actor has exactly two free grabbing appendages');
    test('should pass when actor has more than two free grabbing appendages');
  });

  describe('prerequisite evaluation - insufficient free appendages', () => {
    test('should fail when actor has zero free grabbing appendages');
    test('should fail when actor has only one free grabbing appendage');
    test('should fail when all appendages are locked');
  });

  describe('edge cases', () => {
    test('should handle missing actor gracefully');
    test('should handle actor with no grabbing appendages');
  });

  describe('condition definition validation', () => {
    test('should use hasFreeGrabbingAppendages operator with parameter 2');
    test('condition ID should match what the action references');
  });
});
```

## Test File: clutch_onto_upper_clothing_prerequisites.test.js

### Header

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for clutch_onto_upper_clothing action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage
 *
 * @see data/mods/distress/actions/clutch_onto_upper_clothing.action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREFORACT-006-distress-mod-tests.md
 */
```

### Required Test Scenarios (1-appendage)

```javascript
describe('distress:clutch_onto_upper_clothing prerequisites', () => {
  describe('action definition structure', () => {
    test('should have prerequisites array defined');
    test('should reference anatomy:actor-has-free-grabbing-appendage condition');
    test('should have failure_message for user feedback');
    test('should preserve other action properties');
  });

  describe('prerequisite evaluation - free grabbing appendage available', () => {
    test('should pass when actor has exactly one free grabbing appendage');
    test('should pass when actor has multiple free grabbing appendages');
    test('should pass for actor with two hands both free');
  });

  describe('prerequisite evaluation - no free grabbing appendage', () => {
    test('should fail when actor has zero free grabbing appendages');
    test('should fail when all appendages are locked (holding items)');
  });

  describe('edge cases', () => {
    test('should handle missing actor gracefully');
    test('should handle actor with no grabbing appendages');
  });

  describe('condition definition validation', () => {
    test('should use hasFreeGrabbingAppendages operator with parameter 1');
    test('condition ID should match what the action references');
  });
});
```

## Key Difference: Mock Return Values

### For bury_face_in_hands (2-appendage requirement)
```javascript
mockCountFreeGrabbingAppendages.mockReturnValue(0); // FAIL
mockCountFreeGrabbingAppendages.mockReturnValue(1); // FAIL (need 2)
mockCountFreeGrabbingAppendages.mockReturnValue(2); // PASS
mockCountFreeGrabbingAppendages.mockReturnValue(4); // PASS
```

### For clutch_onto_upper_clothing (1-appendage requirement)
```javascript
mockCountFreeGrabbingAppendages.mockReturnValue(0); // FAIL
mockCountFreeGrabbingAppendages.mockReturnValue(1); // PASS
mockCountFreeGrabbingAppendages.mockReturnValue(2); // PASS
mockCountFreeGrabbingAppendages.mockReturnValue(4); // PASS
```

## Out of Scope

- **DO NOT** modify any action JSON files
- **DO NOT** modify any condition JSON files
- **DO NOT** modify source code in `src/`
- **DO NOT** create unit tests (only integration tests)
- **DO NOT** modify existing test files

## Acceptance Criteria

### Tests Must Pass
- [ ] `npm run test:integration -- --testPathPattern="bury_face_in_hands_prerequisites"` passes
- [ ] `npm run test:integration -- --testPathPattern="clutch_onto_upper_clothing_prerequisites"` passes

### Test Coverage Requirements
- [ ] `bury_face_in_hands` tests verify 2-appendage requirement (fails with 1, passes with 2+)
- [ ] `clutch_onto_upper_clothing` tests verify 1-appendage requirement (fails with 0, passes with 1+)
- [ ] Tests verify correct condition IDs for each action
- [ ] Tests verify action structure preservation

### Invariants That Must Remain True
- [ ] No modifications to action files
- [ ] No modifications to condition files
- [ ] No modifications to source code
- [ ] Test patterns match the reference implementation

## Verification Commands

```bash
# Run specific test files
npm run test:integration -- --testPathPattern="bury_face_in_hands_prerequisites"
npm run test:integration -- --testPathPattern="clutch_onto_upper_clothing_prerequisites"

# Run all distress mod tests
npm run test:integration -- --testPathPattern="mods/distress"

# Check test files exist
ls -la tests/integration/mods/distress/*prerequisites*.test.js
```

## Dependencies

- **Depends on**: GRAPREFORACT-002 (action file modifications must be complete)
- **Blocked by**: GRAPREFORACT-002
- **Blocks**: Nothing

## Directory Structure Note

Ensure `tests/integration/mods/distress/` directory exists before creating test files. If it doesn't exist, create it.
