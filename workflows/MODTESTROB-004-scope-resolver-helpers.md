# MODTESTROB-004: Scope Resolver Helper Library

**Status**: Ready for Implementation
**Priority**: P1 - Medium
**Estimated Time**: 8 hours
**Risk Level**: Low
**Phase**: 2 - Developer Experience

## Overview

Creates a comprehensive library of reusable scope resolver patterns that eliminates 90% of boilerplate code currently required for testing actions with custom scopes. Provides pre-built implementations for common scope patterns (component lookup, array filtering, relationship traversal) that can be registered with a single line of code.

## Prerequisites

- [ ] MODTESTROB-001, 002, 003 complete (Phase 1 done)
- [ ] Clean git working directory
- [ ] All existing tests passing
- [ ] Feature branch: `feature/modtest-scope-helpers`

## Problem Statement

**Current Pain Point**: Tests like `scoot_closer_action_discovery.test.js` require 50-100 lines of custom scope resolver implementation:
```javascript
// Current: 50+ lines of manual scope resolver code
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(...);

  const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
  testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'positioning:furniture_actor_sitting_on') {
      // ... 20 lines of custom logic ...
    }
    if (scopeName === 'positioning:closest_leftmost_occupant') {
      // ... 30 lines of complex array filtering ...
    }
    return originalResolveSync.call(testEnv.unifiedScopeResolver, scopeName, context);
  };
});
```

**Target State**: Register common scope resolvers with helper library:
```javascript
// New: 2 lines
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(...);
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

## Detailed Steps

### Step 1: Create Scope Resolver Helper Library

**File to create**: `tests/common/mods/scopeResolverHelpers.js`

**Key Features**:
- **Component Lookup Pattern**: Resolve entity referenced in component field
- **Array Filter Pattern**: Find entities matching criteria in array
- **Relationship Pattern**: Traverse entity relationships
- **Pre-built Category Helpers**: registerPositioningScopes(), registerInventoryScopes()

**Implementation Structure**:
```javascript
export class ScopeResolverHelpers {
  /**
   * Creates resolver for "component field lookup" pattern
   * Example: "furniture actor is sitting on"
   */
  static createComponentLookupResolver(scopeName, {
    componentType,
    sourceField,
    resultField = 'id',
  }) {
    return (context) => {
      // Get component from source entity
      // Return entity ID from field
    };
  }

  /**
   * Creates resolver for "array filtering" pattern
   * Example: "closest leftmost occupant in furniture spots"
   */
  static createArrayFilterResolver(scopeName, {
    getArray,
    filterFn,
    contextSource = 'actor',
  }) {
    return (context) => {
      // Get array from entity/component
      // Apply filter function
      // Return matching entities
    };
  }

