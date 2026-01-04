# Test Infrastructure Migration Guide

This guide helps migrate tests from legacy patterns to the new test infrastructure APIs.

## Overview

The new test infrastructure provides:

1. **Fail-fast property access** - Immediate errors with suggestions for typos
2. **Simplified scope mocking** - 1-2 lines instead of 10+
3. **Public condition registration** - Replaces private `_loadedConditions` access
4. **Early validation** - Catches common mistakes before test execution

## Migration Checklist

### 1. Update Property Access (If Affected)

If you were using incorrect property names, the new strict proxy will catch them:

```javascript
// Before: Silent undefined, confusing error later
testEnv.scopeResolver.resolve(...);  // TypeError: Cannot read 'resolve' of undefined

// After: Immediate, helpful error
testEnv.scopeResolver;  // TestEnvPropertyError: Property 'scopeResolver' does not exist
                        // Did you mean: 'unifiedScopeResolver'?
```

### 2. Migrate Scope Mocking

```javascript
// Before (10+ lines)
const originalResolve = testEnv.unifiedScopeResolver.resolveSync;
testEnv.unifiedScopeResolver.__originalResolve = originalResolve;
testEnv.unifiedScopeResolver.resolveSync = function(scopeName, context) {
  if (scopeName === 'striking:actors_in_location_not_facing_away') {
    return new Set([target.id]);
  }
  return originalResolve.call(this, scopeName, context);
};

// After (1 line)
fixture.mockScope('striking:actors_in_location_not_facing_away', new Set([target.id]));
```

### 3. Migrate Condition Registration

```javascript
// Before (deprecated, logs warning)
testEnv._loadedConditions.set('test:my-condition', {
  logic: { '==': [{ var: 'entity.type' }, 'actor'] }
});

// After (public API)
fixture.registerCondition('test:my-condition', {
  logic: { '==': [{ var: 'entity.type' }, 'actor'] }
});
```

### 4. Update Action ID Format

```javascript
// Before: Would silently fail or produce confusing errors
ModTestFixture.forAction('positioning', 'sit_down');

// After: Immediate error with suggestion
// Error: Invalid action ID format: 'sit_down'.
//        Did you mean 'positioning:sit_down'?
ModTestFixture.forAction('positioning', 'positioning:sit_down');
```

## Common Patterns

### Pattern: Dynamic Scope Based on Context

```javascript
// Mock scope that returns different results based on context
fixture.mockScope('positioning:close_actors', (context) => {
  if (context.actor.hasComponent('positioning:sitting')) {
    return new Set([nearbySeatedActor.id]);
  }
  return new Set([nearbyStandingActor.id]);
});
```

### Pattern: Multiple Related Scope Mocks

```javascript
// Mock several related scopes for a complex scenario
fixture.mockScope('positioning:close_actors', new Set([actor1.id, actor2.id]));
fixture.mockScope('positioning:facing_actors', new Set([actor1.id]));
fixture.mockScope('positioning:reachable_actors', new Set([actor2.id]));
```

### Pattern: Condition with Complex Logic

```javascript
fixture.registerCondition('test:actor-can-attack', {
  logic: {
    'and': [
      { '!': [{ 'var': 'actor.components.positioning:sitting' }] },
      { '!': [{ 'var': 'actor.components.core:busy' }] },
      { '>': [{ 'var': 'actor.components.stats:stamina.current' }, 0] }
    ]
  },
  description: 'Actor can attack if standing, not busy, and has stamina'
});
```

## Troubleshooting

### Error: TestEnvPropertyError

**Symptom**: Error when accessing testEnv property

**Solution**: Check the property name. The error message includes suggestions and the full list of available properties.

### Error: Condition not found after registration

**Symptom**: Rule evaluation fails to find registered condition

**Solution**: Ensure condition ID includes namespace prefix (e.g., `'test:my-condition'`, not `'my-condition'`).

### Error: Scope mock not being used

**Symptom**: Original scope resolver is called instead of mock

**Solution**:
1. Verify scope name matches exactly (including namespace)
2. Ensure mock is set before the code that uses it
3. Check that another test isn't clearing mocks prematurely

### Error: Action ID format validation

**Symptom**: Error about non-namespaced action ID

**Solution**: Always use full namespaced IDs: `'modId:actionName'`

## Backward Compatibility

All existing patterns continue to work:

- Manual scope mocking with `__originalResolve` ✅
- Direct `_loadedConditions` access (with deprecation warning) ✅
- Existing factory method signatures ✅

Migration is optional and can be done incrementally.
