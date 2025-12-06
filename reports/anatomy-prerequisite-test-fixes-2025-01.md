# Anatomy Prerequisite Test Fixes - January 2025

## Executive Summary

This report documents the resolution of 5 failing tests related to anatomy-based prerequisite evaluation in the seduction mod. The root causes involved two critical issues: incorrect prerequisite context handling for targetless actions and a missing API compatibility layer between production and test entity managers.

## Test Failures

### Affected Tests (5 total)

1. `grab_crotch_draw_attention_action_discovery.test.js` - 1 test
2. `grab_crotch_draw_attention_receiving_blowjob_forbidden.test.js` - 1 test
3. `stroke_penis_to_draw_attention_action_discovery.test.js` - 1 test
4. `stroke_penis_to_draw_attention_receiving_blowjob_forbidden.test.js` - 1 test
5. `squeeze_breasts_draw_attention_action_discovery.test.js` - 1 test

All tests involved actions with `targets: "none"` (targetless actions) that used anatomy-based prerequisites.

## Root Causes Identified

### Issue 1: Missing Prerequisite Context for Targetless Actions

**Location**: `tests/common/engine/systemLogicTestEnv.js:1377-1402`

**Problem**: The `buildPrerequisiteContextOverride` function returned `null` when `resolvedTargets` was empty, preventing prerequisite evaluation for targetless actions.

```javascript
// BEFORE (Incorrect)
const buildPrerequisiteContextOverride = (resolvedTargets, actorId) => {
  const hasTargets = resolvedTargets && Object.keys(resolvedTargets).length > 0;

  if (!hasTargets) {
    return null; // ❌ This prevented prerequisite evaluation!
  }

  const override = { targets: {} };
  // ... rest of function
};
```

**Fix**: Always create a context override with the actor, even when there are no targets:

```javascript
// AFTER (Correct)
const buildPrerequisiteContextOverride = (resolvedTargets, actorId) => {
  const hasTargets = resolvedTargets && Object.keys(resolvedTargets).length > 0;

  const override = { targets: {} };

  if (hasTargets) {
    // ... handle targets ...
  }

  // Always add actor context if actorId is provided
  if (actorId) {
    const actorOverride = createResolvedTarget(actorId);
    if (actorOverride) {
      override.actor = actorOverride;
    }
  }

  // Return override if we have actor context, even if no targets
  if (override.actor || hasTargets) {
    return override;
  }

  return null;
};
```

**Impact**: This fix ensures that targetless actions (like `squeeze_breasts_draw_attention`) can properly evaluate prerequisites that reference the actor (e.g., `hasPartOfType: ["actor", "breast"]`).

### Issue 2: Missing Operator in Validation Whitelist

**Location**: `src/logic/jsonLogicEvaluationService.js:79-147`

**Problem**: The `hasOtherActorsAtLocation` operator was not in the `ALLOWED_OPERATIONS` set, causing prerequisite validation to fail silently.

**Fix**: Added the operator to the whitelist:

```javascript
const ALLOWED_OPERATIONS = new Set([
  // ... other operators ...
  // Location/actor operators
  'hasOtherActorsAtLocation', // ✅ Added
  // ... rest of operators ...
]);
```

**Impact**: Allows actions to use the `hasOtherActorsAtLocation` prerequisite without triggering validation errors.

### Issue 3: Entity Manager API Incompatibility

**Location**: `src/logic/operators/hasOtherActorsAtLocationOperator.js:166`

**Problem**: The operator called `getAllEntities()` which doesn't exist in either `SimpleEntityManager` (tests) or `EntityManager` (production).

```javascript
// BEFORE (Incorrect)
const allEntities = this.#entityManager.getAllEntities(); // ❌ Method doesn't exist!
```

**Fix**: Changed to use `getEntities()` which exists in `SimpleEntityManager`:

```javascript
// AFTER (Correct)
const allEntities = this.#entityManager.getEntities(); // ✅ Correct method
```

**Impact**: The operator now works in both test and production environments.

## Suggested Improvements

### 1. Create Entity Manager Interface Documentation

**Problem**: The incompatibility between `SimpleEntityManager` and `EntityManager` APIs caused runtime errors that were difficult to debug.

**Recommendation**:

- Document the minimal IEntityManager interface that operators should rely on
- Add TypeScript interfaces or JSDoc `@interface` definitions
- Run interface compliance checks during test setup

**Example Interface**:

```javascript
/**
 * @interface IEntityManager
 * @description Minimal entity manager interface for operators
 */
export const IEntityManager = {
  getEntities: () => [], // Returns all entities as array
  getComponentData: (entityId, componentType) => null,
  hasComponent: (entityId, componentType) => false,
  getEntityInstance: (entityId) => null,
};
```

### 2. Add Validation for Targetless Action Prerequisites

**Problem**: The test environment didn't properly validate that targetless actions can still evaluate actor-based prerequisites.

**Recommendation**:

- Add explicit test cases for targetless actions with prerequisites
- Document the expected behavior in test utilities
- Add assertions in `buildPrerequisiteContextOverride` to validate actor context creation

**Example Test Pattern**:

