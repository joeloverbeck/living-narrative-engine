# CONREGUNI-004: Update ModTestFixture to Use TestConditionStore

## Summary

Refactor `ModTestFixture` to delegate all condition storage to `testEnv.conditionStore` instead of maintaining its own `_loadedConditions` Map. This eliminates the dual-map synchronization problem.

## Priority: High | Effort: Medium

## Rationale

ModTestFixture currently maintains its own `_loadedConditions` Map and synchronizes with `testEnv._loadedConditions`. By delegating to the unified `conditionStore`:
- No more dual-map synchronization
- Single source of truth
- Simplified cleanup logic
- Consistent behavior regardless of call order

## Dependencies

- **Requires**: CONREGUNI-002 (TestConditionStore exists)
- **Requires**: CONREGUNI-003 (testEnv.conditionStore available)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/common/mods/ModTestFixture.js` | Modify - Use conditionStore, remove dual-map logic |
| `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js` | Update - Adjust for new implementation |

## Out of Scope

- **DO NOT** modify ScopeResolverHelpers - that's CONREGUNI-005
- **DO NOT** add deprecation warnings to public API - that's CONREGUNI-007
- **DO NOT** remove `_loadedConditions` property entirely (keep for backward compat)
- **DO NOT** change public method signatures

## Implementation Details

### Changes to ModTestFixture.js

#### 1. Remove fixture-level _loadedConditions Map creation

Remove or deprecate the line at ~2100:
```javascript
// BEFORE
this._loadedConditions = new Map();

// AFTER - Make it a proxy to conditionStore
Object.defineProperty(this, '_loadedConditions', {
  get: () => ({
    has: (id) => this.testEnv.conditionStore.has(id),
    get: (id) => this.testEnv.conditionStore.get(id),
    set: (id, def) => this.testEnv.conditionStore.register(id, def),
    delete: (id) => this.testEnv.conditionStore.unregister(id),
    clear: () => this.testEnv.conditionStore.clear(),
  }),
  configurable: true,
});
```

#### 2. Simplify registerCondition() method

Replace lines ~2170-2193:

```javascript
registerCondition(conditionId, definition) {
  // Validation (keep existing)
  if (!conditionId || typeof conditionId !== 'string') {
    throw new Error('registerCondition: conditionId must be a non-empty string');
  }
  if (!definition || typeof definition !== 'object') {
    throw new Error(`registerCondition: definition for '${conditionId}' must be an object`);
  }
  if (!('logic' in definition)) {
    throw new Error(
      `Condition '${conditionId}' must have a 'logic' property. ` +
      `Condition files must specify a 'logic' object (using JSON Logic format). ` +
      `Got: ${JSON.stringify(definition)}`
    );
  }

  // Delegate to unified store (replaces dual-map write)
  this.testEnv.conditionStore.register(conditionId, definition);

  // Track for cleanup
  this.#registeredConditions.add(conditionId);
}
```

#### 3. Simplify isConditionRegistered() method

```javascript
isConditionRegistered(conditionId) {
  return this.testEnv.conditionStore.has(conditionId);
}
```

#### 4. Simplify getRegisteredConditions() method

```javascript
getRegisteredConditions() {
  return Array.from(this.#registeredConditions);
}
```

#### 5. Simplify clearRegisteredConditions() method

Replace lines ~2201-2210:

```javascript
clearRegisteredConditions() {
  for (const conditionId of this.#registeredConditions) {
    this.testEnv.conditionStore.unregister(conditionId);
  }
  this.#registeredConditions.clear();
}
```

#### 6. Update loadDependencyConditions() to use conditionStore

Replace lines ~3070-3103:

```javascript
async loadDependencyConditions(conditionIds) {
  for (const id of conditionIds) {
    if (this.testEnv.conditionStore.has(id)) {
      continue; // Already loaded
    }

    const [modId, conditionName] = id.split(':');
    const conditionPath = resolve(
      process.cwd(),
      `data/mods/${modId}/conditions/${conditionName}.condition.json`
    );

    try {
      const content = await fs.readFile(conditionPath, 'utf-8');
      const def = JSON.parse(content);
      this.testEnv.conditionStore.register(id, def);
    } catch (err) {
      throw new Error(`Failed to load condition "${id}": ${err.message}`);
    }
  }
}
```

Remove the dataRegistry override logic (lines ~3094-3102) - no longer needed since conditionStore already has its override.

### Keep Private Field for Tracking

Keep `#registeredConditions` Set to track what THIS fixture registered (for proper cleanup):

```javascript
#registeredConditions = new Set();
```

## Acceptance Criteria

### Tests That Must Pass

1. **Existing condition registration tests:**
   ```bash
   npm run test:unit -- tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js --verbose
   ```

2. **Integration tests using registerCondition:**
   ```bash
   npm run test:integration -- tests/integration/mods/striking/striking_facing_away_filter.test.js --verbose
   ```

3. **All ModTestFixture tests:**
   ```bash
   npm run test:unit -- --testPathPattern="ModTestFixture" --verbose
   ```

4. **Update tests to reflect new implementation:**
   - Tests should not assert on internal `_loadedConditions` Map structure
   - Tests should use `testEnv.conditionStore` or public API

### Invariants That Must Remain True

1. **API Unchanged**: `registerCondition()`, `isConditionRegistered()`, `getRegisteredConditions()`, `clearRegisteredConditions()` signatures unchanged
2. **Behavior Unchanged**: Registered conditions findable via `dataRegistry.getConditionDefinition()`
3. **Cleanup Works**: `cleanup()` removes all fixture-registered conditions
4. **Fail-Fast**: Invalid registrations throw immediately (from conditionStore)
5. **No Dual-Map**: Only conditionStore used for storage

## Verification Commands

```bash
# Run condition registration tests
npm run test:unit -- tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js --verbose

# Run integration tests
npm run test:integration -- tests/integration/mods/striking/ --verbose

# Run all ModTestFixture tests
npm run test:unit -- --testPathPattern="ModTestFixture" --verbose

# Run all mod tests
npm run test:unit -- tests/unit/common/mods/ --verbose
npm run test:integration -- tests/integration/mods/ --verbose
```

## Migration Notes

Tests that directly access `fixture._loadedConditions` as a Map should be updated:

```javascript
// BEFORE
expect(fixture._loadedConditions.has('test:cond')).toBe(true);
expect(fixture._loadedConditions.size).toBe(1);

// AFTER
expect(fixture.isConditionRegistered('test:cond')).toBe(true);
expect(fixture.testEnv.conditionStore.has('test:cond')).toBe(true);
```

## Definition of Done

- [ ] `registerCondition()` delegates to `testEnv.conditionStore.register()`
- [ ] `isConditionRegistered()` delegates to `testEnv.conditionStore.has()`
- [ ] `clearRegisteredConditions()` uses `testEnv.conditionStore.unregister()`
- [ ] `loadDependencyConditions()` uses conditionStore, removes own override logic
- [ ] `_loadedConditions` is a proxy to conditionStore (backward compat)
- [ ] `#registeredConditions` Set still tracks fixture's own registrations
- [ ] All existing tests pass
- [ ] No changes to public API signatures
