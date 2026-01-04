# TESINFROB-006: Migration Guide and Test Updates

**Priority**: Low | **Effort**: Large

## Description

Create migration documentation and optionally update existing tests to use new APIs. This ticket documents the new patterns and provides an example migration.

## Files to Touch

- `docs/testing/mod-testing-guide.md` (modify)
- `docs/testing/test-infrastructure-migration.md` (create)
- `tests/integration/mods/striking/striking_facing_away_filter.test.js` (modify - example migration)

## Out of Scope

- **DO NOT** modify core infrastructure files (systemLogicTestEnv.js, ModTestFixture.js core)
- **DO NOT** break existing test patterns
- **DO NOT** force migration of all tests (optional upgrade)
- **DO NOT** remove support for manual mocking patterns
- **DO NOT** add new API methods (those are in TESINFROB-003, TESINFROB-004)

## Implementation Details

### 1. Update mod-testing-guide.md

Add new section to `docs/testing/mod-testing-guide.md`:

```markdown
## Scope Mocking (New API)

The `mockScope()` helper simplifies scope resolver mocking from 10+ lines to 1-2 lines.

### Basic Usage

```javascript
// Mock scope with static result
fixture.mockScope('positioning:close_actors', new Set(['actor-1', 'actor-2']));

// Mock scope with dynamic resolver
fixture.mockScope('positioning:close_actors', (context) => {
  return new Set([context.actor.id]);
});
```

### Multiple Mocks

```javascript
fixture.mockScope('scope:a', new Set(['a']));
fixture.mockScope('scope:b', new Set(['b']));
// Both mocks active simultaneously
```

### Cleanup

```javascript
// Automatic cleanup in afterEach
afterEach(() => {
  fixture.cleanup(); // Clears all scope mocks
});

// Manual cleanup mid-test
fixture.clearScopeMocks();
```

### Introspection

```javascript
fixture.isScopeMocked('my:scope');  // Returns boolean
fixture.getMockedScopes();          // Returns string[]
```

## Condition Registration (New API)

The `registerCondition()` API replaces direct access to `testEnv._loadedConditions`.

### Basic Usage

```javascript
fixture.registerCondition('test:always-true', {
  logic: { '==': [1, 1] },
  description: 'Test condition that always evaluates to true'
});
```

### In Rule Testing

```javascript
// Register condition before testing rule
fixture.registerCondition('test:actor-is-ready', {
  logic: { 'and': [
    { '==': [{ 'var': 'entity.type' }, 'actor'] },
    { '!': [{ 'var': 'entity.busy' }] }
  ]}
});

// Condition now available for rule evaluation
```

### Cleanup

```javascript
// Automatic cleanup
fixture.cleanup();

// Manual cleanup
fixture.clearRegisteredConditions();
```

### Introspection

```javascript
fixture.isConditionRegistered('test:my-condition');  // Returns boolean
fixture.getRegisteredConditions();                    // Returns string[]
```

## Deprecation Notices

### _loadedConditions (Deprecated)

Direct access to `testEnv._loadedConditions` is deprecated:

```javascript
// ❌ Deprecated - will log warning
testEnv._loadedConditions.set('test:condition', { logic: ... });

// ✅ Preferred
fixture.registerCondition('test:condition', { logic: ... });
```

### Manual Scope Mocking (Still Supported)

Manual scope mocking with `__originalResolve` pattern is still supported but verbose:

```javascript
// ❌ Verbose (10+ lines)
const originalResolve = testEnv.unifiedScopeResolver.resolveSync;
testEnv.unifiedScopeResolver.__originalResolve = originalResolve;
testEnv.unifiedScopeResolver.resolveSync = function(scopeName, context) {
  if (scopeName === 'my:scope') {
    return new Set([target.id]);
  }
  return originalResolve.call(this, scopeName, context);
};

// ✅ Preferred (1 line)
fixture.mockScope('my:scope', new Set([target.id]));
```
```

### 2. Create test-infrastructure-migration.md

Create `docs/testing/test-infrastructure-migration.md`:

```markdown
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
```

### 3. Migrate example test

Update `tests/integration/mods/striking/striking_facing_away_filter.test.js`:

```javascript
// Example migration showing before/after pattern

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Striking action facing away filter', () => {
  let fixture;
  let actor;
  let target;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'striking',
      'striking:punch_target'
    );

    // Create test entities
    actor = fixture.createActor('Test Actor');
    target = fixture.createActor('Test Target');
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('should filter out targets facing away from actor', async () => {
    // NEW: Use mockScope instead of manual resolver override
    fixture.mockScope(
      'striking:actors_in_location_not_facing_away',
      new Set([target.id])
    );

    // Execute action discovery
    const actions = await fixture.discoverActions(actor.id);

    // Verify target is available
    expect(actions).toContainEqual(
      expect.objectContaining({
        actionId: 'striking:punch_target',
        targetId: target.id,
      })
    );
  });

  it('should exclude targets when actor faces away', async () => {
    // NEW: Mock returns empty set (no valid targets)
    fixture.mockScope(
      'striking:actors_in_location_not_facing_away',
      new Set()
    );

    const actions = await fixture.discoverActions(actor.id);

    // No punch action should be available
    expect(actions).not.toContainEqual(
      expect.objectContaining({
        actionId: 'striking:punch_target',
      })
    );
  });
});
```

## Acceptance Criteria

### Tests that must pass

- All existing tests continue to pass
- `tests/integration/mods/striking/striking_facing_away_filter.test.js` passes with new API
- Documentation is accurate and builds without errors

### Invariants

- Documentation is accurate and helpful
- Old patterns still work (deprecated but functional)
- Migration is optional, not forced
- Example test demonstrates clear before/after improvement
- No runtime behavior changes for existing tests

## Verification

```bash
# Verify documentation builds (if applicable)
npm run docs:build

# Verify migrated test passes
npm run test:integration -- tests/integration/mods/striking/striking_facing_away_filter.test.js

# Verify no regressions
npm run test:unit
npm run test:integration
```

## Notes

This ticket is primarily documentation-focused. The example migration serves as:
1. Proof that the new APIs work in practice
2. Template for other test migrations
3. Documentation of the improvement (10+ lines → 1-2 lines)

Future migrations can be done incrementally as tests are modified for other reasons.
