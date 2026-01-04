# Condition Registry Unification Specification

## Context

**Location in Codebase**:
- `tests/common/mods/ModTestFixture.js` - Factory for mod-specific test fixtures
- `tests/common/mods/scopeResolverHelpers.js` - Helper utilities for scope resolution in tests
- `tests/common/engine/systemLogicTestEnv.js` - Core test environment factory
- `src/validation/dataRegistry.js` - Production data registry for conditions

**What These Modules Do**:

### ModTestFixture.js
Provides a high-level testing API for mod integration tests. Key responsibilities:
- Creates test environments for specific actions/rules
- Provides `registerCondition()` API for test-specific condition mocking
- Provides `mockScope()` API for scope resolver mocking
- Manages cleanup of test-specific state

### ScopeResolverHelpers.js
Static utility class for setting up scope resolution in tests. Key responsibilities:
- `registerCustomScope()` - Loads scope definitions from mod files
- `_loadConditionsIntoRegistry()` - Loads condition definitions for scope resolution
- Creates `dataRegistry.getConditionDefinition` override for loaded conditions

### systemLogicTestEnv.js
Creates the core test environment with all engine services. Key responsibilities:
- Initializes EntityManager, EventBus, OperationInterpreter, etc.
- Creates `dataRegistry` instance
- Provides `getAvailableActions()` for action discovery testing

---

## Problem

### What Failed
During the TESINFROB-006 migration, tests were converted from direct `testEnv._loadedConditions` access to the new `fixture.registerCondition()` API. After migration, **8 of 11 tests failed** with conditions not being found by the PrerequisiteService.

**Error Symptom**:
```
ScopeResolutionError: Could not resolve condition_ref 'striking:actor-has-arm' - condition not found
```

### How It Failed
The registered conditions were being stored correctly, but the PrerequisiteService couldn't find them during action discovery.

### Why It Failed (Root Cause Analysis)

**Two parallel override mechanisms exist for `dataRegistry.getConditionDefinition`**:

1. **ModTestFixture.loadDependencyConditions()** (lines 3094-3102):
   ```javascript
   this.testEnv.dataRegistry.getConditionDefinition = jest.fn((id) => {
     if (this._loadedConditions.has(id)) {  // <-- checks fixture._loadedConditions
       return this._loadedConditions.get(id);
     }
     return original(id);
   });
   ```

2. **ScopeResolverHelpers._loadConditionsIntoRegistry()** (lines 1621-1628):
   ```javascript
   testEnv.dataRegistry.getConditionDefinition = (id) => {
     if (testEnv._loadedConditions.has(id)) {  // <-- checks testEnv._loadedConditions
       return testEnv._loadedConditions.get(id);
     }
     return testEnv._originalGetConditionDefinition(id);
   };
   ```

**The Critical Issue**: These two methods check **different Maps**:
- `fixture._loadedConditions` (created at ModTestFixture line 2100)
- `testEnv._loadedConditions` (created at ScopeResolverHelpers line 1564)

When `registerCondition()` only wrote to `fixture._loadedConditions`, but `ScopeResolverHelpers._loadConditionsIntoRegistry()` had already set up the override to check `testEnv._loadedConditions`, the conditions were never found.

### Linked Tests
- `tests/integration/mods/striking/striking_facing_away_filter.test.js`
- `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js`

---

## Truth Sources

### Internal Documentation
- `docs/testing/mod-testing-guide.md` - Documents `registerCondition()` and `mockScope()` APIs
- `docs/testing/test-infrastructure-migration.md` - Migration guide from legacy patterns

### Domain Rules
1. **Single Source of Truth**: Condition lookups should have ONE authoritative source
2. **Override Chaining**: When multiple overrides exist, they must chain correctly
3. **Cleanup Completeness**: All registered conditions must be removable during cleanup

### External Contracts
- `dataRegistry.getConditionDefinition(id)` - Returns condition definition or undefined
- `fixture.registerCondition(id, definition)` - Must make condition available to all resolution paths
- `fixture.cleanup()` - Must restore all original implementations

---

## Desired Behavior

### Normal Cases

