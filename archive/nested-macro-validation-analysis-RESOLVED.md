# Nested Macro Schema Validation Analysis Report

**Date**: 2025-01-04
**Status**: RESOLVED
**Severity**: Critical (blocked mod loading)

## Executive Summary

Four macro files in the weapons mod were failing validation with 930+ cascading errors due to a **circular schema reference** in `forEach.schema.json`. The error message was misleading ("Unknown operation type: 'FOR_EACH'") because `FOR_EACH` was actually whitelisted.

**Root Cause**: Circular reference chain in JSON schemas
**Impact**: All macros with nested operations (FOR_EACH, etc.) failed to load
**Resolution**: Three-tier fix implementing schema correction, fail-fast validation, and cascade detection

## Affected Files

### Macro Files (Symptoms)
- `data/mods/weapons/macros/handleMeleeCritical.macro.json`
- `data/mods/weapons/macros/handleMeleeHit.macro.json`
- `data/mods/weapons/macros/handleMeleeFumble.macro.json`
- `data/mods/weapons/macros/handleMeleeMiss.macro.json`

### Schema Files (Root Cause)
- `data/schemas/operations/forEach.schema.json` (PRIMARY - contained circular ref)
- `data/schemas/operation.schema.json` (referenced by macro.schema.json)
- `data/schemas/nested-operation.schema.json` (solution pattern - already existed)

### Validation Code (Enhanced)
- `src/utils/preValidationUtils.js` (added macro pre-validation)
- `src/utils/schemaValidationUtils.js` (added cascade detection)

## Root Cause Analysis

### The Circular Reference Chain

```
macro.schema.json
  └─ "actions" array → $ref: operation.schema.json#/$defs/Action
      └─ Operation → anyOf → forEach.schema.json
          └─ parameters.actions → $ref: operation.schema.json#/$defs/Action  ← CIRCULAR!
              └─ AJV attempts infinite resolution → 930+ anyOf errors
```

### Why the Error Was Misleading

1. **`FOR_EACH` IS in `KNOWN_OPERATION_TYPES`** (line 58 of `preValidationUtils.js`)
2. **Pre-validation skipped macros** - only validated rules (lines 591-599)
3. **AJV choked on circular reference** → generated 930+ validation errors
4. **Error formatter picked "Unknown operation type"** from the cascade
5. **Suggestion was correct** ("Did you mean 'FOR_EACH'?") but unhelpful

### Evidence Trail

**forEach.schema.json (BEFORE - Line 35)**:
```json
"$ref": "../operation.schema.json#/$defs/Action"  // WRONG - creates circular ref
```

**if.schema.json (CORRECT PATTERN - Lines 32, 39)**:
```json
"$ref": "../nested-operation.schema.json#/$defs/NestedAction"  // CORRECT
```

The `if.schema.json` already used the correct pattern via `nested-operation.schema.json`, which breaks the circular reference with a simplified validation approach.

## Solution Implementation

### Tier 1: Schema Fix (CRITICAL)

**File**: `data/schemas/operations/forEach.schema.json`
**Change**: Line 35

```diff
- "$ref": "../operation.schema.json#/$defs/Action"
+ "$ref": "../nested-operation.schema.json#/$defs/NestedAction"
```

This follows the established pattern in `if.schema.json` and breaks the circular reference.

### Tier 2: Macro Pre-Validation (FAIL-FAST)

**File**: `src/utils/preValidationUtils.js`
**Changes**:

1. Added `validateMacroStructure()` function (after `validateRuleStructure()`)
2. Updated `performPreValidation()` to handle macro schema

```javascript
export function validateMacroStructure(macroData, _filePath = 'unknown') {
  if (!macroData || typeof macroData !== 'object') {
    return {
      isValid: false,
      error: 'Macro data must be an object',
      path: 'root',
      suggestions: ['Ensure the macro file contains a valid JSON object'],
    };
  }

  // Validates: id, description, actions (required fields)
  // Then recursively validates all operations
  return validateAllOperations(macroData, 'root');
}

export function performPreValidation(data, schemaId, filePath = 'unknown') {
  if (schemaId === 'schema://living-narrative-engine/rule.schema.json') {
    return validateRuleStructure(data, filePath);
  }

  // NEW: Pre-validate macros before AJV tries circular refs
  if (schemaId === 'schema://living-narrative-engine/macro.schema.json') {
    return validateMacroStructure(data, filePath);
  }

  return { isValid: true, error: null, path: null, suggestions: null };
}
```

