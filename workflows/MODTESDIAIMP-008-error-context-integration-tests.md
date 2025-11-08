# MODTESDIAIMP-008: Write Error Context Integration Tests

**Phase**: 2 - Enhanced Error Context
**Priority**: 🔴 Critical
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-006, MODTESDIAIMP-007

---

## Overview

Create comprehensive integration tests verifying that scope resolution errors are properly wrapped with context throughout the system, providing actionable error messages for debugging.

## Objectives

- Verify error wrapping at all integration points
- Validate error context completeness
- Ensure error chain preservation
- Test error formatting quality
- Verify hints and suggestions are helpful

## Test Files

### Main Integration Test Suite
**File**: `tests/integration/scopeDsl/errorWrappingIntegration.test.js` (new)

### Supporting Test Files
- Modify existing integration tests to expect enhanced errors
- Add examples to documentation tests

## Test Specifications

### Suite 1: Parameter Validation Error Wrapping

```javascript
describe('Parameter Validation Error Wrapping', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  it('should wrap ParameterValidationError with scope context', async () => {
    // Force parameter validation error by passing invalid context
    const invalidResolver = (context) => {
      // Intentionally pass wrong type
      return scopeEngine.resolve(ast, undefined, runtimeCtx);
    };

    testFixture.registerCustomScope('test:invalid', invalidResolver);

    const result = await testFixture.resolveCustomScope('test:invalid', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('ScopeResolutionError');
    expect(result.context.scopeName).toBe('test:invalid');
    expect(result.context.phase).toBe('parameter extraction');
    expect(result.context.hint).toBeTruthy();
  });

  it('should include scope name in wrapped error', () => {
    // Test that scopeName appears in error message
  });

  it('should provide parameter extraction hint for context object', () => {
    // Test that hint suggests context.actorEntity extraction
  });

  it('should preserve original ParameterValidationError', () => {
    // Test that originalError is ParameterValidationError
  });

  it('should include parameter values in context', () => {
    // Test that context.parameters has debugging info
  });
});
```

### Suite 2: Scope Not Found Error Wrapping

```javascript
describe('Scope Not Found Error Wrapping', () => {
  it('should wrap "not found" with registered scopes list', () => {
    // Attempt to resolve non-existent scope
    // Verify error includes list of registered scopes
  });

  it('should provide spelling suggestion', () => {
    // Request scope with typo
    // Verify error suggests similar scope names
  });

  it('should include phase: scope lookup', () => {
    // Verify error context has phase set correctly
  });

  it('should list available scopes in suggestion', () => {
    // Verify error includes sample of registered scopes
  });
});
```

### Suite 3: Filter Evaluation Error Wrapping

```javascript
describe('Filter Evaluation Error Wrapping', () => {
  it('should wrap JSON Logic evaluation errors', async () => {
    // Create scope with invalid JSON Logic
    const invalidFilter = {
      kind: 'filter',
      logic: { invalid_operator: true },
    };

    // Verify error is wrapped with context
  });

  it('should include entity ID in error context', () => {
    // Verify context.parameters.entityId is present
  });

  it('should include filter logic in error context', () => {
    // Verify context.parameters.filterLogic shows the expression
  });

  it('should include evaluation context keys', () => {
    // Verify context.parameters.contextKeys lists available vars
  });

  it('should preserve original JSON Logic error', () => {
    // Verify originalError is from json-logic-js
  });
});
```

### Suite 4: Error Chain Preservation

```javascript
describe('Error Chain Preservation', () => {
  it('should maintain original error message', () => {
    // Trigger wrapped error
    // Verify originalError.message is preserved
  });

  it('should maintain original stack trace', () => {
    // Verify originalError.stack is preserved
  });

  it('should not double-wrap ScopeResolutionError', () => {
    // Throw ScopeResolutionError
    // Catch and re-throw
    // Verify not wrapped again
  });

  it('should preserve error chain through multiple layers', () => {
    // ParameterValidationError → ScopeResolutionError → Custom wrapper
    // Verify all layers accessible
  });
});
```

