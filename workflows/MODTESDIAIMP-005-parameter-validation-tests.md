# MODTESDIAIMP-005: Write Comprehensive Parameter Validation Tests

**Phase**: 1 - Parameter Validation
**Priority**: 🔴 Critical
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-001, MODTESDIAIMP-002, MODTESDIAIMP-003, MODTESDIAIMP-004

---

## Overview

Create comprehensive test suites for parameter validation to ensure 100% coverage of validation logic and verify correct error messages with context.

## Production Code Assumptions (Verified)

### ParameterValidationError Class
- **Location**: `src/scopeDsl/errors/parameterValidationError.js`
- **Extends**: `BaseError` (not `TypeError` directly)
- **Properties**: message, context (with expected, received, hint, example fields)
- **Methods**: `toString()`, `toJSON()`, `getSeverity()`, `isRecoverable()`
- **Status**: ✅ Implemented and working

### ParameterValidator Class
- **Location**: `src/scopeDsl/core/parameterValidator.js`
- **Static Methods**:
  - `validateActorEntity(value, source)` - Validates entity instances
  - `validateRuntimeContext(value, source)` - Validates runtime context
  - `validateAST(value, source)` - Validates AST nodes
- **Key Behaviors**:
  - ✅ Checks for action context objects (actor/targets properties)
  - ✅ Checks for scope context objects (runtimeCtx/dispatcher properties)
  - ✅ Only `entityManager` is required in runtimeCtx (jsonLogicEval and logger are optional)
  - ✅ AST validation checks for `type` property (not `kind`)
  - ✅ Detects "undefined" string as invalid entity id
- **Status**: ✅ Implemented and working

### Integration Points
- **ScopeEngine.resolve()**: ✅ Uses all three validation methods at entry point
- **FilterResolver**: ❌ Does NOT use ParameterValidator
- **SourceResolver**: ❌ Does NOT use ParameterValidator
- **StepResolver**: ❌ Does NOT use ParameterValidator
- **Custom Scope Resolvers**: ❌ Do NOT use ParameterValidator

**Architecture**: Single entry point validation at ScopeEngine.resolve() - fail-fast approach.

## Objectives

- Achieve 100% coverage of ParameterValidator class
- Achieve 100% coverage of ParameterValidationError class
- Verify all integration points catch validation errors
- Document expected error messages and hints

## Test Files

### 1. ParameterValidationError Tests
**File**: `tests/unit/scopeDsl/errors/parameterValidationError.test.js` (✅ already exists - needs review and enhancement)

### 2. ParameterValidator Tests
**File**: `tests/unit/scopeDsl/core/parameterValidator.test.js` (✅ already exists - needs corrections)

**⚠️ KNOWN ISSUES IN EXISTING TESTS**:
1. Lines 354-410: Tests expect jsonLogicEval and logger to be required, but production code only requires entityManager
2. These tests will FAIL when run because they expect errors that won't be thrown
3. Need to replace these with tests that verify jsonLogicEval and logger are OPTIONAL

### 3. Integration Tests
**File**: `tests/integration/scopeDsl/parameterValidationIntegration.test.js` (❌ does not exist - needs creation)

## Issues to Fix in Existing Tests

### ParameterValidator Test Issues (tests/unit/scopeDsl/core/parameterValidator.test.js)

**Lines 354-370**: `should fail for missing jsonLogicEval`
- ❌ INCORRECT: Test expects validation to fail when jsonLogicEval is missing
- ✅ CORRECT: jsonLogicEval is OPTIONAL, validation should PASS

**Lines 373-390**: `should fail for missing logger`
- ❌ INCORRECT: Test expects validation to fail when logger is missing
- ✅ CORRECT: logger is OPTIONAL, validation should PASS

**Lines 392-410**: `should fail for missing multiple services`
- ❌ INCORRECT: Test expects validation to fail for missing jsonLogicEval and logger
- ✅ CORRECT: Only entityManager is required, validation should PASS if entityManager present

