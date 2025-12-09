# MODENTPATVAL-002: Load-Time Validation Integration

**Status:** COMPLETED
**Priority:** High (Phase 2 - Integration)
**Estimated Effort:** 0.5 days
**Dependencies:** MODENTPATVAL-001 (Entity Path Validator Utility)

---

## Codebase Verification Notes

**Verified on 2025-12-09:**

1. **MODENTPATVAL-001 is complete** - `src/logic/utils/entityPathValidator.js` exists with all required functions
2. **Action file already fixed** - `treat_my_wounded_part.action.json` uses correct `entity.actor` paths (lines 61, 67)
3. **ActionLoader inheritance**: `ActionLoader` → `SimpleItemLoader` → `BaseManifestItemLoader`
4. **Implementation point**: Override `_processFetchedItem` in `ActionLoader` (already exists for visual properties)
5. **Method signature**: `_processFetchedItem(modId, filename, resolvedPath, data, registryKey)` - action ID is in `data.id`

---

## Objective

Integrate the `EntityPathValidator` into the action loading pipeline so that invalid entity paths in modifier conditions are detected at mod load time, not at runtime. This provides early detection of path errors before they cause silent failures during gameplay.

---

## Files to Touch

### Modified Files

- `src/loaders/actionLoader.js` - Add validation call during action loading

### New Files

- `tests/integration/validation/modifierEntityPathValidation.integration.test.js`

---

## Out of Scope

**DO NOT modify:**

- `src/logic/utils/entityPathValidator.js` (created in MODENTPATVAL-001)
- `src/logic/utils/entityPathResolver.js` (existing resolution logic)
- `src/combat/services/ModifierContextBuilder.js` (context building)
- `src/logic/operators/base/BaseEquipmentOperator.js` (operator logic)
- `data/schemas/action.schema.json` (schema enhancement is MODENTPATVAL-003)
- Any mod files in `data/mods/` (validation script is MODENTPATVAL-004)
- Any DI registration files
- Other loaders (ruleLoader, componentLoader, etc.)

---

## Implementation Details

### ActionLoader Integration

Modify `src/loaders/actionLoader.js` to call the validator during action loading:

1. **Import the validator:**
```javascript
import { validateModifierCondition } from '../logic/utils/entityPathValidator.js';
```

2. **Add validation method to ActionLoader class:**
```javascript
/**
 * Validates entity paths in modifier conditions
 * @param {object} data - Loaded action data
 * @param {string} actionId - Action ID for error messages
 * @returns {Array<{path: string, error: string, location: string}>} - Array of validation errors
 * @private
 */
#validateModifierEntityPaths(data, actionId) {
  const errors = [];

  // Check chanceBased.modifiers if present
  const modifiers = data?.chanceBased?.modifiers;
  if (!Array.isArray(modifiers)) {
    return errors;
  }

  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i];
    if (modifier?.condition) {
      const result = validateModifierCondition(modifier.condition);
      if (!result.isValid) {
        for (const err of result.errors) {
          errors.push({
            ...err,
            location: `chanceBased.modifiers[${i}].condition.${err.location}`,
            actionId,
          });
        }
      }
    }
  }

  return errors;
}
```

3. **Call validation in `_processFetchedItem` after super call:**
```javascript
async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
  // Call parent implementation first
  const result = await super._processFetchedItem(
    modId,
    filename,
    resolvedPath,
    data,
    registryKey
  );

  // Validate modifier entity paths
  const pathErrors = this.#validateModifierEntityPaths(data, result.qualifiedId);
  if (pathErrors.length > 0) {
    for (const error of pathErrors) {
      this._logger.warn(
        `ActionLoader: Invalid entity path in ${error.actionId} at ${error.location}: ` +
        `"${error.path}" - ${error.error}`
      );
    }
    // Graceful degradation: warn but continue loading
  }

  // Add visual properties logging if present (existing code)
  if (hasVisualProperties(data)) {
    this._logger.debug(
      `Action ${result.qualifiedId} loaded with visual properties:`,
      data.visual
    );
  }

  return result;
}
```

**Note:** Uses `this._logger` (protected field from parent) instead of `this.#logger` (private).

### Behavior Notes

- **Graceful degradation**: Initially, validation will log warnings but not block loading
- **Future enhancement**: Add a `strictValidation` option that throws on path errors
- **Logger usage**: Uses the existing logger dependency injection pattern
- **No breaking changes**: Existing action files continue to load normally

---

## Acceptance Criteria

### Tests That Must Pass

1. **Integration tests:**

