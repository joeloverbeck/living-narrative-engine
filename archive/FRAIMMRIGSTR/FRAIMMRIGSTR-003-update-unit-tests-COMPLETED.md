# FRAIMMRIGSTR-003: Update FractureApplicator Unit Tests

## Summary
Validate FractureApplicator unit tests for the rigid structure immunity and add coverage for the remaining edge cases.

## Background
The unit test file already mocks `hasComponent` and includes the core rigid-structure immunity coverage. The earlier assumption that tests would fail due to missing mocks is no longer accurate. Remaining gaps are:
1. `hasRigidStructure()` handling of non-Error exceptions
2. Debug logging when skipping fracture due to missing rigid structure

## File List

### Files to Modify
- `tests/unit/anatomy/applicators/fractureApplicator.test.js`

### Reference Files (read-only)
- `src/anatomy/applicators/fractureApplicator.js` (to understand the interface)

## Out of Scope
- **DO NOT** modify source code in `src/` (that's FRAIMMRIGSTR-002)
- **DO NOT** create integration tests (FRAIMMRIGSTR-006)
- **DO NOT** create E2E tests (FRAIMMRIGSTR-007)
- **DO NOT** modify entity files (FRAIMMRIGSTR-004, FRAIMMRIGSTR-005)

## Implementation Details

### 1. Add non-Error exception coverage in hasRigidStructure()
```javascript
it('returns false and logs warning when entityManager throws non-Error', () => {
  mockEntityManager.hasComponent.mockImplementation(() => {
    throw 'string error';
  });

  expect(applicator.hasRigidStructure('part-1')).toBe(false);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Error checking rigid structure')
  );
});
```

### 2. Add debug-log coverage when skipping fracture due to missing rigid structure
```javascript
it('logs debug when skipping fracture due to missing rigid structure', async () => {
  mockEntityManager.hasComponent.mockReturnValue(false);

  await applicator.apply({
    ...baseParams,
    damageAmount: 60,
    maxHealth: 100,
  });

  expect(mockLogger.debug).toHaveBeenCalledWith(
    expect.stringContaining('lacks rigid structure')
  );
});
```

## Acceptance Criteria

### Tests That Must Pass
```bash
NODE_ENV=test npx jest tests/unit/anatomy/applicators/fractureApplicator.test.js --no-coverage --verbose
npm run test:unit
```
- All existing tests continue to pass
- All new tests pass
- Test coverage remains at or above previous levels

### Invariants That Must Remain True
- No modifications to source code
- Existing test patterns and conventions are followed
- Tests are isolated and independent
- Mock behavior is consistent across tests

## Estimated Diff Size
~20 lines of additions

## Dependencies
- FRAIMMRIGSTR-002 (assumed already merged; rigid structure check exists in code)

## Blocked By
- None

## Blocks
- FRAIMMRIGSTR-006 (integration tests build on unit test patterns)

## Status
Completed

## Outcome
Added unit-test coverage for non-Error exceptions in `hasRigidStructure()` and for debug logging when fracture is skipped due to missing rigid structure, rather than reworking the existing rigid-structure test updates that were already in place.
