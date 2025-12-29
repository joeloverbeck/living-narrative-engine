# SCORESRUNCONROB-003 – Location-Dependent Scope Integration Tests

**Status**: ✅ COMPLETED

## Problem

Scopes that use `location.*` DSL patterns (e.g., `location.locations:exits[{filter}].target`) require `runtimeCtx.location` to be properly set. Currently, no integration tests verify:

- End-to-end behavior of location-dependent scopes
- Empty Set semantics when location is missing
- Proper chaining through location → component → filter → field

The dimensional-travel action discovery tests exposed this gap when they failed because `runtimeCtx.location` was not being populated.

## Proposed scope

Add integration tests that verify:
- Scopes using `location.*` patterns return correct entities when location is provided
- Missing location results in empty Set (graceful degradation, not errors)
- Complex chains like `location.component[filter].field` work correctly
- No exceptions are thrown for missing location property

## File list

- `tests/integration/scopeDsl/locationDependentScopes.test.js` (CREATE)

## Out of scope

- `src/scopeDsl/engine.js` — no changes to the scope engine
- `src/scopeDsl/nodes/sourceResolver.js` — no changes to source resolver
- `tests/common/mods/ModTestFixture.js` — no changes to test fixture
- Any production source code — no changes
- Any existing test files — no modifications

## Acceptance criteria

### Tests

```bash
npm run test:integration -- tests/integration/scopeDsl/locationDependentScopes.test.js
npm run test:integration -- tests/integration/mods/dimensional-travel/
npm run test:unit -- tests/unit/scopeDsl/engine.test.js
npm run test:unit -- tests/unit/scopeDsl/nodes/sourceResolver.test.js
```

All commands must pass.

### Invariants

1. **Empty Set semantics**: Missing source data (location) MUST return empty Set, NOT throw errors
2. **Dimensional-travel tests remain green**:
   - `tests/integration/mods/dimensional-travel/travel_through_dimensions_action_discovery.test.js`
   - `tests/integration/mods/dimensional-travel/diagnostic_dimensional_travel.test.js`
3. **Scope DSL tests remain green**:
   - `tests/unit/scopeDsl/engine.test.js`
   - `tests/unit/scopeDsl/nodes/sourceResolver.test.js`
4. No modifications to production code are required

### Required test cases

| Test Name | Description |
|-----------|-------------|
| `should return matching entities when location is provided` | Set `runtimeCtx.location` to valid entity → scope returns matching entities |
| `should return empty Set when location is null` | Set `runtimeCtx.location = null` → scope returns `Set()` |
| `should not throw when location property is missing` | Omit `location` from `runtimeCtx` → no exception, returns empty Set |
| `should correctly chain location.component[filter].field` | Verify multi-step resolution works end-to-end |

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned**: Create `tests/integration/scopeDsl/locationDependentScopes.test.js` with 4 required test cases.

**Actual**: Created the test file with **10 test cases** (exceeds requirements):

| Test Suite | Test Name | Status |
|------------|-----------|--------|
| Basic location source resolution | should return matching entities when location is provided | ✅ |
| Basic location source resolution | should return empty Set when location is null | ✅ |
| Basic location source resolution | should not throw when location property is missing from runtimeCtx | ✅ |
| Location component access chains | should correctly chain location.component access | ✅ |
| Location component access chains | should correctly chain location.component[filter].field | ✅ |
| Location component access chains | should return empty Set for location.component when location is null | ✅ |
| Edge cases and error handling | should handle location entity with missing component gracefully | ✅ |
| Edge cases and error handling | should handle location as string ID | ✅ |
| Edge cases and error handling | should handle undefined location provider | ✅ |
| Empty Set semantics invariant | should return empty Set for all missing location scenarios | ✅ |

### Invariants Verified

1. ✅ **Empty Set semantics**: All missing location scenarios return empty Set without throwing
2. ✅ **Dimensional-travel tests remain green**: All 7 tests pass (145 total tests across all suites)
3. ✅ **Scope DSL tests remain green**: `engine.test.js` and `sourceResolver.test.js` pass
4. ✅ **No production code modified**: Only test file created

### Technical Notes

- Filter expressions on plain objects (without `id` property) require accessing properties via `entity.*` path
- Example: `{"var": "entity.isPortal"}` instead of `{"var": "isPortal"}` for exit objects
- This is documented in the test file for future reference

### Files Created

- `tests/integration/scopeDsl/locationDependentScopes.test.js` (CREATE) - 285 lines, 10 tests

### Test Results

```
PASS tests/integration/scopeDsl/locationDependentScopes.test.js
PASS tests/integration/mods/dimensional-travel/*.test.js (7 files)
PASS tests/unit/scopeDsl/engine.test.js
PASS tests/unit/scopeDsl/nodes/sourceResolver.test.js

Test Suites: 10 passed, 10 total
Tests:       145 passed, 145 total
```
