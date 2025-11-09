# MODTESDIAIMP-004: Integrate Parameter Validation into Test Fixtures

**Phase**: 1 - Parameter Validation
**Priority**: 🟡 Medium (reduced from Critical - production code already validates)
**Estimated Effort**: 1.5 hours (reduced from 3 hours)
**Dependencies**: MODTESDIAIMP-001, MODTESDIAIMP-002, MODTESDIAIMP-003

**⚠️ SCOPE REDUCED**: Original plan included production resolvers, but code analysis revealed they already have validation. Now focusing only on test helpers for better error messages.

---

## Overview

⚠️ **UPDATED AFTER CODE ANALYSIS**: This workflow has been revised based on actual production code analysis.

**Key Finding**: FilterResolver and SourceResolver already have comprehensive validation built-in (lines 93-138 and 75-109 respectively). Additionally, ScopeEngine.resolve() validates all parameters (AST, actorEntity, runtimeCtx) at lines 293-295 using ParameterValidator.

**Revised Scope**: Focus on test fixture helpers (ModTestFixture and ScopeResolverHelpers) where adding ParameterValidator can provide better error context BEFORE calling ScopeEngine.resolve().

## Objectives

- ~~Add validation to FilterResolver.resolve()~~ **REMOVED** - Already has comprehensive validation
- ~~Add validation to SourceResolver.resolve()~~ **REMOVED** - Already has comprehensive validation
- Add validation to ModTestFixture custom scope resolver wrapper for better error context
- Add validation to ScopeResolverHelpers.registerCustomScope() for better error context
- Provide helpful error messages when test fixtures are passed incorrect parameters

## Implementation Details

### Files to Modify

1. ~~**FilterResolver** - `src/scopeDsl/nodes/filterResolver.js`~~ **REMOVED** - Already validated
2. ~~**SourceResolver** - `src/scopeDsl/nodes/sourceResolver.js`~~ **REMOVED** - Already validated
3. **ModTestFixture** - `tests/common/mods/ModTestFixture.js` (line 2233-2263)
4. **ScopeResolverHelpers** - `tests/common/mods/scopeResolverHelpers.js` (line 1112-1131)

### ~~1. FilterResolver Integration~~ **REMOVED**

**Reason**: FilterResolver already has comprehensive validation at lines 93-138 in `src/scopeDsl/nodes/filterResolver.js`:
- Validates actorEntity is not undefined (lines 93-108)
- Validates actorEntity.id is valid string (lines 111-138)
- Detects spread issues and provides helpful error messages
- Uses errorHandler pattern for centralized error management

**No changes needed** - existing validation is more thorough than ParameterValidator.

### ~~2. SourceResolver Integration~~ **REMOVED**

**Reason**: SourceResolver already has comprehensive validation at lines 75-109 in `src/scopeDsl/nodes/sourceResolver.js`:
- Validates actorEntity exists (lines 75-91)
- Validates actorEntity.id is valid string (lines 93-109)
- Uses errorHandler pattern for centralized error management

**No changes needed** - existing validation is sufficient.

### 1. ModTestFixture Custom Scope Resolver

**File**: `tests/common/mods/ModTestFixture.js`
**Location**: Line 2233-2263 (custom resolver function in `registerCustomScope` method)

**Current State**: The resolver calls `scopeEngine.resolve()` which already validates actorEntity (via ParameterValidator at ScopeEngine.resolve:293-295).

**Enhancement Goal**: Add validation BEFORE the scopeEngine call to provide better error context in test fixtures with more helpful error messages specific to the test context.

