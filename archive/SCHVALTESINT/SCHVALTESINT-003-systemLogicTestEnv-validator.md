# SCHVALTESINT-003: Update systemLogicTestEnv with Schema Validator Injection

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: HIGH
**Phase**: 1 - Fail-Fast in Test Infrastructure
**Dependencies**: SCHVALTESINT-002
**Blocks**: SCHVALTESINT-015
**Status**: ✅ COMPLETED

---

## Objective

Update `systemLogicTestEnv.js` to inject a real schema validator dependency, enabling rule tests to validate operations against schemas at test time rather than only at runtime.

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `tests/common/engine/systemLogicTestEnv.js` | Add schema validator injection to `createBaseRuleEnvironment()` |

### Files to Create

| File | Purpose |
|------|---------|
| `tests/unit/common/engine/systemLogicTestEnv.validation.test.js` | Test new validation capability |

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `src/validation/ajvSchemaValidator.js` | Understand validator interface |
| `tests/common/mods/ModTestFixture.js` | Reference pattern from SCHVALTESINT-001 |

---

## Assumption Corrections (verified 2025-11-26)

The original ticket contained some incorrect assumptions about the code structure:

1. **CORRECTED**: The actual parameter is `rules` (array), not `ruleData` (single object)
   - `createBaseRuleEnvironment()` accepts `rules = []` parameter
   - Validation should iterate over all rules in the array

2. **CORRECTED**: Changes should go in `createBaseRuleEnvironment()` since `createRuleTestEnvironment()` delegates to it
   - `createRuleTestEnvironment()` calls `createBaseRuleEnvironment(options)` and extends the result
   - Adding validation to the base function ensures both functions benefit

3. **CORRECTED**: The suggested implementation needs to match actual code structure
   - The environment is created by `createBaseRuleEnvironment()` and extended in `createRuleTestEnvironment()`
   - The returned `env` object has many properties set from `initializeEnv()` call

---

## Out of Scope

**DO NOT MODIFY:**

- `src/validation/ajvSchemaValidator.js` - Core validator must remain unchanged
- `src/loaders/schemaLoader.js` - Schema loader must remain unchanged
- Any files in `data/schemas/` - Schemas are not part of this ticket
- `tests/common/mods/ModTestFixture.js` - Already done in SCHVALTESINT-001/002
- `tests/common/integrationTestBed.js` - Separate ticket (SCHVALTESINT-004)

**DO NOT:**

- Change the public API of `createRuleTestEnvironment()` beyond adding optional parameters
- Break existing tests that don't need validation
- Force validation on all tests (keep it opt-in initially)

---

## Implementation Details

### Current Code (Problem)

```javascript
// tests/common/engine/systemLogicTestEnv.js

export function createBaseRuleEnvironment({
  createHandlers,
  entities = [],
  rules = [],  // <-- Rules passed as array
  actions = [],
  // ... other params
}) {
  // ⚠️ NO SCHEMA VALIDATION on rules array
  // Rules executed without prior validation
}
```

### Required Changes

1. **Add optional schema validator parameter** to `createBaseRuleEnvironment()` (which is called by `createRuleTestEnvironment()`)
2. **Validate rules array** when validator is provided and `validateOnSetup` is true
3. **Expose validation methods** on returned environment object
4. **Document new validation capability**

### Corrected Implementation Pattern

