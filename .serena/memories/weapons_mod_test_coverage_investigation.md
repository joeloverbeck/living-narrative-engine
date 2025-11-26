# Weapons Mod Test Coverage Investigation Report

## Summary
The failing validation errors for LOCK_GRABBING and UNLOCK_GRABBING operations in the weapons mod rule files were NOT caught by existing tests because:

1. **Test isolation prevents full schema validation** - Tests use `ModTestFixture` which loads rules as parsed JSON objects, bypassing the full AJV schema validation pipeline
2. **No comprehensive pre-validation enforcement** - The `operationTypeCompleteness.test.js` validates the pre-validation whitelist, but this test does NOT run during integration tests
3. **Tests mock the operation system** - The mod test environment creates rule interpreters but doesn't validate operations against the operation.schema.json
4. **Weapons mod tests don't validate rules during loading** - Tests directly provide rule objects without going through the `modsLoader.js` validation pipeline

## Existing Test Coverage Analysis

### 1. Weapons Mod Test Files (tests/integration/mods/weapons/)

**Files that test unwield_item and wield_threateningly:**
- `unwield_item_rule_execution.test.js` (11 tests)
  - Tests rule execution behavior when unwielding
  - Does NOT validate rule schema or operation types
  - Directly loads rule via import: `import unwieldItemRule from '../../../../data/mods/weapons/rules/handle_unwield_item.rule.json'`
  - Passes the JSON object directly to ModTestFixture

- `wieldThreateninglyRuleValidation.test.js` (4 tests)
  - Tests rule structure and operation presence
  - Loads rule file directly and validates specific operations exist
  - Does NOT validate against operation.schema.json
  - Tests for `LOCK_GRABBING` operation existence but doesn't validate it's a known operation type

- `wield_threateningly_grabbing.test.js` (6 tests)
  - Tests LOCK_GRABBING operation execution
  - Uses ModTestFixture to load and execute rule
  - Does NOT validate operation schema during loading

### 2. Validation Tests (tests/integration/validation/)

**operationTypeCompleteness.test.js** (3 tests) - THE MISSING LINK
- Validates that all operation schema files in `data/schemas/operations/` are registered in `KNOWN_OPERATION_TYPES` whitelist
- Extracts operation type from schema using regex on preValidationUtils.js file
- Compares schema files to whitelist
- **NOT RUN by weapons mod tests** - This is a separate test file that validates the completeness system

**operationSchemaRegistration.test.js** (7 tests)
- Tests schema validation for specific operations
- Validates that operation schemas are referenced in operation.schema.json
- Tests individual operations like AUTO_MOVE_CLOSENESS_PARTNERS
- Does NOT specifically test weapons mod operations

### 3. ModTestFixture Mechanism (tests/common/mods/ModTestFixture.js)

How it loads rules:
```javascript
// Lines 210-219: ModTestFixture loads JSON directly
if (typeof finalRuleFile === 'string') {
  const resolvedPath = resolve(finalRuleFile);
  const content = await fs.readFile(resolvedPath, 'utf8');
  finalRuleFile = JSON.parse(content);  // ← Parses JSON but doesn't validate
}

// Then passes to ModActionTestFixture constructor
const fixture = new ModActionTestFixture(
  modId,
  actionId,
  finalRuleFile,
  finalConditionFile,
  otherOptions
);
```

**The problem:** ModTestFixture accepts rule objects but doesn't call validateAgainstSchema() on them. The rule is passed directly to the rule engine without schema validation.

### 4. ModsLoader Validation Pipeline (FULL MOD LOADING)

The proper validation happens in:
- `src/loaders/modsLoader.js` - Orchestrates mod loading phases
- Uses `AJV schema validator` with `validateAgainstSchema()`
- Validates against `rule.schema.json` which has references to `operation.schema.json`
- This validates operation types during full app initialization

**But:** Weapons mod tests don't use ModsLoader - they use ModTestFixture which bypasses full validation!

### 5. Initialization Service Tests

`tests/integration/initializers/services/initializationService.integration.test.js`
- Tests initialization including mod loading
- **MOCKS ModsLoader**: `container.register(tokens.ModsLoader, () => ({ loadMods: jest.fn().mockResolvedValue({}) }))`
- Doesn't actually load mods with real validation
- So weapons mod validation errors wouldn't be caught here either

## Why Tests Didn't Catch the Errors

### Root Cause Chain:
1. Weapons mod rule files are imported as JSON objects in tests
2. ModTestFixture accepts these objects without schema validation
3. Tests pass the rule object directly to rule engine setup
4. No call to `validateAgainstSchema()` occurs
5. Unknown operation types (LOCK_GRABBING, UNLOCK_GRABBING) are never validated against the operation.schema.json or KNOWN_OPERATION_TYPES whitelist