**Recommended Fix**: Replace these three tests with:
- `should pass when jsonLogicEval is missing (optional service)`
- `should pass when logger is missing (optional service)`
- `should pass when both optional services are missing`

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
      it('should pass for runtimeCtx with entityManager only (minimum required)')
      it('should pass for complete runtimeCtx with all optional services')
      it('should allow extra properties')
      it('should pass when jsonLogicEval is missing (optional)')
      it('should pass when logger is missing (optional)')
    });

    describe('invalid type', () => {
      it('should throw for undefined')
      it('should throw for null')
      it('should throw for primitive')
    });

    describe('missing critical services', () => {
      it('should throw for missing entityManager (ONLY critical service)')
      it('should list missing critical service in error')
    });

    describe('error messages', () => {
      it('should include source location')
      it('should include missing service names')
      it('should provide example runtimeCtx')
      it('should clarify entityManager is required, others optional')
    });
  });

  describe('validateAST', () => {
    describe('valid cases', () => {
      it('should pass for object with type property')
      it('should pass for Source node with both type and kind')
      it('should pass for Filter node with type property')
      it('should pass for Union node with type property')
      it('should allow extra properties beyond type')
    });

    describe('invalid type', () => {
      it('should throw for undefined')
      it('should throw for null')
      it('should throw for primitive')
    });

    describe('missing type property', () => {
      it('should throw for object without type property')
      it('should throw for object with only kind property (missing type)')
    });

    describe('error messages', () => {
      it('should include source location')
      it('should indicate type property is required for resolver dispatch')
      it('should list valid AST node types in hint')
    });
  });
});
```

### Suite 3: Integration Tests

**⚠️ CURRENT STATE**: Parameter validation only occurs in ScopeEngine.resolve(). Individual resolvers (FilterResolver, SourceResolver, etc.) do not perform parameter validation themselves.

```javascript
describe('Parameter Validation Integration', () => {
  describe('ScopeEngine validation (primary entry point)', () => {
    it('should validate AST at entry point before resolution')
    it('should validate actorEntity at entry point before resolution')
    it('should validate runtimeCtx at entry point before resolution')
    it('should propagate ParameterValidationError unchanged')
    it('should include "ScopeEngine.resolve" in error source')
    it('should fail fast before calling any resolvers')
  });

  describe('Validation failure scenarios', () => {
    it('should catch invalid AST before parsing')
    it('should catch missing actorEntity.id before resolution')
    it('should catch action context passed as actorEntity')
    it('should catch scope context passed as actorEntity')
    it('should catch missing entityManager in runtimeCtx')
    it('should catch "undefined" string as entity id')
  });

  describe('End-to-end validation flow', () => {
    it('should catch invalid params at ScopeEngine layer (fail-fast)')
    it('should maintain error context through call stack')
    it('should provide actionable error messages with hints')
    it('should provide code examples in error output')
  });

  describe('Error recovery', () => {
    it('should allow retry after fixing parameters')
    it('should not corrupt state on validation failure')
    it('should maintain clean error state after failed validation')
  });

  describe('Resolver integration (no direct validation)', () => {
    it('should receive pre-validated parameters from ScopeEngine')
    it('should not re-validate parameters in FilterResolver')
    it('should not re-validate parameters in SourceResolver')
    it('should not re-validate parameters in StepResolver')
    it('should rely on ScopeEngine validation as single entry point')
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
  - MODTESDIAIMP-001 (ParameterValidationError implementation) ✅ Complete
  - MODTESDIAIMP-002 (ParameterValidator implementation) ✅ Complete
  - MODTESDIAIMP-003 (ScopeEngine integration) ✅ Complete
  - MODTESDIAIMP-004 (Resolver integration) ⚠️ Different from spec - validation only in ScopeEngine

## Summary of Corrections Made

### Major Discrepancies Fixed

1. **File Paths**: Corrected ParameterValidationError test path from `core/` to `errors/` subdirectory
2. **Test Status**: Marked existing tests as "already exists" instead of "new"
3. **Runtime Context Validation**: Corrected assumption that jsonLogicEval and logger are required (they're optional, only entityManager is required)
4. **AST Validation**: Corrected assumption about `kind` property - actual validation checks for `type` property
5. **Integration Points**: Removed incorrect assumptions about FilterResolver and SourceResolver using validation - only ScopeEngine validates parameters
6. **Test Issues**: Documented three failing tests that need correction (lines 354-410 in parameterValidator.test.js)

### Workflow Now Reflects Reality

- ✅ Production code locations verified
- ✅ Validation behavior documented accurately
- ✅ Integration architecture clarified (single entry point)
- ✅ Test corrections needed are clearly marked
- ✅ All assumptions verified against actual code