**Benefits**:
- Catches structural issues BEFORE AJV validation
- Provides clear, actionable error messages
- Prevents 930+ error cascades from even starting
- Validates nested operations recursively

### Tier 3: Cascade Detection (DEBUGGING)

**File**: `src/utils/schemaValidationUtils.js`
**Change**: Added after `if (!validationResult.isValid)` check

```javascript
// Detect possible circular schema reference cascade
const errors = validationResult.errors ?? [];
if (errors.length > 100) {
  const anyOfErrors = errors.filter((e) => e.keyword === 'anyOf');
  if (anyOfErrors.length > 50) {
    logger.warn(
      `Possible circular schema reference detected - ${errors.length} errors ` +
      `with ${anyOfErrors.length} anyOf failures. ` +
      `Check nested actions/operations for circular $refs in schema '${schemaId}'.`,
      { schemaId, filePath, totalErrors: errors.length, anyOfErrors: anyOfErrors.length }
    );
  }
}
```

**Benefits**:
- Warns developers when they might have a circular reference
- Provides specific guidance on where to look
- Helps prevent future issues from being as confusing
- Threshold of 100+ errors with 50+ anyOf is a strong signal

## Test Results

All tests pass after implementation:

```
✓ tests/unit/utils/preValidationUtils.test.js (68 tests)
✓ tests/unit/utils/schemaValidationUtils.test.js (5 tests)
✓ tests/unit/utils/macroUtils.test.js (24 tests)
✓ tests/unit/utils/preValidationUtils.macroReference.test.js (10 tests)
✓ tests/unit/validation/macroSchemaNestedMacroRefs.test.js (15 tests)
✓ tests/integration/validation/macroSchemaNestedMacroRefsProduction.test.js (8 tests)
```

### Key Test Coverage

The `macroSchemaNestedMacroRefs.test.js` tests specifically verify:
- Macros with only operations (existing behavior) ✓
- Macros with nested macro references (THE FIX) ✓
- Mixed operations and macro references ✓
- Invalid macro content still rejected ✓
- Error count limited (no cascades) ✓

The `macroSchemaNestedMacroRefsProduction.test.js` tests verify:
- Core macros without nested refs work ✓
- **weapons:handleMeleeCritical** validates ✓
- **weapons:handleMeleeFumble** validates ✓
- **weapons:handleMeleeHit** validates ✓
- **weapons:handleMeleeMiss** validates ✓

## Future Recommendations

### 1. Schema Pattern Documentation
Document the `nested-operation.schema.json` pattern in `docs/modding/` to prevent future developers from making the same mistake.

### 2. Schema Reference Linting
Consider adding a schema linting step that detects potential circular references before runtime.

### 3. Pre-Validation Extension
The `validateAllOperations()` function could be extended to validate more operation types, catching issues even earlier.

### 4. Error Message Improvement
The AJV error formatter could be enhanced to detect the "cascade signature" (100+ errors, many anyOf) and suggest checking for circular references in the error message itself.

## Files Modified

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `data/schemas/operations/forEach.schema.json` | 1 | Fixed circular $ref |
| `src/utils/preValidationUtils.js` | ~70 | Added validateMacroStructure() |
| `src/utils/schemaValidationUtils.js` | ~15 | Added cascade detection |

## Validation Commands

```bash
# Quick validation
npm run start  # Should load weapons mod without errors

# Full test suite
npm run test:unit -- tests/unit/utils/preValidationUtils.test.js
npm run test:unit -- tests/unit/validation/macroSchemaNestedMacroRefs.test.js
npm run test:integration -- tests/integration/validation/macroSchemaNestedMacroRefsProduction.test.js

# Lint check
npx eslint src/utils/preValidationUtils.js src/utils/schemaValidationUtils.js
```

## Conclusion

The nested macro validation failure was caused by a simple but impactful circular schema reference in `forEach.schema.json`. The fix followed an established pattern already used in `if.schema.json`. Additional robustness improvements ensure similar issues will be caught early with clear error messages in the future.

The three-tier approach provides:
1. **Immediate fix** - Macros now validate correctly
2. **Fail-fast validation** - Clear errors before AJV cascade
3. **Better debugging** - Cascade detection warns about potential circular refs