```javascript
// tests/integration/validation/modifierEntityPathValidation.integration.test.js
describe('Modifier Entity Path Validation at Load Time', () => {
  describe('invalid path detection', () => {
    it('should log warning for paths not starting with entity.');
    it('should log warning for paths with invalid roles');
    it('should include action ID and modifier index in warning');
    it('should include the problematic path in warning');
    it('should include suggestion of valid roles in warning');
  });

  describe('valid path handling', () => {
    it('should not log warnings for valid entity.actor paths');
    it('should not log warnings for valid entity.primary paths');
    it('should not log warnings for paths with component access');
  });

  describe('graceful degradation', () => {
    it('should continue loading action even with invalid paths');
    it('should load all modifiers even if some have invalid paths');
  });

  describe('edge cases', () => {
    it('should handle actions without modifiers');
    it('should handle modifiers without conditions');
    it('should handle null/undefined gracefully');
  });
});
```

2. **Regression test for fix:**
   - `tests/integration/mods/first-aid/treat_my_wounded_part_modifier_context.test.js` continues to pass
   - No new warnings logged for the fixed action files

3. **All existing tests pass:**
   - `npm run test:unit` passes
   - `npm run test:integration` passes

### Invariants That Must Remain True

1. **Backward compatibility**: All existing valid action files load without errors
2. **No loading failures**: Actions with invalid paths still load (with warnings)
3. **Existing tests pass**: `npm run test:ci` passes with no regressions
4. **Warning format consistent**: Warnings follow existing logging patterns
5. **No performance regression**: Validation is O(n) where n = number of modifiers

---

## Verification Steps

```bash
# 1. Run the first-aid regression tests to ensure no warnings
NODE_ENV=test npx jest tests/integration/mods/first-aid/treat_my_wounded_part_modifier_context.test.js --no-coverage --verbose

# 2. Run the new integration tests
NODE_ENV=test npx jest tests/integration/validation/modifierEntityPathValidation.integration.test.js --no-coverage --verbose

# 3. Run unit tests for action loader
npm run test:unit -- --testPathPattern="actionLoader" --verbose

# 4. Run full test suite to ensure no regressions
npm run test:ci

# 5. Manual verification: Load the game and check console for path warnings
npm run start
```

---

## Reference Files

- ActionLoader: `src/loaders/actionLoader.js`
- EntityPathValidator: `src/logic/utils/entityPathValidator.js` (from MODENTPATVAL-001)
- Fixed action file: `data/mods/first-aid/actions/treat_my_wounded_part.action.json`
- Regression test: `tests/integration/mods/first-aid/treat_my_wounded_part_modifier_context.test.js`

---

## Risk Assessment

**Risk Level:** Medium

**Mitigation:**
- Validation only warns, does not block loading
- All existing tests serve as regression protection
- Easy rollback by removing the validation call

**Testing Strategy:**
- Integration tests simulate loading actions with various path patterns
- Spy on logger to verify correct warnings are emitted
- Verify no warnings for valid paths

---

## Completion Summary

**Completed:** 2025-12-09

### Files Modified
- `src/loaders/actionLoader.js` - Added import, private validation method, and validation call

### Files Created
- `tests/integration/validation/modifierEntityPathValidation.integration.test.js` - 15 tests covering all acceptance criteria

### Test Results
- **New integration tests:** 15/15 passed
- **Regression tests:** 4/4 passed (`treat_my_wounded_part_modifier_context.test.js`)
- **Action loader tests:** 12/12 passed (unit + integration)
- **Entity path validator tests:** 39/39 passed
- **All relevant tests:** 394/394 passed

---

## Outcome

### Planned vs. Actual

| Aspect | Planned | Actual |
|--------|---------|--------|
| Files modified | `src/loaders/actionLoader.js` | ✅ Same |
| Files created | 1 integration test file | ✅ Same |
| Implementation approach | Override `_processFetchedItem` | ✅ Same |
| Logger usage | `this.#logger` (private) | `this._logger` (protected from parent) |
| Test count | ~13 specified in acceptance criteria | 15 tests implemented |

### Minor Corrections Made to Ticket

1. **Variable naming**: Ticket originally referenced `actionData` but actual parameter name is `data`
2. **Logger access**: Changed from `this.#logger` (private) to `this._logger` (protected inherited field)
3. **Method signature**: Verified actual signature of `_processFetchedItem` and documented

### Key Observations

- ActionLoader already had `_processFetchedItem` override for visual properties logging
- The existing override made integration straightforward - just added validation call before visual properties check
- All existing valid action files (including fixed `treat_my_wounded_part.action.json`) load without warnings
- Graceful degradation works as designed - validation warns but doesn't block loading
