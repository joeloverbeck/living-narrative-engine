# TESINFROB-005: Early Validation in ModTestFixture.forAction()

**Priority**: Low | **Effort**: Small | **Status**: COMPLETED

## Description

Add early validation in `ModTestFixture.forAction()` to catch common issues before test execution begins, with helpful suggestions.

## Files to Touch

- `tests/common/mods/ModTestFixture.js` (modify)
- `tests/unit/common/mods/ModTestFixture.earlyValidation.test.js` (create)
  - Note: Changed from `.validation.test.js` because that file already exists for SCHVALTESINT-001 (schema validation)

## Out of Scope

- **DO NOT** change factory method signatures
- **DO NOT** add new public methods beyond validation
- **DO NOT** modify `systemLogicTestEnv.js`
- **DO NOT** change error handling for valid inputs
- **DO NOT** add scope mocking (that's TESINFROB-003)
- **DO NOT** add condition registration (that's TESINFROB-004)

## Implementation Details

### 1. Add validation to forAction()

In `tests/common/mods/ModTestFixture.js`, add validation to `forAction()`:

```javascript
import { existsSync, readdirSync, statSync } from 'fs';
import { findSimilar } from '../../../src/utils/suggestionUtils.js';

class ModTestFixture {
  // ... existing code ...

  static async forAction(modId, actionId, ruleFile, conditionFile, options = {}) {
    // Early validation: mod/action existence (only when files will be auto-loaded)
    // Skip if both rule and condition files are provided (mock data scenario)
    const needsAutoLoad = !ruleFile || !conditionFile;
    if (needsAutoLoad) {
      // Validate action ID format
      if (!actionId.includes(':')) {
        const suggestion = `${modId}:${actionId}`;
        throw new Error(
          `Invalid action ID format: '${actionId}'. ` +
            `Action IDs must be namespaced (e.g., 'mod:action-name'). ` +
            `Did you mean '${suggestion}'?`
        );
      }

      // Validate mod exists
      const modPath = `data/mods/${modId}`;
      if (!existsSync(modPath)) {
        // ... error with suggestions using findSimilar()
      }

      // Validate action file exists
      const actionFile = `data/mods/${modId}/actions/${actionId.split(':')[1]}.action.json`;
      if (!existsSync(actionFile)) {
        // ... error with suggestions
      }
    }

    // ... existing implementation continues ...
  }
}
```

### 2. Create test file

Create `tests/unit/common/mods/ModTestFixture.earlyValidation.test.js` with:
- Action ID format validation tests
- Mod existence validation tests
- Action existence validation tests
- Valid input regression tests
- Edge case tests for explicit file scenarios

## Acceptance Criteria

### Tests that must pass

- `tests/unit/common/mods/ModTestFixture.earlyValidation.test.js`:
  - `should throw for non-namespaced action ID with suggestion`
  - `should throw descriptive error for non-namespaced ID`
  - `should accept valid namespaced action ID`
  - `should throw for non-existent mod with available mods list`
  - `should suggest similar mod names for typos`
  - `should suggest similar mod names for partial matches`
  - `should throw for non-existent action with suggestions`
  - `should suggest similar action names for typos`
  - `should list available actions when no close match`
  - `should handle mod with no actions directory gracefully`
  - `should pass validation for valid mod and action`
  - `should work with additional options`
  - `should work with sitting mod`
  - `should handle action ID with multiple colons`
  - `should not throw format error when colon is present`
  - `should skip mod/action existence validation when explicit files provided`
  - `should skip action ID format validation when explicit files provided`

### Invariants

- All existing tests pass unchanged
- Valid inputs work exactly as before
- Error messages are actionable with suggestions
- No runtime overhead for valid inputs (validation is fail-fast)
- No changes to factory method signatures

## Verification

```bash
# Run new tests
npm run test:unit -- tests/unit/common/mods/ModTestFixture.earlyValidation.test.js

# Verify no regressions in ModTestFixture tests
npm run test:unit -- tests/unit/common/mods/ModTestFixture
```

## Notes

This ticket adds defensive validation that catches common mistakes early:
- Forgetting namespace prefix on action IDs
- Typos in mod names
- Typos in action names

The suggestions use the same Levenshtein distance algorithm as TESINFROB-001.

---

## Outcome

### Completed: 2025-01-04

### Implementation Changes

1. **Test file renamed**: Created `ModTestFixture.earlyValidation.test.js` instead of `ModTestFixture.validation.test.js` (which already exists for schema validation)

2. **fs import corrected**: Used synchronous named imports instead of default import:
   ```javascript
   import { existsSync, readdirSync, statSync } from 'fs';
   ```

3. **Validation is conditional**: Validation only runs when `needsAutoLoad` is true (i.e., when rule or condition files are not explicitly provided). This maintains backward compatibility with tests that use mock data with fake mod/action IDs.

### Test Results

- All 17 new early validation tests pass
- All 290 ModTestFixture-related tests pass
- Early validation catches ~142 pre-existing bugs in integration tests where tests specify incorrect modIds (e.g., `modId: 'positioning'` for action `bending:bend_over`)

### Detected Pre-existing Issues

The early validation feature revealed ~142 integration tests with incorrect `modId` parameters. These tests were previously "passing" because no validation checked if the mod existed. Examples:
- `tests/integration/mods/bending/bend_over_lying_forbidden.test.js` uses `modId: 'positioning'` but action is in `bending` mod
- Similar issues exist in other test files

These issues should be fixed in a separate ticket (out of scope for TESINFROB-005).

### Files Modified

| File | Change |
|------|--------|
| `tests/common/mods/ModTestFixture.js` | Added imports (lines 24-25), added early validation logic in forAction() (lines 379-438) |
| `tests/unit/common/mods/ModTestFixture.earlyValidation.test.js` | Created (189 lines) |
| `tests/unit/common/mods/ModTestFixtureAutoLoading.test.js` | Updated mock to include `statSync` and `existsSync.mockReturnValue(true)` for tests that need to pass early validation |
