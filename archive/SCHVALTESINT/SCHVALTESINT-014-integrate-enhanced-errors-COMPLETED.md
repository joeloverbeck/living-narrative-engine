# SCHVALTESINT-014: Integrate Enhanced Errors into ajvAnyOfErrorFormatter

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: LOW
**Phase**: 5 - Enhanced Error Messages
**Dependencies**: SCHVALTESINT-012, SCHVALTESINT-013
**Blocks**: None
**Status**: COMPLETED

---

## Objective

Integrate `validationErrorContext.js` and `suggestionUtils.js` into `ajvAnyOfErrorFormatter.js` to provide rich error context and suggestions for validation failures, specifically:
1. Add "Did you mean?" suggestions for unknown operation types
2. Support optional file context for rich error formatting with line numbers and code snippets

## Reassessed Assumptions

### Original Assumptions vs Actual State

| Assumption | Actual State | Impact |
|------------|--------------|--------|
| Create new `formatAjvErrors` function | File already has `formatAjvErrorsEnhanced` as main entry point | Enhance existing function instead |
| Replace error grouping with `groupErrorsByPath` | Existing `groupErrorsByOperationType` serves different purpose | Keep existing, add new capability |
| Completely new implementation | Sophisticated pattern detection already exists (`detectCommonPatterns`) | Integrate suggestions into existing patterns |

### Corrected Scope

**Minimal changes needed:**
1. Add imports for `suggestOperationType` and `createValidationErrorContext`
2. Add optional `context` parameter to `formatAjvErrorsEnhanced`
3. Integrate `suggestOperationType` into `formatOperationTypeSummary` for unknown types
4. Use `createValidationErrorContext` when file context is provided
5. Maintain 100% backward compatibility (context parameter is optional)

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `src/utils/ajvAnyOfErrorFormatter.js` | Add imports, enhance with suggestions and context support |

### Files to Create

None

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `src/validation/validationErrorContext.js` | Created in SCHVALTESINT-012 |
| `src/utils/suggestionUtils.js` | Created in SCHVALTESINT-013 |
| `src/utils/preValidationUtils.js` | KNOWN_OPERATION_TYPES for suggestions |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/validation/validationErrorContext.js` - Already done in SCHVALTESINT-012
- `src/utils/suggestionUtils.js` - Already done in SCHVALTESINT-013
- `src/validation/ajvSchemaValidator.js` - Core validator unchanged
- Any schema files

**DO NOT:**

- Replace existing `detectCommonPatterns` function
- Replace existing `groupErrorsByOperationType` function
- Change the core error formatting logic fundamentally
- Break backward compatibility with existing error consumers
- Add file I/O to the formatter (content passed as parameter)

---

## Implementation Details

### Actual Implementation Approach

Rather than replacing the formatter, enhance it by:

1. **Add imports** at top of file:
   ```javascript
   import { createValidationErrorContext } from '../validation/validationErrorContext.js';
   import { suggestOperationType } from './suggestionUtils.js';
   import { KNOWN_OPERATION_TYPES } from './preValidationUtils.js';
   ```

2. **Extend function signature** with optional context:
   ```javascript
   export function formatAjvErrorsEnhanced(errors, data, context = null)
   ```

3. **Add suggestion in `formatOperationTypeSummary`**:
   - When showing "Unknown or invalid operation type", add "Did you mean?" suggestion

4. **Add context-aware output** when context provided:
   - Use `createValidationErrorContext` for rich formatting with file path, line number, code snippet

### Current Error Format

```
Unknown or invalid operation type: 'LOCK_GRABB'
Valid operation types include:
  - LOCK_GRABBING
  - UNLOCK_GRABBING
  ...
```

### Enhanced Error Format

**Without context (backward compatible):**
```
Unknown or invalid operation type: 'LOCK_GRABB'
Did you mean "LOCK_GRABBING"?
Valid operation types include:
  - LOCK_GRABBING
  - UNLOCK_GRABBING
  ...
```

**With context:**
```
Validation Error in rule "handle_wield_threateningly"
  File: data/mods/weapons/rules/handle_wield_threateningly.rule.json
  Line: 23

  Context:
    21 |       {
    22 |         "type": "LOCK_GRABB",
  > 23 |         "parameters": { "count": "invalid" }
    24 |       }

  Error: Unknown or invalid operation type: 'LOCK_GRABB'
  Did you mean "LOCK_GRABBING"?
  Path: /actions/2/type
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All existing tests**: `tests/unit/utils/ajvAnyOfErrorFormatter.test.js` - Must pass unchanged
2. **All existing tests**: `tests/unit/utils/ajvAnyOfErrorFormatter.patternDetection.test.js` - Must pass unchanged

### New Tests to Add

| Test | Purpose |
|------|---------|
| `should suggest similar operation type for typos` | Verify "Did you mean?" appears |
| `should not suggest when no similar types` | Verify no false suggestions |
| `should include file context when provided` | Verify rich context output |
| `should format without context when not provided` | Backward compatibility |

### Invariants That Must Remain True

1. **Backward Compatibility**: Calling without context produces identical output to before
2. **Suggestion Quality**: Only suggests when Levenshtein distance ≤ 5
3. **No File I/O**: All content passed as parameters

---

## Estimated Effort

- **Size**: Small (S) - Corrected from Medium
- **Complexity**: Low - Integration into existing structure
- **Risk**: Very Low - Additive changes only, backward compatible

## Review Checklist

- [x] All existing formatter tests pass
- [x] New suggestion integration tests pass
- [x] Suggestions appear for typos
- [x] Backward compatibility maintained (no context = identical output)
- [x] Error messages are clear and actionable
- [x] JSDoc documentation updated

---

## Outcome

### What Was Originally Planned

The ticket originally proposed:
1. Creating a new `formatAjvErrors` function
2. Replacing `groupErrorsByPath` error grouping
3. Substantial rewrite of the formatter

### What Was Actually Changed

After reassessing assumptions against the actual codebase, a **minimal integration** approach was taken:

1. **Added 3 imports** to `src/utils/ajvAnyOfErrorFormatter.js`:
   - `createValidationErrorContext` from validationErrorContext.js
   - `suggestOperationType` from suggestionUtils.js
   - `KNOWN_OPERATION_TYPES` from preValidationUtils.js

2. **Extended `formatAjvErrorsEnhanced`** with optional `context` parameter (backward compatible)

3. **Enhanced `formatOperationTypeSummary`** to include "Did you mean?" suggestions for typos

4. **Added `wrapWithContext` helper** for rich error formatting when file context is provided

5. **Added 8 new tests** in `ajvAnyOfErrorFormatter.patternDetection.test.js`:
   - 3 tests for "Did you mean?" suggestions
   - 5 tests for rich context support

### Key Differences from Plan

| Original Plan | Actual Implementation |
|---------------|----------------------|
| New function `formatAjvErrors` | Enhanced existing `formatAjvErrorsEnhanced` |
| Replace error grouping | Kept existing, added new capability |
| Medium complexity | Small complexity (additive only) |
| Potential breaking changes | 100% backward compatible |

### Test Results

- All 49 existing formatter tests: ✅ PASSED
- All 63 dependency tests (validationErrorContext + suggestionUtils): ✅ PASSED
- All 8 new SCHVALTESINT-014 tests: ✅ PASSED
- Total: 35 tests in patternDetection test file, all passing
