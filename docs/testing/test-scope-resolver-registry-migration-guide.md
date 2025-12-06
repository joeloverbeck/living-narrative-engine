# Migrating to Unified Test Scope Resolver Registry

**Status**: ✅ Implemented (Phase 1-2 Complete)
**Version**: 1.0.0
**Date**: 2025-11-08

## Overview

This guide helps you migrate from the fragmented scope registration pattern to the unified `TestScopeResolverRegistry` system for test infrastructure.

**Important:** This guide is for **test infrastructure only**. The production `ScopeRegistry` (`src/scopeDsl/scopeRegistry.js`) remains unchanged and serves a different purpose (storing scope definitions, not resolver functions).

## What Changed?

### Before (Old Pattern)

Scope registration was fragmented across multiple helper methods:

```javascript
// Manual registration for each category
ScopeResolverHelpers.registerPositioningScopes(testEnv);
ScopeResolverHelpers.registerInventoryScopes(testEnv);
ScopeResolverHelpers.registerAnatomyScopes(testEnv);

// Custom scopes required additional code
await ScopeResolverHelpers.registerCustomScope(
  testEnv,
  'my-mod',
  'my_custom_scope'
);
```

### After (New Pattern)

Unified registry with auto-discovery:

```javascript
// Single call to register all scopes from multiple mods
await testEnv.scopeResolverRegistry.discoverAndRegister([
  'positioning',
  'inventory',
  'anatomy',
  'my-mod',
]);

// Or use ModTestFixture's autoRegisterScopes option (backward compatible)
const fixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:sit_down',
  null,
  null,
  {
    autoRegisterScopes: true,
    scopeCategories: ['positioning', 'inventory'],
  }
);
```

## Migration Path

### Quick Migration (Recommended)

The old API still works! No immediate action required. However, new tests should use the unified pattern.

#### For Existing Tests

```javascript
// OLD (still works)
ScopeResolverHelpers.registerPositioningScopes(testEnv);

// NEW (recommended for new tests)
await testEnv.scopeResolverRegistry.discoverAndRegister(['positioning']);
```

#### For ModTestFixture Users

```javascript
// OLD (still works)
const fixture = await ModTestFixture.forAction('mod', 'action');
ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);

// NEW (cleaner, auto-discovery)
const fixture = await ModTestFixture.forAction('mod', 'action', null, null, {
  autoRegisterScopes: true,
  scopeCategories: ['positioning', 'inventory'],
});
```

## API Reference

### TestScopeResolverRegistry

Located at: `tests/common/engine/testScopeResolverRegistry.js`

#### Constructor

```javascript
import TestScopeResolverRegistry from '../../common/engine/testScopeResolverRegistry.js';

const registry = new TestScopeResolverRegistry({ logger: mockLogger });
```

#### register(resolver)

Register a single scope resolver.

```javascript
registry.register(myResolver);
```

#### registerBatch(resolvers)

Register multiple resolvers at once.

```javascript
registry.registerBatch([resolver1, resolver2, resolver3]);
```

#### async discoverAndRegister(modIds, options)

Auto-discover and register scopes from mod directories.

```javascript
// Register all scopes from mods
await registry.discoverAndRegister(['positioning', 'inventory', 'anatomy']);

// With category filter
await registry.discoverAndRegister(['positioning', 'inventory'], {
  categories: ['positioning'],
});
```

**Parameters:**

- `modIds` (string[]): Array of mod identifiers
- `options.categories` (string[]|null): Filter by categories (default: null = all)
- `options.loadConditions` (boolean): Whether to load condition dependencies (default: true)

**Returns:** Promise<number> - Number of scopes registered

#### get(scopeId)

Get a resolver by ID.

```javascript
const resolver = registry.get('positioning:close_actors');
```

#### getByCategory(category)

Get all resolvers for a category.

```javascript
const resolvers = registry.getByCategory('positioning');
```

#### resolve(scopeId, context, runtimeCtx)

Resolve a scope using the registered resolver.

```javascript
const entityIds = registry.resolve(
  'positioning:close_actors',
  { actor: myActor },
  { entityManager: em, logger: logger }
);
```

#### has(scopeId)

Check if a scope is registered.

```javascript
if (registry.has('positioning:close_actors')) {
  // Use the scope
}
```

#### list()

List all registered scope IDs (sorted).

```javascript
const allScopes = registry.list();
// ['items:actor_inventory_items', 'positioning:close_actors', ...]
```

#### listByCategory()

List scopes organized by category.

```javascript
const byCategory = registry.listByCategory();
// {
//   positioning: ['positioning:close_actors', 'positioning:sitting_actors'],
//   items: ['items:actor_inventory_items']
// }
```

