# MODTESDIAIMP-007: Integrate Error Wrapping Across Scope System

**Phase**: 2 - Enhanced Error Context
**Priority**: 🔴 Critical
**Estimated Effort**: 4 hours
**Dependencies**: MODTESDIAIMP-006

---

## Overview

Wrap scope resolution errors with `ScopeResolutionError` throughout the scope system to provide consistent, context-rich error messages that aid debugging.

## Objectives

- Wrap parameter validation errors with scope context
- Wrap scope lookup failures with registered scope info
- Wrap filter evaluation errors with entity context
- Ensure consistent error format across all failure modes
- Preserve original errors in error chain

## Implementation Details

### Files to Modify

1. **Custom Scope Resolver** - `tests/common/mods/ModTestFixture.js`
2. **Scope Registry** - `src/scopeDsl/scopeRegistry.js` (if exists)
3. **FilterResolver** - `src/scopeDsl/nodes/filterResolver.js`
4. **ScopeEngine** - `src/scopeDsl/engine.js`

### 1. Custom Scope Resolver Error Wrapping

**File**: `tests/common/mods/ModTestFixture.js`
**Location**: Around line 2233 (custom resolver function)

```javascript
import { ScopeResolutionError } from '../../../src/scopeDsl/core/scopeResolutionError.js';
import { ParameterValidationError } from '../../../src/scopeDsl/core/parameterValidationError.js';

const resolver = (context) => {
  const runtimeCtx = { /* ... */ };

  try {
    const actorEntity = context.actorEntity || context.actor || context;

    ParameterValidator.validateActorEntity(actorEntity, 'CustomScopeResolver');

    const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);
    return { success: true, value: result };
  } catch (err) {
    // Wrap with enhanced context
    if (err instanceof ParameterValidationError) {
      const wrappedError = new ScopeResolutionError(
        'Invalid parameter passed to scope resolver',
        {
          scopeName: fullScopeName,
          phase: 'parameter extraction',
          parameters: {
            contextType: typeof context,
            hasActorEntity: !!context.actorEntity,
            hasActor: !!context.actor,
            extractedType: typeof actorEntity,
          },
          expected: 'Entity instance with id property',
          received: 'Full context object with actor, targets properties',
          hint: 'Extract actorEntity from context before passing to ScopeEngine.resolve()',
          suggestion: 'Use: const actorEntity = context.actorEntity || context.actor',
          example:
            'const actorEntity = context.actorEntity || context.actor;\n' +
            'const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);',
          originalError: err,
        }
      );

      return {
        success: false,
        error: wrappedError.toString(),
        context: wrappedError.context,
      };
    }

    // Wrap other errors
    return {
      success: false,
      error: `Failed to resolve scope "${fullScopeName}": ${err.message}`,
      originalError: err,
    };
  }
};
```

### 2. Scope Not Found Error

**File**: `src/scopeDsl/scopeRegistry.js` or equivalent
**Pattern**: Wrap "scope not found" errors

```javascript
import { ScopeResolutionError } from './core/scopeResolutionError.js';

if (!scopeData) {
  throw new ScopeResolutionError(
    `Scope "${fullScopeName}" not found`,
    {
      scopeName: fullScopeName,
      phase: 'scope lookup',
      parameters: {
        requestedScope: fullScopeName,
        registeredScopes: Array.from(scopeRegistry.keys()),
      },
      hint: 'Check that the scope is registered and the name is correct',
      suggestion: 'Available scopes: ' +
        Array.from(scopeRegistry.keys()).slice(0, 5).join(', '),
    }
  );
}
```

### 3. Filter Evaluation Error

**File**: `src/scopeDsl/nodes/filterResolver.js`
**Method**: `resolve(node, ctx)` - filter evaluation try/catch

```javascript
import { ScopeResolutionError } from '../core/scopeResolutionError.js';

try {
  const result = logicEval.evaluate(node.logic, evalCtx);
} catch (err) {
  throw new ScopeResolutionError(
    'Filter logic evaluation failed',
    {
      scopeName: currentScopeName,
      phase: 'filter evaluation',
      parameters: {
        entityId: item.id,
        filterLogic: node.logic,
        contextKeys: Object.keys(evalCtx),
      },
      hint: 'Check that JSON Logic expression is valid and context has required fields',
      originalError: err,
    }
  );
}
```

