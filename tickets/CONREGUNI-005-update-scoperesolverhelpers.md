# CONREGUNI-005: Update ScopeResolverHelpers to Use TestConditionStore

## Summary

Refactor `ScopeResolverHelpers._loadConditionsIntoRegistry()` to delegate condition storage to `testEnv.conditionStore` instead of maintaining its own `testEnv._loadedConditions` Map and override.

## Priority: High | Effort: Medium

## Rationale

ScopeResolverHelpers currently creates its own `_loadedConditions` Map and overrides `dataRegistry.getConditionDefinition`. This creates the dual-map problem. By delegating to conditionStore:
- Eliminates second override installation
- Conditions loaded here are immediately visible to all code paths
- Simpler implementation

## Dependencies

- **Requires**: CONREGUNI-002 (TestConditionStore exists)
- **Requires**: CONREGUNI-003 (testEnv.conditionStore available)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/common/mods/scopeResolverHelpers.js` | Modify - Use conditionStore, remove own override logic |
| `tests/integration/common/ModTestFixture.loadDependencyConditions.integration.test.js` | Review - May need updates |

## Out of Scope

- **DO NOT** modify ModTestFixture - that's CONREGUNI-004
- **DO NOT** add deprecation warnings - that's CONREGUNI-007
- **DO NOT** change public API signatures of static methods
- **DO NOT** modify the scope registration logic (only condition loading)

## Implementation Details

### Changes to scopeResolverHelpers.js

#### 1. Simplify _loadConditionsIntoRegistry() method

Replace lines ~1561-1629:

```javascript
/**
 * Loads condition definitions from mod files into the test environment's condition store.
 *
 * @param {object} testEnv - The test environment
 * @param {string[]} conditionIds - Array of condition IDs (format: modId:conditionName)
 * @returns {Promise<void>}
 */
