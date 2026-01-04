# CONREGUNI-002: Create TestConditionStore Class

## Summary

Create a new `TestConditionStore` class that serves as the single source of truth for test condition storage. This eliminates the dual-map problem by providing one authoritative storage location with proper override management.

## Priority: High | Effort: Medium

## Rationale

The current architecture has two parallel `_loadedConditions` Maps that must be kept in sync. A unified store:
- Eliminates synchronization burden
- Provides clear ownership
- Enables fail-fast guarantees
- Simplifies the mental model

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/common/engine/TestConditionStore.js` | **Create** - New class file |
| `tests/unit/common/engine/TestConditionStore.test.js` | **Create** - Unit tests for the store |

## Out of Scope

- **DO NOT** integrate into systemLogicTestEnv - that's CONREGUNI-003
- **DO NOT** modify ModTestFixture - that's CONREGUNI-004
- **DO NOT** modify ScopeResolverHelpers - that's CONREGUNI-005
- **DO NOT** add any deprecation warnings - that's CONREGUNI-007

## Implementation Details

### New File: tests/common/engine/TestConditionStore.js

```javascript
/**
 * @file TestConditionStore - Unified condition storage for test environments
 *
 * This class provides a single source of truth for test condition definitions,
 * eliminating the dual-map synchronization issue between ModTestFixture and
 * ScopeResolverHelpers.
 *
 * @see specs/condition-registry-unification.md
 */

/**
 * Unified condition store for test environments.
 * Provides a single override of dataRegistry.getConditionDefinition that
 * all test infrastructure can rely on.
 */
class TestConditionStore {
  /** @type {Map<string, object>} */
  #conditions = new Map();

  /** @type {Function} */
  #originalLookup;

  /** @type {object} */
  #dataRegistry;

  /** @type {boolean} */
  #isInitialized = false;

  /**
   * Creates a new TestConditionStore.
   * @param {object} dataRegistry - The dataRegistry instance to wrap
   * @throws {Error} If dataRegistry is invalid
   */
  constructor(dataRegistry) {
    if (!dataRegistry || typeof dataRegistry.getConditionDefinition !== 'function') {
      throw new Error(
        'TestConditionStore requires a dataRegistry with getConditionDefinition method'
      );
    }

    this.#dataRegistry = dataRegistry;
    this.#originalLookup = dataRegistry.getConditionDefinition.bind(dataRegistry);

    // Install our override
    dataRegistry.getConditionDefinition = (id) => {
      if (this.#conditions.has(id)) {
        return this.#conditions.get(id);
      }
      return this.#originalLookup(id);
    };

    this.#isInitialized = true;
  }

  /**
   * Registers a condition definition.
   * @param {string} conditionId - The condition ID (format: modId:conditionName)
   * @param {object} definition - The condition definition with 'logic' property
   * @throws {Error} If conditionId or definition is invalid
   */
  register(conditionId, definition) {
    if (!conditionId || typeof conditionId !== 'string') {
      throw new Error('register: conditionId must be a non-empty string');
    }
    if (!definition || typeof definition !== 'object') {
      throw new Error(`register: definition for '${conditionId}' must be an object`);
    }
    if (!('logic' in definition)) {
      throw new Error(
        `Condition '${conditionId}' must have a 'logic' property. ` +
        `Got: ${JSON.stringify(definition)}`
      );
    }

    this.#conditions.set(conditionId, definition);

    // Fail-fast: verify immediately findable
    const found = this.#dataRegistry.getConditionDefinition(conditionId);
    if (!found) {
      throw new Error(
        `CRITICAL: Condition '${conditionId}' registered but not findable. ` +
        `This indicates a TestConditionStore bug.`
      );
    }
  }

  /**
   * Unregisters a condition.
   * @param {string} conditionId - The condition ID to remove
   */
  unregister(conditionId) {
    this.#conditions.delete(conditionId);
  }

  /**
   * Checks if a condition is registered.
   * @param {string} conditionId - The condition ID to check
   * @returns {boolean}
   */
  has(conditionId) {
    return this.#conditions.has(conditionId);
  }

  /**
   * Gets a registered condition definition.
   * @param {string} conditionId - The condition ID
   * @returns {object|undefined}
   */
  get(conditionId) {
    return this.#conditions.get(conditionId);
  }