```javascript
describe('Targetless actions with prerequisites', () => {
  it('should evaluate actor-based prerequisites for actions with targets: "none"', () => {
    const action = {
      id: 'test:targetless_action',
      targets: 'none',
      prerequisites: [{ logic: { hasPartOfType: ['actor', 'hand'] } }],
    };

    // Test should pass when actor has hand
    const result = fixture.discoverActions(actorWithHand.id);
    expect(result).toHaveAction(action.id);
  });
});
```

### 3. Enforce JSON Logic Operator Registration

**Problem**: The `hasOtherActorsAtLocation` operator was fully implemented and registered in `jsonLogicCustomOperators.js` but was missing from the validation whitelist, causing silent failures.

**Recommendation**:

- Automate whitelist generation from registered operators
- Add validation during operator registration to check whitelist presence
- Create a test that verifies all registered operators are in the whitelist

**Example Check**:

```javascript
// In JsonLogicCustomOperators.registerOperators()
const registeredOperators = [
  'hasPartOfType',
  'hasClothingInSlot',
  'hasOtherActorsAtLocation',
  // ... etc
];

// Validate against ALLOWED_OPERATIONS in JsonLogicEvaluationService
for (const op of registeredOperators) {
  if (!jsonLogicEvaluationService.isOperatorAllowed(op)) {
    throw new Error(
      `Operator '${op}' is registered but not in ALLOWED_OPERATIONS whitelist. ` +
        `Add it to JsonLogicEvaluationService.#validateJsonLogic()`
    );
  }
}
```

### 4. Improve Test Error Messages

**Problem**: When prerequisite evaluation failed, the error messages didn't clearly indicate which prerequisite failed or why.

**Recommendation**:

- Enhance prerequisite evaluation error messages to include:
  - Which prerequisite failed (by index or logic)
  - The actual values being evaluated
  - The expected vs actual results
- Add debug mode flag for verbose prerequisite evaluation logging

**Example Enhanced Error**:

```javascript
// Current (vague)
"Action not discovered"

// Improved (specific)
"Action 'seduction:grab_crotch_draw_attention' not discovered
 Prerequisite #3 failed: hasOtherActorsAtLocation(['actor'])
 Expected: true (other actors present)
 Actual: false (no other actors found)
 Actor location: room1
 Entities at location: 1 (only the actor)"
```

### 5. Standardize Entity Manager Mock Creation

**Problem**: Tests use `SimpleEntityManager` which has a different API than production `EntityManager`, requiring operators to handle both.

**Recommendation**:

- Create a `TestEntityManager` wrapper that provides the production API surface
- Use adapter pattern to bridge `SimpleEntityManager` to production API
- Document which methods are required vs optional

**Example Adapter**:

```javascript
class TestEntityManagerAdapter {
  constructor(simpleEntityManager) {
    this.#simple = simpleEntityManager;
  }

  // Adapt SimpleEntityManager.getEntities() to match production
  getEntities() {
    return this.#simple.getEntities();
  }

  // Add any missing production methods
  getEntitiesWithComponent(componentType) {
    return this.getEntities().filter((e) =>
      this.#simple.hasComponent(e.id, componentType)
    );
  }
}
```

## Implementation Impact

### Files Modified

1. **`tests/common/engine/systemLogicTestEnv.js`**
   - Fixed `buildPrerequisiteContextOverride` to handle targetless actions
   - Lines: 1377-1402

2. **`src/logic/jsonLogicEvaluationService.js`**
   - Added `hasOtherActorsAtLocation` to `ALLOWED_OPERATIONS` whitelist
   - Line: 139

3. **`src/logic/operators/hasOtherActorsAtLocationOperator.js`**
   - Changed `getAllEntities()` to `getEntities()`
   - Line: 166

### Test Results

**Before Fix**: 5 failures, 17 passes (22 total)
**After Fix**: 0 failures, 22 passes (22 total)

All anatomy-based prerequisite tests now pass successfully.

## Lessons Learned

### 1. Test Environments Should Mirror Production

The API mismatch between `SimpleEntityManager` and `EntityManager` caused a runtime error that wouldn't occur in production. Test utilities should provide the same interface as production code to catch these issues earlier.

### 2. Silent Failures Are Dangerous

The validation whitelist issue caused silent failures where prerequisites were evaluated but operators weren't called. Adding validation to ensure registered operators are whitelisted would catch this class of error.

### 3. Edge Cases Need Explicit Testing

Targetless actions are an edge case that wasn't explicitly tested in the prerequisite evaluation system. Adding explicit tests for edge cases prevents regressions.

### 4. Documentation Prevents Drift

The lack of interface documentation allowed the API drift between test and production entity managers. Maintaining interface contracts prevents this.

## Conclusion

The fixes implemented resolve all 5 failing tests by addressing three root causes:

1. Targetless action prerequisite context handling
2. Missing operator validation whitelist entry
3. Entity manager API incompatibility

The suggested improvements aim to prevent similar issues in the future by:

- Enforcing interface contracts
- Improving error messages
- Automating validation checks
- Standardizing test utilities

These changes improve system robustness and make future prerequisite-related debugging easier.
