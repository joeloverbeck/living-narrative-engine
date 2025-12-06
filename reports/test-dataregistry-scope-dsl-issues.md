# Report: DataRegistry and Scope DSL Testing Issues

**Date**: 2025-11-08
**Last Updated**: 2025-11-08 (Revised after codebase verification)
**Issue**: Integration tests for `sex-anal-penetration` mod failing due to DataRegistry API mismatch and Scope DSL resolution issues
**Impact**: Unable to test actions that use custom scopes with dependency mod conditions

> **⚠️ NOTE**: This report has been revised to correct inaccuracies in the initial analysis. Several features that were listed as "recommended solutions" actually **already exist** in the codebase. The revised report accurately reflects the current state and identifies the actual gaps.
>
> **Key Corrections Made**:
>
> - ✅ `autoRegisterScopes` feature already exists (was incorrectly listed as "Mid-Term" addition)
> - ✅ `scopeCategories` option already exists (was incorrectly listed as "Mid-Term" addition)
> - ✅ `ScopeResolverHelpers` library already exists with registration methods
> - ✅ Custom JSON Logic operators are automatically registered in tests
> - ✅ Real gap is specifically loading dependency conditions for custom scopes, not general scope registration

## Summary

Two integration tests initially failed but were fixed using existing workarounds:

1. `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`
2. `tests/integration/mods/sex-anal-penetration/insert_multiple_fingers_into_asshole_action_discovery.test.js`

**Status**: ✅ Tests now passing with manual workarounds

**Key Finding**: The test infrastructure already has robust support for most scenarios through `autoRegisterScopes` and `ScopeResolverHelpers`. The remaining gap is specifically around loading conditions from dependency mods when testing custom scopes.

## Verification Summary

**Features that ALREADY EXIST** ✅:

- `ModTestFixture.forAction()` with `autoRegisterScopes` option (lines 152-234 of ModTestFixture.js)
- `scopeCategories` option supporting positioning, inventory, items, anatomy
- `ScopeResolverHelpers.registerPositioningScopes()` and related methods
- Custom JSON Logic operators (`hasPartOfType`, `isSocketCovered`, etc.) automatically registered in tests
- `_registerResolvers()` method for custom scope registration

**Features that DO NOT EXIST** ❌:

- `dataRegistry.add()` or `dataRegistry.addCondition()` method
- Automatic loading of dependency mod conditions
- `ScopeResolverHelpers.registerCustomScope()` convenience method

## Root Causes Identified

### 1. DataRegistry `add()` Method Does Not Exist ✅ VERIFIED

**Problem**: Tests attempted to call `testFixture.testEnv.dataRegistry.add('condition', conditionObject)` to register dependency mod conditions, but this method does not exist in the mock dataRegistry.

**Location**: `tests/common/engine/systemLogicTestEnv.js` lines 116-141

**Current API**:

