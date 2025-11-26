# SCHVALTESINT-012: Create validationErrorContext.js

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: LOW
**Phase**: 5 - Enhanced Error Messages
**Dependencies**: None (can proceed in parallel)
**Blocks**: SCHVALTESINT-014
**Status**: ✅ COMPLETED

---

## Objective

Create `validationErrorContext.js` that provides rich error context for validation failures, including file path, line number extraction from JSON path, and code snippet generation.

## File List

### Files Created

| File | Purpose |
|------|---------|
| `src/validation/validationErrorContext.js` | Rich error context generation |
| `tests/unit/validation/validationErrorContext.test.js` | Unit tests (27 tests) |

### Files Read (for reference)

| File | Purpose |
|------|---------|
| `src/utils/ajvAnyOfErrorFormatter.js` | Current error formatting approach |
| AJV error object structure | Understand error.instancePath format |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/utils/ajvAnyOfErrorFormatter.js` - Separate ticket (SCHVALTESINT-014)
- `src/validation/ajvSchemaValidator.js` - Core validator unchanged
- Any schema files in `data/schemas/`

**DO NOT:**

- Integrate with existing error formatters (that's SCHVALTESINT-014)
- Read files synchronously (use passed file content)
- Make this dependent on file system access at runtime

---

## Implementation Details

### Desired Error Format

From spec section 4.1:

```
Validation Error in rule "handle_wield_threateningly"
  File: data/mods/weapons/rules/handle_wield_threateningly.rule.json
  Line: 23

  Context:
    21 |       {
    22 |         "type": "LOCK_GRABBING",
  > 23 |         "parameters": { "count": "invalid" }
    24 |       }

  Error: "count" must be integer or template string (e.g., "{context.value}")
  Path: /actions/2/parameters/count
```

---

## Acceptance Criteria

### Tests That Must Pass ✅

1. **New unit test**: `tests/unit/validation/validationErrorContext.test.js` - **27 tests passing**

### Error Format Requirements ✅

1. **Includes file path**: Full path to invalid file ✅
2. **Includes line number**: Approximate line of error ✅
3. **Includes code snippet**: 2-3 lines context around error ✅
4. **Includes error message**: Human-readable description ✅
5. **Includes JSON path**: AJV instancePath for precise location ✅

### Invariants That Must Remain True ✅

1. **No File I/O**: Module accepts file content as parameter, doesn't read files ✅
2. **Graceful Degradation**: Returns reasonable output even if line detection fails ✅
3. **Pure Functions**: All functions are side-effect free ✅

---

## Estimated Effort

- **Size**: Medium (M)
- **Complexity**: Medium - line number extraction from JSON path is heuristic
- **Risk**: Low - new module, no existing code changes

## Review Checklist

- [x] Line number extraction works for common paths
- [x] Code snippet generation handles edge cases (first/last line)
- [x] Error format matches specification
- [x] No file I/O in module (content passed as parameter)
- [x] Unit tests cover main scenarios
- [x] JSDoc documentation complete
- [x] toString() output is clear and actionable

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned:**
- Create `src/validation/validationErrorContext.js` with rich error context generation
- Create `tests/unit/validation/validationErrorContext.test.js` with unit tests

**Actual:**
- Created `src/validation/validationErrorContext.js` - implementation follows the suggested design with minor improvements:
  - Enhanced array index detection algorithm that properly tracks bracket depth
  - Better handling of edge cases (null/undefined paths, malformed JSON paths)
- Created `tests/unit/validation/validationErrorContext.test.js` with **27 comprehensive tests** covering:
  - `extractLineNumber`: 8 tests (simple paths, nested paths, array indices, edge cases)
  - `generateCodeSnippet`: 6 tests (context lines, first/last line, padding, single line)
  - `createValidationErrorContext`: 5 tests (complete context, toString with/without ruleId)
  - `formatValidationErrors`: 5 tests (single/multiple errors, missing fields)
  - Edge cases: 3 tests (deep nesting, special characters, malformed paths)

**No deviations from scope** - ticket assumptions were accurate, no modifications needed to the ticket or existing code.

### Test Results
```
Tests:       27 passed, 27 total
Time:        0.512 s
```