static async _loadConditionsIntoRegistry(testEnv, conditionIds) {
  // Use the unified condition store
  if (!testEnv.conditionStore) {
    throw new Error(
      '_loadConditionsIntoRegistry: testEnv.conditionStore is not available. ' +
      'Ensure the test environment was created with createSystemLogicTestEnv().'
    );
  }

  const loadPromises = conditionIds.map(async (id) => {
    // Skip if already loaded
    if (testEnv.conditionStore.has(id)) {
      return;
    }

    // Validate ID format
    if (typeof id !== 'string' || !id.includes(':')) {
      throw new Error(
        `Invalid condition ID format: "${id}". Expected "modId:conditionId"`
      );
    }

    const [modId, conditionName] = id.split(':');

    // Construct file path
    const conditionPath = resolve(
      process.cwd(),
      `data/mods/${modId}/conditions/${conditionName}.condition.json`
    );

    try {
      const conditionContent = await fs.readFile(conditionPath, 'utf-8');
      const conditionDef = JSON.parse(conditionContent);

      // Use the unified store
      testEnv.conditionStore.register(id, conditionDef);
    } catch (err) {
      throw new Error(
        `Failed to load condition "${id}" from ${conditionPath}: ${err.message}`
      );
    }
  });

  await Promise.all(loadPromises);

  // NOTE: No longer need to set up dataRegistry override here
  // The conditionStore already has its override installed
}
```

#### 2. Remove legacy Map creation and override logic

Delete or comment out these sections:
- Line ~1564: `if (!testEnv._loadedConditions) { testEnv._loadedConditions = new Map(); }`
- Lines ~1617-1628: The `dataRegistry.getConditionDefinition` override

#### 3. Keep backward compatibility for _loadedConditions

If other code still accesses `testEnv._loadedConditions`, keep a getter that proxies:

```javascript
// At the start of _loadConditionsIntoRegistry, if needed for backward compat:
if (!testEnv._loadedConditions) {
  // Create proxy object (not a real Map, but Map-like interface)
  Object.defineProperty(testEnv, '_loadedConditions', {
    get: () => ({
      has: (id) => testEnv.conditionStore.has(id),
      get: (id) => testEnv.conditionStore.get(id),
      set: (id, def) => testEnv.conditionStore.register(id, def),
      delete: (id) => testEnv.conditionStore.unregister(id),
      clear: () => testEnv.conditionStore.clear(),
    }),
    configurable: true,
  });
}
```

**Note**: This may already be handled by CONREGUNI-003 at the testEnv level. Check if needed.

### Update registerCustomScope() if needed

If `registerCustomScope()` calls `_loadConditionsIntoRegistry()`, verify it works correctly:

```javascript
static async registerCustomScope(testEnv, modId, scopeName) {
  // ... existing scope loading logic ...

  // Load conditions - this now uses conditionStore internally
  if (scopeDef.parameters?.conditions) {
    const conditionIds = scopeDef.parameters.conditions;
    await ScopeResolverHelpers._loadConditionsIntoRegistry(testEnv, conditionIds);
  }

  // ... rest of scope registration ...
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Integration tests using scope registration:**
   ```bash
   npm run test:integration -- tests/integration/mods/striking/striking_facing_away_filter.test.js --verbose
   ```

2. **LoadDependencyConditions integration tests:**
   ```bash
   npm run test:integration -- tests/integration/common/ModTestFixture.loadDependencyConditions.integration.test.js --verbose
   ```

3. **All scope-related tests:**
   ```bash
   npm run test:unit -- --testPathPattern="scope" --verbose
   npm run test:integration -- --testPathPattern="scope" --verbose
   ```

### Invariants That Must Remain True

1. **Single Override**: Only conditionStore's override on `dataRegistry.getConditionDefinition`
2. **Condition Findability**: Conditions loaded via `_loadConditionsIntoRegistry` are findable
3. **Scope Resolution Works**: Custom scopes that reference conditions still resolve correctly
4. **No Orphaned Maps**: No more `testEnv._loadedConditions` as an independent Map
5. **API Unchanged**: `registerCustomScope()` signature unchanged

## Verification Commands

```bash
# Run striking tests (primary regression test)
npm run test:integration -- tests/integration/mods/striking/ --verbose

# Run scope helper related tests
npm run test:integration -- tests/integration/common/ModTestFixture.loadDependencyConditions.integration.test.js --verbose

# Run all positioning tests (use scopes heavily)
npm run test:integration -- tests/integration/mods/positioning/ --verbose

# Run full integration suite
npm run test:integration
```

## Testing the Fix

After this change, the original failure scenario should work:

```javascript
describe('CONREGUNI regression test', () => {
  it('conditions registered via fixture.registerCondition() are findable after ScopeResolverHelpers.registerCustomScope()', async () => {
    const fixture = await ModTestFixture.forAction('striking', 'striking:punch_target');

    // This triggers _loadConditionsIntoRegistry which now uses conditionStore
    await ScopeResolverHelpers.registerCustomScope(
      fixture.testEnv, 'striking', 'actors_in_location_not_facing_away'
    );

    // Register via fixture API
    fixture.registerCondition('striking:actor-has-arm', {
      id: 'striking:actor-has-arm',
      logic: { '==': [true, true] }
    });

    // Must be findable - this was the failure case
    const condition = fixture.testEnv.dataRegistry.getConditionDefinition('striking:actor-has-arm');
    expect(condition).toBeDefined();
    expect(condition.logic).toEqual({ '==': [true, true] });

    fixture.cleanup();
  });
});
```

## Definition of Done

- [ ] `_loadConditionsIntoRegistry()` uses `testEnv.conditionStore.register()`
- [ ] Removed own `_loadedConditions` Map creation
- [ ] Removed own `dataRegistry.getConditionDefinition` override
- [ ] Error handling preserved (file not found, invalid format)
- [ ] `registerCustomScope()` still works correctly
- [ ] All striking tests pass
- [ ] All scope-related tests pass
- [ ] No changes to public static method signatures
