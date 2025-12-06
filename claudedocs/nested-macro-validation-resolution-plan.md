# Nested Macro Validation Issue - Comprehensive Resolution Report

## Executive Summary

The four macro files (`handleMeleeCritical.macro.json`, `handleMeleeFumble.macro.json`, `handleMeleeHit.macro.json`, `handleMeleeMiss.macro.json`) fail schema validation with a confusing error message suggesting `FOR_EACH` is unknown despite being in the whitelist. This is **not** an operation type registration issue but rather a **schema validation architecture problem** involving circular references and missing pre-validation for macros.

---

## Problem Analysis

### 1. The Misleading Error Message

**Error displayed:**

```
Unknown or invalid operation type: 'FOR_EACH'
Did you mean "FOR_EACH"?
```

**Why this is misleading:** `FOR_EACH` IS in the `KNOWN_OPERATION_TYPES` whitelist in `src/utils/preValidationUtils.js` (line 56). The error is not coming from pre-validation but from AJV's anyOf validation cascade.

### 2. Root Cause: Circular Reference Resolution Failure

The issue stems from a complex circular reference chain in the schema definitions:

```
macro.schema.json
  └─ actions items → ./operation.schema.json#/$defs/Action
       └─ anyOf → #/$defs/MacroReference | #/$defs/Operation
            └─ Operation anyOf → ./operations/forEach.schema.json
                 └─ parameters.actions items → ../operation.schema.json#/$defs/Action
                      └─ CIRCULAR! Back to Action definition
```

**When AJV attempts to validate a macro with FOR_EACH:**

1. AJV tries to compile `macro.schema.json`
2. It needs to resolve `./operation.schema.json#/$defs/Action`
3. Action references Operation, which references `forEach.schema.json`
4. `forEach.schema.json` references back to `../operation.schema.json#/$defs/Action`
5. The circular reference causes fragment resolution issues
6. When resolution fails, AJV validates against ALL 50+ operation types in the `anyOf`
7. This produces 930+ errors that cascade into confusing messages

### 3. Critical Code Gap: Pre-Validation Skips Macros

**Location:** `src/utils/preValidationUtils.js` lines 590-598

```javascript
export function performPreValidation(data, schemaId, filePath = 'unknown') {
  // Check for rule-specific validation
  if (schemaId === 'schema://living-narrative-engine/rule.schema.json') {
    return validateRuleStructure(data, filePath);
  }

  // For other schemas, skip pre-validation to avoid conflicts
  return { isValid: true, error: null, path: null, suggestions: null };
}
```

**Impact:** Macros skip pre-validation entirely and go directly to AJV validation, where the circular reference issue manifests.

### 4. Why Working Macros Pass

Macros like `core:endTurnOnly` that use simple operations (DISPATCH_EVENT, END_TURN) pass because:

- They don't have nested `actions` arrays
- They don't trigger the circular reference path through `forEach.schema.json` or `if.schema.json`

Failing macros like `weapons:handleMeleeCritical` fail because:

- They contain `FOR_EACH` operations with nested `actions` arrays
- These nested arrays trigger the circular reference resolution

---

## Existing Mitigation Attempts

The codebase already has:

1. **`nested-operation.schema.json`** - A simplified schema for nested operations that breaks the circular reference:
   - Uses `oneOf` instead of `anyOf`
   - Has a simplified `NestedOperation` definition without recursive refs
   - The `if.schema.json` correctly uses this for `then_actions` and `else_actions`

2. **`forEach.schema.json` uses full Action reference** - This is the problem:
   - Line 35: `"$ref": "../operation.schema.json#/$defs/Action"`
   - This creates the circular reference

3. **Test coverage for circular refs** - Tests exist in:
   - `tests/unit/validation/ajvSchemaValidator.circularFragmentRefs.test.js`
   - `tests/integration/validation/ajvSchemaValidator.productionSchemaValidation.test.js`

---

## Proposed Solutions

### Solution 1: Fix forEach.schema.json to Use nested-operation.schema.json (RECOMMENDED)

**Priority: HIGH | Effort: LOW | Risk: LOW**

**Problem:** `forEach.schema.json` references `../operation.schema.json#/$defs/Action` for nested actions.

**Fix:** Change it to reference `../nested-operation.schema.json#/$defs/NestedAction` like `if.schema.json` does.

**File:** `data/schemas/operations/forEach.schema.json`

**Current (line 35):**

```json
"items": {
  "$ref": "../operation.schema.json#/$defs/Action"
}
```

**Proposed:**

