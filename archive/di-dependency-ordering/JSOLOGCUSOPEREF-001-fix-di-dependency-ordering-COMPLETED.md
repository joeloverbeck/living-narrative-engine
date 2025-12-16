# JSOLOGCUSOPEREF-001: Fix DI Dependency Ordering for LightingStateService

**Priority**: 🔴 Critical
**Estimated Effort**: 2 hours
**Actual Effort**: ~15 minutes
**Phase**: 1 - Critical Fixes
**Status**: ✅ COMPLETED (2025-12-16)

---

## Summary

The `JsonLogicCustomOperators` class depends on `LightingStateService` which is registered in `infrastructureRegistrations.js`, but the operator class itself is registered in `worldAndEntityRegistrations.js`. This cross-module dependency caused unit tests that call `registerWorldAndEntity()` in isolation to fail with "No service registered for key" errors.

---

## Outcome

### Originally Planned

The ticket proposed two options:
- **Option A (Recommended)**: Make `lightingStateService` optional in production code
  - Modify `jsonLogicCustomOperators.js` to handle optional dependency
  - Modify `worldAndEntityRegistrations.js` to use `tryResolve`
- **Option B**: Register infrastructure first in tests

### Actually Implemented: Option B (Simpler Solution)

Only the test file was modified. No production code changes were necessary.

**Change made to `tests/unit/dependencyInjection/registrations/worldAndEntityRegistrations.test.js`**:

```javascript
// Register ILightingStateService (required by JsonLogicCustomOperators)
container.register(tokens.ILightingStateService, () => ({
  isLocationLit: jest.fn().mockReturnValue(true),
  getLightLevel: jest.fn().mockReturnValue(1.0),
}));
```

This mock registration was added to the `beforeEach` block, ensuring the test has the required dependency without modifying production code.

### Rationale for Option B

1. **Minimal change**: Only 6 lines added to test file
2. **No production code risk**: No changes to `jsonLogicCustomOperators.js` or `worldAndEntityRegistrations.js`
3. **Follows existing patterns**: Other tests in the file already mock services in `beforeEach`
4. **Complete test isolation**: Tests don't depend on other registration modules

---

## Files Actually Modified

| File | Change Type |
|------|-------------|
| `tests/unit/dependencyInjection/registrations/worldAndEntityRegistrations.test.js` | Added mock `ILightingStateService` registration |

**Files NOT modified** (contrary to original ticket scope):
- ❌ `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`
- ❌ `src/logic/jsonLogicCustomOperators.js`

---

## Verification Results

All acceptance criteria met:

### Tests Passed ✅
```bash
# worldAndEntityRegistrations.test.js - 54 tests passed
# jsonLogicCustomOperators.test.js - 74 tests passed
# integration/logic/ - 259 tests passed
```

### Specific Assertions Met ✅
1. `registerWorldAndEntity()` can be called in isolation without throwing ✅
2. `JsonLogicCustomOperators` resolves successfully from container ✅
3. No "No service registered for key: ILightingStateService" errors ✅
4. All 26 operator registrations work correctly ✅

### Invariants Preserved ✅
1. Full application startup works correctly ✅
2. `getRegisteredOperators().size` equals 26 ✅
3. No breaking changes to production code ✅
4. No new linting errors from the change ✅

---

## New/Modified Tests

| Test File | Change | Rationale |
|-----------|--------|-----------|
| `worldAndEntityRegistrations.test.js` | Added `ILightingStateService` mock in `beforeEach` | Ensures test isolation works without cross-module DI dependencies. Tests can run in isolation without requiring `registerInfrastructure()` to be called first. |

---

## Lessons Learned

1. **Option B was sufficient**: The simpler test-only fix was adequate for the issue
2. **No production code changes needed**: Making dependencies optional in production code would have added complexity without clear benefit
3. **Follow existing patterns**: The test file already mocked other services; this change follows that pattern

---

## Original Ticket Content (Preserved)

### Implementation Details (Original)

#### Option A: Make LightingStateService Optional (Originally Recommended)

1. **In `jsonLogicCustomOperators.js` constructor:**
   - Accept `lightingStateService` as optional dependency
   - Store it but don't require it for instantiation
   - Log warning if not provided

2. **In `registerOperators()` method:**
   - Only register `isActorLocationLit` operator if `lightingStateService` is available
   - Log debug message when skipping due to missing dependency

3. **In `worldAndEntityRegistrations.js`:**
   - Use `c.tryResolve(tokens.ILightingStateService)` instead of `c.resolve()`
   - This returns `undefined` if not registered instead of throwing

#### Option B: Register Infrastructure First in Tests ✅ (IMPLEMENTED)

1. **In test setup:**
   - Register mock `ILightingStateService` in `beforeEach`
   - This ensures all dependencies are available

---

## Notes

- The `tryResolve` method does not exist in the container, but `isRegistered()` is available
- The simpler mock registration approach was sufficient without needing `tryResolve`
