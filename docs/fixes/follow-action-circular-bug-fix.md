# Follow Action Circular Following Bug Fix

## Issue
The "core:follow" action was incorrectly allowing circular following relationships. For example, if Iker was already following Amaia, Amaia could still select "follow Iker" as a valid action, creating a circular dependency.

## Root Cause
The scope cache (`ScopeCache`) was generating cache keys that only included:
- Actor ID
- Location ID
- AST structure

It did **not** include the component state (following/leading relationships) that affects scope filtering. This meant that when following relationships changed, the cache would return stale results from before the relationship was established.

## Fix
Updated `ScopeCache._generateKey()` to include relevant component state in the cache key:
- For actors with `core:leading` component: includes sorted list of followers
- For actors with `core:following` component: includes the leader ID

This ensures the cache is invalidated whenever following/leading relationships change.

## Code Changes

### src/scopeDsl/cache.js
```javascript
// Added actorEntity parameter and component state to cache key
_generateKey(actorId, ast, runtimeCtx, actorEntity) {
  // ... existing code ...
  
  // Include relevant component state that affects scope evaluation
  let componentStateKey = '';
  if (actorEntity?.components) {
    const leadingComponent = actorEntity.components['core:leading'];
    const followingComponent = actorEntity.components['core:following'];
    
    if (leadingComponent?.followers) {
      // Sort followers for stable key generation
      const sortedFollowers = [...leadingComponent.followers].sort();
      componentStateKey += `:followers=${sortedFollowers.join(',')}`;
    }
    
    if (followingComponent?.leaderId) {
      componentStateKey += `:following=${followingComponent.leaderId}`;
    }
  }

  return `${actorId}:${locationId}:${astKey}${componentStateKey}`;
}
```

## Tests Added
- `tests/integration/actions/followActionCircularBug.test.js` - Demonstrates the bug
- `tests/integration/actions/followActionCacheFix.test.js` - Verifies the cache fix
- `tests/integration/cache/scopeCacheComponentState.test.js` - Integration test for component state in cache keys

## Verification
The fix ensures that:
1. Cache keys change when following/leading relationships change
2. Scope resolution correctly filters out entities that would create circular relationships
3. The "core:potential_leaders" scope properly excludes followers from being potential leaders