1. **Single Registration Point**
   ```javascript
   // Registering via fixture should make condition available everywhere
   fixture.registerCondition('test:my-condition', { logic: { '==': [1, 1] } });

   // All these should find the condition:
   fixture.testEnv.dataRegistry.getConditionDefinition('test:my-condition'); // ✅
   fixture.testEnv.jsonLogic.evaluate({ condition_ref: 'test:my-condition' }, {}); // ✅
   // During scope resolution in action discovery: // ✅
   ```

2. **Consistent Override Chaining**
   ```javascript
   // Original → ScopeResolverHelpers override → ModTestFixture override
   // Each layer checks its own conditions, then delegates to previous
   ```

3. **Complete Cleanup**
   ```javascript
   fixture.registerCondition('test:temp', { logic: { '==': [1, 1] } });
   fixture.cleanup();
   // Condition is no longer available anywhere
   fixture.testEnv.dataRegistry.getConditionDefinition('test:temp'); // undefined
   ```

### Edge Cases

1. **Condition Registered Before ScopeResolverHelpers Override**
   ```javascript
   fixture.registerCondition('test:early', { ... });
   await ScopeResolverHelpers.registerCustomScope(testEnv, 'mod', 'scope');
   // 'test:early' must still be findable after scope registration
   ```

2. **Same Condition ID Registered Multiple Times**
   ```javascript
   fixture.registerCondition('test:cond', { logic: { '==': [1, 1] } });
   fixture.registerCondition('test:cond', { logic: { '==': [2, 2] } }); // Overwrites
   // Latest definition wins
   ```

3. **Condition Registered via Both Paths**
   ```javascript
   // If loaded from file via loadDependencyConditions AND registered via API
   // The explicit API registration should take precedence
   ```

4. **ScopeResolverHelpers Override Not Yet Applied**
   ```javascript
   // If testEnv._loadedConditions doesn't exist yet, skip that path
   if (this.testEnv._loadedConditions) {
     this.testEnv._loadedConditions.set(conditionId, definition);
   }
   ```

### Failure Modes

#### 1. Condition Not Found After Registration
**Detection**: Should NEVER happen with proper implementation
**Error to Raise**:
```
ConditionRegistrationError: Condition 'test:my-condition' was registered but not findable.
This indicates a test infrastructure bug - condition should be available in all resolution paths.

Debug info:
  - fixture._loadedConditions.has('test:my-condition'): true
  - testEnv._loadedConditions?.has('test:my-condition'): false  <-- mismatch detected

Resolution: Ensure registerCondition() writes to all condition storage Maps.
```

#### 2. Override Chain Broken
**Detection**: When chained override returns undefined but condition exists somewhere
**Error to Raise**:
```
ConditionLookupChainError: Condition 'mod:condition' exists but was not found during lookup.

Override chain status:
  1. ModTestFixture._loadedConditions: not found
  2. ScopeResolverHelpers._loadedConditions: FOUND  <-- chain broken before this
  3. Original dataRegistry: not checked

This indicates the override chain was not properly established.
```

#### 3. Cleanup Incomplete
**Detection**: Condition still available after cleanup()
**Error to Raise**:
```
CleanupIncompleteError: Condition 'test:temp' still available after cleanup().

Found in:
  - testEnv._loadedConditions: yes
  - fixture._loadedConditions: no (correctly removed)

Resolution: Ensure clearRegisteredConditions() removes from ALL Maps.
```

---

## Invariants

**Properties that must ALWAYS hold:**

1. **Registration Completeness**: `registerCondition(id, def)` MUST write to ALL condition storage locations that any lookup path might check.

2. **Lookup Consistency**: `dataRegistry.getConditionDefinition(id)` MUST return the same result regardless of which code path triggered the lookup.

3. **Cleanup Totality**: After `cleanup()`, NO registered conditions remain in ANY storage location.

4. **Chain Preservation**: Override chains MUST preserve access to conditions registered at any layer.

5. **Idempotent Registration**: Registering the same condition twice replaces the definition; no stale references remain.

6. **Fail-Fast on Misconfiguration**: If a registered condition becomes unfindable, the system MUST throw immediately with diagnostic information.

---

## API Contracts

### What Stays Stable (DO NOT CHANGE)

