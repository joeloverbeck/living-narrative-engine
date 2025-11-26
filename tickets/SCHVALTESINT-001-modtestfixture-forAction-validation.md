# SCHVALTESINT-001: Add Schema Validation to ModTestFixture.forAction()

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: CRITICAL
**Phase**: 1 - Fail-Fast in Test Infrastructure
**Dependencies**: None
**Blocks**: SCHVALTESINT-002, SCHVALTESINT-004, SCHVALTESINT-015

---

## Objective

Modify `ModTestFixture.forAction()` to validate rule and condition files against their JSON schemas before test setup, ensuring invalid mod data fails immediately with clear error messages.

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `tests/common/mods/ModTestFixture.js` | Add schema validation in `forAction()` method |

### Files to Create

None

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `src/validation/ajvSchemaValidator.js` | Understand validation API |
| `src/loaders/schemaLoader.js` | Understand schema loading patterns |
| `data/schemas/rule.schema.json` | Rule schema to validate against |
| `data/schemas/condition.schema.json` | Condition schema to validate against |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/validation/ajvSchemaValidator.js` - Core validator must remain unchanged
- `src/loaders/schemaLoader.js` - Schema loader must remain unchanged
- Any files in `data/schemas/` - Schemas are not part of this ticket
- `tests/common/integrationTestBed.js` - Separate ticket (SCHVALTESINT-004)
- `tests/common/engine/systemLogicTestEnv.js` - Separate ticket (SCHVALTESINT-003)
- Any existing test files in `tests/unit/` or `tests/integration/` (except to fix breakage)
- The `forRule()` method - Separate ticket (SCHVALTESINT-002)

**DO NOT:**

- Change the public API signature of `forAction()`
- Break backward compatibility with existing tests
- Add new dependencies to package.json
- Modify schema files

---

## Implementation Details

### Current Code (Problem)

```javascript
// tests/common/mods/ModTestFixture.js - forAction() method
// Line ~180-200 (approximate)

static async forAction(modId, actionId, options = {}) {
  const rulePath = this._resolveRulePath(modId, actionId);
  const ruleData = JSON.parse(await fs.readFile(rulePath, 'utf8'));
  // ⚠️ NO SCHEMA VALIDATION - ruleData passed directly to test setup

  const conditionPath = this._resolveConditionPath(modId, actionId);
  const conditionData = JSON.parse(await fs.readFile(conditionPath, 'utf8'));
  // ⚠️ NO SCHEMA VALIDATION

  return new ModTestFixture({ ruleData, conditionData, ... });
}
```

### Required Changes

1. **Add schema validator initialization** at class level or in static initializer
2. **Validate rule file** against `schema://living-narrative-engine/rule.schema.json`
3. **Validate condition file** against `schema://living-narrative-engine/condition.schema.json`
4. **Add `skipValidation` option** (default `false`) for debugging edge cases
5. **Include file path and action ID** in validation error messages

### Suggested Implementation Pattern

```javascript
// Add to ModTestFixture class

static #schemaValidator = null;

static async #ensureSchemaValidator() {
  if (!this.#schemaValidator) {
    // Load schemas and create validator
    // Use minimal schema loading - just rule.schema.json and condition.schema.json
    // Consider caching for performance across multiple tests
  }
  return this.#schemaValidator;
}

static async forAction(modId, actionId, options = {}) {
  const { skipValidation = false, ...restOptions } = options;

  const rulePath = this._resolveRulePath(modId, actionId);
  const ruleData = JSON.parse(await fs.readFile(rulePath, 'utf8'));

  if (!skipValidation) {
    const validator = await this.#ensureSchemaValidator();
    try {
      validator.validate('schema://living-narrative-engine/rule.schema.json', ruleData);
    } catch (validationError) {
      throw new Error(
        `Schema validation failed for rule file\n` +
        `  File: ${rulePath}\n` +
        `  Action: ${actionId}\n` +
        `  Error: ${validationError.message}`
      );
    }
  }

  // Similar for condition file...

  return new ModTestFixture({ ruleData, conditionData, ... });
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All existing tests using `ModTestFixture.forAction()`** must continue to pass (assuming their rule files are valid)
2. **New unit test**: `tests/unit/common/mods/ModTestFixture.validation.test.js`
   - `should throw ValidationError when rule file violates schema`
   - `should throw ValidationError when condition file violates schema`
   - `should include file path in error message`
   - `should include action ID in error message`
   - `should skip validation when skipValidation: true`
   - `should succeed for valid rule and condition files`

### Specific Test File to Create

```javascript
// tests/unit/common/mods/ModTestFixture.validation.test.js

describe('ModTestFixture.forAction() Schema Validation', () => {
  it('should throw ValidationError when rule file violates schema', async () => {
    // Create temp invalid rule file
    // Call forAction()
    // Expect throw with specific error message pattern
  });

  it('should skip validation when skipValidation: true', async () => {
    // Create temp invalid rule file
    // Call forAction({ skipValidation: true })
    // Expect no throw
  });

  it('should include file path in validation error', async () => {
    // ...
  });
});
```

### Invariants That Must Remain True

1. **INV-1 (Test-Schema Coupling)**: After this change, `forAction()` validates against schemas before test execution
2. **Backward Compatibility**: Existing test files calling `forAction()` without options continue to work
3. **Performance**: Schema loading is cached; validation adds < 100ms per test file
4. **Error Clarity**: Validation errors include:
   - Full file path to the invalid file
   - Action ID being tested
   - Specific validation error from AJV

### Manual Verification Steps

1. Run: `NODE_ENV=test npx jest tests/integration/mods/weapons/ --no-coverage`
   - All existing weapon mod tests should pass
2. Temporarily corrupt `data/mods/weapons/rules/handle_wield_threateningly.rule.json`
   - Run tests again - should fail immediately with validation error
3. Run with `skipValidation: true` in test - should proceed (to test the flag works)

---

## Implementation Notes

### Schema Loading Considerations

- Consider using `SchemaLoader.loadAndCompileAllSchemas()` but with filtered schema list
- Alternatively, create lightweight validation-only schema loader
- Cache compiled validators for performance across multiple `forAction()` calls

### Error Message Format

Follow project convention for error formatting:

```
Schema validation failed for rule file
  File: data/mods/weapons/rules/handle_wield_threateningly.rule.json
  Action: weapons:wield_threateningly

  Validation errors:
    /actions/0/type: must be equal to one of the allowed values
    Path: /actions/0/type
    Found: "INVALID_TYPE"
    Expected: One of KNOWN_OPERATION_TYPES
```

### Edge Cases to Handle

- Missing rule file → Clear "file not found" error (before validation)
- Malformed JSON → Clear "parse error" error (before validation)
- Missing condition file → Clear "file not found" error
- Schema not found → Graceful degradation with warning, or fail fast

---

## Estimated Effort

- **Size**: Medium (M)
- **Complexity**: Medium - requires understanding AJV integration and test infrastructure
- **Risk**: Low-Medium - changes test infrastructure used by many tests

## Review Checklist

- [ ] All existing mod tests pass
- [ ] New validation tests pass
- [ ] Error messages are clear and actionable
- [ ] `skipValidation` flag works correctly
- [ ] No new dependencies added
- [ ] Performance impact is acceptable (< 100ms per test file)
- [ ] JSDoc updated for `forAction()` documenting new behavior
