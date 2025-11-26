# SCHVALTESINT-002: Add Schema Validation to ModTestFixture.forRule()

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: CRITICAL
**Phase**: 1 - Fail-Fast in Test Infrastructure
**Dependencies**: SCHVALTESINT-001
**Blocks**: SCHVALTESINT-003, SCHVALTESINT-015

---

## Objective

Modify `ModTestFixture.forRule()` to validate rule files against their JSON schema before test setup, reusing the validation infrastructure established in SCHVALTESINT-001.

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `tests/common/mods/ModTestFixture.js` | Add schema validation in `forRule()` method |

### Files to Create

None (tests added in SCHVALTESINT-001's test file)

### Files to Read (for reference)

| File | Purpose |
|------|---------|
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

```javascript
// tests/common/mods/ModTestFixture.js - forRule() method

static async forRule(modId, ruleId, options = {}) {
  const rulePath = this._resolveRulePath(modId, ruleId);
  const ruleData = JSON.parse(await fs.readFile(rulePath, 'utf8'));
  // ⚠️ NO SCHEMA VALIDATION

  return new ModTestFixture({ ruleData, ... });
}
```

### Required Changes

1. **Reuse schema validator** from `#ensureSchemaValidator()` (created in SCHVALTESINT-001)
2. **Validate rule file** against `schema://living-narrative-engine/rule.schema.json`
3. **Add `skipValidation` option** (default `false`) for consistency with `forAction()`
4. **Include file path and rule ID** in validation error messages

### Suggested Implementation Pattern

```javascript
static async forRule(modId, ruleId, options = {}) {
  const { skipValidation = false, ...restOptions } = options;

  const rulePath = this._resolveRulePath(modId, ruleId);
  const ruleData = JSON.parse(await fs.readFile(rulePath, 'utf8'));

  if (!skipValidation) {
    const validator = await this.#ensureSchemaValidator();
    try {
      validator.validate('schema://living-narrative-engine/rule.schema.json', ruleData);
    } catch (validationError) {
      throw new Error(
        `Schema validation failed for rule file\n` +
        `  File: ${rulePath}\n` +
        `  Rule: ${ruleId}\n` +
        `  Error: ${validationError.message}`
      );
    }
  }

  return new ModTestFixture({ ruleData, ... });
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All existing tests using `ModTestFixture.forRule()`** must continue to pass
2. **Add to existing test file**: `tests/unit/common/mods/ModTestFixture.validation.test.js`
   - `describe('ModTestFixture.forRule() Schema Validation')`
   - `should throw ValidationError when rule file violates schema`
   - `should include file path in error message`
   - `should include rule ID in error message`
   - `should skip validation when skipValidation: true`
   - `should succeed for valid rule files`

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

- [ ] All existing tests using `forRule()` pass
- [ ] New validation tests pass
- [ ] Error messages match format from `forAction()`
- [ ] `skipValidation` flag works correctly
- [ ] JSDoc updated for `forRule()` documenting new behavior