```javascript
/**
 * Creates a base rule test environment with optional schema validation
 * @param {Object} config - Environment configuration
 * @param {import('ajv').default|null} [config.schemaValidator=null] - Optional AJV instance for rule validation
 * @param {boolean} [config.validateOnSetup=true] - Validate rules on setup when validator provided
 * @returns {Object} Test environment with validation capabilities
 */
export function createBaseRuleEnvironment({
  createHandlers,
  entities = [],
  rules = [],
  actions = [],
  // ... existing params ...
  schemaValidator = null,
  validateOnSetup = true,
}) {
  // ... existing setup code ...

  // Add validation on setup if enabled
  if (schemaValidator && validateOnSetup && rules.length > 0) {
    const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';
    const ruleValidate = schemaValidator.getSchema(ruleSchemaId);
    if (ruleValidate) {
      for (const rule of rules) {
        const valid = ruleValidate(rule);
        if (!valid) {
          const errors = ruleValidate.errors || [];
          const errorDetails = errors
            .map((e) => `    ${e.instancePath || '/'}: ${e.message}`)
            .join('\n');
          throw new Error(
            `Schema validation failed for rule\n` +
              `  Rule ID: ${rule.id || 'unknown'}\n` +
              `  Schema: ${ruleSchemaId}\n` +
              `  Validation errors:\n${errorDetails}`
          );
        }
      }
    }
  }

  return {
    // ... existing properties ...

    /**
     * Validates a single rule against the rule schema
     * @param {Object} ruleData - Rule to validate
     * @throws {Error} If validator not provided or validation fails
     */
    validateRule(ruleData) {
      if (!schemaValidator) {
        throw new Error('Schema validator not provided to test environment');
      }
      const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';
      const ruleValidate = schemaValidator.getSchema(ruleSchemaId);
      if (!ruleValidate) {
        throw new Error(`Rule schema not found: ${ruleSchemaId}`);
      }
      const valid = ruleValidate(ruleData);
      if (!valid) {
        const errors = ruleValidate.errors || [];
        const errorDetails = errors
          .map((e) => `    ${e.instancePath || '/'}: ${e.message}`)
          .join('\n');
        throw new Error(
          `Schema validation failed for rule\n` +
            `  Rule ID: ${ruleData.id || 'unknown'}\n` +
            `  Schema: ${ruleSchemaId}\n` +
            `  Validation errors:\n${errorDetails}`
        );
      }
    },

    /**
     * Checks if schema validation is available
     * @returns {boolean}
     */
    hasValidation() {
      return schemaValidator !== null;
    },
  };
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All existing tests using `createRuleTestEnvironment()`** must pass unchanged
2. **New unit test**: `tests/unit/common/engine/systemLogicTestEnv.validation.test.js`
   - `should validate rules when schemaValidator provided and validateOnSetup=true`
   - `should skip validation when schemaValidator not provided`
   - `should skip validation when validateOnSetup=false`
   - `should expose validateRule() method`
   - `should expose hasValidation() method`
   - `should throw clear error when validateRule() called without validator`

### Invariants That Must Remain True

1. **Backward Compatibility**: Tests not passing `schemaValidator` work exactly as before
2. **Opt-in Validation**: Validation is not forced on existing tests
3. **Consistent Error Format**: Validation errors follow project conventions (matching ModTestFixture pattern)

### Manual Verification Steps

1. Run: `NODE_ENV=test npx jest tests/common/engine/ --no-coverage`
   - All tests pass without validator
2. Run: `NODE_ENV=test npx jest tests/unit/common/engine/systemLogicTestEnv.validation.test.js --no-coverage`
   - All new validation tests pass

---

## Estimated Effort

- **Size**: Small (S)
- **Complexity**: Low - additive change with clear precedent
- **Risk**: Low - opt-in behavior preserves backward compatibility

## Review Checklist

- [x] All existing tests pass without modification
- [x] New validation tests pass
- [x] JSDoc documents new parameters and methods
- [x] Error messages are clear and actionable
- [x] No forced validation on existing tests

---

## Outcome (Implementation Complete - 2025-11-26)

### Changes Made

**Modified File**: `tests/common/engine/systemLogicTestEnv.js`
- Added `schemaValidator = null` and `validateOnSetup = true` parameters to `createBaseRuleEnvironment()`
- Added validation logic after macro expansion (before environment creation)
- Added `validateRule(ruleData)` method to returned environment object
- Added `hasValidation()` method to check if validation is available
- Updated JSDoc documentation for new parameters and return types
- Error messages support both `rule_id` (per schema) and `id` (for compatibility) fields

**Created File**: `tests/unit/common/engine/systemLogicTestEnv.validation.test.js`
- 15 comprehensive tests covering:
  - `hasValidation()` returning false/true based on validator presence
  - `validateRule()` throwing appropriate errors
  - `validateOnSetup` behavior (default true, can disable)
  - Backward compatibility with existing code
  - `createRuleTestEnvironment()` inheriting validation

### Test Results

```
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

### Key Implementation Notes

1. Schema loading in tests requires proper dependency order matching `ModTestFixture.js` pattern
2. Rule validation uses `rule.rule_id || rule.id` for compatibility with both schema-compliant and legacy rules
3. Validation is completely opt-in - no breaking changes to existing tests