### Test Coverage Gaps:
1. **No operation type validation in test loading** - Tests don't call the validation pipeline
2. **operationTypeCompleteness.test.js is isolated** - Validates the static whitelist but not dynamic usage in actual mod files
3. **Weapons mod tests are unit/functional, not schema-validation tests** - They test behavior, not structure
4. **No regression test for "unknown operation type" scenarios** - Tests don't verify unknown ops are rejected

## Existing Test Patterns That Work Correctly

### Pattern 1: Direct Rule Schema Validation (operationTypeCompleteness.test.js)
```javascript
// This test CORRECTLY validates the system:
// - Reads all schema files from data/schemas/operations/
// - Extracts operation type from each
// - Compares to KNOWN_OPERATION_TYPES in preValidationUtils.js
// - Result: FAILS if schema has op type not in whitelist
```

### Pattern 2: ModsLoader Integration Test (modsLoader tests)
```javascript
// These tests load mods through actual ModsLoader phases
// - This WOULD trigger schema validation
// - But mods tests bypass ModsLoader
```

### Pattern 3: Validation Service Tests (operationSchemaRegistration.test.js)
```javascript
// Tests schema validator directly:
const schemaValidator = testBed.container.resolve('ISchemaValidator');
schemaValidator.validateAgainstSchema(ruleData, 'schema://living-narrative-engine/rule.schema.json');
// This WOULD catch unknown operation types if rules were validated
```

## Files That Need Modification or Creation

### 1. NEW TEST: Weapons Mod Schema Validation (High Priority)
- **File:** `tests/integration/mods/weapons/weaponsModSchemaValidation.test.js`
- **Purpose:** Validate all weapons mod rules against JSON schema
- **What it should test:**
  - Load each rule file as it would be loaded by modsLoader
  - Call validateAgainstSchema() on each rule
  - Verify all operations in rules have valid types
  - Should have caught LOCK_GRABBING and UNLOCK_GRABBING

### 2. ENHANCE: operationTypeCompleteness.test.js
- **File:** `tests/integration/validation/operationTypeCompleteness.test.js`
- **Already exists** but doesn't validate operation usage in rules
- **Enhancement:** Add second test that validates actual rule files contain only known operation types
- **What it should do:**
  - Find all .rule.json files in data/mods/*/rules/
  - Extract operation types from each rule's actions array
  - Compare to KNOWN_OPERATION_TYPES
  - This would have caught the issue immediately

### 3. MODIFY: ModTestFixture Schema Validation Option
- **File:** `tests/common/mods/ModTestFixture.js`
- **Enhancement:** Add optional schema validation parameter
- **What it should do:**
  - Add `validateSchemas: true` option to ModTestFixture.forAction()
  - If enabled, call validateAgainstSchema() on loaded rules before testing
  - Provides regression testing capability

## Test Patterns and Architecture

### Current Architecture Issues:
1. **Two validation paths**: 
   - Path A: ModsLoader → AJV validation (production)
   - Path B: ModTestFixture → No validation (tests)
   - These paths diverge, causing test/production mismatch

2. **Test isolation is too complete**:
   - Isolates from schema validation
   - Prevents catching structural errors
   - Forces developers to manually validate rule files

3. **Missing schema validation in test loading**:
   - ModTestFixture could call validateAgainstSchema()
   - Would provide immediate feedback in tests
   - Would prevent deployment of invalid mods

## Recommendations

### Priority 1: Create Weapons Mod Schema Validation Test
- Immediately catches the current issue
- Prevents future unknown operation type errors
- Provides regression testing

### Priority 2: Enhance operationTypeCompleteness Test
- Makes system-level check easier
- Validates entire mod ecosystem at once
- Catches cross-mod issues

### Priority 3: Add Schema Validation Option to ModTestFixture
- Allows tests to opt-in to schema validation
- Maintains backward compatibility
- Enables progressive hardening of test suite

### Priority 4: Document This Pattern
- Explain why tests use ModTestFixture vs ModsLoader
- Show developers how to validate rules in tests
- Provide template for mod testing with schema validation

## Conclusion

The weapons mod validation errors were NOT caught because:
1. Tests use isolated ModTestFixture that bypasses schema validation
2. No dedicated test validates actual rule files against schemas
3. operationTypeCompleteness.test.js validates the whitelist, not rule usage
4. Tests focus on execution behavior, not structural validity

**This is a test infrastructure gap, not a test quantity gap.** The test framework needs schema validation integration to catch these issues automatically.