```json
"items": {
  "$ref": "../nested-operation.schema.json#/$defs/NestedAction"
}
```

**Validation:** This is consistent with how `if.schema.json` handles the same pattern (see lines 31-32, 38-39).

---

### Solution 2: Add Pre-Validation for Macros

**Priority: HIGH | Effort: MEDIUM | Risk: LOW**

**Rationale:** Even with the schema fix, adding fail-fast pre-validation provides better error messages.

**File:** `src/utils/preValidationUtils.js`

**Changes:**

1. **Add macro schema check in `performPreValidation`:**

```javascript
export function performPreValidation(data, schemaId, filePath = 'unknown') {
  // Check for rule-specific validation
  if (schemaId === 'schema://living-narrative-engine/rule.schema.json') {
    return validateRuleStructure(data, filePath);
  }

  // NEW: Check for macro-specific validation
  if (schemaId === 'schema://living-narrative-engine/macro.schema.json') {
    return validateMacroStructure(data, filePath);
  }

  // For other schemas, skip pre-validation to avoid conflicts
  return { isValid: true, error: null, path: null, suggestions: null };
}
```

2. **Add new `validateMacroStructure` function:**

```javascript
/**
 * Validates the structure of a macro definition before AJV validation.
 *
 * @param {object} macroData - The macro data to validate
 * @param {string} filePath - Path to the macro file for error reporting
 * @returns {PreValidationResult} Validation result
 */
export function validateMacroStructure(macroData, filePath = 'unknown') {
  if (!macroData || typeof macroData !== 'object') {
    return {
      isValid: false,
      error: 'Macro data must be an object',
      path: 'root',
      suggestions: ['Ensure the macro file contains a valid JSON object'],
    };
  }

  // Check for required macro fields
  if (!macroData.id) {
    return {
      isValid: false,
      error: 'Missing required "id" field in macro',
      path: 'root',
      suggestions: [
        'Add an "id" field with a namespaced ID like "weapons:handleMeleeCritical"',
      ],
    };
  }

  if (!macroData.description) {
    return {
      isValid: false,
      error: 'Missing required "description" field in macro',
      path: 'root',
      suggestions: [
        'Add a "description" field explaining what this macro does',
      ],
    };
  }

  if (!macroData.actions) {
    return {
      isValid: false,
      error: 'Missing required "actions" field in macro',
      path: 'root',
      suggestions: ['Add an "actions" array with at least one operation'],
    };
  }

  if (!Array.isArray(macroData.actions)) {
    return {
      isValid: false,
      error: 'Macro "actions" field must be an array',
      path: 'actions',
      suggestions: ['Change the actions field to an array of operations'],
    };
  }

  if (macroData.actions.length === 0) {
    return {
      isValid: false,
      error: 'Macro "actions" array cannot be empty',
      path: 'actions',
      suggestions: ['Add at least one operation to the actions array'],
    };
  }

  // Validate all operations in the macro (reuse existing function)
  return validateAllOperations(macroData, 'root');
}
```

---

### Solution 3: Improve Error Message Detection

**Priority: MEDIUM | Effort: MEDIUM | Risk: LOW**

**Rationale:** When AJV validation fails with 100+ errors, detect this as a circular reference cascade and provide a helpful message.

**File:** `src/utils/schemaValidationUtils.js`

**Enhancement to `formatAjvErrorsEnhanced`:**

```javascript
/**
 * Detects if validation errors indicate a circular reference cascade
 * @param {Array} errors - AJV validation errors
 * @returns {boolean} True if cascade detected
 */
function detectCircularRefCascade(errors) {
  if (!errors || errors.length < 50) return false;

  // Look for patterns indicating anyOf cascade
  const anyOfErrors = errors.filter(
    (e) => e.keyword === 'anyOf' || e.keyword === 'oneOf'
  );

  return anyOfErrors.length > 10;
}

// In the error formatting function:
if (detectCircularRefCascade(errors)) {
  return `Schema validation failed due to circular reference cascade (${errors.length} errors).
This typically indicates nested operations with circular schema references.
Check that nested actions use nested-operation.schema.json instead of operation.schema.json.`;
}
```

---

### Solution 4: Add Explicit Circular Reference Detection in Schema Loader

**Priority: LOW | Effort: HIGH | Risk: MEDIUM**

**Rationale:** Defensive improvement to catch circular refs during schema loading.

**File:** `src/validation/ajvSchemaValidator.js`

**Location:** `#createSchemaLoader()` method (lines 75-264)