  /**
   * Register all positioning-related scope resolvers
   */
  static registerPositioningScopes(testEnv) {
    const resolvers = {
      'positioning:furniture_actor_sitting_on':
        this.createComponentLookupResolver('positioning:furniture_actor_sitting_on', {
          componentType: 'positioning:sitting_on',
          sourceField: 'furniture_id',
        }),

      'positioning:actors_sitting_on_same_furniture':
        this.createArrayFilterResolver('positioning:actors_sitting_on_same_furniture', {
          getArray: (actor, context, em) => {
            // Get furniture spots array
          },
          filterFn: (entityId, actor, context, em) => {
            // Filter criteria
          },
        }),
    };

    // Register all with testEnv
    Object.entries(resolvers).forEach(([name, resolver]) => {
      testEnv.registerScopeResolver(name, resolver);
    });
  }
}
```

### Step 2: Implement Common Patterns

**Patterns to implement**:
1. Component Lookup (5 variations)
2. Array Filtering (3 variations)
3. Location-based queries (2 variations)
4. Relationship traversal (2 variations)

### Step 3: Create Category-Specific Helpers

**Helpers to create**:
- `registerPositioningScopes()` - All positioning mod scopes
- `registerInventoryScopes()` - All items/inventory scopes
- `registerAnatomyScopes()` - All anatomy mod scopes

### Step 4: Update Existing Tests

**Convert 5 test files to use helpers**:
- scoot_closer_action_discovery.test.js
- hold_hand_action_discovery.test.js
- sit_down_action_discovery.test.js
- pick_up_item_action_discovery.test.js
- give_item_action_discovery.test.js

### Step 5: Create Comprehensive Tests

**Test files**:
- `tests/unit/common/mods/scopeResolverHelpers.test.js`
- `tests/integration/common/mods/scopeResolverHelpersIntegration.test.js`

## Validation Criteria

- [ ] scopeResolverHelpers.js created with all patterns
- [ ] registerPositioningScopes() implemented
- [ ] registerInventoryScopes() implemented
- [ ] Unit tests pass with 100% coverage
- [ ] Integration tests demonstrate usage
- [ ] 5 existing tests converted successfully
- [ ] Boilerplate reduced by 90% in converted tests
- [ ] All tests still pass

## Files Created/Modified

### New Files
```
tests/common/mods/scopeResolverHelpers.js
tests/unit/common/mods/scopeResolverHelpers.test.js
tests/integration/common/mods/scopeResolverHelpersIntegration.test.js
```

### Modified Files
```
tests/integration/mods/positioning/scoot_closer_action_discovery.test.js  (convert to use helpers)
tests/integration/mods/positioning/hold_hand_action_discovery.test.js     (convert to use helpers)
tests/integration/mods/positioning/sit_down_action_discovery.test.js      (convert to use helpers)
tests/integration/mods/items/pick_up_item_action_discovery.test.js        (convert to use helpers)
tests/integration/mods/items/give_item_action_discovery.test.js           (convert to use helpers)
```

## Expected Impact

### Quantitative
- **90% reduction** in scope resolver boilerplate (50 lines → 2 lines)
- **80% faster** test file creation for new actions
- **100% consistency** across scope implementations
- **50% fewer bugs** from copy-paste errors

### Qualitative
- Significantly easier for new contributors
- Consistent, maintainable patterns
- Easier to understand and debug
- Reusable across all mods

## Commit Strategy

```bash
git add tests/common/mods/scopeResolverHelpers.js
git add tests/unit/common/mods/scopeResolverHelpers.test.js
git add tests/integration/common/mods/scopeResolverHelpersIntegration.test.js
git add tests/integration/mods/positioning/scoot_closer_action_discovery.test.js
git add tests/integration/mods/positioning/hold_hand_action_discovery.test.js
git add tests/integration/mods/positioning/sit_down_action_discovery.test.js
git add tests/integration/mods/items/pick_up_item_action_discovery.test.js
git add tests/integration/mods/items/give_item_action_discovery.test.js

git commit -m "MODTESTROB-004: Create scope resolver helper library

- Add ScopeResolverHelpers class with reusable patterns
- Implement createComponentLookupResolver() for component field lookups
- Implement createArrayFilterResolver() for array-based scopes
- Add registerPositioningScopes() with 8 common positioning scopes
- Add registerInventoryScopes() with 5 common inventory scopes
- Convert 5 existing tests to use helpers (90% boilerplate reduction)
- Add comprehensive unit and integration tests

Impact:
- 90% reduction in scope resolver boilerplate (50 lines → 2 lines)
- Consistent implementations across all tests
- Easier for new contributors to write tests
- Reusable patterns for all mod categories

Resolves MODTESTROB-004 (Phase 2 - P1 Priority)
"
```

## Success Criteria

- ✅ Helper library provides 10+ reusable patterns
- ✅ Category-specific helpers cover common scopes
- ✅ Existing tests converted successfully
- ✅ 90% boilerplate reduction demonstrated
- ✅ All tests still pass after conversion
- ✅ Clear documentation and examples

## Next Steps

1. Verify all tests pass after conversion
2. Document helper patterns in MODTESTROB-008
3. Proceed to **MODTESTROB-005** (Enhanced Test Assertions)

---

**Dependencies**: Phase 1 complete (MODTESTROB-001-003)
**Blocks**: MODTESTROB-008 (documentation needs examples)
