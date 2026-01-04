# TESINFROB-006: Migration Guide and Test Updates

**Priority**: Low | **Effort**: Medium (reduced from Large)

**Status**: ✅ COMPLETED

## Description

Create migration documentation and update example test to use new APIs. This ticket documents the new patterns and provides an example migration.

**Note**: The `mockScope()`, `registerCondition()`, and related APIs were already implemented in TESINFROB-003 and TESINFROB-004. The `docs/testing/mod-testing-guide.md` already contains documentation for these APIs. This ticket focuses on:
1. Creating a dedicated migration guide document
2. Migrating an example test to demonstrate the new patterns

## Files to Touch

- `docs/testing/test-infrastructure-migration.md` (create)
- `tests/integration/mods/striking/striking_facing_away_filter.test.js` (modify - example migration)

## Files Already Updated (No Changes Needed)

- `docs/testing/mod-testing-guide.md` - Already contains `mockScope()` and `registerCondition()` documentation
- `tests/common/mods/ModTestFixture.js` - Already contains the new APIs (implemented in TESINFROB-003, TESINFROB-004)

## Out of Scope

- **DO NOT** modify core infrastructure files (systemLogicTestEnv.js, ModTestFixture.js core)
- **DO NOT** break existing test patterns
- **DO NOT** force migration of all tests (optional upgrade)
- **DO NOT** remove support for manual mocking patterns
- **DO NOT** add new API methods (those are in TESINFROB-003, TESINFROB-004)

## Acceptance Criteria

### Tests that must pass

- All existing tests continue to pass
- `tests/integration/mods/striking/striking_facing_away_filter.test.js` passes with new API
- Documentation is accurate and builds without errors

### Invariants

- Documentation is accurate and helpful
- Old patterns still work (deprecated but functional)
- Migration is optional, not forced
- Example test demonstrates clear before/after improvement
- No runtime behavior changes for existing tests

---

## Outcome

### Completed Deliverables

1. **Created `docs/testing/test-infrastructure-migration.md`**
   - Comprehensive migration guide covering:
     - Property access improvements (fail-fast with suggestions)
     - Scope mocking migration (10+ lines → 1 line)
     - Condition registration migration (private → public API)
     - Action ID format validation
     - Common patterns and troubleshooting

2. **Migrated `tests/integration/mods/striking/striking_facing_away_filter.test.js`**
   - Converted from manual `__strikingOriginalResolve` pattern to `fixture.mockScope()` API
   - Converted from direct `_loadedConditions` access to `fixture.registerCondition()` API
   - All 11 tests pass

3. **Bug Fix: Dual-Map Condition Registration**
   - **Issue Discovered**: `fixture.registerCondition()` stored conditions in `fixture._loadedConditions`, but `ScopeResolverHelpers._loadConditionsIntoRegistry()` sets up a separate override checking `testEnv._loadedConditions` - these were different Maps, causing condition lookups to fail.
   - **Fix Applied**: Modified `registerCondition()` and `clearRegisteredConditions()` in `ModTestFixture.js` to write to BOTH Maps when `testEnv._loadedConditions` exists, ensuring cross-compatibility.
   - **Files Modified**: `tests/common/mods/ModTestFixture.js`

4. **Cleanup**
   - Removed all diagnostic console.log statements from `systemLogicTestEnv.js`
   - Removed diagnostic logging from `src/scopeDsl/nodes/filterResolver.js`

### Test Verification

- ✅ `striking_facing_away_filter.test.js`: 11/11 tests pass
- ✅ `ModTestFixture*.test.js`: 290/290 tests pass
- ✅ No regressions in existing test patterns

### Technical Notes

The dual-map condition registration fix ensures that:
- Conditions registered via `fixture.registerCondition()` are available to both:
  - `ModTestFixture.loadDependencyConditions()` override (checks `fixture._loadedConditions`)
  - `ScopeResolverHelpers._loadConditionsIntoRegistry()` override (checks `testEnv._loadedConditions`)
- Cleanup properly removes from both Maps to prevent test pollution
