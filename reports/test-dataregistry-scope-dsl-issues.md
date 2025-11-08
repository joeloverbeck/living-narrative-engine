# Report: DataRegistry and Scope DSL Testing Issues

**Date**: 2025-11-08
**Issue**: Integration tests for `sex-anal-penetration` mod failing due to DataRegistry API mismatch and Scope DSL resolution issues
**Impact**: Unable to test actions that use custom scopes with dependency mod conditions

## Summary

Two integration tests failed due to incorrect assumptions about the `dataRegistry` API in test environments:

1. `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`
2. `tests/integration/mods/sex-anal-penetration/insert_multiple_fingers_into_asshole_action_discovery.test.js`

## Root Causes Identified

### 1. DataRegistry `add()` Method Does Not Exist

**Problem**: Tests attempted to call `testFixture.testEnv.dataRegistry.add('condition', conditionObject)` to register dependency mod conditions, but this method does not exist in the mock dataRegistry.

**Location**: `tests/common/engine/systemLogicTestEnv.js` lines 116-141

**Current API**:
```javascript
const testDataRegistry = {
  getAllSystemRules: jest.fn(),
  getAllActionDefinitions: jest.fn(),
  getConditionDefinition: jest.fn(),  // Uses closure over conditions map
  getMacroDefinition: jest.fn(),
  getComponentDefinition: jest.fn(),
  get: jest.fn()
  // NO add() method
};
```

**What Tests Expected**:
```javascript
testFixture.testEnv.dataRegistry.add('condition', conditionObject);
```

**Resolution**:
- Fixed by extending the `getConditionDefinition` mock to handle the specific condition needed
- This is a workaround, not a proper solution

### 2. No Standard Way to Load Dependency Mod Conditions

**Problem**: When a mod's scope references conditions from dependency mods (e.g., positioning), there's no standard way to load those conditions into the test environment.

**Example**: The `sex-anal-penetration` mod's scope uses:
```javascript
{"condition_ref": "positioning:actor-in-entity-facing-away"}
```

This condition needs to be available in the dataRegistry for jsonLogic evaluation, but `ModTestFixture` doesn't provide a mechanism to load dependency conditions.

**Current Workaround**:
```javascript
// Manually load condition
const positioningCondition = await import('...condition.json');

// Extend mock
testFixture.testEnv.dataRegistry.getConditionDefinition = jest.fn((id) => {
  if (id === 'positioning:actor-in-entity-facing-away') {
    return positioningCondition.default;
  }
  return originalGetCondition(id);
});
```

This is fragile and requires each test to know about all transitive condition dependencies.

### 3. ScopeEngine Context Passing Issues

**Problem**: When manually registering scopes using `ScopeEngine.resolve()`, the context parameter expectations were unclear.

**Incorrect Code**:
```javascript
const actorEntity = context.actor || context.entity;
const result = scopeEngine.resolve(scopeAst, actorEntity, runtimeCtx);
```

**Correct Code**:
```javascript
const result = scopeEngine.resolve(scopeAst, context, runtimeCtx);
```

The scope DSL starts with `actor.`, so it needs the full context object with an `actor` property, not just the actor entity itself.

### 4. Custom JSON Logic Operators May Not Be Registered

**Problem**: The scope uses custom JSON Logic operators like `hasPartOfType` and `isSocketCovered`, but it's unclear if these are properly registered in the test environment's jsonLogic instance.

**Location**: Scope definition uses:
```javascript
{"hasPartOfType": [".", "asshole"]}
{"isSocketCovered": [".", "asshole"]}
```

## Recommended Solutions

### Short-Term (Immediate)

1. **Add DataRegistry Helper Method**
   ```javascript
   // In systemLogicTestEnv.js
   testDataRegistry.addCondition = (conditionId, conditionDef) => {
     conditions[conditionId] = conditionDef;
   };
   ```

