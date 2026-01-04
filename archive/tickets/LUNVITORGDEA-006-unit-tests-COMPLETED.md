# LUNVITORGDEA-006: Unit Tests for Collective Organ Death

## Status: COMPLETED

## Summary

Add comprehensive unit tests for the new collective organ death logic in DeathCheckService.

## Dependencies

- LUNVITORGDEA-003 (Collective death check must be implemented) - COMPLETED
- LUNVITORGDEA-005 (Death message must be implemented) - COMPLETED

## Assumption Reassessment (2026-01-03)

**Original Assumptions (INCORRECT):**
- Ticket originally assumed tests needed to be created in a NEW file `deathCheckService.collectiveOrgans.test.js`
- Ticket assumed the existing test file should NOT be modified

**Actual State of Codebase:**
After code analysis, the existing test file `tests/unit/anatomy/services/deathCheckService.test.js` already contains comprehensive coverage for collective organ death logic:

### Already Covered Tests (lines 451-543, 1675-1743, 1954-2022):
- ✅ "should not trigger death when only one collective organ is destroyed" (line 512)
- ✅ "should trigger death when all collective organs are destroyed" (line 527)
- ✅ "should generate appropriate message for respiratory organ collective destruction" (line 1675)
- ✅ "when collective vital organs are all destroyed" → shouldFinalize test (line 1954)
- ✅ Single brain destruction triggers death (line 296)
- ✅ Single heart destruction triggers death (line 308)
- ✅ Single spine destruction triggers death (line 317)

### Missing Edge Cases to Add:
The following edge cases were identified as NOT covered and should be added:
1. Actor with only one lung entity (unusual case - when destroyed, should trigger death)
2. Actor with no body data (should return null gracefully)

## Corrected Scope

### Files to Modify
- `tests/unit/anatomy/services/deathCheckService.test.js` (add 2 missing edge case tests)

### Files to Create
- NONE (separate file not needed - tests already exist in main file)

### Files to Reference (read-only)
- `src/anatomy/services/deathCheckService.js`

## Out of Scope

- DO NOT modify source code files
- DO NOT create integration tests (done in 007)
- DO NOT test oxygen handlers (separate test scope)
- DO NOT duplicate tests that already exist

## Implementation Details

### Edge Case Tests to Add

```javascript
describe('edge cases', () => {
  it('should trigger death when actor has only one lung entity that is destroyed', () => {
    // Arrange: Actor with single lung (unusual case)
    // When that single lung is destroyed
    // Assert: Should trigger death (all respiratory organs destroyed)
  });

  it('should return no death when actor has no body data', () => {
    // Arrange: Actor without body component
    // Act: Call death check via checkDeathConditions
    // Assert: Returns isDead=false, isDying=false (handles gracefully)
  });
});
```

## Acceptance Criteria

### Tests That Must Pass
- All existing tests in deathCheckService.test.js continue to pass
- 2 new edge case tests pass
- `npm run test:unit -- tests/unit/anatomy/services/deathCheckService.test.js`

### Coverage Requirements
- `#checkCollectiveVitalOrganDestruction` method: Already has high coverage
- Edge cases for single-lung actor and no-body-data scenarios covered

### Invariants That Must Remain True
1. Tests use existing project test utilities and patterns
2. Tests are isolated and don't depend on execution order
3. Mocks properly verify expected interactions
4. No regressions in existing tests

## Verification Commands

```bash
# Run all deathCheckService tests
npm run test:unit -- tests/unit/anatomy/services/deathCheckService.test.js

# Run with coverage
npm run test:unit -- tests/unit/anatomy/services/deathCheckService.test.js --coverage

# Verify no regressions
npm run test:unit
```

## Estimated Diff Size

~40 lines added to existing test file (2 new test cases with setup).

## Outcome (2026-01-03)

### What Was Done

1. **Assumption Reassessment**: Analyzed existing test file and discovered that core collective organ death tests already existed, contrary to the ticket's original assumption that a new file was needed.

2. **Edge Case Tests Added**: Added 2 missing edge case tests to `tests/unit/anatomy/services/deathCheckService.test.js`:
   - `should trigger death when actor has only one lung entity that is destroyed` (lines 545-602)
   - `should return no death when actor has no body data` (lines 604-632)

### Tests Added/Modified

| Test Name | Rationale |
|-----------|-----------|
| `should trigger death when actor has only one lung entity that is destroyed` | Verifies edge case: single-lung anatomy where destruction = death (1/1 = 100% destroyed) |
| `should return no death when actor has no body data` | Verifies graceful handling when entity lacks `anatomy:body` component |

### Verification Results

```
PASS tests/unit/anatomy/services/deathCheckService.test.js
Test Suites: 1 passed, 1 total
Tests:       78 passed, 78 total
```

All 78 tests pass, including the 2 new edge case tests. No regressions.

### Files Changed

- `tests/unit/anatomy/services/deathCheckService.test.js` (+88 lines)