```typescript
// ModTestFixture public API
interface ModTestFixture {
  testEnv: TestEnv;

  registerCondition(conditionId: string, definition: ConditionDefinition): void;
  clearRegisteredConditions(): void;
  isConditionRegistered(conditionId: string): boolean;
  getRegisteredConditions(): string[];

  mockScope(scopeName: string, resolver: Set<string> | ((ctx: ScopeContext) => Set<string>)): void;
  clearScopeMocks(): void;

  cleanup(): void;
}

// ScopeResolverHelpers public API
interface ScopeResolverHelpers {
  static registerCustomScope(testEnv: TestEnv, modId: string, scopeName: string): Promise<void>;
  static registerPositioningScopes(testEnv: TestEnv): void;
  // ... other static methods
}

// TestEnv properties (from systemLogicTestEnv.js)
interface TestEnv {
  dataRegistry: DataRegistry;
  entityManager: EntityManager;
  eventBus: EventBus;
  // ... other services
}
```

### What is Allowed to Change

1. **Internal Storage Mechanism**: How/where conditions are stored internally
2. **Override Implementation**: How dataRegistry.getConditionDefinition is overridden
3. **Diagnostic Logging**: Additional debug logging for troubleshooting
4. **Validation Logic**: Additional validation in registerCondition()
5. **Error Message Wording**: Exact text of error messages (not structure)

---

## Proposed Architectural Improvements

### Option A: Unified Condition Store (Recommended)

**Concept**: Create a single, shared condition store that all lookup paths reference.

```javascript
// In systemLogicTestEnv.js or new file
class TestConditionStore {
  #conditions = new Map();
  #originalLookup;

  constructor(dataRegistry) {
    this.#originalLookup = dataRegistry.getConditionDefinition.bind(dataRegistry);

    // Single override that checks our store first
    dataRegistry.getConditionDefinition = (id) => {
      if (this.#conditions.has(id)) {
        return this.#conditions.get(id);
      }
      return this.#originalLookup(id);
    };
  }

  register(id, definition) {
    this.#conditions.set(id, definition);
  }

  unregister(id) {
    this.#conditions.delete(id);
  }

  has(id) {
    return this.#conditions.has(id);
  }

  clear() {
    this.#conditions.clear();
  }
}

// testEnv exposes this single store
testEnv.conditionStore = new TestConditionStore(testEnv.dataRegistry);
```

**Benefits**:
- Single source of truth
- No dual-map synchronization needed
- Clear ownership and cleanup
- Fail-fast guarantee: if it's registered, it's findable

**Migration Path**:
1. Add `TestConditionStore` to systemLogicTestEnv.js
2. Deprecate direct `_loadedConditions` access
3. Update `ModTestFixture.registerCondition()` to use store
4. Update `ScopeResolverHelpers._loadConditionsIntoRegistry()` to use store

### Option B: Fail-Fast Validation (Minimal Change)

**Concept**: Keep current dual-map approach but add immediate validation.

```javascript
registerCondition(conditionId, definition) {
  // ... existing validation ...

  // Write to both maps
  this._loadedConditions.set(conditionId, definition);
  if (this.testEnv._loadedConditions) {
    this.testEnv._loadedConditions.set(conditionId, definition);
  }
  this.#registeredConditions.add(conditionId);

  // FAIL-FAST: Verify condition is now findable
  const found = this.testEnv.dataRegistry.getConditionDefinition(conditionId);
  if (!found) {
    throw new Error(
      `CRITICAL: registerCondition() succeeded but condition '${conditionId}' is not findable.\n` +
      `This indicates a test infrastructure bug.\n\n` +
      `Debug state:\n` +
      `  - fixture._loadedConditions.has(): ${this._loadedConditions.has(conditionId)}\n` +
      `  - testEnv._loadedConditions exists: ${!!this.testEnv._loadedConditions}\n` +
      `  - testEnv._loadedConditions.has(): ${this.testEnv._loadedConditions?.has(conditionId)}\n\n` +
      `Resolution: The dataRegistry.getConditionDefinition override chain may be misconfigured.`
    );
  }
}
```

**Benefits**:
- Minimal code change
- Immediate error on misconfiguration
- Detailed diagnostic output

**Drawbacks**:
- Still maintains two Maps
- Synchronization still required
- Root architectural issue remains

### Option C: Condition Store Wrapper with Proxy

**Concept**: Wrap condition access in a proxy that validates on every lookup.