### Suite 5: Error Formatting Quality

```javascript
describe('Error Formatting Quality', () => {
  it('should format error with all context sections', () => {
    // Get formatted error via toString()
    // Verify contains: Scope, Phase, Parameters, Hint, Example
  });

  it('should include hints for common mistakes', () => {
    // Verify context extraction hint
    // Verify missing services hint
    // Verify invalid scope syntax hint
  });

  it('should provide actionable suggestions', () => {
    // Verify suggestions are concrete and implementable
  });

  it('should format parameters with proper indentation', () => {
    // Verify nested objects are readable
  });

  it('should include code examples', () => {
    // Verify examples show correct usage
  });

  it('should format stack trace excerpt', () => {
    // Verify first 5 lines of stack shown
  });
});
```

### Suite 6: Real-World Error Scenarios

```javascript
describe('Real-World Error Scenarios', () => {
  it('should help debug "action not discovered" issue', async () => {
    // Reproduce spec example: empty set mystery
    // Verify error explains why no actions found
  });

  it('should help debug "context object passed" issue', async () => {
    // Reproduce spec example: parameter type confusion
    // Verify error detects and explains the mistake
  });

  it('should help debug "scope not found" issue', () => {
    // Typo in scope name
    // Verify error suggests correct scope names
  });

  it('should help debug "missing components" issue', () => {
    // Filter expects component that doesn't exist
    // Verify error shows component status
  });
});
```

## Acceptance Criteria

### Error Wrapping Coverage
- ✅ Parameter validation errors wrapped
- ✅ Scope lookup errors wrapped
- ✅ Filter evaluation errors wrapped
- ✅ Generic scope errors wrapped
- ✅ All wrapping preserves original error

### Error Context Completeness
- ✅ Scope name always included
- ✅ Phase always included
- ✅ Parameters included when relevant
- ✅ Hints provided for common mistakes
- ✅ Examples provided when helpful

### Error Chain Integrity
- ✅ Original errors accessible via originalError
- ✅ Stack traces preserved
- ✅ No double-wrapping of ScopeResolutionError
- ✅ Error chain traversable

### Formatting Quality
- ✅ toString() output is human-readable
- ✅ Sections properly formatted
- ✅ Indentation consistent
- ✅ Examples properly displayed

### Real-World Utility
- ✅ Errors from spec examples provide helpful guidance
- ✅ Common mistakes detected and explained
- ✅ Suggestions are actionable

## Test Execution

```bash
# Run error wrapping integration tests
npm run test:integration -- tests/integration/scopeDsl/errorWrappingIntegration.test.js

# Run with verbose output to see error messages
npm run test:integration -- tests/integration/scopeDsl/errorWrappingIntegration.test.js --verbose

# Run all scopeDsl integration tests
npm run test:integration -- tests/integration/scopeDsl/
```

## Documentation Requirements

Add examples to:
- JSDoc in `ScopeResolutionError` class
- Error handling guide in `docs/testing/mod-testing-guide.md`
- Troubleshooting section with common error patterns

## Success Metrics

- ✅ All tests pass
- ✅ 100% coverage of error wrapping code paths
- ✅ No eslint errors
- ✅ Error messages verified as helpful (human review)

## Example Test Output

```javascript
✓ should wrap ParameterValidationError with scope context
✓ should include scope name in wrapped error
✓ should provide parameter extraction hint
✓ should preserve original error

Error message example:
ScopeResolutionError: Invalid parameter passed to scope resolver
  Scope: positioning:close_actors
  Phase: parameter extraction
  Parameters:
    contextType: object
    hasActorEntity: false
  💡 Hint: Extract actorEntity from context before passing...
  Example:
    const actorEntity = context.actorEntity || context.actor;
```

## References

- **Spec Section**: 7. Testing Strategy (lines 2236-2303)
- **Example Section**: 5. Usage Examples (lines 1837-2086)
- **Related Tickets**:
  - MODTESDIAIMP-006 (ScopeResolutionError class)
  - MODTESDIAIMP-007 (Error wrapping integration)
