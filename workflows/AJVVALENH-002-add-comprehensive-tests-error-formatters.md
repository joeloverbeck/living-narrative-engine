# AJVVALENH-002: Add Comprehensive Tests for Error Formatters

## Priority: 1 - Immediate

## Problem Statement
The error formatting utilities (`ajvUtils.js` and `ajvAnyOfErrorFormatter.js`) have ZERO test coverage. These critical components handle the transformation of raw AJV validation errors into developer-friendly messages, but their behavior is not verified by any automated tests. This creates risk when modifying validation logic and makes it impossible to ensure error messages remain helpful.

## Current State
- `src/utils/ajvUtils.js` - No tests exist
  - Contains `formatAjvErrors` function used throughout the codebase
  - Handles anyOf cascade detection (>50 errors)
  - No verification of its behavior

- `src/utils/ajvAnyOfErrorFormatter.js` - No tests exist
  - Contains `formatAnyOfErrors` and `formatAjvErrorsEnhanced`
  - Sophisticated error grouping and filtering logic
  - Complex operation type detection untested

## Technical Requirements

### 1. Test File Structure
Create comprehensive test suites for both error formatters:

```
tests/unit/utils/
├── ajvUtils.test.js
└── ajvAnyOfErrorFormatter.test.js
```

### 2. Test Coverage Requirements

#### For ajvUtils.test.js

##### Basic Functionality Tests
```javascript
describe('ajvUtils - formatAjvErrors', () => {
  describe('basic error formatting', () => {
    it('should format a single validation error');
    it('should format multiple validation errors');
    it('should handle empty error array');
    it('should handle null/undefined errors');
  });

  describe('anyOf cascade detection', () => {
    it('should detect anyOf cascade (>50 errors)');
    it('should extract operation type from data');
    it('should filter errors for detected operation type');
    it('should provide structural hints for common issues');
    it('should handle missing data parameter');
    it('should handle missing type in data');
  });

  describe('error message formatting', () => {
    it('should format required property errors clearly');
    it('should format type mismatch errors clearly');
    it('should format additional property errors clearly');
    it('should preserve error paths correctly');
  });
});
```

##### Edge Cases
- Test with exactly 50, 51, 100, 500, 1000 errors
- Test with malformed error objects
- Test with circular references in data
- Test with very long error paths
- Test with non-English error messages

#### For ajvAnyOfErrorFormatter.test.js

##### Core Functionality Tests
```javascript
describe('ajvAnyOfErrorFormatter', () => {
  describe('formatAnyOfErrors', () => {
    it('should group errors by operation type');
    it('should identify the most likely operation type');
    it('should filter irrelevant operation errors');
    it('should handle unknown operation types');
    it('should provide operation-specific hints');
  });

  describe('formatAjvErrorsEnhanced', () => {
    it('should detect anyOf patterns automatically');
    it('should fall back to basic formatting for simple errors');
    it('should handle nested anyOf structures');
    it('should preserve original error information');
    it('should generate actionable error messages');
  });

  describe('operation type detection', () => {
    it('should detect IF operation from structure');
    it('should detect QUERY_COMPONENT operation');
    it('should detect SET_COMPONENT operation');
    // Test all 41 operation types
  });
});
```

##### Performance Tests
```javascript
describe('performance', () => {
  it('should handle 1000+ errors in <100ms');
  it('should not consume excessive memory');
  it('should not block event loop');
});
```

### 3. Test Data Generation

#### Create Test Fixtures
```javascript
// tests/fixtures/validation-errors/
const createAnyOfCascade = (operationType, errorCount = 742) => {
  // Generate realistic anyOf cascade errors
};

const createStructuralError = (operation) => {
  // Create errors for properties at wrong nesting level
};

const createTypeMismatchError = (path, expected, actual) => {
  // Create type mismatch error
};
```

#### Real-World Error Scenarios
Test with actual error patterns from:
1. IF operation with properties outside parameters
2. Missing required fields in operations
3. Invalid type values
4. Additional properties not allowed
5. Nested operation validation failures

### 4. Mock Data Requirements

