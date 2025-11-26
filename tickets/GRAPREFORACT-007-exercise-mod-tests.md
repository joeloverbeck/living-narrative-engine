# GRAPREFORACT-007: Create Integration Test for Exercise Mod Grabbing Prerequisites

## Summary

Create 1 integration test file to verify the grabbing prerequisite added in GRAPREFORACT-003:
- `show_off_biceps_prerequisites.test.js`

**SPECIAL CASE**: This action has **combined prerequisites** - both a muscular build check AND a grabbing appendage check. The test must verify both prerequisites work correctly together.

## Background

The `show_off_biceps` action requires **2 free appendages** AND the actor must have muscular or hulking arms. The test file must verify both prerequisites function correctly, including all four combinations of success/failure states.

**Reference Test**: `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`

## Files to Create

| File | Action Tested |
|------|---------------|
| `tests/integration/mods/exercise/show_off_biceps_prerequisites.test.js` | `exercise:show_off_biceps` |

## Test Structure

### Header

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for show_off_biceps action prerequisites
 * @description Tests that the action correctly requires both:
 *   1. Muscular or hulking arm build
 *   2. Two free grabbing appendages
 *
 * @see data/mods/exercise/actions/show_off_biceps.action.json
 * @see data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json
 * @see tickets/GRAPREFORACT-007-exercise-mod-tests.md
 */
```

## Required Test Scenarios

### 1. Action Definition Structure

```javascript
describe('action definition structure', () => {
  test('should have prerequisites array defined');
  test('should have exactly two prerequisites');
  test('first prerequisite should check for muscular/hulking build');
  test('second prerequisite should reference anatomy:actor-has-two-free-grabbing-appendages');
  test('both prerequisites should have failure_message for user feedback');
  test('should preserve other action properties');
});
```

### 2. Combined Prerequisites - All Four Combinations

**This is the critical section unique to this test file:**

```javascript
describe('combined prerequisites evaluation', () => {
  test('should pass when actor has muscular build AND 2 free appendages');
  test('should pass when actor has hulking build AND 2 free appendages');
  test('should fail when actor has muscular build BUT 0 free appendages');
  test('should fail when actor has muscular build BUT only 1 free appendage');
  test('should fail when actor has 2 free appendages BUT NOT muscular/hulking build');
  test('should fail when both conditions fail (no muscles AND no free appendages)');
});
```

### 3. Grabbing Prerequisites Only (2-appendage)

```javascript
describe('grabbing prerequisite evaluation', () => {
  // With muscular build satisfied, test grabbing variations
  test('should pass when actor has exactly two free grabbing appendages');
  test('should pass when actor has more than two free grabbing appendages');
  test('should fail when actor has zero free grabbing appendages');
  test('should fail when actor has only one free grabbing appendage');
});
```

### 4. Edge Cases

```javascript
describe('edge cases', () => {
  test('should handle missing actor gracefully');
  test('should handle actor with no grabbing appendages');
  test('should handle actor with no arm body parts');
});
```

### 5. Prerequisite Order

```javascript
describe('prerequisite structure validation', () => {
  test('should evaluate muscular build prerequisite first');
  test('should evaluate grabbing prerequisite second');
  test('both prerequisites should use correct condition references/logic');
});
```

## Mock Setup Pattern

This test requires mocking **both** the grabbing utilities and the body graph service:

```javascript
// Mock grabbingUtils to control free appendage count
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

// In beforeEach - set up mocks for BOTH prerequisites:

// Control free appendage count:
mockCountFreeGrabbingAppendages.mockReturnValue(2); // or 0, 1, etc.

// Control body part component value check (for muscular/hulking build):
mockBodyGraphService.hasPartOfTypeWithComponentValue.mockImplementation(
  (actorId, partType, componentType, propertyPath, value) => {
    if (partType === 'arm' && componentType === 'descriptors:build') {
      return value === 'muscular' || value === 'hulking';
    }
    return false;
  }
);
```

## Test Combinations Matrix

| Muscular Build | Free Appendages | Expected Result |
|----------------|-----------------|-----------------|
| ✅ Yes | 2+ | ✅ PASS |
| ✅ Yes | 1 | ❌ FAIL (grabbing) |
| ✅ Yes | 0 | ❌ FAIL (grabbing) |
| ❌ No | 2+ | ❌ FAIL (build) |
| ❌ No | 1 | ❌ FAIL (both) |
| ❌ No | 0 | ❌ FAIL (both) |

## Out of Scope

- **DO NOT** modify any action JSON files
- **DO NOT** modify any condition JSON files
- **DO NOT** modify source code in `src/`
- **DO NOT** create unit tests (only integration tests)
- **DO NOT** modify existing test files
- **DO NOT** test the muscular build prerequisite in isolation (it's tested by existing tests)

## Acceptance Criteria

### Tests Must Pass
- [ ] `npm run test:integration -- --testPathPattern="show_off_biceps_prerequisites"` passes

### Test Coverage Requirements
- [ ] Tests verify **combined prerequisite** behavior (all 4+ combinations)
- [ ] Tests verify 2-appendage requirement for grabbing
- [ ] Tests verify prerequisite array structure (exactly 2 prerequisites)
- [ ] Tests verify correct condition ID for grabbing prerequisite
- [ ] Tests verify existing muscular build prerequisite is preserved

### Invariants That Must Remain True
- [ ] No modifications to action files
- [ ] No modifications to condition files
- [ ] No modifications to source code
- [ ] Existing muscular build prerequisite logic exactly preserved in test validation
- [ ] Test patterns match the reference implementation

## Verification Commands

```bash
# Run specific test file
npm run test:integration -- --testPathPattern="show_off_biceps_prerequisites"

# Run all exercise mod tests
npm run test:integration -- --testPathPattern="mods/exercise"

# Check test file exists
ls -la tests/integration/mods/exercise/*prerequisites*.test.js
```

## Dependencies

- **Depends on**: GRAPREFORACT-003 (action file modification must be complete)
- **Blocked by**: GRAPREFORACT-003
- **Blocks**: Nothing

## Directory Structure Note

Ensure `tests/integration/mods/exercise/` directory exists before creating test files. If it doesn't exist, create it.

## Risk Notes

⚠️ This test is more complex than others because it must verify **combined prerequisite** behavior. The test must correctly mock both the body graph service (for muscular check) AND the grabbing utils (for appendage count).