**Enhancement:** Track visited schema refs during resolution and detect when a circular path is encountered.

This is a lower priority because Solution 1 addresses the root cause.

---

## Implementation Priority Order

### Phase 1: Immediate Fix (< 1 hour)

1. **Solution 1**: Fix `forEach.schema.json` to use `nested-operation.schema.json`
   - Single file change
   - Consistent with existing pattern in `if.schema.json`
   - Immediately resolves the validation failure

### Phase 2: Fail-Fast Improvements (2-3 hours)

2. **Solution 2**: Add macro pre-validation in `preValidationUtils.js`
   - Better error messages for macro issues
   - Prevents cascade before AJV validation
   - Validates nested operations recursively

### Phase 3: Enhanced Error Handling (1-2 hours)

3. **Solution 3**: Improve error cascade detection
   - Better UX when circular refs cause cascades
   - Guides modders to the actual issue

### Phase 4: Defensive Architecture (4+ hours)

4. **Solution 4**: Schema loader circular ref detection (optional)
   - Long-term architectural improvement
   - Lower priority if other solutions resolve the issue

---

## Testing Strategy

### Unit Tests to Add/Update

1. **New test:** `tests/unit/utils/preValidationUtils.validateMacroStructure.test.js`
   - Test macro validation for missing id, description, actions
   - Test nested operation validation in macros

2. **Update test:** `tests/unit/validation/ajvSchemaValidator.circularFragmentRefs.test.js`
   - Add test case using forEach with nested-operation schema pattern

### Integration Tests to Add/Update

1. **Update:** `tests/integration/validation/macroSchemaNestedMacroRefsProduction.test.js`
   - Verify weapons macros pass with production schemas after fix

2. **Update:** `tests/integration/validation/ajvSchemaValidator.productionSchemaValidation.test.js`
   - Verify handleMeleeCritical passes with browser-simulated loading

### E2E Verification

1. Run `npm run validate` to verify all macros pass
2. Load game in browser and verify macros execute correctly
3. Test all four failing macros in gameplay

---

## Files to Modify

### Summary Table

| File                                                                        | Purpose                | Change Type      |
| --------------------------------------------------------------------------- | ---------------------- | ---------------- |
| `data/schemas/operations/forEach.schema.json`                               | Fix circular ref       | Schema update    |
| `src/utils/preValidationUtils.js`                                           | Add macro validation   | Code addition    |
| `src/utils/schemaValidationUtils.js`                                        | Improve error messages | Code enhancement |
| `tests/unit/validation/ajvSchemaValidator.circularFragmentRefs.test.js`     | Test coverage          | Test addition    |
| `tests/integration/validation/macroSchemaNestedMacroRefsProduction.test.js` | Integration test       | Test update      |

---

## Risk Assessment

| Solution                     | Risk Level | Rollback Difficulty    | Dependencies  |
| ---------------------------- | ---------- | ---------------------- | ------------- |
| 1. forEach schema fix        | LOW        | Easy (revert schema)   | None          |
| 2. Macro pre-validation      | LOW        | Easy (revert function) | None          |
| 3. Error message improvement | LOW        | Easy (revert function) | None          |
| 4. Schema loader detection   | MEDIUM     | Moderate               | AJV internals |

---

## Verification Commands

```bash
# After implementation, run these commands to verify:

# 1. Schema validation
npm run validate

# 2. Unit tests
npm run test:unit -- --testPathPattern="preValidationUtils|ajvSchemaValidator"

# 3. Integration tests
npm run test:integration -- --testPathPattern="macroSchema|ajvSchemaValidator"

# 4. Full test suite
npm run test:ci

# 5. Type checking
npm run typecheck
```

---

## Critical Files for Implementation

List of files most critical for implementing this plan:

1. **`/home/joeloverbeck/projects/living-narrative-engine/data/schemas/operations/forEach.schema.json`** - Primary fix: change $ref to use nested-operation.schema.json
2. **`/home/joeloverbeck/projects/living-narrative-engine/src/utils/preValidationUtils.js`** - Add validateMacroStructure function and update performPreValidation
3. **`/home/joeloverbeck/projects/living-narrative-engine/data/schemas/nested-operation.schema.json`** - Reference: pattern to follow for breaking circular refs
4. **`/home/joeloverbeck/projects/living-narrative-engine/data/schemas/operations/if.schema.json`** - Reference: correct pattern already implemented
5. **`/home/joeloverbeck/projects/living-narrative-engine/src/utils/schemaValidationUtils.js`** - Error message enhancement for cascade detection