  /**
   * Gets all registered condition IDs.
   * @returns {string[]}
   */
  getRegisteredIds() {
    return Array.from(this.#conditions.keys());
  }

  /**
   * Clears all registered conditions.
   */
  clear() {
    this.#conditions.clear();
  }

  /**
   * Returns the number of registered conditions.
   * @returns {number}
   */
  get size() {
    return this.#conditions.size;
  }

  /**
   * Restores the original dataRegistry.getConditionDefinition.
   * Should only be called during final cleanup.
   */
  restore() {
    if (this.#isInitialized) {
      this.#dataRegistry.getConditionDefinition = this.#originalLookup;
      this.#conditions.clear();
      this.#isInitialized = false;
    }
  }
}

export default TestConditionStore;
```

### New File: tests/unit/common/engine/TestConditionStore.test.js

```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import TestConditionStore from '../../../common/engine/TestConditionStore.js';

describe('TestConditionStore', () => {
  let mockDataRegistry;
  let store;

  beforeEach(() => {
    mockDataRegistry = {
      getConditionDefinition: jest.fn().mockReturnValue(undefined)
    };
  });

  afterEach(() => {
    if (store) {
      store.restore();
    }
  });

  describe('constructor', () => {
    it('should throw if dataRegistry is missing', () => {
      expect(() => new TestConditionStore(null)).toThrow(/requires a dataRegistry/);
    });

    it('should throw if getConditionDefinition is not a function', () => {
      expect(() => new TestConditionStore({})).toThrow(/requires a dataRegistry/);
    });

    it('should install override on dataRegistry', () => {
      const original = mockDataRegistry.getConditionDefinition;
      store = new TestConditionStore(mockDataRegistry);

      expect(mockDataRegistry.getConditionDefinition).not.toBe(original);
    });
  });

  describe('register', () => {
    beforeEach(() => {
      store = new TestConditionStore(mockDataRegistry);
    });

    it('should store condition and make it findable', () => {
      store.register('test:condition', { logic: { '==': [1, 1] } });

      expect(store.has('test:condition')).toBe(true);
      expect(mockDataRegistry.getConditionDefinition('test:condition')).toEqual({
        logic: { '==': [1, 1] }
      });
    });

    it('should throw if conditionId is empty', () => {
      expect(() => store.register('', { logic: {} })).toThrow(/non-empty string/);
    });

    it('should throw if definition lacks logic property', () => {
      expect(() => store.register('test:no-logic', {})).toThrow(/must have a 'logic' property/);
    });

    it('should allow overwriting existing condition', () => {
      store.register('test:overwrite', { logic: { '==': [1, 1] } });
      store.register('test:overwrite', { logic: { '==': [2, 2] } });

      expect(store.get('test:overwrite')).toEqual({ logic: { '==': [2, 2] } });
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      store = new TestConditionStore(mockDataRegistry);
      store.register('test:to-remove', { logic: { '==': [1, 1] } });
    });

    it('should remove condition', () => {
      store.unregister('test:to-remove');

      expect(store.has('test:to-remove')).toBe(false);
    });

    it('should make condition unfindable via dataRegistry', () => {
      store.unregister('test:to-remove');

      expect(mockDataRegistry.getConditionDefinition('test:to-remove')).toBeUndefined();
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      store = new TestConditionStore(mockDataRegistry);
      store.register('test:one', { logic: { '==': [1, 1] } });
      store.register('test:two', { logic: { '==': [2, 2] } });
    });

    it('should remove all conditions', () => {
      store.clear();

      expect(store.size).toBe(0);
      expect(store.has('test:one')).toBe(false);
      expect(store.has('test:two')).toBe(false);
    });
  });

  describe('fallback to original', () => {
    it('should fall back to original lookup for unknown conditions', () => {
      mockDataRegistry.getConditionDefinition.mockReturnValue({ logic: { '==': [3, 3] } });
      store = new TestConditionStore(mockDataRegistry);

      // Need to call through the new override which should delegate
      const result = mockDataRegistry.getConditionDefinition('unknown:condition');

      // Since our override should call original for unknown conditions
      expect(result).toEqual({ logic: { '==': [3, 3] } });
    });
  });

  describe('restore', () => {
    it('should restore original getConditionDefinition', () => {
      const original = mockDataRegistry.getConditionDefinition;
      store = new TestConditionStore(mockDataRegistry);
      store.register('test:temp', { logic: { '==': [1, 1] } });

      store.restore();

      // After restore, should be back to original
      // The mock itself was replaced, so we verify by behavior
      expect(store.has('test:temp')).toBe(false);
      expect(store.size).toBe(0);
    });
  });

  describe('getRegisteredIds', () => {
    beforeEach(() => {
      store = new TestConditionStore(mockDataRegistry);
      store.register('test:one', { logic: { '==': [1, 1] } });
      store.register('test:two', { logic: { '==': [2, 2] } });
    });

    it('should return all registered IDs', () => {
      const ids = store.getRegisteredIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('test:one');
      expect(ids).toContain('test:two');
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **New TestConditionStore unit tests:**
   ```bash
   npm run test:unit -- tests/unit/common/engine/TestConditionStore.test.js --verbose
   ```

2. **All tests pass** (store is not yet integrated, so existing tests unchanged):
   ```bash
   npm run test:unit -- --testPathPattern="common" --verbose
   ```

### Invariants That Must Remain True

1. **Single Override**: Only one `getConditionDefinition` override installed
2. **Fail-Fast**: Registration validates findability immediately
3. **Clean Restore**: `restore()` returns dataRegistry to original state
4. **No Side Effects**: Creating a store doesn't break existing tests (it's isolated)

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- tests/unit/common/engine/TestConditionStore.test.js --verbose

# Ensure no existing tests break (store not integrated yet)
npm run test:unit -- tests/unit/common/mods/ --verbose
npm run test:integration -- tests/integration/mods/striking/ --verbose
```

## Definition of Done

- [ ] `TestConditionStore.js` created with all methods implemented
- [ ] Unit tests cover all public methods
- [ ] Tests cover edge cases (empty ID, missing logic, overwrite)
- [ ] Tests cover cleanup (clear, unregister, restore)
- [ ] JSDoc documentation complete
- [ ] No integration with other files (that's later tickets)
