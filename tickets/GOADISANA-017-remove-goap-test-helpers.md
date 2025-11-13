# GOADISANA-017: Remove GOAP Test Helpers

## Context

The GOAP test helpers provide utility functions and fixtures for GOAP tests. With all GOAP tests removed, these helpers are no longer needed.

**Fatal Flaw Context**: These helpers facilitated testing of services attempting to auto-generate effects and simulate planning - services and tests that are now completely removed.

## Objective

Remove the `tests/common/goap/` directory containing shared GOAP test utilities.

## Files Affected

**To be REMOVED** (1 file in `tests/common/goap/`):
- `goapTestHelpers.js`

**Expected Helper Functions** (for documentation):
```javascript
// Common utilities like:
// - createMockGoalManager()
// - createMockEffectsGenerator()
// - createTestAction()
// - createTestGoal()
// - mockPlanningEffects()
```

## Detailed Steps

1. **Verify directory exists**:
   ```bash
   test -d tests/common/goap/ && echo "Directory exists" || echo "Directory not found"
   ```

2. **Back up helpers** (for reference):
   ```bash
   cp tests/common/goap/goapTestHelpers.js tickets/removed-goap-test-helpers.js
   ```

3. **Remove entire directory**:
   ```bash
   rm -rf tests/common/goap/
   ```

4. **Verify removal**:
   ```bash
   test -d tests/common/goap/ && echo "ERROR: Directory still exists" || echo "OK: Directory removed"
   ```

5. **Search for any remaining imports** (should be none):
   ```bash
   grep -r "goapTestHelpers" tests/ || echo "No imports found (expected)"
   ```

## Acceptance Criteria

- [ ] `tests/common/goap/` directory removed completely
- [ ] `goapTestHelpers.js` file removed
- [ ] Helpers backed up to `tickets/removed-goap-test-helpers.js`
- [ ] No remaining imports of `goapTestHelpers` in test files
- [ ] Test suite still runs (no broken imports)
- [ ] Commit message documents helper removal

## Dependencies

**Requires**:
- GOADISANA-012 (unit tests removed - no longer import helpers)
- GOADISANA-013 (integration tests removed)
- GOADISANA-014 (e2e tests removed)

**Can run in PARALLEL with**:
- GOADISANA-015 (performance tests removal)
- GOADISANA-016 (memory tests removal)

**Note**: Should ideally run AFTER other test removals to ensure no imports remain

## Verification Commands

```bash
# Verify directory removed
test -d tests/common/goap/ && echo "FAIL" || echo "PASS"

# Check backup created
cat tickets/removed-goap-test-helpers.js

# Verify no imports remain
grep -r "goapTestHelpers" tests/
# Should return empty

# Verify no goap directories in common
find tests/common/ -name "*goap*"
# Should return empty

# Run test suite to verify no broken imports
npm run test:ci 2>&1 | grep -i "cannot find module.*goap"
# Should return empty (no import errors)
```

## Expected State After This Step

- All GOAP test infrastructure completely removed
- Test suite runs without GOAP test dependencies
- No broken imports or missing module errors
- Common test utilities for other systems preserved

## Helper Functions Lost

The removed helpers provided:
- Mock GOAP service factories
- Test fixture generators for goals and actions
- Planning effects mocking utilities
- Goal state simulation helpers

**Impact**: No longer needed as all GOAP tests removed

## Notes

- This is the final test-related cleanup ticket
- After this, all GOAP test code is removed
- Helpers remain in git history for reference
- No impact on non-GOAP test utilities in `tests/common/`
- Should verify no remaining imports before removal
- If any tests still import helpers, those tests are orphaned and should be investigated
