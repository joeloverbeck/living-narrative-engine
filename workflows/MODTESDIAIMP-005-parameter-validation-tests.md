# MODTESDIAIMP-005: Write Comprehensive Parameter Validation Tests

**Phase**: 1 - Parameter Validation
**Priority**: 🔴 Critical
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-001, MODTESDIAIMP-002, MODTESDIAIMP-003, MODTESDIAIMP-004

---

## Overview

Create comprehensive test suites for parameter validation to ensure 100% coverage of validation logic and verify correct error messages with context.

## Objectives

- Achieve 100% coverage of ParameterValidator class
- Achieve 100% coverage of ParameterValidationError class
- Verify all integration points catch validation errors
- Document expected error messages and hints

## Test Files

### 1. ParameterValidationError Tests
**File**: `tests/unit/scopeDsl/core/parameterValidationError.test.js` (new)

### 2. ParameterValidator Tests
**File**: `tests/unit/scopeDsl/core/parameterValidator.test.js` (new)

### 3. Integration Tests
**File**: `tests/integration/scopeDsl/parameterValidationIntegration.test.js` (new)

## Test Specifications

### Suite 1: ParameterValidationError Tests

```javascript
describe('ParameterValidationError', () => {
  describe('constructor', () => {
    it('should create error with message only')
    it('should create error with full context')
    it('should extend TypeError')
    it('should preserve stack trace')
  });

  describe('toString()', () => {
    it('should format basic message')
    it('should include expected field')
    it('should include received field')
    it('should include hint with emoji')
    it('should include multiline example')
    it('should format all context fields')
  });

  describe('context access', () => {
    it('should expose context object')
    it('should allow reading context properties')
  });

  describe('error type checks', () => {
    it('should be instanceof ParameterValidationError')
    it('should be instanceof TypeError')
    it('should be instanceof Error')
  });
});
```

### Suite 2: ParameterValidator Tests

```javascript
describe('ParameterValidator', () => {
  describe('validateActorEntity', () => {
    describe('valid cases', () => {
      it('should pass for entity with id and components')
      it('should pass for entity with id only')
      it('should pass for entity with string id')
      it('should allow extra properties')
    });

    describe('invalid type', () => {
      it('should throw for undefined')
      it('should throw for null')
      it('should throw for string')
      it('should throw for number')
      it('should throw for boolean')
      it('should throw for array')
    });

    describe('missing id', () => {
      it('should throw for object without id')
      it('should throw for object with null id')
      it('should throw for object with undefined id')
    });

    describe('invalid id', () => {
      it('should throw for number id')
      it('should throw for empty string id')
      it('should throw for "undefined" string id')
    });

    describe('context object detection', () => {
      it('should detect object with actorEntity property')
      it('should detect object with actor property')
      it('should detect object with targets property')
      it('should provide context extraction hint')
      it('should provide code example for extraction')
    });

    describe('invalid components', () => {
      it('should throw for non-object components')
      it('should allow undefined components')
      it('should allow null components')
    });

    describe('error messages', () => {
      it('should include source location in message')
      it('should include expected type in context')
      it('should include received type in context')
    });
  });

  describe('validateRuntimeContext', () => {
    describe('valid cases', () => {
      it('should pass for complete runtimeCtx')
      it('should allow extra properties')
    });

    describe('invalid type', () => {
      it('should throw for undefined')
      it('should throw for null')
      it('should throw for primitive')
    });

    describe('missing services', () => {
      it('should throw for missing entityManager')
      it('should throw for missing jsonLogicEval')
      it('should throw for missing logger')
      it('should throw for missing multiple services')
      it('should list all missing services in error')
    });

    describe('error messages', () => {
      it('should include source location')
      it('should include missing service names')
      it('should provide example runtimeCtx')
    });
  });

  describe('validateAST', () => {
    describe('valid cases', () => {
      it('should pass for object with kind')
      it('should allow extra properties')
    });

    describe('invalid type', () => {
      it('should throw for undefined')
      it('should throw for null')
      it('should throw for primitive')
    });

    describe('missing kind', () => {
      it('should throw for object without kind')
    });

    describe('error messages', () => {
      it('should include source location')
      it('should indicate kind is required')
    });
  });
});
```

### Suite 3: Integration Tests

```javascript
describe('Parameter Validation Integration', () => {
  describe('ScopeEngine validation', () => {
    it('should validate AST at entry point')
    it('should validate actorEntity at entry point')
    it('should validate runtimeCtx at entry point')
    it('should propagate ParameterValidationError')
    it('should include "ScopeEngine.resolve" in error')
  });

  describe('FilterResolver validation', () => {
    it('should validate actorEntity')
    it('should include "FilterResolver.resolve" in error')
  });

  describe('SourceResolver validation', () => {
    it('should validate actorEntity')
    it('should include "SourceResolver.resolve" in error')
  });

  describe('Custom scope resolver validation', () => {
    it('should validate extracted actorEntity')
    it('should detect context object')
    it('should return error with context')
    it('should include "CustomScopeResolver" in error')
  });

  describe('End-to-end validation flow', () => {
    it('should catch invalid params at appropriate layer')
    it('should maintain error context through call stack')
    it('should provide actionable error messages')
  });

  describe('Error recovery', () => {
    it('should allow retry after fixing parameters')
    it('should not corrupt state on validation failure')
  });
});
```

## Acceptance Criteria

### Coverage Targets
- ✅ ParameterValidationError: 100% statement, branch, function, line
- ✅ ParameterValidator: 100% statement, branch, function, line
- ✅ Integration points: All validation calls covered

### Error Message Quality
- ✅ All error messages include source location
- ✅ Context object detection provides extraction hint
- ✅ Missing services list all missing items
- ✅ Examples provided for common mistakes

### Test Quality
- ✅ Each validation method has >= 10 test cases
- ✅ Edge cases covered (empty strings, "undefined" strings, etc.)
- ✅ Error context verified, not just error type
- ✅ Integration tests verify end-to-end flow

## Test Execution

```bash
# Run parameter validation tests only
npm run test:unit -- tests/unit/scopeDsl/core/parameterValidation*.test.js

# Run with coverage
npm run test:unit -- tests/unit/scopeDsl/core/parameterValidation*.test.js --coverage

# Run integration tests
npm run test:integration -- tests/integration/scopeDsl/parameterValidationIntegration.test.js
```

## Documentation Requirements

Add test examples to:
- JSDoc comments in `ParameterValidator` class
- JSDoc comments in `ParameterValidationError` class
- Code comments showing expected error output

## Success Metrics

- ✅ All tests pass
- ✅ Coverage >= 100% for validator classes
- ✅ No eslint errors
- ✅ No type errors
- ✅ Integration tests verify error propagation

## References

- **Spec Section**: 7. Testing Strategy (lines 2236-2303, 2406-2466)
- **Related Tickets**:
  - MODTESDIAIMP-001 (ParameterValidationError implementation)
  - MODTESDIAIMP-002 (ParameterValidator implementation)
  - MODTESDIAIMP-003 (ScopeEngine integration)
  - MODTESDIAIMP-004 (Resolver integration)
