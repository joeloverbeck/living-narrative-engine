# JSOLOGCUSOPEREF-003: Update Failing DI Registration Tests

**Priority**: 🔴 Critical
**Estimated Effort**: 2 hours
**Actual Effort**: ~5 minutes (verification only)
**Phase**: 1 - Critical Fixes
**Depends On**: JSOLOGCUSOPEREF-001
**Status**: ✅ COMPLETED (2025-12-16)

---

## Outcome

### Original Assumption (INCORRECT)

The ticket assumed that `worldAndEntityRegistrations.test.js` tests would fail due to missing `LightingStateService` dependency when calling `registerWorldAndEntity()` in isolation.

### Actual Finding

**The issue was already resolved in JSOLOGCUSOPEREF-001.** That ticket implemented Option C (Minimal Mock Registration) by adding a mock `ILightingStateService` to the test file's `beforeEach` block at lines 144-148:

```javascript
// Register ILightingStateService (required by JsonLogicCustomOperators)
container.register(tokens.ILightingStateService, () => ({
  isLocationLit: jest.fn().mockReturnValue(true),
  getLightLevel: jest.fn().mockReturnValue(1.0),
}));
```

### Verification Results

All tests pass without any changes:

```bash
npm run test:unit -- tests/unit/dependencyInjection/registrations/worldAndEntityRegistrations.test.js
# Result: 54/54 tests passed

npm run test:unit -- tests/unit/dependencyInjection/registrations/
# Result: 291/291 tests passed
```

### Conclusion

No code changes were necessary. The ticket was effectively a duplicate of work already completed in JSOLOGCUSOPEREF-001. The dependency between these tickets (003 depends on 001) meant that when 001 was completed with the test-only fix approach, 003 became obsolete.

---

## Original Summary (Preserved for Reference)

The `worldAndEntityRegistrations.test.js` tests fail because they call `registerWorldAndEntity()` in isolation, but `JsonLogicCustomOperators` now depends on `LightingStateService` from `infrastructureRegistrations.js`. The tests need to be updated to either mock the missing dependency or include the required registration modules.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/dependencyInjection/registrations/worldAndEntityRegistrations.test.js` | Modify - update test setup to handle LightingStateService dependency |

---

## Out of Scope

**DO NOT modify:**
- Source files (handled by JSOLOGCUSOPEREF-001)
- Other test files
- Any operator implementation files
- Integration tests (they use full DI setup)

---

## Implementation Details

### Option A: Mock LightingStateService in Tests

If JSOLOGCUSOPEREF-001 makes `lightingStateService` optional, no changes may be needed. Verify first.

### Option B: Register Infrastructure in Test Setup

Add infrastructure registration to the test setup:

```javascript
import { registerInfrastructure } from '../../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';

beforeEach(() => {
  container = createMockContainer();

  // Register infrastructure first (provides LightingStateService)
  registerInfrastructure(container);

  // Then register world and entity
  registerWorldAndEntity(container);
});
```

### Option C: Minimal Mock Registration

Register only the specific token that's missing:

```javascript
beforeEach(() => {
  container = createMockContainer();

  // Mock the missing LightingStateService
  container.register('ILightingStateService', {
    isLocationLit: jest.fn().mockReturnValue(true),
  });

  registerWorldAndEntity(container);
});
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/dependencyInjection/registrations/worldAndEntityRegistrations.test.js
npm run test:unit -- tests/unit/dependencyInjection/registrations/
```

### Specific Test Assertions

1. **All existing tests pass**: No test removals or skips allowed
2. **JsonLogicCustomOperators resolves**: Container can resolve the service without errors
3. **No "No service registered" errors**: All tokens resolve correctly

### Invariants That Must Remain True

1. **Test isolation**: Each test runs independently without shared state
2. **Mock clarity**: If mocking is used, it must be clear what's being mocked
3. **No false positives**: Tests must actually validate registration, not just pass
4. **Coverage maintained**: Test coverage for registration files must not decrease

---

## Verification Commands

```bash
# Run the specific test file
npm run test:unit -- tests/unit/dependencyInjection/registrations/worldAndEntityRegistrations.test.js --verbose

# Run all DI registration tests
npm run test:unit -- tests/unit/dependencyInjection/registrations/ --verbose

# Verify no regressions in integration tests
npm run test:integration -- tests/integration/dependencyInjection/

# Full CI check
npm run test:ci
```

---

## Notes

- Coordinate with JSOLOGCUSOPEREF-001 - if that ticket makes `lightingStateService` optional, this may be simpler
- The mock approach (Option C) is preferred for unit tests as it isolates the module under test
- Check if there are helper functions in `/tests/common/` for DI container mocking
