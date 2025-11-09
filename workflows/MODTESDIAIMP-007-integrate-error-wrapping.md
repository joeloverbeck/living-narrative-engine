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

### ⚠️ IMPORTANT: Existing Error Architecture

The codebase already has a comprehensive error handling system:
- **`ScopeDslErrorHandler`**: Centralized error handler at `src/scopeDsl/core/scopeDslErrorHandler.js`
- **`ScopeDslError`**: Standard error type used by the error handler
- **Integration**: Multiple resolvers already inject and use `errorHandler` dependency
- **Decision needed**: Should we integrate `ScopeResolutionError` with the existing `ScopeDslErrorHandler`, or run a parallel error system?

### Files to Modify

1. **Custom Scope Resolver** - `tests/common/mods/ModTestFixture.js`
2. **Scope Registry** - `src/scopeDsl/scopeRegistry.js` ✅ **EXISTS**
3. **FilterResolver** - `src/scopeDsl/nodes/filterResolver.js` ✅ **EXISTS** (uses `ScopeDslErrorHandler`)
4. **ScopeEngine** - `src/scopeDsl/engine.js` ✅ **EXISTS** (uses `ParameterValidator`)

### 1. Custom Scope Resolver Error Wrapping

**File**: `tests/common/mods/ModTestFixture.js`
**Location**: Lines 2235-2283 (custom resolver function)
**Current State**: Catches `ParameterValidationError` but does NOT wrap it - just returns error directly

**⚠️ CORRECTED IMPORT PATHS**:
```javascript
import { ScopeResolutionError } from '../../../src/scopeDsl/errors/scopeResolutionError.js';
import { ParameterValidationError } from '../../../src/scopeDsl/errors/parameterValidationError.js';

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

**File**: `src/scopeDsl/scopeRegistry.js`
**Current State**:
- `getScope()` method returns `null` when scope not found - does NOT throw
- Throws regular `Error` for non-namespaced scope names (validation errors)
- No `ScopeResolutionError` wrapping exists

**⚠️ ARCHITECTURAL DECISION NEEDED**:
The current design returns `null` for missing scopes rather than throwing. Changing this would be a **breaking change**. Consider:
1. Keep `getScope()` returning `null`, add new method `getScopeOrThrow()` that wraps with `ScopeResolutionError`
2. Or change `getScope()` to throw (breaking change - requires updating all callers)

**Proposed Implementation** (non-breaking):
```javascript
import { ScopeResolutionError } from './errors/scopeResolutionError.js'; // ⚠️ CORRECTED PATH

/**
 * Get a scope definition by name, throwing if not found
 *
 * @param {string} name - Scope name
 * @returns {object} Scope definition
 * @throws {ScopeResolutionError} If scope not found
 */
getScopeOrThrow(name) {
  const scopeData = this.getScope(name); // Uses existing getScope logic

  if (!scopeData) {
    throw new ScopeResolutionError(
      `Scope "${name}" not found`,
      {
        scopeName: name,
        phase: 'scope lookup',
        parameters: {
          requestedScope: name,
          registeredScopes: this.getAllScopeNames(), // Use existing method
        },
        hint: 'Check that the scope is registered and the name is correct',
        suggestion: 'Available scopes: ' +
          this.getAllScopeNames().slice(0, 5).join(', '),
      }
    );
  }

  return scopeData;
}
```

### 3. Filter Evaluation Error

**File**: `src/scopeDsl/nodes/filterResolver.js`
**Current State**:
- Uses factory function pattern: `createFilterResolver({ logicEval, entitiesGateway, locationProvider, errorHandler })`
- Already has `errorHandler` dependency injection (optional, for backward compatibility)
- Currently uses `errorHandler.handleError()` which throws `ScopeDslError`, NOT `ScopeResolutionError`
- Error handling at lines 259-277 for JSON Logic evaluation errors

**⚠️ INTEGRATION CHALLENGE**:
The resolver already uses `ScopeDslErrorHandler` system. Two approaches:
1. **Replace** `errorHandler.handleError()` calls with `ScopeResolutionError` (requires removing existing error handler)
2. **Enhance** `ScopeDslErrorHandler` to wrap errors in `ScopeResolutionError` internally

**Current Error Handling** (lines 259-277):
```javascript
} catch (error) {
  // Re-throw errors for missing condition references
  if (error.message && error.message.includes('Could not resolve condition_ref')) {
    if (errorHandler) {
      errorHandler.handleError(
        error,
        ctx,
        'FilterResolver',
        ErrorCodes.RESOLUTION_FAILED_GENERIC
      );
    } else {
      throw error;
    }
  }
  // Handle other errors gracefully - continue processing other items
}
```

**Proposed Enhancement** (wrapping approach):
```javascript
import { ScopeResolutionError } from '../errors/scopeResolutionError.js'; // ⚠️ CORRECTED PATH

