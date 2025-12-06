# SCHVALTESINT-009: Create Schema Pattern Linting Script

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: LOW
**Phase**: 3 - Template String Standardization
**Dependencies**: SCHVALTESINT-007, SCHVALTESINT-008
**Blocks**: None
**Status**: ✅ COMPLETED

---

## Objective

Create a linting script that detects operation schemas using local `oneOf` patterns for template strings instead of `$ref` to `common.schema.json`, ensuring future operations follow the standardized pattern.

## File List

### Files Created

| File                                            | Purpose                                  |
| ----------------------------------------------- | ---------------------------------------- |
| `scripts/lintSchemaPatterns.js`                 | Schema pattern linting script            |
| `tests/unit/scripts/lintSchemaPatterns.test.js` | Unit tests for linting script (18 tests) |

### Files Modified

| File           | Change Type                             |
| -------------- | --------------------------------------- |
| `package.json` | Added `lint:schema-patterns` npm script |

### Files Read (for reference)

| File                                    | Purpose                       |
| --------------------------------------- | ----------------------------- |
| `data/schemas/operations/*.schema.json` | All operation schemas to lint |
| `data/schemas/common.schema.json`       | Expected $ref target          |

---

## Out of Scope

**DO NOT MODIFY:**

- Any schema files in `data/schemas/` (this ticket detects problems, doesn't fix them)
- Any source code files in `src/`
- CI workflow (optional integration can be added later)

**DO NOT:**

- Auto-fix detected issues (report only)
- Modify existing schemas
- Add complex pattern matching beyond local oneOf detection

---

## Implementation Details

### Detection Logic

The script detects schemas that:

1. Have a local `oneOf` containing a `templateString`-like pattern
2. Could be replaced with `$ref` to `common.schema.json#/definitions/*`

### Pattern to Detect

```json
// LOCAL PATTERN (should be flagged)
{
  "count": {
    "oneOf": [
      { "type": "integer" },
      {
        "type": "string",
        "pattern": "^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$"
      }
    ]
  }
}

// CORRECT PATTERN (should NOT be flagged)
{
  "count": { "$ref": "../common.schema.json#/definitions/integerOrTemplate" }
}
```

### NPM Script Added

```json
{
  "scripts": {
    "lint:schema-patterns": "node scripts/lintSchemaPatterns.js"
  }
}
```

---

## Acceptance Criteria

### Tests That Pass ✅

1. **New unit test**: `tests/unit/scripts/lintSchemaPatterns.test.js`
   - ✅ `should match template string regex patterns`
   - ✅ `should not match non-template regex patterns`
   - ✅ `should return only .schema.json files`
   - ✅ `should return empty array on directory read error`
   - ✅ `should detect local oneOf with template pattern`
   - ✅ `should NOT flag $ref patterns`
   - ✅ `should NOT flag oneOf without template string pattern`
   - ✅ `should detect multiple violations in nested structure`
   - ✅ `should return empty array for null/undefined input`
   - ✅ `should return null for valid schema without violations`
   - ✅ `should return violation object for schema with local oneOf`
   - ✅ `should return error for invalid JSON`
   - ✅ `should return error for file read failure`
   - ✅ `should return empty array when no violations`
   - ✅ `should return violations array when issues found`
   - ✅ `should exit 0 when no violations found`
   - ✅ `should exit 1 when violations found`
   - ✅ `should exit 0 when no schema files found`

### Script Behavior ✅

1. **After SCHVALTESINT-007/008**:

   ```bash
   npm run lint:schema-patterns
   # Output: ✅ All operation schemas use $ref patterns correctly
   # Exit code: 0
   ```

2. **If local patterns reintroduced** (verified via unit tests):
   ```bash
   npm run lint:schema-patterns
   # Output: ❌ Found schemas with local oneOf patterns:
   #   newOperation.schema.json:
   #     - allOf.1.properties.parameters.properties.count
   #     Suggestion: Replace with $ref to common.schema.json#/definitions/*
   # Exit code: 1
   ```

### Invariants That Remain True ✅

1. **INV-2 (Template Pattern Consistency)**: Script enforces use of shared definitions
2. **No False Positives**: Valid $ref patterns not flagged
3. **Actionable Output**: Suggestions point to correct common.schema.json definition

---

## Review Checklist

- [x] Script runs without errors on current schemas
- [x] Correctly detects local oneOf template patterns
- [x] Does not flag $ref patterns
- [x] Output format is clear and actionable
- [x] Exit codes are correct (0=success, 1=violations)
- [x] NPM script added to package.json
- [x] Unit tests cover main scenarios (18 tests)
- [x] JSDoc documentation present

---

## Outcome

### What Was Changed vs Originally Planned

**Aligned with Plan:**

- Created `scripts/lintSchemaPatterns.js` with full detection logic
- Added 18 comprehensive unit tests covering all edge cases
- Added `lint:schema-patterns` npm script to package.json
- Script correctly reports clean state after SCHVALTESINT-007/008 migrations

**Minor Implementation Differences:**

- Used CommonJS (`require`) instead of ESM (`import`) to match project conventions for scripts
- Added dependency injection for `fs` and `path` modules to enable unit testing
- Used separate JSDoc comment blocks to avoid linting warning about `@jest-environment` directive
- Added additional exports (`getSchemaFiles`, `lintSchemaFile`) for granular unit testing

**Test Coverage:**

- 18 tests covering regex matching, file discovery, pattern detection, CLI behavior
- Tests verify both positive detection (violations) and negative detection (clean schemas)
- Error handling for invalid JSON and missing files verified

**Verified Working:**

```bash
$ npm run lint:schema-patterns
✅ All operation schemas use $ref patterns correctly
```
