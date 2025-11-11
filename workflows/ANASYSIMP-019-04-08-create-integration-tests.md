# ANASYSIMP-019-04-08: Create Integration Tests for ValidationRules

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 3 (Testing & Validation)
**Timeline:** 30 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-07

## Overview

Create comprehensive integration tests to verify that the new `validationRules` feature works correctly at runtime with migrated components. Tests will demonstrate enhanced error messages, similarity suggestions, and backward compatibility.

## Objectives

1. Create integration test file for component validationRules
2. Test enhanced error messages for enum violations
3. Test similarity suggestions for typos
4. Test backward compatibility with non-migrated components
5. Test multiple enum properties in single component
6. Test required field validation with enhanced messages
7. Test type validation with enhanced messages
8. Achieve 85% branch coverage, 90% function/line coverage

## Test File Location

**File:** `tests/integration/validation/componentValidationRules.integration.test.js`

## Reference Documentation

- **Parent Workflow**: `workflows/ANASYSIMP-019-04-migrate-components-validation-rules.md`
  - Test file template (lines 207-256)
- **Testing Guide**: `docs/testing/mod-testing-guide.md`
- **Validation Workflow**: `docs/anatomy/validation-workflow.md`

## Test Structure

### Test Suite Organization

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Component ValidationRules Integration', () => {
  let testBed;
  let validator;

  beforeEach(async () => {
    testBed = createTestBed();
    validator = await testBed.resolve('IAjvSchemaValidator');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // Test cases here
});
```

## Test Cases to Implement

### Test Case 1: Enhanced Error Messages for Enum Violations

**Purpose:** Verify that components with validationRules provide clear, customized error messages.

```javascript
describe('Enhanced Error Messages', () => {
  it('should provide enhanced error messages for enum violations', () => {
    // Test with clothing:wearable component (migrated in ANASYSIMP-019-04-04)
    const invalidData = { layer: 'invalid-layer' };
    const result = validator.validate('clothing:wearable', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);

    const error = result.errors[0];
    expect(error.message).toContain('Invalid layer');
    expect(error.message).toContain('invalid-layer');
    expect(error.message).toContain('Valid options');
    expect(error.message).toMatch(/underwear|base|outer|accessories/);
  });

  it('should provide enhanced error for descriptors:build enum violation', () => {
    // Test with descriptors:build component (migrated in ANASYSIMP-019-04-02)
    const invalidData = { build: 'super-muscular' };
    const result = validator.validate('descriptors:build', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid build');
    expect(result.errors[0].message).toContain('super-muscular');
    expect(result.errors[0].message).toContain('Valid options');
  });

  it('should provide enhanced error for core:gender enum violation', () => {
    // Test with core:gender component (migrated in ANASYSIMP-019-04-05)
    const invalidData = { gender: 'unknown-gender' };
    const result = validator.validate('core:gender', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid gender');
    expect(result.errors[0].message).toContain('unknown-gender');
  });
});
```

### Test Case 2: Similarity Suggestions

**Purpose:** Verify that similarity suggestions are provided for typos close to valid values.

```javascript
describe('Similarity Suggestions', () => {
  it('should suggest similar valid values for typos', () => {
    // Test with typo close to valid value
    const invalidData = { layer: 'outter' }; // Typo of "outer"
    const result = validator.validate('clothing:wearable', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);

    const error = result.errors[0];
    expect(error.suggestions).toBeDefined();
    expect(error.suggestions).toContain('outer');
    expect(error.suggestions.length).toBeLessThanOrEqual(3); // maxSuggestions: 3
  });

  it('should suggest similar values for descriptors:height typo', () => {
    const invalidData = { height: 'tallll' }; // Typo of "tall"
    const result = validator.validate('descriptors:height', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].suggestions).toBeDefined();
    expect(result.errors[0].suggestions).toContain('tall');
  });

  it('should not suggest when distance exceeds maxDistance', () => {
    // Test with value too different from any valid value
    const invalidData = { layer: 'xyz123' };
    const result = validator.validate('clothing:wearable', invalidData);

    expect(result.isValid).toBe(false);
    // Suggestions may be empty or contain distant matches
    expect(result.errors[0].suggestions).toBeDefined();
  });
});
```

### Test Case 3: Required Field Validation

**Purpose:** Verify enhanced error messages for missing required fields.

```javascript
describe('Required Field Validation', () => {
  it('should provide enhanced error for missing required field', () => {
    // Test with missing required field
    const invalidData = {}; // Missing 'layer' which is required
    const result = validator.validate('clothing:wearable', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);

    const error = result.errors[0];
    expect(error.message).toContain('Layer is required');
    expect(error.message).not.toContain('{{'); // No unresolved template vars
  });

  it('should provide enhanced error for missing descriptors:build', () => {
    const invalidData = {};
    const result = validator.validate('descriptors:build', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Build is required');
  });
});
```

### Test Case 4: Type Validation

**Purpose:** Verify enhanced error messages for type mismatches.

```javascript
describe('Type Validation', () => {
  it('should provide enhanced error for type mismatch', () => {
    // Test with wrong type (number instead of string)
    const invalidData = { layer: 123 };
    const result = validator.validate('clothing:wearable', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid type');
    expect(result.errors[0].message).toContain('expected');
    expect(result.errors[0].message).toContain('got');
  });

  it('should provide enhanced error for descriptors:height type mismatch', () => {
    const invalidData = { height: true }; // Boolean instead of string
    const result = validator.validate('descriptors:height', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid type');
  });
});
```

### Test Case 5: Backward Compatibility

**Purpose:** Verify that components without validationRules still work correctly.

```javascript
describe('Backward Compatibility', () => {
  it('should work with components without validationRules', () => {
    // Test with component that doesn't have validationRules
    // (Find a component not yet migrated or create a test schema)
    const validData = { someProperty: 'someValue' };
    const result = validator.validate('some:component-without-validation', validData);

    // Should still work, just without enhanced messages
    expect(result).toBeDefined();
    expect(result.isValid).toBeDefined();
  });

  it('should provide standard AJV errors for non-migrated components', () => {
    // Test that non-migrated components still validate
    const invalidData = { someEnum: 'invalid-value' };
    const result = validator.validate('some:component-without-validation', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
    // Error message may not have enhanced format
  });
});
```

### Test Case 6: Multiple Enum Properties

**Purpose:** Verify validation works correctly with components that have multiple enum properties.

```javascript
describe('Multiple Enum Properties', () => {
  it('should validate multiple enum properties independently', () => {
    // Test with component that has multiple enum properties
    // (If such component exists after migration)
    const invalidData = {
      property1: 'invalid-value-1',
      property2: 'valid-value'
    };
    const result = validator.validate('some:multi-enum-component', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1); // Only property1 fails
    expect(result.errors[0].message).toContain('property1');
  });

  it('should report all enum violations when multiple fail', () => {
    const invalidData = {
      property1: 'invalid-value-1',
      property2: 'invalid-value-2'
    };
    const result = validator.validate('some:multi-enum-component', invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
```

### Test Case 7: Valid Data Passes

**Purpose:** Verify that valid data passes validation.

```javascript
describe('Valid Data', () => {
  it('should pass validation with valid data', () => {
    const validData = { layer: 'outer' };
    const result = validator.validate('clothing:wearable', validData);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass validation for all valid descriptor:height values', () => {
    const validHeights = [
      'microscopic', 'minuscule', 'tiny', 'petite', 'short',
      'average', 'tall', 'very-tall', 'gigantic', 'colossal', 'titanic'
    ];

    validHeights.forEach(height => {
      const result = validator.validate('descriptors:height', { height });
      expect(result.isValid).toBe(true);
    });
  });
});
```

## Implementation Steps

### Step 1: Create Test File

```bash
# Create test file
touch tests/integration/validation/componentValidationRules.integration.test.js

# Verify location
ls -la tests/integration/validation/
```

### Step 2: Write Test Structure

1. Import dependencies (jest, testBed)
2. Set up describe block
3. Add beforeEach and afterEach hooks
4. Create test cases from templates above

### Step 3: Implement Test Cases

Implement each test case following the patterns above:
1. Enhanced error messages (3 tests)
2. Similarity suggestions (3 tests)
3. Required field validation (2 tests)
4. Type validation (2 tests)
5. Backward compatibility (2 tests)
6. Multiple enum properties (2 tests)
7. Valid data passes (2 tests)

**Total:** 16 test cases

### Step 4: Run Tests

```bash
# Run integration tests
NODE_ENV=test npm run test:integration -- tests/integration/validation/componentValidationRules.integration.test.js

# Run with coverage
NODE_ENV=test npm run test:integration -- tests/integration/validation/componentValidationRules.integration.test.js --coverage

# Check coverage metrics
# Target: 85% branches, 90% functions/lines
```

### Step 5: Fix Failing Tests

If tests fail:
1. Review error messages
2. Check component schemas for validationRules
3. Verify AJV integration (ANASYSIMP-019-03)
4. Debug with verbose logging
5. Update tests if needed

### Step 6: Lint and Type Check

```bash
# ESLint
npx eslint tests/integration/validation/componentValidationRules.integration.test.js

# TypeScript check
npm run typecheck
```

### Step 7: Commit Test File

```bash
# Stage test file
git add tests/integration/validation/componentValidationRules.integration.test.js

# Commit
git commit -m "test(validation): add integration tests for component validationRules

- Test enhanced error messages for enum violations
- Test similarity suggestions for typos
- Test backward compatibility with non-migrated components
- Test required field and type validation
- Test multiple enum properties
- Achieve 85%+ branch coverage
- Part of ANASYSIMP-019-04 migration"

# Verify commit
git log -1 --stat
```

## Acceptance Criteria

- [ ] Integration test file created
- [ ] All 16 test cases implemented
- [ ] Tests pass successfully
- [ ] Coverage targets met: 85% branches, 90% functions/lines
- [ ] ESLint passes
- [ ] TypeScript type checking passes
- [ ] Tests demonstrate enhanced validation works
- [ ] Similarity suggestions verified working
- [ ] Backward compatibility confirmed
- [ ] Test file committed to git

## Common Pitfalls

### Pitfall 1: Hard-Coded Component IDs
**Problem:** Using component IDs that may not exist after migration
**Solution:** Use components known to be migrated (from ANASYSIMP-019-04-02 through 04-07)

### Pitfall 2: Not Checking Suggestions
**Problem:** Assuming suggestions always exist
**Solution:** Check that `suggestions` is defined before asserting contents

### Pitfall 3: Template Variable Leaks
**Problem:** Not checking for unresolved template variables like `{{value}}`
**Solution:** Add assertions like `expect(message).not.toContain('{{')`

### Pitfall 4: Insufficient Coverage
**Problem:** Tests don't cover all validation paths
**Solution:** Add tests for error cases, edge cases, and valid data

## Coverage Targets

- **Branches:** 85% minimum
- **Functions:** 90% minimum
- **Lines:** 90% minimum

**Measured Against:** New integration test file

## Time Estimate

- Test file setup: 5 minutes
- Test case implementation (16 tests): 20 minutes
- Running and debugging tests: 10 minutes
- Linting and type checking: 2 minutes
- Commit: 1 minute
- **Total:** ~38 minutes (adjusted to 30 with focus)

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-09**: Final verification and cleanup
