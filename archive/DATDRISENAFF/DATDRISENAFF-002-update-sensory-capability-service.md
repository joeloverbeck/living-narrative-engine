# DATDRISENAFF-002: Update SensoryCapabilityService

## Description

Replace hardcoded part type checking with component-based affordance detection in `SensoryCapabilityService`.

## Files to Touch

### MODIFY
- `src/perception/services/sensoryCapabilityService.js`
- `tests/unit/perception/services/sensoryCapabilityService.test.js`

## Out of Scope

- Do NOT modify BodyGraphService
- Do NOT modify entity files
- Do NOT modify documentation
- Do NOT change the public API of SensoryCapabilityService

## In Scope (Updated)

- Modify `src/perception/services/sensoryCapabilityService.js`
- **Modify `tests/unit/perception/services/sensoryCapabilityService.test.js`** (merged from DATDRISENAFF-003 to ensure tests pass atomically)

## Implementation Details

### Current Implementation (to be replaced)

Lines 108-111:
```javascript
const canSee = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'eye');
const canHear = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'ear');
const canSmell = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'nose');
```

### New Implementation

```javascript
const canSee = this.#hasAtLeastOneFunctioningPartWithComponent(bodyComponent, entityId, 'anatomy:provides_sight');
const canHear = this.#hasAtLeastOneFunctioningPartWithComponent(bodyComponent, entityId, 'anatomy:provides_hearing');
const canSmell = this.#hasAtLeastOneFunctioningPartWithComponent(bodyComponent, entityId, 'anatomy:provides_smell');
```

### New Private Method

Replace `#hasAtLeastOneFunctioningPart(bodyComponent, partType)` with:

```javascript
/**
 * Check if entity has at least one functioning part with the given sensory affordance.
 *
 * @param {Object} bodyComponent - The anatomy:body component data
 * @param {string} entityId - The entity ID for the actor
 * @param {string} affordanceComponentId - Component ID to check for (e.g., 'anatomy:provides_sight')
 * @returns {boolean} True if at least one functioning part with this affordance exists
 * @private
 */
#hasAtLeastOneFunctioningPartWithComponent(bodyComponent, entityId, affordanceComponentId) {
  // Get all parts in the anatomy graph using correct API
  const allParts = this.#bodyGraphService.getAllParts(bodyComponent, entityId);

  if (!allParts || allParts.length === 0) {
    this.#logger.debug(
      `#hasAtLeastOneFunctioningPartWithComponent: No parts found for entity ${entityId}`
    );
    return false;
  }

  // Check if any part has the affordance component and is functioning
  const hasFunctioning = allParts.some((partId) => {
    const hasAffordance = this.#entityManager.hasComponent(partId, affordanceComponentId);
    if (!hasAffordance) return false;
    return this.#isPartFunctioning(partId);
  });

  this.#logger.debug(
    `#hasAtLeastOneFunctioningPartWithComponent: ${affordanceComponentId} found functioning=${hasFunctioning}`
  );

  return hasFunctioning;
}
```

### Dependency Validation Update

Update constructor's dependency validation:
```javascript
validateDependency(bodyGraphService, 'IBodyGraphService', this.#logger, {
  requiredMethods: ['getAllParts'],  // Changed from 'findPartsByType'
});
```

### API Note

The spec incorrectly assumed `getAllPartIds(rootId)`. The actual API is:
```javascript
this.#bodyGraphService.getAllParts(bodyComponent, entityId)
```

### Backward Compatibility

Entities without any `anatomy:provides_*` components will return `false` for those senses. This is a **breaking change** from the previous behavior where all senses were assumed available. Entity updates in DATDRISENAFF-004 through DATDRISENAFF-010 must be completed to restore functionality.

## Acceptance Criteria

### Tests That Must Pass
- All existing unit tests pass (with updated mocks)
- New exotic creature scenarios pass
- `npm run typecheck` passes
- `npx eslint src/perception/services/sensoryCapabilityService.js` passes

### Invariants That Must Remain True
- Manual override via `perception:sensory_capability` must still work
- `canFeel` must always return `true`
- `availableSenses` must always include `tactile` and `proprioceptive`
- Public API signature remains unchanged
- Error handling patterns remain consistent

## Risk Assessment

**Medium Risk** - Logic change in core service. Must maintain backward compatibility patterns.

## Dependencies

- DATDRISENAFF-001 must be completed first (components must exist)

## Estimated Diff Size

~80 lines in 1 file

---

## Outcome

**Status**: ✅ COMPLETED

**Date**: 2025-12-17

### What Was Done

1. **Service code was already updated** in a previous session:
   - Replaced `#hasAtLeastOneFunctioningPart(bodyComponent, partType)` with `#hasAtLeastOneFunctioningPartWithComponent(bodyComponent, entityId, affordanceComponentId)`
   - Updated dependency validation to require `getAllParts` instead of `findPartsByType`
   - Implementation queries all parts via `BodyGraphService.getAllParts()` and checks for affordance marker components

2. **Test file updated** (`tests/unit/perception/services/sensoryCapabilityService.test.js`):
   - Changed all mock patterns from `findPartsByType` to `getAllParts`
   - Updated `hasComponent` mock to handle affordance component checks (`anatomy:provides_sight`, `anatomy:provides_hearing`, `anatomy:provides_smell`)
   - Updated all 9 scenarios to work with new component-based affordance detection
   - Added 5 new exotic creature test scenarios:
     - Exotic eye with `anatomy:provides_sight` (eldritch_baleful_eye)
     - Standard eye with `anatomy:provides_sight`
     - Eye lacking `anatomy:provides_sight`
     - Multi-sense organ (provides both sight and smell)
     - Partial damage with multiple visual organs
   - Fixed edge case test for malformed body component (no root) to expect no senses instead of all senses

### Test Results

- **27 tests passing**
- All acceptance criteria met:
  - ✅ All existing unit tests pass with updated mocks
  - ✅ New exotic creature scenarios pass
  - ✅ `npm run typecheck` passes (only unrelated CLI validation errors)
  - ✅ `npx eslint` passes (only pre-existing warnings)

### Invariants Verified

- ✅ Manual override via `perception:sensory_capability` still works
- ✅ `canFeel` always returns `true`
- ✅ `availableSenses` always includes `tactile` and `proprioceptive`
- ✅ Public API signature unchanged
- ✅ Error handling patterns consistent

### Notes

- The test "should return all senses when body component has no root" was corrected to expect no senses for malformed anatomy. A body component that exists but has no root should not grant all senses - backward compatibility (all senses) only applies to entities without `anatomy:body` at all.
- DATDRISENAFF-003 was merged into this ticket since tests must be updated atomically with service changes.