#### clear()

Clear all registrations (useful in test cleanup).

```javascript
afterEach(() => {
  registry.clear();
});
```

#### count()

Get the number of registered resolvers.

```javascript
const total = registry.count();
```

## Benefits of Migration

### 1. Automatic Discovery

No need to manually register each scope - the registry discovers them from mod directories.

```javascript
// Before: Manual registration for each scope category
ScopeResolverHelpers.registerPositioningScopes(testEnv);
ScopeResolverHelpers.registerInventoryScopes(testEnv);
ScopeResolverHelpers.registerAnatomyScopes(testEnv);

// After: Auto-discover all at once
await registry.discoverAndRegister(['positioning', 'inventory', 'anatomy']);
```

### 2. Better Error Messages

Clear error messages when scopes are missing or resolution fails.

```javascript
// Before: Generic error
// After: "No resolver registered for scope 'positioning:close_actors'. Available scopes: ..."
```

### 3. Centralized Management

Single source of truth for all test scope resolvers.

```javascript
// Check what's registered
console.log(registry.list());
console.log(registry.listByCategory());
console.log(`Total: ${registry.count()} scopes`);
```

### 4. Performance Improvements

- Caching of scope definitions
- Efficient category indexing
- Dependency validation

### 5. Dependency Tracking

Registry tracks and validates dependencies between scopes.

```javascript
// Registry warns if dependencies are missing
const resolver = new CustomResolver({
  id: 'my:scope',
  dependencies: ['positioning:close_actors'], // Will validate this exists
});
```

## Testing Your Migration

### Unit Tests

Ensure your tests still pass after migration:

```bash
npm run test:unit -- tests/unit/yourModule.test.js
```

### Integration Tests

Run integration tests to verify end-to-end functionality:

```bash
npm run test:integration -- tests/integration/yourModule.test.js
```

### Full Test Suite

```bash
npm run test:ci
```

## Common Migration Scenarios

### Scenario 1: Basic Test with Manual Registration

**Before:**

```javascript
describe('My Action Test', () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = await createSystemLogicTestEnv();
    ScopeResolverHelpers.registerPositioningScopes(testEnv);
  });

  it('should work', () => {
    // test code
  });
});
```

**After:**

```javascript
describe('My Action Test', () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = await createSystemLogicTestEnv();
    await testEnv.scopeResolverRegistry.discoverAndRegister(['positioning']);
  });

  it('should work', () => {
    // test code
  });
});
```

### Scenario 2: ModTestFixture with Auto-Registration

**Before:**

```javascript
const fixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:sit_down'
);
ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
```

**After:**

```javascript
const fixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:sit_down',
  null,
  null,
  { autoRegisterScopes: true }
);
```

### Scenario 3: Multiple Categories

**Before:**

```javascript
ScopeResolverHelpers.registerPositioningScopes(testEnv);
ScopeResolverHelpers.registerInventoryScopes(testEnv);
ScopeResolverHelpers.registerAnatomyScopes(testEnv);
```

**After:**

```javascript
await testEnv.scopeResolverRegistry.discoverAndRegister([
  'positioning',
  'inventory',
  'anatomy',
]);
```

### Scenario 4: Custom Scopes

**Before:**

```javascript
await ScopeResolverHelpers.registerCustomScope(
  testEnv,
  'my-mod',
  'my_custom_scope'
);
```

**After:**

```javascript
// Custom scopes are auto-discovered if they exist in data/mods/my-mod/scopes/
await testEnv.scopeResolverRegistry.discoverAndRegister(['my-mod']);
```

## Advanced Usage

### Creating Custom Resolvers

```javascript
import BaseScopeResolver from '../../common/engine/baseScopeResolver.js';

class MyCustomResolver extends BaseScopeResolver {
  constructor() {
    super({
      id: 'my-mod:my_scope',
      category: 'my-mod',
      name: 'My Custom Scope',
      dependencies: ['positioning:close_actors'],
    });
  }

  resolve(context, runtimeCtx) {
    // Your resolution logic
    const { entityManager } = runtimeCtx;
    const { actor } = context;

    // Return a Set of entity IDs
    return new Set(['entity1', 'entity2']);
  }
}

// Register it
const resolver = new MyCustomResolver();
registry.register(resolver);
```

### Category Filtering

```javascript
// Only register positioning scopes
await registry.discoverAndRegister(['positioning', 'inventory', 'anatomy'], {
  categories: ['positioning'],
});
```

### Inspecting Registered Scopes