// In the evaluate loop (around line 237):
try {
  const evalResult = logicEval.evaluate(node.logic, evalCtx);
  // ... rest of logic
} catch (err) {
  // Wrap JSON Logic errors with ScopeResolutionError
  const wrappedError = new ScopeResolutionError(
    'Filter logic evaluation failed',
    {
      phase: 'filter evaluation',
      parameters: {
        entityId: typeof item === 'string' ? item : item?.id,
        filterLogic: node.logic,
        contextKeys: evalCtx ? Object.keys(evalCtx) : [],
      },
      hint: 'Check that JSON Logic expression is valid and context has required fields',
      originalError: err,
    }
  );

  // Option 1: Throw directly (bypasses errorHandler)
  throw wrappedError;

  // Option 2: Pass to errorHandler (if we enhance it to handle ScopeResolutionError)
  // if (errorHandler) {
  //   errorHandler.handleError(wrappedError, ctx, 'FilterResolver', ErrorCodes.RESOLUTION_FAILED_GENERIC);
  // } else {
  //   throw wrappedError;
  // }
}
```

### 4. General Scope Resolution Errors

**File**: `src/scopeDsl/engine.js`
**Current State**:
- Uses `ParameterValidator` class (lines 293-295) which throws `ParameterValidationError`
- Validation happens at start of `resolve()` method with fail-fast pattern
- No general error wrapping for resolution failures

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
      scopeName: currentScope, // ⚠️ Need to track scope name in context
      phase: currentPhase,
      hint: 'Check scope syntax and entity components',
      originalError: err,
    }
  );
}
```

## ⚠️ CRITICAL ARCHITECTURAL DECISIONS

Before implementing this workflow, the following decisions must be made:

### Decision 1: Error Handler Integration Strategy

