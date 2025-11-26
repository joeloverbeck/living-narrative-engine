# SCHVALTESINT-003: Update systemLogicTestEnv with Schema Validator Injection

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: HIGH
**Phase**: 1 - Fail-Fast in Test Infrastructure
**Dependencies**: SCHVALTESINT-002
**Blocks**: SCHVALTESINT-015

---

## Objective

Update `systemLogicTestEnv.js` to inject a real schema validator dependency, enabling rule tests to validate operations against schemas at test time rather than only at runtime.

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `tests/common/engine/systemLogicTestEnv.js` | Add schema validator injection |

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

export function createRuleTestEnvironment(config) {
  // Sets up rule execution environment
  // ⚠️ NO SCHEMA VALIDATOR INJECTED
  // Rules executed without prior validation
}
```

### Required Changes

1. **Add optional schema validator parameter** to `createRuleTestEnvironment()`
2. **Validate rule data** when validator is provided
3. **Expose validation method** on returned environment object
4. **Document new validation capability**

### Suggested Implementation Pattern

```javascript
/**
 * Creates a rule test environment with optional schema validation
 * @param {Object} config - Environment configuration
 * @param {Object} [config.schemaValidator] - Optional schema validator for rule validation
 * @param {boolean} [config.validateOnSetup=true] - Validate rules on setup when validator provided
 * @returns {Object} Test environment with validation capabilities
 */
export function createRuleTestEnvironment(config) {
  const {
    schemaValidator = null,
    validateOnSetup = true,
    ...restConfig
  } = config;

  const env = {
    // ... existing environment setup ...

    /**
     * Validates rule data against schema
     * @param {Object} ruleData - Rule to validate
     * @throws {Error} If validation fails
     */
    validateRule(ruleData) {
      if (!schemaValidator) {
        throw new Error('Schema validator not provided to test environment');
      }
      schemaValidator.validate(
        'schema://living-narrative-engine/rule.schema.json',
        ruleData
      );
    },

    /**
     * Checks if validation is available
     * @returns {boolean}
     */
    hasValidation() {
      return schemaValidator !== null;
    }
  };

  // Validate on setup if enabled
  if (schemaValidator && validateOnSetup && config.ruleData) {
    env.validateRule(config.ruleData);
  }

  return env;
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All existing tests using `createRuleTestEnvironment()`** must pass unchanged
2. **New unit test**: `tests/unit/common/engine/systemLogicTestEnv.validation.test.js`
   - `should validate rule when schemaValidator provided and validateOnSetup=true`
   - `should skip validation when schemaValidator not provided`
   - `should skip validation when validateOnSetup=false`
   - `should expose validateRule() method`
   - `should expose hasValidation() method`
   - `should throw clear error when validateRule() called without validator`

### Invariants That Must Remain True

1. **Backward Compatibility**: Tests not passing `schemaValidator` work exactly as before
2. **Opt-in Validation**: Validation is not forced on existing tests
3. **Consistent Error Format**: Validation errors follow project conventions

### Manual Verification Steps

1. Run: `NODE_ENV=test npx jest tests/common/engine/ --no-coverage`
   - All tests pass without validator
2. Create test with validator injection
   - Invalid rules should fail during setup

---

## Estimated Effort

- **Size**: Small (S)
- **Complexity**: Low - additive change with clear precedent
- **Risk**: Low - opt-in behavior preserves backward compatibility

## Review Checklist

- [ ] All existing tests pass without modification
- [ ] New validation tests pass
- [ ] JSDoc documents new parameters and methods
- [ ] Error messages are clear and actionable
- [ ] No forced validation on existing tests