```javascript
import { ParameterValidator } from '../../../src/scopeDsl/core/parameterValidator.js';
import { ParameterValidationError } from '../../../src/scopeDsl/errors/parameterValidationError.js';

const resolver = (context) => {
  const runtimeCtx = {
    get entityManager() { return testEnv.entityManager; },
    get jsonLogicEval() { return testEnv.jsonLogic; },
    get logger() { return testEnv.logger; },
  };

  try {
    // Extract actorEntity from context
    const actorEntity = context.actorEntity || context.actor || context;

    // ADD VALIDATION - Provides better error context in test environment
    // Note: ScopeEngine.resolve() also validates, but this catches errors earlier
    // with test-specific context
    ParameterValidator.validateActorEntity(actorEntity, `CustomScopeResolver[${fullScopeName}]`);

    const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);
    return { success: true, value: result };
  } catch (err) {
    if (err instanceof ParameterValidationError) {
      // Enhanced error with full context for test debugging
      return {
        success: false,
        error: err.toString(),
        context: err.context,
      };
    }

    return {
      success: false,
      error: `Failed to resolve scope "${fullScopeName}": ${err.message}`,
    };
  }
};
```

### 2. ScopeResolverHelpers Integration

**File**: `tests/common/mods/scopeResolverHelpers.js`
**Location**: Line 1112-1131 (resolver function in `registerCustomScope` static method)

**Current State**: The resolver calls `scopeEngine.resolve()` which already validates actorEntity.

**Enhancement Goal**: Add validation BEFORE the scopeEngine call, mirroring ModTestFixture pattern for consistency.

```javascript
import { ParameterValidator } from '../../../src/scopeDsl/core/parameterValidator.js';
import { ParameterValidationError } from '../../../src/scopeDsl/errors/parameterValidationError.js';

const resolver = (context) => {
  const runtimeCtx = {
    entityManager: testEnv.entityManager,
    jsonLogicEval: testEnv.jsonLogic,
    logger: testEnv.logger,
  };

  try {
    // Extract actorEntity from context
    const actorEntity = context.actorEntity || context.actor || context;

    // ADD VALIDATION - Provides better error context in test environment
    ParameterValidator.validateActorEntity(actorEntity, `ScopeResolverHelpers.registerCustomScope[${fullScopeName}]`);

    const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);
    return { success: true, value: result };
  } catch (err) {
    if (err instanceof ParameterValidationError) {
      // Enhanced error with full context for test debugging
      return {
        success: false,
        error: err.toString(),
        context: err.context,
      };
    }

    return {
      success: false,
      error: `Failed to resolve scope "${fullScopeName}": ${err.message}`,
    };
  }
};
```

## Acceptance Criteria

### ~~FilterResolver~~ **REMOVED**
- N/A - Already has comprehensive validation

### ~~SourceResolver~~ **REMOVED**
- N/A - Already has comprehensive validation

### ModTestFixture
- ✅ Import ParameterValidator and ParameterValidationError
- ✅ Validate extracted actorEntity BEFORE scopeEngine.resolve() call
- ✅ Catch ParameterValidationError separately for better error messages
- ✅ Return error with full context for validation failures
- ✅ Source location includes scope name: `CustomScopeResolver[${fullScopeName}]`
- ✅ Existing logic unchanged

### ScopeResolverHelpers
- ✅ Import ParameterValidator and ParameterValidationError
- ✅ Validate in custom scope wrapper BEFORE scopeEngine.resolve() call
- ✅ Consistent error handling with ModTestFixture
- ✅ Source location includes scope name: `ScopeResolverHelpers.registerCustomScope[${fullScopeName}]`
- ✅ Existing logic unchanged

## Testing Requirements

### Unit Tests

**~~1. FilterResolver Tests~~** **REMOVED**
- N/A - FilterResolver already has validation tests

**~~2. SourceResolver Tests~~** **REMOVED**
- N/A - SourceResolver already has validation tests

**1. ModTestFixture Tests** (`tests/unit/common/mods/ModTestFixture.test.js` or new test file)
- Custom scope resolver validates actorEntity before ScopeEngine call
- Custom scope resolver detects context object (with actor/targets properties)
- Custom scope resolver detects scope context (with runtimeCtx/dispatcher properties)
- Error includes helpful hint with expected vs received
- Error context accessible in result.context
- Error message includes scope name in source location
- Validation happens BEFORE ScopeEngine.resolve() is called (can verify with spy)

### Integration Tests