#### Operation Type Mocks
Create mock data for all 41 operation types:
```javascript
const operationMocks = {
  IF: {
    type: 'IF',
    parameters: { condition: {}, then_actions: [] }
  },
  QUERY_COMPONENT: {
    type: 'QUERY_COMPONENT',
    parameters: { componentId: 'test', query: {} }
  },
  // ... all 41 operations
};
```

#### Error Pattern Mocks
```javascript
const errorPatterns = {
  anyOfCascade: generateCascadeErrors(742),
  structuralIssue: generateStructuralErrors(),
  simpleValidation: generateSimpleErrors()
};
```

### 5. Integration with CI/CD

#### Test Commands
Update package.json:
```json
{
  "scripts": {
    "test:formatters": "jest tests/unit/utils/ajv*.test.js",
    "test:validation": "jest tests/**/validation/**/*.test.js tests/unit/utils/ajv*.test.js"
  }
}
```

#### Coverage Requirements
- Minimum 80% branch coverage
- Minimum 90% line coverage
- Minimum 85% function coverage
- 100% coverage for error detection logic

## Success Criteria

### Test Implementation
- [ ] All test files created and passing
- [ ] Coverage targets met for both modules
- [ ] Edge cases thoroughly tested
- [ ] Performance benchmarks established

### Test Quality
- [ ] Tests are readable and well-documented
- [ ] Tests use realistic error scenarios
- [ ] Tests verify actual output format
- [ ] Tests catch regressions effectively

### Integration
- [ ] Tests run in CI pipeline
- [ ] Tests included in npm test
- [ ] Coverage reports generated
- [ ] Test failures block deployment

## Dependencies
- Requires AJVVALENH-001 to be completed first (to test the integrated formatter)
- Uses existing test infrastructure (Jest, testBed)
- May need to create new test utilities for error generation

## Estimated Complexity
- **Effort**: 4-6 hours
- **Risk**: Low-Medium (complex test scenarios)
- **Coverage**: 3-4 hours to reach targets

## Implementation Notes

### Test Organization
1. Group tests by functionality, not just function names
2. Use descriptive test names that explain the scenario
3. Include comments explaining why each test is important
4. Use beforeEach/afterEach for consistent setup

### Test Data Management
1. Create reusable fixtures for common error patterns
2. Store large test data in separate fixture files
3. Use factories to generate test data dynamically
4. Avoid hardcoding error messages that might change

### Assertion Strategies
```javascript
// Don't just check message exists
expect(result.message).toBe('Expected specific message');

// Verify structure
expect(result).toMatchObject({
  message: expect.stringContaining('IF operation'),
  errors: expect.arrayContaining([
    expect.objectContaining({
      path: 'parameters.condition',
      message: expect.any(String)
    })
  ])
});

// Verify behavior
expect(formatAjvErrors(cascadeErrors, { type: 'IF' }))
  .toHaveLength(5); // Should reduce 742 to ~5 relevant errors
```

### Performance Testing
```javascript
it('should handle large error arrays efficiently', () => {
  const errors = generateErrors(1000);
  const start = performance.now();
  const result = formatAjvErrorsEnhanced(errors, data);
  const duration = performance.now() - start;
  
  expect(duration).toBeLessThan(100);
  expect(result).toBeDefined();
});
```

## Definition of Done
- [ ] Test files created for both modules
- [ ] All tests passing
- [ ] Coverage targets met
- [ ] Performance benchmarks passing
- [ ] Tests integrated into CI/CD
- [ ] Documentation updated with test examples
- [ ] Edge cases documented and tested

## Related Tickets
- AJVVALENH-001: Complete ajvAnyOfErrorFormatter Integration (must be done first)
- AJVVALENH-003: Implement Pre-validation Type Checker
- AJVVALENH-004: Create Validation Testing Suite

## Notes
These tests are critical for ensuring the error formatting improvements actually work as intended. Without tests, we cannot confidently modify the validation system or guarantee that error messages remain helpful after changes. The test suite should become the source of truth for expected error formatting behavior.

## Test Checklist
- [ ] Test basic error formatting
- [ ] Test anyOf cascade detection
- [ ] Test operation type identification
- [ ] Test error grouping and filtering
- [ ] Test performance with large error sets
- [ ] Test edge cases and error conditions
- [ ] Test all 41 operation types
- [ ] Test integration with validation flow