2. **Document Scope Testing Pattern**
   - Add section to `docs/testing/mod-testing-guide.md` explaining how to load dependency conditions
   - Provide examples of manually registering custom scopes with ScopeEngine

### Mid-Term (Next Sprint)

1. **Enhance ModTestFixture API**
   ```javascript
   const fixture = await ModTestFixture.forAction(
     'sex-anal-penetration',
     'sex-anal-penetration:insert_finger_into_asshole',
     null,
     null,
     {
       autoRegisterScopes: true,
       scopeCategories: ['positioning'],
       additionalConditions: [
         'positioning:actor-in-entity-facing-away',
         'positioning:entity-not-in-facing-away'
       ]
     }
   );
   ```

2. **Auto-Load Dependency Conditions**
   - ModTestFixture should parse scope files to detect `condition_ref` usage
   - Automatically load referenced conditions from dependency mods
   - Cache loaded conditions to avoid redundant file reads

3. **Provide ScopeResolverHelpers for Custom Scopes**
   ```javascript
   // Instead of manual ScopeEngine setup
   ScopeResolverHelpers.registerCustomScope(
     testFixture.testEnv,
     'sex-anal-penetration',
     'actors_with_exposed_asshole_accessible_from_behind'
   );
   ```

### Long-Term (Next Quarter)

1. **Unified Scope Registration System**
   - Consolidate all scope registration logic
   - Provide clear contract for scope resolver implementations
   - Auto-detect and load scopes from `.scope` files

2. **Condition Dependency Graph**
   - Build dependency graph of conditions during mod loading
   - Automatically resolve and load transitive condition dependencies
   - Validate that all referenced conditions exist

3. **Integration Test Helpers**
   - Create specialized helpers for testing mods with custom scopes
   - Provide diagnostic tools for debugging scope resolution failures
   - Add validation that warns when condition_ref points to non-existent condition

## Testing Best Practices Moving Forward

1. **Use `autoRegisterScopes` when possible**
   ```javascript
   const fixture = await ModTestFixture.forAction(
     'violence',
     'violence:grab_neck',
     null,
     null,
     { autoRegisterScopes: true }
   );
   ```

2. **For custom scopes, prefer helper methods over manual ScopeEngine setup**
   - Manual setup is error-prone (context passing, operator registration, etc.)
   - Helper methods encapsulate complexity and prevent common mistakes

3. **Document condition dependencies in test files**
   ```javascript
   /**
    * This action uses custom scopes that reference:
    * - positioning:actor-in-entity-facing-away (condition)
    * - positioning:close_actors (scope)
    */
   ```

4. **Add integration tests for ScopeResolverHelpers**
   - Verify that all registered scopes work correctly
   - Test that condition_ref resolution works
   - Validate that custom operators are available

## Impact Analysis

**Current State**: Tests for mods with custom scopes are difficult to write and maintain

**Affected Tests**:
- `sex-anal-penetration` mod (2 tests failing)
- Potentially other mods using custom scopes with dependency conditions
- Any future mods that need similar patterns

**Developer Experience**:
- High barrier to entry for testing complex scopes
- Error messages don't clearly indicate the root cause
- Requires deep understanding of internal test infrastructure

## Conclusion

The issues stem from a mismatch between what the test infrastructure provides and what tests need when working with custom scopes and dependency mod conditions. The immediate fixes (manual mock extension and context passing corrections) work but are not sustainable for a growing codebase.

The recommended solutions focus on making the common case easy (auto-registration) while still supporting complex cases (manual registration with better helpers). This will improve developer experience and reduce the likelihood of similar issues in the future.

## References

- `tests/common/engine/systemLogicTestEnv.js` - Test environment setup
- `tests/common/mods/ModTestFixture.js` - Main fixture factory
- `tests/common/mods/scopeResolverHelpers.js` - Scope registration helpers
- `docs/testing/mod-testing-guide.md` - Testing documentation
- `src/scopeDsl/engine.js` - ScopeEngine implementation