**Test File**: `tests/integration/common/mods/customScopeValidation.test.js` (new) or add to existing integration tests

1. **ModTestFixture Custom Scope Validation**
   - Test ModTestFixture.registerCustomScope() with invalid actorEntity
   - Test with context object (has actor/targets) - should fail with helpful message
   - Test with scope context (has runtimeCtx/dispatcher) - should fail with helpful message
   - Verify error includes scope name in source location
   - Verify error.context includes expected/received/hint/example
   - Verify validation fails BEFORE ScopeEngine.resolve() is invoked

2. **ScopeResolverHelpers Custom Scope Validation**
   - Test ScopeResolverHelpers.registerCustomScope() with invalid actorEntity
   - Verify consistent error handling with ModTestFixture
   - Verify error includes scope name in source location

## Migration Guide

### For Existing Tests

**No migration needed** - This workflow only adds validation to test helpers (ModTestFixture and ScopeResolverHelpers), not production code.

Existing tests using these helpers won't be affected because:
1. They already pass valid actorEntity parameters
2. The validation only triggers on invalid parameters
3. The enhancement provides better error messages if tests ARE passing wrong parameters

### For New Tests

When writing new tests with custom scopes, if you encounter validation errors:

```javascript
// ❌ Wrong: Passing action context instead of entity
const result = await fixture.resolveCustomScope('my:scope', {
  actor: actorEntity,
  targets: { primary: targetEntity }
});

// ✅ Correct: Pass entity directly
const result = await fixture.resolveCustomScope('my:scope', {
  actorEntity: actorEntity
});
```

## Performance Impact

**Production Code**: No performance impact - no changes to production resolvers.

**Test Code**:
- **Per-validation overhead**: < 0.05ms (only in test fixtures)
- **Impact**: Negligible - tests already call ScopeEngine.resolve() which validates
- **Benefit**: Better error messages during test development/debugging
- **Note**: Validation happens twice (test fixture + ScopeEngine), but only for test code

## References

- **Spec Section**: 3.1 Integration Points (lines 472-553)
- **Related Files**:
  - ~~`src/scopeDsl/nodes/filterResolver.js`~~ - Already has validation (lines 93-138)
  - ~~`src/scopeDsl/nodes/sourceResolver.js`~~ - Already has validation (lines 75-109)
  - `src/scopeDsl/engine.js` - Already validates at entry point (lines 293-295)
  - `src/scopeDsl/core/parameterValidator.js` - Parameter validation logic
  - `src/scopeDsl/errors/parameterValidationError.js` - Error class
  - `tests/common/mods/ModTestFixture.js` - Test fixture to enhance (lines 2233-2263)
  - `tests/common/mods/scopeResolverHelpers.js` - Test helper to enhance (lines 1112-1131)
- **Related Tickets**:
  - MODTESDIAIMP-001 (ParameterValidationError) - ✅ Complete
  - MODTESDIAIMP-002 (ParameterValidator) - ✅ Complete
  - MODTESDIAIMP-003 (ScopeEngine integration) - ✅ Complete

## Summary of Changes from Original Workflow

This workflow was significantly revised after analyzing the production code:

### What Changed
1. **Removed FilterResolver integration** - Already has comprehensive validation
2. **Removed SourceResolver integration** - Already has comprehensive validation
3. **Narrowed scope** - Focus only on test fixtures for better error messages
4. **Updated rationale** - Clarified that ScopeEngine already validates at entry point

### Why These Changes
- **Production code already validates**: ScopeEngine.resolve() validates all parameters (lines 293-295)
- **Resolvers have custom validation**: FilterResolver and SourceResolver have their own validation with errorHandler
- **Avoid redundancy**: Adding ParameterValidator to resolvers would duplicate existing validation
- **Test-focused enhancement**: Test fixtures benefit from early validation with better context

### Value Proposition
Instead of adding redundant validation to production code, we enhance test fixtures to provide:
- Better error messages during test development
- Earlier failure detection in test context
- Consistent error format across test helpers
- Helpful hints when tests pass wrong parameters
