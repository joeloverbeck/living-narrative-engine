# Migration Guide: Auto-Registration in ModTestFixture

## Overview
ModTestFixture now supports automatic scope registration, eliminating manual `ScopeResolverHelpers.register*Scopes()` calls.

## Migration Pattern

### Before (Manual Registration)
```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'violence:grab_neck');
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

### After (Auto-Registration)
```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    'violence',
    'violence:grab_neck',
    null,
    null,
    { autoRegisterScopes: true }
  );
});
```

**Benefits**:
- 2 lines → 1 line
- No import of ScopeResolverHelpers needed
- Explicit opt-in behavior
- Easy to forget → Impossible to forget

## When to Use Auto-Registration

✅ **Use Auto-Registration** when:
- Action uses standard positioning/inventory/anatomy scopes
- You want zero-config testing
- You're creating new tests

⚠️ **Use Manual Registration** when:
- Action uses custom scopes (not in standard library)
- You need fine-grained control over registered scopes
- Migrating existing tests (optional)

## Multiple Scope Categories

```javascript
// Before
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('intimacy', 'intimacy:caress_face');
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
});

// After
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    'intimacy',
    'intimacy:caress_face',
    null,
    null,
    {
      autoRegisterScopes: true,
      scopeCategories: ['positioning', 'anatomy']
    }
  );
});
```

## Backward Compatibility

No changes required to existing tests - auto-registration is opt-in. Your tests will continue to work with manual registration.

## Valid Scope Categories

- `'positioning'` - Sitting, standing, closeness, facing scopes (default)
- `'inventory'` or `'items'` - Item, container, inventory scopes
- `'anatomy'` - Body part, anatomy interaction scopes

## Common Migration Scenarios

### Scenario 1: Simple Positioning Action
```javascript
// Before
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});

// After
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    'positioning',
    'positioning:sit_down',
    null,
    null,
    { autoRegisterScopes: true }
  );
});
// No ScopeResolverHelpers import needed
```

### Scenario 2: Inventory Action
```javascript
// Before
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('items', 'items:pick_up_item');
  ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});

// After
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    'items',
    'items:pick_up_item',
    null,
    null,
    {
      autoRegisterScopes: true,
      scopeCategories: ['inventory', 'positioning']
    }
  );
});
```

### Scenario 3: Anatomy + Positioning
```javascript
// Before
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('intimacy', 'intimacy:caress_face');
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
});

// After
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    'intimacy',
    'intimacy:caress_face',
    null,
    null,
    {
      autoRegisterScopes: true,
      scopeCategories: ['positioning', 'anatomy']
    }
  );
});
```

## Troubleshooting

### Problem: Action not discovered after auto-registration
**Solution**: Verify you're using a valid scope category. Check the list of valid categories above.

### Problem: Tests fail with "scopeCategories must be an array"
**Solution**: Wrap category in array:
```javascript
// ❌ Wrong
{ scopeCategories: 'positioning' }

// ✅ Correct
{ scopeCategories: ['positioning'] }
```

### Problem: Tests fail with "Invalid scope categories"
**Solution**: Check spelling and use valid categories only (positioning, inventory, items, anatomy).

## Recommendations

1. **For New Tests**: Use auto-registration from the start
2. **For Existing Tests**: Optional migration - no breaking changes
3. **For Custom Scopes**: Continue using manual registration
4. **For CI/CD**: Both patterns work - choose based on team preference

## Related Documentation

- [Mod Testing Guide](./mod-testing-guide.md) - Main testing guide with auto-registration examples
- [Scope Resolver Registry](./scope-resolver-registry.md) - Complete scope documentation
- [Action Discovery Toolkit](./action-discovery-testing-toolkit.md) - Discovery testing patterns
