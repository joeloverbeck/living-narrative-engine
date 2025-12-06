# SCHVALTESINT-002: Add Schema Validation to ModTestFixture.forRule()

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: CRITICAL
**Phase**: 1 - Fail-Fast in Test Infrastructure
**Dependencies**: SCHVALTESINT-001
**Blocks**: SCHVALTESINT-003, SCHVALTESINT-015
**Status**: ✅ COMPLETED (2025-11-26)

---

## Objective

Modify `ModTestFixture.forRule()` to validate rule files against their JSON schema before test setup, reusing the validation infrastructure established in SCHVALTESINT-001.

## File List

### Files to Modify

| File                                  | Change Type                                 |
| ------------------------------------- | ------------------------------------------- |
| `tests/common/mods/ModTestFixture.js` | Add schema validation in `forRule()` method |

### Files to Create

None (tests added in SCHVALTESINT-001's test file)

### Files to Read (for reference)

| File                            | Purpose                         |
| ------------------------------- | ------------------------------- |
| `data/schemas/rule.schema.json` | Rule schema to validate against |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/validation/ajvSchemaValidator.js` - Core validator must remain unchanged
- Any files in `data/schemas/` - Schemas are not part of this ticket
- `tests/common/integrationTestBed.js` - Separate ticket (SCHVALTESINT-004)
- `tests/common/engine/systemLogicTestEnv.js` - Separate ticket (SCHVALTESINT-003)
- The `forAction()` method - Already done in SCHVALTESINT-001
- Any existing test files (except to fix breakage)

**DO NOT:**

- Change the public API signature of `forRule()`
- Duplicate schema validator initialization logic (reuse from SCHVALTESINT-001)
- Add new dependencies

---

## Implementation Details

### Current Code (Problem)

**Note**: Initial ticket assumptions about the signature were incorrect. The actual signature is:

```javascript
// tests/common/mods/ModTestFixture.js - forRule() method (actual signature)

static async forRule(
    modId,
    ruleId,
    ruleFile = null,
    conditionFile = null,
    options = {}
  ) {
  // ... auto-load files if not provided ...
  // ... parse JSON if string paths provided ...

  // ⚠️ NO SCHEMA VALIDATION - unlike forAction() which calls #validateModFiles()

  const fixture = new ModRuleTestFixture(modId, ruleId, finalRuleFile, finalConditionFile, options);
  await fixture.initialize();
  return fixture;
}
```

The method signature takes `ruleFile` and `conditionFile` as optional parameters (can be objects or file paths),
with `options` as the 5th parameter. This matches `forAction()`.

### Required Changes

1. **Reuse `#validateModFiles()`** - Already exists and validates both rule and condition files
2. **Add `skipValidation` option** (default `false`) for consistency with `forAction()`
3. **Destructure options** to extract `skipValidation` similar to `forAction()`
4. **Call `#validateModFiles()`** after files are loaded/parsed, before fixture creation

### Suggested Implementation Pattern

```javascript
static async forRule(
    modId,
    ruleId,
    ruleFile = null,
    conditionFile = null,
    options = {}
  ) {
  try {
    const { skipValidation = false, ...otherOptions } = options;

    // ... existing auto-load logic ...
    // ... existing JSON parse logic ...

    // Validate files against schemas (SCHVALTESINT-002)
    if (!skipValidation && finalRuleFile && finalConditionFile) {
      await this.#validateModFiles(
        modId,
        ruleId,
        finalRuleFile,
        finalConditionFile
      );
    }

    const fixture = new ModRuleTestFixture(modId, ruleId, finalRuleFile, finalConditionFile, otherOptions);
    await fixture.initialize();
    return fixture;
  } catch (error) {
    throw new Error(`ModTestFixture.forRule failed for ${modId}:${ruleId}: ${error.message}`);
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All existing tests using `ModTestFixture.forRule()`** must continue to pass
2. **Add to existing test file**: `tests/unit/common/mods/ModTestFixture.validation.test.js`
   - `describe('ModTestFixture.forRule() Schema Validation')`
   - `should throw ValidationError when rule file violates schema`
   - `should include rule ID in error message`
   - `should skip validation when skipValidation: true`
   - `should succeed for valid rule files`
   - `should perform validation when skipValidation is not set (default false)`
   - `should perform validation when skipValidation is explicitly false`

**Note**: Error messages will match the format from `forAction()` since both use `#validateModFiles()`.
The error message includes "Action: modId:ruleId" (the method uses "Action" terminology even for rules
since `#validateModFiles` was designed for actions).

### Invariants That Must Remain True

1. **INV-1 (Test-Schema Coupling)**: After this change, `forRule()` validates against schemas before test execution
2. **Backward Compatibility**: Existing test files calling `forRule()` without options continue to work
3. **Consistency**: Same validation behavior as `forAction()` (same error format, same `skipValidation` flag)

### Manual Verification Steps

1. Run: `NODE_ENV=test npx jest tests/integration/mods/ --testPathPattern="rule" --no-coverage`
   - All existing rule-focused tests should pass
2. Temporarily corrupt any rule file
   - Run tests again - should fail immediately with validation error

---

## Estimated Effort

- **Size**: Small (S)
- **Complexity**: Low - follows pattern from SCHVALTESINT-001
- **Risk**: Low - isolated change with clear precedent

## Review Checklist

- [x] All existing tests using `forRule()` pass
- [x] New validation tests pass
- [x] Error messages match format from `forAction()`
- [x] `skipValidation` flag works correctly
- [x] JSDoc updated for `forRule()` documenting new behavior

---

## Outcome

**Completed**: 2025-11-26

### What Was Actually Changed vs Originally Planned

**Ticket Corrections Made Before Implementation:**

- Original ticket assumed incorrect method signature: `forRule(modId, ruleId, options = {})`
- Corrected to actual signature: `forRule(modId, ruleId, ruleFile = null, conditionFile = null, options = {})`
- Updated implementation pattern to match actual code structure

**Code Changes:**

1. **`tests/common/mods/ModTestFixture.js`** - `forRule()` method:
   - Added options destructuring: `const { skipValidation = false, ...otherOptions } = options;`
   - Added validation call before fixture creation using existing `#validateModFiles()` method
   - Changed fixture constructor to use `otherOptions` instead of `options`
   - Updated JSDoc to document the new `skipValidation` option

2. **`tests/unit/common/mods/ModTestFixture.validation.test.js`**:
   - Added new describe block: `ModTestFixture.forRule() Schema Validation`
   - Added 9 new test cases covering:
     - Valid rule and condition files
     - Invalid rule files (schema violation, error message format)
     - Invalid condition files
     - `skipValidation` option behavior (true, default false, explicit false)
     - Edge cases (minimal required fields)

**Test Results:**

- All 31 validation tests pass (22 existing `forAction()` + 9 new `forRule()`)
- All 388 integration tests for rules pass (49 test suites)

**Key Design Decisions:**

- Reused existing `#validateModFiles()` private method (no code duplication)
- Followed exact pattern from `forAction()` for consistency
- Maintained backward compatibility (existing tests work without changes)
