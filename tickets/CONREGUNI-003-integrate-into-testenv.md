# CONREGUNI-003: Integrate TestConditionStore into systemLogicTestEnv

## Summary

Wire the `TestConditionStore` (created in CONREGUNI-002) into `systemLogicTestEnv.js` so that all test environments have access to a unified condition store via `testEnv.conditionStore`.

## Priority: High | Effort: Medium

## Rationale

The test environment factory is the natural place to instantiate shared infrastructure. By providing `conditionStore` at the environment level:
- All fixture types can access the same store
- Cleanup is centralized
- The override is installed once, early in test setup

## Dependencies

- **Requires**: CONREGUNI-002 (TestConditionStore class exists)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/common/engine/systemLogicTestEnv.js` | Modify - Add conditionStore creation and exposure |
| `tests/unit/common/engine/systemLogicTestEnv.test.js` | Modify - Add tests for conditionStore integration |

## Out of Scope

- **DO NOT** modify ModTestFixture - that's CONREGUNI-004
- **DO NOT** modify ScopeResolverHelpers - that's CONREGUNI-005
- **DO NOT** remove `_loadedConditions` yet - backward compatibility for migration
- **DO NOT** add deprecation warnings - that's CONREGUNI-007

## Implementation Details

### In systemLogicTestEnv.js

#### 1. Import the store

Near the top of the file (after existing imports):

```javascript
import TestConditionStore from './TestConditionStore.js';
```

#### 2. Instantiate the store after dataRegistry creation

In the factory function, after `testDataRegistry` is created (around line 322), add:

```javascript
// Create unified condition store for test infrastructure
const conditionStore = new TestConditionStore(testDataRegistry);
```

#### 3. Add to the returned testEnv object

In the return object (around line 1469-1547), add:

```javascript
return {
  // ... existing properties ...
  dataRegistry: testDataRegistry,
  conditionStore, // NEW: Unified condition storage
  // ... rest of properties ...
};
```

#### 4. Add conditionStore to cleanup

If there's an existing cleanup mechanism, ensure conditionStore.restore() is called:

```javascript
cleanup: () => {
  conditionStore.restore();
  // ... existing cleanup ...
}
```

### Example of Updated Factory Section

```javascript
// Around line 320-350 in the factory function
const testDataRegistry =
  dataRegistry ||
  (typeof createDataRegistry === 'function'
    ? createDataRegistry()
    : {
        getAllSystemRules: jest.fn().mockReturnValue(expandedRules),
        getAllActionDefinitions: jest.fn().mockReturnValue(actions),
        getConditionDefinition: jest
          .fn()
          .mockImplementation((conditionId) => {
            return conditions[conditionId] || undefined;
          }),
        // ... other methods
      });

// NEW: Create unified condition store
const conditionStore = new TestConditionStore(testDataRegistry);
```

### Backward Compatibility

Keep `_loadedConditions` as a deprecated property that proxies to conditionStore:

```javascript
// DEPRECATED: Legacy access pattern, use conditionStore instead
Object.defineProperty(returnObject, '_loadedConditions', {
  get() {
    console.warn(
      'DEPRECATED: testEnv._loadedConditions is deprecated. Use testEnv.conditionStore instead.'
    );
    // Return a Map-like proxy that delegates to conditionStore
    return {
      has: (id) => conditionStore.has(id),
      get: (id) => conditionStore.get(id),
      set: (id, def) => conditionStore.register(id, def),
      delete: (id) => conditionStore.unregister(id),
      clear: () => conditionStore.clear(),
    };
  }
});
```

**Note**: The deprecation warning is actually for CONREGUNI-007. For this ticket, just add the property without the warning:

```javascript
// Legacy compatibility - will be deprecated in CONREGUNI-007
_loadedConditions: {
  has: (id) => conditionStore.has(id),
  get: (id) => conditionStore.get(id),
  set: (id, def) => conditionStore.register(id, def),
  delete: (id) => conditionStore.unregister(id),
  clear: () => conditionStore.clear(),
},
```

## Acceptance Criteria

### Tests That Must Pass

1. **Existing systemLogicTestEnv tests pass:**
   ```bash
   npm run test:unit -- tests/unit/common/engine/systemLogicTestEnv.test.js --verbose
   ```

2. **New integration tests:**
   ```javascript
   describe('conditionStore integration', () => {
     it('should expose conditionStore on testEnv', () => {
       const testEnv = createSystemLogicTestEnv({ /* minimal config */ });

       expect(testEnv.conditionStore).toBeDefined();
       expect(typeof testEnv.conditionStore.register).toBe('function');
       expect(typeof testEnv.conditionStore.has).toBe('function');
     });

     it('should allow registering conditions via conditionStore', () => {
       const testEnv = createSystemLogicTestEnv({ /* minimal config */ });

       testEnv.conditionStore.register('test:via-store', { logic: { '==': [1, 1] } });

       expect(testEnv.dataRegistry.getConditionDefinition('test:via-store')).toBeDefined();
     });

     it('should provide _loadedConditions for backward compatibility', () => {
       const testEnv = createSystemLogicTestEnv({ /* minimal config */ });

       testEnv._loadedConditions.set('test:legacy', { logic: { '==': [1, 1] } });

       expect(testEnv.conditionStore.has('test:legacy')).toBe(true);
     });
   });
   ```

3. **All existing tests pass** (store is wired but not yet used by fixtures):
   ```bash
   npm run test:unit -- --testPathPattern="common" --verbose
   npm run test:integration -- tests/integration/mods/striking/ --verbose
   ```

### Invariants That Must Remain True

1. **Backward Compatibility**: `testEnv._loadedConditions` still works (proxies to store)
2. **Single Override**: Only one `getConditionDefinition` override installed
3. **Centralized Cleanup**: `conditionStore.restore()` called during environment cleanup
4. **All Tests Pass**: Existing infrastructure tests unchanged

## Verification Commands

```bash
# Run systemLogicTestEnv tests
npm run test:unit -- tests/unit/common/engine/systemLogicTestEnv.test.js --verbose

# Run all engine tests
npm run test:unit -- tests/unit/common/engine/ --verbose

# Run integration tests that create test environments
npm run test:integration -- tests/integration/mods/striking/ --verbose

# Run full unit test suite to ensure no regressions
npm run test:unit
```

## Definition of Done

- [ ] `TestConditionStore` imported into systemLogicTestEnv.js
- [ ] `conditionStore` created after dataRegistry
- [ ] `conditionStore` exposed on returned testEnv object
- [ ] `_loadedConditions` proxy added for backward compatibility (no warnings yet)
- [ ] Cleanup mechanism calls `conditionStore.restore()`
- [ ] New tests for conditionStore integration pass
- [ ] All existing tests continue to pass