```javascript
// Create a proxy that monitors condition lookups
const conditionLookupProxy = new Proxy({}, {
  get(target, conditionId) {
    // Try all known sources
    const sources = [
      ['fixture._loadedConditions', fixture._loadedConditions],
      ['testEnv._loadedConditions', testEnv._loadedConditions],
      ['dataRegistry', dataRegistry],
    ];

    for (const [name, source] of sources) {
      const result = source?.get?.(conditionId) ?? source?.getConditionDefinition?.(conditionId);
      if (result) {
        console.debug(`[Condition Lookup] '${conditionId}' found in ${name}`);
        return result;
      }
    }

    console.warn(`[Condition Lookup] '${conditionId}' not found in any source`);
    return undefined;
  }
});
```

**Benefits**:
- Full observability
- Helps diagnose issues during development
- Non-breaking

**Drawbacks**:
- Performance overhead
- Doesn't fix root cause
- Best suited for debugging, not production

---

## Testing Plan

### Tests to Create

#### 1. Condition Registration Cross-Path Tests
**File**: `tests/unit/common/mods/ModTestFixture.conditionRegistrationCrossPaths.test.js`

```javascript
describe('registerCondition cross-path availability', () => {
  it('should make condition available via dataRegistry after ScopeResolverHelpers setup', async () => {
    const fixture = await ModTestFixture.forAction('striking', 'striking:punch_target');

    // Trigger ScopeResolverHelpers to set up its override
    await ScopeResolverHelpers.registerCustomScope(
      fixture.testEnv, 'striking', 'actors_in_location_not_facing_away'
    );

    // Register condition via fixture API
    fixture.registerCondition('test:cross-path', { logic: { '==': [1, 1] } });

    // Verify available via all paths
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:cross-path')).toBeDefined();
    expect(fixture._loadedConditions.has('test:cross-path')).toBe(true);
    expect(fixture.testEnv._loadedConditions?.has('test:cross-path')).toBe(true);
  });

  it('should make condition available via PrerequisiteService during action discovery', async () => {
    const fixture = await ModTestFixture.forAction('striking', 'striking:punch_target');

    await ScopeResolverHelpers.registerCustomScope(
      fixture.testEnv, 'striking', 'actors_in_location_not_facing_away'
    );

    // Register prerequisite condition
    fixture.registerCondition('striking:actor-has-arm', {
      logic: { '==': [true, true] }
    });

    // Setup entities and trigger action discovery
    // ... entity setup ...

    // Should not throw "condition not found"
    expect(() => fixture.testEnv.getAvailableActions('actor1')).not.toThrow();
  });
});
```

#### 2. Override Chain Integrity Tests
**File**: `tests/unit/common/mods/conditionOverrideChain.test.js`

```javascript
describe('condition override chain integrity', () => {
  it('should preserve condition access after multiple overrides', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');

    // Register at fixture level
    fixture.registerCondition('test:level1', { logic: { '==': [1, 1] } });

    // Trigger scope helper override
    await ScopeResolverHelpers.registerCustomScope(fixture.testEnv, 'test', 'test_scope');

    // Register after scope helper
    fixture.registerCondition('test:level2', { logic: { '==': [2, 2] } });

    // Both should be accessible
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:level1')).toBeDefined();
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:level2')).toBeDefined();
  });

  it('should chain to original dataRegistry for unknown conditions', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');

    // Unknown condition should return undefined, not throw
    const result = fixture.testEnv.dataRegistry.getConditionDefinition('unknown:condition');
    expect(result).toBeUndefined();
  });
});
```

#### 3. Cleanup Completeness Tests
**File**: `tests/unit/common/mods/conditionCleanupCompleteness.test.js`

```javascript
describe('condition cleanup completeness', () => {
  it('should remove conditions from ALL storage locations', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');

    // Trigger both override paths
    await ScopeResolverHelpers.registerCustomScope(fixture.testEnv, 'test', 'scope');
    fixture.registerCondition('test:cleanup-test', { logic: { '==': [1, 1] } });

    // Verify present
    expect(fixture._loadedConditions.has('test:cleanup-test')).toBe(true);
    expect(fixture.testEnv._loadedConditions?.has('test:cleanup-test')).toBe(true);

    // Cleanup
    fixture.cleanup();

    // Verify removed from ALL locations
    expect(fixture._loadedConditions.has('test:cleanup-test')).toBe(false);
    expect(fixture.testEnv._loadedConditions?.has('test:cleanup-test')).toBe(false);
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:cleanup-test')).toBeUndefined();
  });
});
```

