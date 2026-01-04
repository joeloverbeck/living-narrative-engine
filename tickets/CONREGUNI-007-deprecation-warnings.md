# CONREGUNI-007: Add Deprecation Warnings for Direct _loadedConditions Access

## Summary

Add console warnings when code directly accesses `testEnv._loadedConditions` or `fixture._loadedConditions` to guide developers toward using `conditionStore` instead.

## Priority: Low | Effort: Small

## Rationale

After unification, the `_loadedConditions` Maps are proxies to `conditionStore`. Direct access is deprecated but still works for backward compatibility. Warnings help guide migration to the correct API.

## Dependencies

- **Requires**: All prior tickets completed (CONREGUNI-001 through CONREGUNI-006)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/common/engine/systemLogicTestEnv.js` | Modify - Add warning to _loadedConditions getter |
| `tests/common/mods/ModTestFixture.js` | Modify - Add warning to _loadedConditions getter |
| `docs/testing/test-infrastructure-migration.md` | Update - Add deprecation notice |

## Out of Scope

- **DO NOT** remove `_loadedConditions` entirely - keep for backward compat
- **DO NOT** break any existing tests
- **DO NOT** modify the conditionStore itself
- **DO NOT** add warnings that trigger in production code

## Implementation Details

### In systemLogicTestEnv.js

Update the `_loadedConditions` property (added in CONREGUNI-003):

```javascript
// Legacy compatibility with deprecation warning
let _loadedConditionsWarningShown = false;
Object.defineProperty(returnObject, '_loadedConditions', {
  get() {
    if (!_loadedConditionsWarningShown) {
      console.warn(
        'DEPRECATED: testEnv._loadedConditions is deprecated and will be removed in a future version.\n' +
        'Use testEnv.conditionStore instead:\n' +
        '  - testEnv.conditionStore.register(id, def)\n' +
        '  - testEnv.conditionStore.has(id)\n' +
        '  - testEnv.conditionStore.get(id)\n' +
        '  - testEnv.conditionStore.unregister(id)\n' +
        '  - testEnv.conditionStore.clear()\n' +
        '\nSee docs/testing/test-infrastructure-migration.md for migration guide.'
      );
      _loadedConditionsWarningShown = true;
    }
    return {
      has: (id) => conditionStore.has(id),
      get: (id) => conditionStore.get(id),
      set: (id, def) => conditionStore.register(id, def),
      delete: (id) => conditionStore.unregister(id),
      clear: () => conditionStore.clear(),
    };
  },
  configurable: true,
});
```

### In ModTestFixture.js

Update the `_loadedConditions` property:

```javascript
// Legacy compatibility with deprecation warning
let _loadedConditionsWarningShown = false;
Object.defineProperty(this, '_loadedConditions', {
  get: () => {
    if (!_loadedConditionsWarningShown) {
      console.warn(
        'DEPRECATED: fixture._loadedConditions is deprecated and will be removed in a future version.\n' +
        'Use fixture.registerCondition() and related methods instead:\n' +
        '  - fixture.registerCondition(id, def)\n' +
        '  - fixture.isConditionRegistered(id)\n' +
        '  - fixture.getRegisteredConditions()\n' +
        '  - fixture.clearRegisteredConditions()\n' +
        '\nOr access testEnv.conditionStore directly for more control.\n' +
        'See docs/testing/test-infrastructure-migration.md for migration guide.'
      );
      _loadedConditionsWarningShown = true;
    }
    return {
      has: (id) => this.testEnv.conditionStore.has(id),
      get: (id) => this.testEnv.conditionStore.get(id),
      set: (id, def) => this.testEnv.conditionStore.register(id, def),
      delete: (id) => this.testEnv.conditionStore.unregister(id),
      clear: () => this.testEnv.conditionStore.clear(),
    };
  },
  configurable: true,
});
```

### Update docs/testing/test-infrastructure-migration.md

Add a section:

```markdown
## Deprecated: Direct _loadedConditions Access

As of the Condition Registry Unification (CONREGUNI), direct access to `_loadedConditions` is deprecated:

### Before (Deprecated)
```javascript
// Don't do this
testEnv._loadedConditions.set('my:condition', { logic: {...} });
fixture._loadedConditions.has('my:condition');
```

### After (Recommended)
```javascript
// For fixture-level operations
fixture.registerCondition('my:condition', { logic: {...} });
fixture.isConditionRegistered('my:condition');

// For direct store access
testEnv.conditionStore.register('my:condition', { logic: {...} });
testEnv.conditionStore.has('my:condition');
```

### Migration Steps

1. Replace `testEnv._loadedConditions.set()` with `fixture.registerCondition()` or `testEnv.conditionStore.register()`
2. Replace `testEnv._loadedConditions.has()` with `fixture.isConditionRegistered()` or `testEnv.conditionStore.has()`
3. Replace `testEnv._loadedConditions.get()` with `testEnv.conditionStore.get()`
4. Replace `testEnv._loadedConditions.delete()` with `testEnv.conditionStore.unregister()`
5. Replace `testEnv._loadedConditions.clear()` with `fixture.clearRegisteredConditions()` or `testEnv.conditionStore.clear()`

### Why This Changed

The `_loadedConditions` Map existed in two places (fixture and testEnv), causing synchronization issues. The new `conditionStore` provides a single source of truth.

See `specs/condition-registry-unification.md` for detailed background.
```

### Suppress Warning in Tests

Tests that intentionally test the deprecated behavior should suppress the warning:

```javascript
it('should still work via deprecated _loadedConditions', () => {
  const originalWarn = console.warn;
  console.warn = jest.fn(); // Suppress warning

  try {
    testEnv._loadedConditions.set('test:deprecated', { logic: { '==': [1, 1] } });
    expect(testEnv._loadedConditions.has('test:deprecated')).toBe(true);
  } finally {
    console.warn = originalWarn;
  }
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **All existing tests pass** (deprecation doesn't break functionality):
   ```bash
   npm run test:unit
   npm run test:integration
   ```

2. **Warning appears on first access** (can be verified manually or with spy):
   ```javascript
   it('should warn on first _loadedConditions access', () => {
     const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

     const fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
     void fixture._loadedConditions; // Access to trigger warning

     expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED'));

     warnSpy.mockRestore();
     fixture.cleanup();
   });
   ```

3. **Warning only appears once** (not spamming):
   ```javascript
   it('should only warn once per instance', () => {
     const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

     const fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
     void fixture._loadedConditions;
     void fixture._loadedConditions;
     void fixture._loadedConditions;

     expect(warnSpy).toHaveBeenCalledTimes(1);

     warnSpy.mockRestore();
     fixture.cleanup();
   });
   ```

### Invariants That Must Remain True

1. **Backward Compatibility**: `_loadedConditions` still works (just warns)
2. **Warning Once**: Warning only shown once per instance
3. **Tests Don't Break**: No test failures due to warnings
4. **Clear Message**: Warning includes migration path

## Verification Commands

```bash
# Verify all tests still pass
npm run test:unit
npm run test:integration

# Check that tests using _loadedConditions still work
npm run test:unit -- tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js --verbose
```

## Definition of Done

- [ ] Deprecation warning added to systemLogicTestEnv._loadedConditions
- [ ] Deprecation warning added to ModTestFixture._loadedConditions
- [ ] Warnings only fire once per instance
- [ ] Migration guide updated in docs
- [ ] All existing tests pass
- [ ] New tests verify warning behavior