**Option A - Parallel Systems** (workflow's current assumption):
- Add `ScopeResolutionError` wrapping alongside existing `ScopeDslErrorHandler`
- Pro: Cleaner separation, richer error context
- Con: Two error systems running in parallel, potential confusion

**Option B - Integrate with Existing Handler**:
- Enhance `ScopeDslErrorHandler.handleError()` to wrap errors in `ScopeResolutionError`
- Pro: Single error system, consistent with existing architecture
- Con: More complex implementation

**Option C - Replace Existing Handler**:
- Remove `ScopeDslErrorHandler`, use only `ScopeResolutionError`
- Pro: Simpler, cleaner
- Con: Breaking change, requires updating all resolver factories

**Recommendation**: Choose based on project philosophy for error handling consistency.

### Decision 2: Breaking Changes in ScopeRegistry

**Current**: `getScope()` returns `null` when scope not found
**Workflow assumes**: Throwing errors for "not found" cases

**Options**:
1. Add new `getScopeOrThrow()` method (non-breaking)
2. Change `getScope()` to throw (breaking - requires updating all 10+ callers)

**Recommendation**: Option 1 (non-breaking) unless team prefers fail-fast everywhere.

### Decision 3: Scope Name Tracking

**Challenge**: To include `scopeName` in error context, we need to track it through resolution
**Current**: No scope name tracking in resolution context
**Required**: Add scope name to resolution context or AST metadata

**Options**:
1. Add `scopeName` field to resolution context
2. Store scope name in AST root during parsing
3. Pass scope name as parameter through resolver chain

**Recommendation**: Option 1 for minimal disruption.

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

**Depends on architectural decisions chosen**:

**If choosing Option A (Parallel Systems)**:
- ❌ **No breaking changes** - New error wrapping runs alongside existing system
- Existing `ScopeDslErrorHandler` continues to work
- Tests may need updates if they check error types

**If choosing Option B (Integrate with Handler)**:
- ⚠️ **Minor breaking changes** - Error type changes from `ScopeDslError` to `ScopeResolutionError`
- Tests checking `error instanceof ScopeDslError` need updates
- Error message format changes (enhanced context)

**If choosing Option C (Replace Handler)**:
- 🔴 **Major breaking changes** - Complete error system replacement
- All resolver factories need dependency injection updates
- All tests checking errors need updates
- Migration guide required for external code

### Test Updates Required

Tests checking exact error messages need updates:

```javascript
// Before
expect(error.message).toBe('Scope X not found');

// After (depends on chosen approach)
expect(error).toBeInstanceOf(ScopeResolutionError);
expect(error.context.scopeName).toBe('X');
expect(error.toString()).toContain('Scope X not found');
```

### Files Requiring Updates Based on Existing Usage

**Current `errorHandler` injection locations** (need decision on how to handle):
1. `src/scopeDsl/nodes/sourceResolver.js` - Has `errorHandler` parameter
2. `src/scopeDsl/nodes/stepResolver.js` - Has `errorHandler` parameter
3. `src/scopeDsl/nodes/filterResolver.js` - Has `errorHandler` parameter
4. `src/scopeDsl/nodes/scopeReferenceResolver.js` - Has `errorHandler` parameter
5. `src/scopeDsl/nodes/arrayIterationResolver.js` - Has `errorHandler` parameter
6. `src/scopeDsl/engine.js` - Constructs resolvers with `errorHandler`

**Action required**: Decide whether to:
- Keep `errorHandler` and make it wrap with `ScopeResolutionError`
- Remove `errorHandler` and use direct `ScopeResolutionError` throws
- Run both systems in parallel

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
  - MODTESDIAIMP-006 (ScopeResolutionError class) ✅ **COMPLETED**
  - MODTESDIAIMP-008 (Integration tests)

## Workflow Validation Summary

**Date**: 2025-11-09
**Status**: ⚠️ REQUIRES ARCHITECTURAL DECISIONS

### Assumptions Corrected

1. ✅ **Import paths corrected**: Changed from `core/` to `errors/` directory
2. ✅ **Line numbers updated**: ModTestFixture resolver is at lines 2235-2283, not ~2233
3. ✅ **File existence validated**: All target files exist
4. ✅ **Current implementations documented**: Each section now shows actual current state
5. ✅ **Existing error architecture documented**: `ScopeDslErrorHandler` system identified

### New Findings

1. 🆕 **Existing error handler system**: `ScopeDslErrorHandler` already in use across 5+ resolvers
2. 🆕 **Breaking change risk**: `ScopeRegistry.getScope()` returns `null`, not throws
3. 🆕 **Scope name tracking**: Not currently tracked in resolution context
4. 🆕 **Dual error systems**: Need decision on how `ScopeResolutionError` integrates with existing `ScopeDslError`

### Blockers Before Implementation

1. ⚠️ **Decision 1**: Error handler integration strategy (Options A/B/C)
2. ⚠️ **Decision 2**: Breaking changes approach for ScopeRegistry
3. ⚠️ **Decision 3**: Scope name tracking implementation
4. ⚠️ **Impact assessment**: Determine which option minimizes breaking changes

### Recommendations

1. **Prefer non-breaking changes**: Option A (Parallel Systems) + new `getScopeOrThrow()` method
2. **Add scope name to context**: Minimal disruption, enables rich error messages
3. **Gradual migration**: Keep both error systems during transition period
4. **Update tests incrementally**: Focus on high-value integration tests first
