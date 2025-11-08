# MODTESDIAIMP-004: Integrate Parameter Validation into Resolvers and Test Fixtures

**Phase**: 1 - Parameter Validation
**Priority**: 🔴 Critical
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-001, MODTESDIAIMP-002

---

## Overview

Integrate parameter validation into scope resolvers (FilterResolver, SourceResolver) and test fixture custom scope registration to ensure consistent validation across the scope resolution system.

## Objectives

- Add validation to FilterResolver.resolve()
- Add validation to SourceResolver.resolve()
- Add validation to ModTestFixture custom scope resolver wrapper
- Add validation to ScopeResolverHelpers.registerCustomScope()
- Ensure consistent error messages across all entry points

## Implementation Details

### Files to Modify

1. **FilterResolver** - `src/scopeDsl/nodes/filterResolver.js`
2. **SourceResolver** - `src/scopeDsl/nodes/sourceResolver.js`
3. **ModTestFixture** - `tests/common/mods/ModTestFixture.js`
4. **ScopeResolverHelpers** - `tests/common/mods/scopeResolverHelpers.js`

### 1. FilterResolver Integration

**File**: `src/scopeDsl/nodes/filterResolver.js`
**Method**: `resolve(node, ctx)` (around line 78)

```javascript
import { ParameterValidator } from '../core/parameterValidator.js';

resolve(node, ctx) {
  const { actorEntity, dispatcher, trace } = ctx;

  // ADD VALIDATION
  ParameterValidator.validateActorEntity(actorEntity, 'FilterResolver.resolve');

  // Continue with existing logic
  // ...
}
```

### 2. SourceResolver Integration

**File**: `src/scopeDsl/nodes/sourceResolver.js`
**Method**: `resolve(node, ctx)` (around line 71)

```javascript
import { ParameterValidator } from '../core/parameterValidator.js';

resolve(node, ctx) {
  const { actorEntity, trace } = ctx;

  // ADD VALIDATION
  ParameterValidator.validateActorEntity(actorEntity, 'SourceResolver.resolve');

  // Continue with existing logic
  // ...
}
```

### 3. ModTestFixture Custom Scope Resolver

**File**: `tests/common/mods/ModTestFixture.js`
**Location**: Around line 2233 (custom resolver function)

```javascript
import { ParameterValidator } from '../../../src/scopeDsl/core/parameterValidator.js';

const resolver = (context) => {
  const runtimeCtx = {
    get entityManager() { return testEnv.entityManager; },
    get jsonLogicEval() { return testEnv.jsonLogic; },
    get logger() { return testEnv.logger; },
  };

  try {
    // Extract actorEntity from context
    const actorEntity = context.actorEntity || context.actor || context;

    // ADD VALIDATION - will throw ParameterValidationError if wrong type
    ParameterValidator.validateActorEntity(actorEntity, 'CustomScopeResolver');

    const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);
    return { success: true, value: result };
  } catch (err) {
    if (err instanceof ParameterValidationError) {
      // Enhanced error with context
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

### 4. ScopeResolverHelpers Integration

**File**: `tests/common/mods/scopeResolverHelpers.js`
**Function**: `registerCustomScope()` (similar pattern to ModTestFixture)

```javascript
import { ParameterValidator } from '../../../src/scopeDsl/core/parameterValidator.js';

// Add validation in custom resolver wrapper
// Similar pattern to ModTestFixture above
```

## Acceptance Criteria

### FilterResolver
- ✅ Import ParameterValidator
- ✅ Validate actorEntity at method start
- ✅ Source location is "FilterResolver.resolve"
- ✅ Existing logic unchanged

### SourceResolver
- ✅ Import ParameterValidator
- ✅ Validate actorEntity at method start
- ✅ Source location is "SourceResolver.resolve"
- ✅ Existing logic unchanged

### ModTestFixture
- ✅ Import ParameterValidator
- ✅ Validate extracted actorEntity
- ✅ Catch ParameterValidationError separately
- ✅ Return error with context for validation failures
- ✅ Source location is "CustomScopeResolver"

### ScopeResolverHelpers
- ✅ Import ParameterValidator
- ✅ Validate in custom scope wrapper
- ✅ Consistent error handling with ModTestFixture

## Testing Requirements

### Unit Tests

**1. FilterResolver Tests** (`tests/unit/scopeDsl/nodes/filterResolver.test.js`)
- Throw error for invalid actorEntity
- Throw error for context object
- Error message includes "FilterResolver.resolve"

**2. SourceResolver Tests** (`tests/unit/scopeDsl/nodes/sourceResolver.test.js`)
- Throw error for invalid actorEntity
- Throw error for context object
- Error message includes "SourceResolver.resolve"

**3. ModTestFixture Tests** (modify existing test file)
- Custom scope resolver detects context object
- Error includes helpful hint
- Error context accessible in result

### Integration Tests

**Test File**: `tests/integration/scopeDsl/parameterValidationIntegration.test.js` (new)

1. **End-to-End Validation Flow**
   - Test passes through ScopeEngine → Resolver chain
   - Verify validation catches errors at appropriate layer
   - Verify error messages maintained through call stack

2. **Custom Scope Resolver Validation**
   - Test ModTestFixture.registerCustomScope() with invalid params
   - Verify error includes "CustomScopeResolver" source
   - Verify context object detection works

## Migration Guide

### For Existing Tests

Most tests won't require changes as they already pass valid parameters.

Tests that **need updates**:
```javascript
// Before: Tests that intentionally pass invalid params
it('handles missing actorEntity', () => {
  const result = filterResolver.resolve(node, { actorEntity: undefined });
  // ... expect some error
});

// After: Update to expect ParameterValidationError
it('handles missing actorEntity', () => {
  expect(() => {
    filterResolver.resolve(node, { actorEntity: undefined });
  }).toThrow(ParameterValidationError);
});
```

## Performance Impact

- **Per-resolver overhead**: < 0.05ms
- **Total impact**: Negligible compared to scope evaluation
- **Benefit**: Prevents expensive evaluation on invalid input

## References

- **Spec Section**: 3.1 Integration Points (lines 472-553)
- **Related Files**:
  - `src/scopeDsl/nodes/filterResolver.js`
  - `src/scopeDsl/nodes/sourceResolver.js`
  - `tests/common/mods/ModTestFixture.js`
  - `tests/common/mods/scopeResolverHelpers.js`
- **Related Tickets**:
  - MODTESDIAIMP-001 (ParameterValidationError)
  - MODTESDIAIMP-002 (ParameterValidator)
  - MODTESDIAIMP-003 (ScopeEngine integration)