```javascript
// List all scopes
console.log('All scopes:', registry.list());

// List by category
console.log('By category:', registry.listByCategory());

// Check specific scope
if (registry.has('positioning:close_actors')) {
  const resolver = registry.get('positioning:close_actors');
  console.log('Resolver:', resolver.name);
  console.log('Category:', resolver.category);
  console.log('Dependencies:', resolver.dependencies);
}
```

## Backward Compatibility

### Existing APIs Still Work

All existing helper methods continue to work:

```javascript
// ✅ Still works (no deprecation warnings yet)
ScopeResolverHelpers.registerPositioningScopes(testEnv);
ScopeResolverHelpers.registerInventoryScopes(testEnv);
ScopeResolverHelpers.registerAnatomyScopes(testEnv);
ScopeResolverHelpers.registerCustomScope(testEnv, 'mod', 'scope');
```

### ModTestFixture Options Still Work

```javascript
// ✅ Still works
const fixture = await ModTestFixture.forAction(
  'mod',
  'action',
  ruleFile,
  conditionFile
);
ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
```

### Gradual Migration Strategy

1. **Phase 1** (Current): Both APIs available, no warnings
2. **Phase 2** (Q2 2025): Old helpers marked deprecated with console warnings
3. **Phase 3** (Q3 2025): All internal tests migrated to new system
4. **Phase 4** (Q4 2025): Old helpers removed (breaking change)

## Troubleshooting

### Scope Not Found

**Error:**

```
No resolver registered for scope "positioning:close_actors"
```

**Solution:**

```javascript
// Ensure you've registered the mod containing the scope
await registry.discoverAndRegister(['positioning']);

// Check what's registered
console.log(registry.list());
```

### Category Filter Not Working

**Issue:** Scopes from unwanted categories still appearing

**Explanation:** Category filtering is based on mod ID and scope name heuristics. If a scope is categorized incorrectly, it may still be included.

**Solution:**

```javascript
// Check what was registered
const byCategory = registry.listByCategory();
console.log(byCategory);

// If needed, clear and re-register with explicit categories
registry.clear();
await registry.discoverAndRegister(['positioning'], {
  categories: ['positioning'],
});
```

### Dependency Warnings

**Warning:**

```
Resolver "my:scope" depends on "other:scope" which is not yet registered
```

**Solution:**
Register dependencies before dependent scopes:

```javascript
// Register in dependency order
await registry.discoverAndRegister(['positioning']); // Dependencies first
await registry.discoverAndRegister(['my-mod']); // Then dependents
```

### Performance Issues

**Issue:** Registration taking too long

**Check:**

```javascript
const start = Date.now();
await registry.discoverAndRegister(['positioning']);
console.log(`Took ${Date.now() - start}ms`);
```

**Target:** Should be < 300ms for 50 scopes

**Solution:**

- Ensure scope files are not too large
- Check for parsing errors in scope definitions
- Report performance issues if consistently > 300ms

## FAQ

### Q: Do I need to migrate immediately?

**A:** No. The old API still works and will continue to work for the foreseeable future. New tests should use the new API.

### Q: What's the difference between test registry and production registry?

**A:**

- **Production ScopeRegistry** (`src/scopeDsl/scopeRegistry.js`): Stores scope **definitions** (ASTs from .scope files) for runtime evaluation
- **TestScopeResolverRegistry** (`tests/common/engine/`): Stores JavaScript **resolver functions** for common test patterns

They serve different purposes and don't conflict.

### Q: Can I use both old and new APIs in the same test?

**A:** Yes, but it's not recommended. Stick to one pattern per test file for clarity.

### Q: Will auto-discovery work for custom mods?

**A:** Yes! Place your .scope files in `data/mods/your-mod/scopes/` and they'll be discovered automatically.

### Q: How do I know if my test needs migration?

**A:** If you see:

```javascript
ScopeResolverHelpers.registerPositioningScopes(testEnv);
ScopeResolverHelpers.registerInventoryScopes(testEnv);
```

You can simplify to:

```javascript
await testEnv.scopeResolverRegistry.discoverAndRegister([
  'positioning',
  'inventory',
]);
```

But it's not required immediately.

### Q: Does this affect production code?

**A:** No. This is test infrastructure only. Production scope resolution is unchanged.

## Support

For questions or issues:

1. Check this guide first
2. Review existing tests for examples
3. See `tests/integration/common/testScopeResolverRegistry.integration.test.js` for usage patterns
4. Ask in development chat or create an issue

## Related Documentation

- [Test Scope Resolver Registry Architecture](./test-scope-resolver-registry-architecture.md) (coming soon)
- [Mod Testing Guide](./mod-testing-guide.md)
- [Scope DSL Documentation](../scope-dsl/)