```javascript
const testDataRegistry = {
  getAllSystemRules: jest.fn(),
  getAllActionDefinitions: jest.fn(),
  getConditionDefinition: jest.fn(), // Uses closure over conditions map
  getMacroDefinition: jest.fn(),
  getComponentDefinition: jest.fn(),
  get: jest.fn(),
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

### 2. No Built-in Helper for Loading Dependency Mod Conditions ✅ VERIFIED

**Problem**: When a mod's custom scope references conditions from dependency mods (e.g., positioning), there's no convenience method to load those conditions. Standard scopes registered via `autoRegisterScopes` work fine, but custom mod-specific scopes that use `condition_ref` require manual workarounds.

**Example**: The `sex-anal-penetration` mod's custom scope uses:

```javascript
{"condition_ref": "positioning:actor-in-entity-facing-away"}
```

This condition needs to be available in the dataRegistry for jsonLogic evaluation. While `ModTestFixture` provides `autoRegisterScopes` for standard scopes, it doesn't automatically load conditions referenced by custom scopes.

**Current Workaround (Working Solution)**:

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

### 3. ScopeEngine Context Parameter Naming Can Be Confusing ⚠️ CLARIFIED

**Issue**: The `ScopeEngine.resolve()` method signature uses `actorEntity` as the parameter name, which might suggest passing only the entity. However, for scopes that start with `actor.`, you should pass a context object with an `actor` property.

**Method Signature** (src/scopeDsl/engine.js:290):

```javascript
resolve(ast, actorEntity, runtimeCtx, (trace = null));
```

**Correct Usage for Scopes Starting with `actor.`**:

```javascript
const context = { actor: actorEntityObject };
const result = scopeEngine.resolve(scopeAst, context, runtimeCtx);
```

**Note**: The parameter name `actorEntity` is somewhat misleading for this use case. The engine internally wraps it in a context object (line 329). For simple scopes, you can pass just the entity. For scopes with field access like `actor.name`, pass a context object.

### 4. Custom JSON Logic Operators Are Properly Registered

**Status**: ✅ NOT AN ISSUE - Custom operators are correctly registered in test environments.

**Details**: The scope uses custom JSON Logic operators like `hasPartOfType` and `isSocketCovered`. These operators ARE properly registered in the test environment.

**Location**:

- Scope definition uses: `{"hasPartOfType": [".", "asshole"]}` and `{"isSocketCovered": [".", "asshole"]}`
- Registration: `tests/common/engine/systemLogicTestEnv.js` lines 322-327
- Implementation: `src/logic/jsonLogicCustomOperators.js`
- Operator whitelisting: `src/logic/jsonLogicEvaluationService.js` lines 132, 137

**How it works**:

```javascript
const jsonLogicCustomOperators = new JsonLogicCustomOperators({
  logger: testLogger,
  entityManager,
  bodyGraphService: mockBodyGraphService,
});
jsonLogicCustomOperators.registerOperators(jsonLogic);
```

## Recommended Solutions

### Short-Term (Immediate)

1. **✅ ALREADY EXISTS: Use autoRegisterScopes Feature**

   The `ModTestFixture.forAction()` method already supports automatic scope registration:

   ```javascript
   const fixture = await ModTestFixture.forAction(
     'sex-anal-penetration',
     'sex-anal-penetration:insert_finger_into_asshole',
     null,
     null,
     {
       autoRegisterScopes: true,
       scopeCategories: ['positioning'], // Default: ['positioning']
     }
   );
   ```

   **Location**: `tests/common/mods/ModTestFixture.js` lines 152-234

   **Supported categories**: `positioning`, `inventory`, `items`, `anatomy`

2. **Document Current Workaround for Custom Scopes**
   - Add section to `docs/testing/mod-testing-guide.md` explaining how to load dependency conditions when using custom mod-specific scopes
   - Document the pattern of extending `dataRegistry.getConditionDefinition` mock
   - Provide examples of manually registering custom scopes with ScopeEngine

### Mid-Term (Next Sprint)

1. **Add Convenience Method for Loading Dependency Conditions** (NEW FEATURE PROPOSAL)

   ```javascript
   // Proposed API - does not currently exist
   testFixture.loadDependencyConditions([
     'positioning:actor-in-entity-facing-away',
     'positioning:entity-not-in-facing-away',
   ]);
   ```

   This would eliminate the need to manually extend the mock in tests.

2. **Auto-Load Dependency Conditions from Scope Files** (NEW FEATURE PROPOSAL)
   - Parse scope files to detect `condition_ref` usage
   - Automatically load referenced conditions from dependency mods
   - Cache loaded conditions to avoid redundant file reads

3. **Add Helper for Custom Scope Registration** (NEW FEATURE PROPOSAL)

   ```javascript
   // Proposed API - does not currently exist
   ScopeResolverHelpers.registerCustomScope(
     testFixture.testEnv,
     'sex-anal-penetration',
     'actors_with_exposed_asshole_accessible_from_behind'
   );
   ```

   This would simplify the current manual registration process (lines 36-68 in test file).

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

## Testing Best Practices (Current State)

### ✅ Available Now

1. **Use `autoRegisterScopes` for standard mod scopes**

   ```javascript
   const fixture = await ModTestFixture.forAction(
     'violence',
     'violence:grab_neck',
     null,
     null,
     { autoRegisterScopes: true, scopeCategories: ['positioning'] }
   );
   ```

   **Benefit**: Automatically registers all positioning scopes via `ScopeResolverHelpers.registerPositioningScopes()`.

2. **Use existing `ScopeResolverHelpers` methods for manual registration**

   ```javascript
   const fixture = await ModTestFixture.forAction('mod', 'action');
   ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
   ScopeResolverHelpers.registerInventoryScopes(fixture.testEnv);
   ScopeResolverHelpers.registerAnatomyScopes(fixture.testEnv);
   ```

   **Location**: `tests/common/mods/scopeResolverHelpers.js`

3. **For custom mod-specific scopes, use the manual ScopeEngine pattern**
   - Load scope file with `parseScopeDefinitions()`
   - Create resolver function that calls `scopeEngine.resolve()`
   - Register with `ScopeResolverHelpers._registerResolvers()`
   - See `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js` lines 36-68 for reference

### 🎯 Recommended Practices

1. **Document condition dependencies in test files**

   ```javascript
   /**
    * This action uses custom scopes that reference:
    * - positioning:actor-in-entity-facing-away (condition) - must be loaded manually
    * - positioning:close_actors (scope) - auto-registered with autoRegisterScopes
    */
   ```

2. **Extend dataRegistry mock for dependency conditions**

   ```javascript
   // Load condition from dependency mod
   const conditionDef = await import('...condition.json', {
     assert: { type: 'json' },
   });

   // Extend mock to return it
   const original = testFixture.testEnv.dataRegistry.getConditionDefinition;
   testFixture.testEnv.dataRegistry.getConditionDefinition = jest.fn((id) => {
     if (id === 'dependency:condition-id') return conditionDef.default;
     return original(id);
   });
   ```

3. **Custom operators are automatically available** - No special setup needed
   - All operators in `src/logic/jsonLogicCustomOperators.js` are registered automatically in test environments

## Impact Analysis

**Current State**: Testing standard mod scopes is well-supported, but testing custom mod-specific scopes with dependency conditions requires manual workarounds.

**What Works Well** ✅:

- Testing mods that use standard positioning/inventory/anatomy scopes
- Automatic scope registration via `autoRegisterScopes` option
- Custom JSON Logic operators are always available in tests
- Clear patterns for manual scope registration when needed

**What Needs Improvement** ⚠️:

- Loading conditions from dependency mods requires manual mock extension
- Custom mod-specific scopes need verbose manual registration (36+ lines of setup code)
- No helper method to simplify loading dependency conditions
- Documentation could be clearer about the different approaches

**Affected Tests**:

- `sex-anal-penetration` mod (2 tests) - required workarounds, now passing
- Potentially other mods using custom scopes with dependency conditions
- Any future mods that need similar patterns

**Developer Experience**:

- Standard cases: ✅ Excellent - one-line `autoRegisterScopes` option
- Custom scopes: ⚠️ Moderate - requires understanding of ScopeEngine and mock extension
- Error messages: Could be improved to guide developers to solutions

## Conclusion

The test infrastructure has strong support for common testing scenarios through the existing `autoRegisterScopes` feature and `ScopeResolverHelpers` library. The report initially misidentified these features as missing when they already exist.

**Actual Gap**: The remaining challenge is testing mods with **custom scopes that reference conditions from dependency mods**. This currently requires:

1. Manually loading the dependency condition file
2. Extending the dataRegistry mock to return it
3. Manually registering the custom scope with ScopeEngine

The recommended solutions focus on creating convenience helpers to reduce boilerplate for this specific pattern, while maintaining the flexibility for complex cases. The core infrastructure is solid; we need targeted improvements for the edge cases.

## References

- `tests/common/engine/systemLogicTestEnv.js` - Test environment setup
- `tests/common/mods/ModTestFixture.js` - Main fixture factory
- `tests/common/mods/scopeResolverHelpers.js` - Scope registration helpers
- `docs/testing/mod-testing-guide.md` - Testing documentation
- `src/scopeDsl/engine.js` - ScopeEngine implementation