### Tests to Update

1. **`tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js`**
   - Add tests for cross-path availability
   - Add tests for post-ScopeResolverHelpers registration

2. **`tests/integration/mods/striking/striking_facing_away_filter.test.js`**
   - Already updated; serves as regression test

### Regression Tests

```javascript
describe('TESINFROB-006 Regression: Dual-Map Condition Registration', () => {
  it('should not regress: conditions registered via fixture.registerCondition() must be findable after ScopeResolverHelpers.registerCustomScope()', async () => {
    // This exact scenario caused the original failure
    const fixture = await ModTestFixture.forAction('striking', 'striking:punch_target');

    ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
    await ScopeResolverHelpers.registerCustomScope(
      fixture.testEnv, 'striking', 'actors_in_location_not_facing_away'
    );

    fixture.registerCondition('striking:actor-has-arm', {
      id: 'striking:actor-has-arm',
      logic: { '==': [true, true] }
    });

    // This would fail before the fix
    const condition = fixture.testEnv.dataRegistry.getConditionDefinition('striking:actor-has-arm');
    expect(condition).toBeDefined();
    expect(condition.logic).toEqual({ '==': [true, true] });
  });
});
```

### Property Tests (Invariant Verification)

```javascript
describe('Condition Registration Invariants', () => {
  // Property: Registered conditions are always findable
  it.each([
    ['before scope registration'],
    ['after scope registration'],
    ['after multiple scope registrations'],
  ])('registered condition should be findable %s', async (scenario) => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');

    if (scenario.includes('after')) {
      await ScopeResolverHelpers.registerCustomScope(fixture.testEnv, 'test', 'scope');
    }
    if (scenario.includes('multiple')) {
      await ScopeResolverHelpers.registerCustomScope(fixture.testEnv, 'test', 'scope2');
    }

    fixture.registerCondition('test:prop-test', { logic: { '==': [1, 1] } });

    // INVARIANT: Always findable
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:prop-test')).toBeDefined();
  });

  // Property: Cleanup removes all traces
  it('should leave no traces after cleanup regardless of registration order', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');

    fixture.registerCondition('test:early', { logic: { '==': [1, 1] } });
    await ScopeResolverHelpers.registerCustomScope(fixture.testEnv, 'test', 'scope');
    fixture.registerCondition('test:late', { logic: { '==': [2, 2] } });

    fixture.cleanup();

    // INVARIANT: No traces remain
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:early')).toBeUndefined();
    expect(fixture.testEnv.dataRegistry.getConditionDefinition('test:late')).toBeUndefined();
  });
});
```

---

## Implementation Tickets

| Ticket ID | Priority | Effort | Description |
|-----------|----------|--------|-------------|
| CONDREG-001 | High | Medium | Implement fail-fast validation in registerCondition() |
| CONDREG-002 | High | Small | Add cross-path registration tests |
| CONDREG-003 | Medium | Large | Implement unified TestConditionStore (Option A) |
| CONDREG-004 | Low | Small | Add debug logging for condition lookup chain |
| CONDREG-005 | Low | Medium | Deprecate direct _loadedConditions access with warnings |

---

## Summary

The root cause of the TESINFROB-006 migration difficulty was **two parallel condition storage mechanisms** (`fixture._loadedConditions` and `testEnv._loadedConditions`) with **independent override chains** that weren't synchronized.

The immediate fix (dual-map write in `registerCondition()`) works but introduces:
1. Implicit coupling between ModTestFixture and ScopeResolverHelpers
2. Maintenance burden to keep synchronization correct
3. Non-obvious failure mode if synchronization breaks

The recommended long-term solution is **Option A: Unified Condition Store** which:
1. Eliminates the dual-map problem entirely
2. Provides clear ownership and cleanup semantics
3. Enables fail-fast validation with detailed diagnostics
4. Simplifies the mental model for test authors

The specification provides a complete testing plan to verify the invariants and prevent regression of this issue.