### 4. General Scope Resolution Errors

**Pattern**: Wrap any scope-related errors with context

```javascript
catch (err) {
  if (err instanceof ScopeResolutionError) {
    // Already wrapped, re-throw
    throw err;
  }

  // Wrap generic errors
  throw new ScopeResolutionError(
    'Scope resolution failed',
    {
      scopeName: currentScope,
      phase: currentPhase,
      hint: 'Check scope syntax and entity components',
      originalError: err,
    }
  );
}
```

## Acceptance Criteria

### Custom Scope Resolver
- ✅ ParameterValidationError wrapped with scope context
- ✅ Error includes scope name, phase, parameters
- ✅ Hint explains parameter extraction
- ✅ Example shows correct usage
- ✅ Original error preserved

### Scope Lookup
- ✅ "Not found" errors wrapped with registered scopes list
- ✅ Suggestions include available scope names
- ✅ Error indicates spelling/registration issue

### Filter Evaluation
- ✅ JSON Logic errors wrapped with entity context
- ✅ Filter logic included in error
- ✅ Evaluation context keys listed
- ✅ Hint suggests validation approach

### Error Consistency
- ✅ All scope errors use ScopeResolutionError
- ✅ Already-wrapped errors not double-wrapped
- ✅ Stack traces preserved through wrapping

## Testing Requirements

**Test File**: `tests/integration/scopeDsl/errorWrappingIntegration.test.js` (new)

### Test Cases

```javascript
describe('Error Wrapping Integration', () => {
  describe('Parameter validation errors', () => {
    it('should wrap validation errors with scope context')
    it('should include scope name in wrapped error')
    it('should provide parameter extraction hint')
    it('should preserve original ParameterValidationError')
  });

  describe('Scope not found errors', () => {
    it('should wrap with registered scopes list')
    it('should provide spelling suggestion')
    it('should include phase: scope lookup')
  });

  describe('Filter evaluation errors', () => {
    it('should wrap JSON Logic errors')
    it('should include entity ID in context')
    it('should include filter logic in context')
    it('should preserve original evaluation error')
  });

  describe('Error chain preservation', () => {
    it('should maintain original error message')
    it('should maintain original stack trace')
    it('should not double-wrap ScopeResolutionError')
  });

  describe('Error formatting', () => {
    it('should format error with all context sections')
    it('should include hints and suggestions')
    it('should provide actionable error messages')
  });
});
```

## Migration Impact

### Breaking Changes
- **None** - Only enhances error messages for failures

### Test Updates Required
Tests checking exact error messages need updates:

```javascript
// Before
expect(error.message).toBe('Scope X not found');

// After
expect(error).toBeInstanceOf(ScopeResolutionError);
expect(error.context.scopeName).toBe('X');
expect(error.toString()).toContain('Scope X not found');
```

## Example Error Outputs

### Before (Generic)
```
Error: Failed to resolve scope "positioning:close_actors"
  at CustomScopeResolver (ModTestFixture.js:2245)
```

### After (Enhanced)
```
ScopeResolutionError: Invalid parameter passed to scope resolver
  Scope: positioning:close_actors
  Phase: parameter extraction
  Parameters:
    contextType: object
    hasActorEntity: false
    hasActor: true
    extractedType: object
  💡 Hint: Extract actorEntity from context before passing to ScopeEngine.resolve()
  Example:
    const actorEntity = context.actorEntity || context.actor;
    const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);
  Original Error: ParameterValidationError: actorEntity has invalid 'id' property
```

## References

- **Spec Section**: 3.2 Enhanced Error Context (lines 557-735)
- **Integration Examples**: Usage Examples 1, 2, 3 (lines 664-735)
- **Related Tickets**:
  - MODTESDIAIMP-006 (ScopeResolutionError class)
  - MODTESDIAIMP-008 (Integration tests)
