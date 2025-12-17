# DATDRISENAFF-003: Update SensoryCapabilityService Unit Tests

## Description

Update unit test mocks and add new test scenarios for exotic creatures in the SensoryCapabilityService tests.

## Files to Touch

### MODIFY
- `tests/unit/perception/services/sensoryCapabilityService.test.js`

## Out of Scope

- Do NOT modify integration tests
- Do NOT modify service code (handled in DATDRISENAFF-002)
- Do NOT create new test files
- Do NOT modify other unit test files

## Implementation Details

### Mock Setup Updates

**Before (current implementation)**:
```javascript
mockBodyGraphService.findPartsByType.mockImplementation(
  (rootId, partType) => {
    if (partType === 'eye') return ['eye-left', 'eye-right'];
    if (partType === 'ear') return ['ear-left', 'ear-right'];
    if (partType === 'nose') return ['nose-1'];
    return [];
  }
);
```

**After (new implementation)**:
```javascript
mockBodyGraphService.getAllParts.mockReturnValue([
  'eye-left', 'eye-right', 'ear-left', 'ear-right', 'nose-1'
]);

mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
  if (componentId === 'anatomy:provides_sight') return id.includes('eye');
  if (componentId === 'anatomy:provides_hearing') return id.includes('ear');
  if (componentId === 'anatomy:provides_smell') return id.includes('nose');
  if (componentId === 'anatomy:dismembered') return false;
  return false;
});
```

### New Test Scenarios to Add

1. **Entity with exotic eye (eldritch_baleful_eye) with `anatomy:provides_sight`**
   - Setup: Part ID contains 'eldritch_baleful_eye', has `anatomy:provides_sight`
   - Expected: `canSee` returns `true`

2. **Entity with standard eye with `anatomy:provides_sight`**
   - Setup: Part ID like 'human_eye_blue', has `anatomy:provides_sight`
   - Expected: `canSee` returns `true`

3. **Entity with eye lacking `anatomy:provides_sight`**
   - Setup: Part exists but `hasComponent` returns `false` for affordance
   - Expected: `canSee` returns `false`

4. **Entity with multiple visual organs, some destroyed**
   - Setup: Two eyes, one with destroyed health state
   - Expected: `canSee` returns `true` (one functioning remains)

5. **Multi-sense organ (provides both sight and smell)**
   - Setup: Single part with both `anatomy:provides_sight` and `anatomy:provides_smell`
   - Expected: Both `canSee` and `canSmell` return `true`

6. **Entity with no parts in anatomy graph**
   - Setup: `getAllParts` returns empty array
   - Expected: All senses return `false`

### Dependency Validation Test Update

Update any tests that verify dependency validation to expect `getAllParts` method instead of `findPartsByType`.

## Acceptance Criteria

### Tests That Must Pass
- `npm run test:unit -- tests/unit/perception/services/sensoryCapabilityService.test.js` passes
- All existing test scenarios pass (with updated mocks)
- All 6 new test scenarios pass
- Coverage remains at or above current levels

### Invariants That Must Remain True
- Test file structure must remain consistent with project patterns
- Test helper functions (`createHealthComponent`, `createBodyComponent`) should be reused where possible
- Mock patterns follow existing conventions
- No test should require actual entity files to run

## Risk Assessment

**Medium Risk** - Test modifications must align exactly with service changes.

## Dependencies

- DATDRISENAFF-002 must be completed first (service changes must exist)

## Estimated Diff Size

~150 lines in 1 file

---

## Outcome

**Status**: ✅ COMPLETED (merged into DATDRISENAFF-002)

**Date**: 2025-12-17

### What Was Done

This ticket was merged into DATDRISENAFF-002 to ensure service changes and test updates are applied atomically. All test updates specified in this ticket were implemented as part of DATDRISENAFF-002.

See DATDRISENAFF-002 for full implementation details and outcome.

### Summary of Test Changes

- Updated all mock patterns from `findPartsByType` to `getAllParts`
- Added `hasComponent` mock for affordance component checking
- Updated all 9 existing scenarios
- Added 5 new exotic creature test scenarios (one of the 6 proposed was covered by existing tests)
- Fixed edge case for malformed body component
- **27 tests passing**
