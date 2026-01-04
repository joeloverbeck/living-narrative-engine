# TESINFROB-004: registerCondition() Public API

**Priority**: Medium | **Effort**: Medium

## Description

Add `registerCondition()` and `clearRegisteredConditions()` methods to replace direct access to private `testEnv._loadedConditions`. This provides a clean, documented API for condition registration in tests.

## Files to Touch

- `tests/common/mods/ModTestFixture.js` (modify)
- `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js` (create)

## Out of Scope

- **DO NOT** remove `_loadedConditions` - existing tests may use it
- **DO NOT** modify `systemLogicTestEnv.js` (beyond TESINFROB-001 deprecation warning)
- **DO NOT** change how conditions are evaluated at runtime
- **DO NOT** modify scope mocking (that's TESINFROB-003)

## Implementation Details

### 1. Add condition registration to BaseModTestFixture

In `tests/common/mods/ModTestFixture.js`, add to `BaseModTestFixture`:

```javascript
class BaseModTestFixture {
  // ... existing code ...

  /** @type {Set<string>} */
  #registeredConditions = new Set();

  /**
   * Register a condition for use in rules during testing.
   *
   * This is the preferred way to add test conditions. It replaces direct
   * access to `testEnv._loadedConditions` which is deprecated.
   *
   * @param {string} conditionId - Full condition ID (e.g., 'test:my-condition')
   * @param {Object} definition - Condition definition object
   * @param {Object} definition.logic - JSON Logic expression for the condition
   * @param {string} [definition.description] - Human-readable description
   *
   * @throws {Error} If definition is missing required 'logic' property
   *
   * @example
   * fixture.registerCondition('test:is-actor', {
   *   logic: { '==': [{ var: 'entity.type' }, 'actor'] },
   *   description: 'Checks if entity is an actor'
   * });
   *
   * @example
   * // Use in rule testing
   * fixture.registerCondition('test:always-true', {
   *   logic: { '==': [1, 1] }
   * });
   */
  registerCondition(conditionId, definition) {
    // Validate inputs
    if (!conditionId || typeof conditionId !== 'string') {
      throw new Error('registerCondition: conditionId must be a non-empty string');
    }

    if (!definition || typeof definition !== 'object') {
      throw new Error(
        `registerCondition: definition for '${conditionId}' must be an object`
      );
    }

    if (!('logic' in definition)) {
      throw new Error(
        `Condition '${conditionId}' must have a 'logic' property. ` +
          `Received: ${JSON.stringify(Object.keys(definition))}`
      );
    }

    // Register with the appropriate registry
    // The exact implementation depends on how conditions are stored
    // Option 1: If dataRegistry has registerCondition
    if (this.testEnv.dataRegistry?.registerCondition) {
      this.testEnv.dataRegistry.registerCondition(conditionId, definition);
    }
    // Option 2: If using _loadedConditions Map
    else if (this.testEnv._loadedConditions) {
      this.testEnv._loadedConditions.set(conditionId, definition);
    }
    // Option 3: If jsonLogic service has condition registration
    else if (this.testEnv.jsonLogic?.registerCondition) {
      this.testEnv.jsonLogic.registerCondition(conditionId, definition);
    }
    else {
      throw new Error(
        'Cannot register condition: no suitable registry found on testEnv'
      );
    }

    this.#registeredConditions.add(conditionId);
  }

  /**
   * Clear all conditions registered via registerCondition().
   *
   * Called automatically by cleanup(), but can be called manually
   * to remove test conditions mid-test.
   *
   * Note: This only removes conditions registered through this API,
   * not conditions loaded from mod files.
   */
  clearRegisteredConditions() {
    for (const conditionId of this.#registeredConditions) {
      // Unregister from the appropriate registry
      if (this.testEnv.dataRegistry?.unregisterCondition) {
        this.testEnv.dataRegistry.unregisterCondition(conditionId);
      } else if (this.testEnv._loadedConditions) {
        this.testEnv._loadedConditions.delete(conditionId);
      } else if (this.testEnv.jsonLogic?.unregisterCondition) {
        this.testEnv.jsonLogic.unregisterCondition(conditionId);
      }
    }
    this.#registeredConditions.clear();
  }

  /**
   * Check if a condition was registered via registerCondition().
   *
   * @param {string} conditionId - Condition ID to check
   * @returns {boolean} True if condition was registered through this API
   */
  isConditionRegistered(conditionId) {
    return this.#registeredConditions.has(conditionId);
  }

  /**
   * Get list of conditions registered via registerCondition().
   *
   * @returns {string[]} Array of registered condition IDs
   */
  getRegisteredConditions() {
    return Array.from(this.#registeredConditions);
  }
}
```

### 2. Add deprecation warning for _loadedConditions

If TESINFROB-001 is implemented first, add to the strict proxy:

```javascript
// In the testEnv proxy handler
get(target, prop) {
  // ... existing checks ...

  // Deprecation warning for _loadedConditions
  if (prop === '_loadedConditions') {
    console.warn(
      'Deprecated: Direct access to testEnv._loadedConditions is deprecated. ' +
      'Use fixture.registerCondition() instead. ' +
      'See: docs/testing/test-infrastructure-migration.md'
    );
    return target[prop];
  }

  // ... rest of handler ...
}
```

### 3. Integrate with cleanup()

Modify the existing `cleanup()` method:

```javascript
cleanup() {
  // Clear registered conditions
  this.clearRegisteredConditions();

  // Clear scope mocks (from TESINFROB-003)
  this.clearScopeMocks();

  // ... existing cleanup logic ...
}
```

### 4. Create test file

Create `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModTestFixture } from '../../../../tests/common/mods/ModTestFixture.js';

describe('ModTestFixture.registerCondition()', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('core', 'core:wait');
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('should register condition for use in rules', () => {
    fixture.registerCondition('test:always-true', {
      logic: { '==': [1, 1] },
    });

    expect(fixture.isConditionRegistered('test:always-true')).toBe(true);

    // Verify condition is evaluable
    const result = fixture.testEnv.jsonLogic.evaluate(
      { condition_ref: 'test:always-true' },
      {}
    );
    expect(result).toBe(true);
  });

  it('should throw if definition missing logic property', () => {
    expect(() => {
      fixture.registerCondition('test:invalid', {
        description: 'Missing logic',
      });
    }).toThrow("must have a 'logic' property");
  });

  it('should throw for empty conditionId', () => {
    expect(() => {
      fixture.registerCondition('', { logic: { '==': [1, 1] } });
    }).toThrow('must be a non-empty string');
  });

  it('should throw for non-object definition', () => {
    expect(() => {
      fixture.registerCondition('test:invalid', null);
    }).toThrow('must be an object');

    expect(() => {
      fixture.registerCondition('test:invalid', 'not-an-object');
    }).toThrow('must be an object');
  });

  it('should clean up registered conditions on cleanup()', () => {
    fixture.registerCondition('test:temp', { logic: { '==': [1, 1] } });
    expect(fixture.isConditionRegistered('test:temp')).toBe(true);

    fixture.cleanup();

    // After cleanup, fixture is in unknown state, but we verified registration worked
  });

  it('should clean up on clearRegisteredConditions()', () => {
    fixture.registerCondition('test:a', { logic: { '==': [1, 1] } });
    fixture.registerCondition('test:b', { logic: { '==': [2, 2] } });

    expect(fixture.getRegisteredConditions()).toContain('test:a');
    expect(fixture.getRegisteredConditions()).toContain('test:b');

    fixture.clearRegisteredConditions();

    expect(fixture.getRegisteredConditions()).toEqual([]);
    expect(fixture.isConditionRegistered('test:a')).toBe(false);
  });

  it('should allow multiple condition registrations', () => {
    fixture.registerCondition('test:first', { logic: { '==': [1, 1] } });
    fixture.registerCondition('test:second', { logic: { '==': [2, 2] } });
    fixture.registerCondition('test:third', { logic: { '==': [3, 3] } });

    expect(fixture.getRegisteredConditions()).toHaveLength(3);
  });

  it('should warn when accessing _loadedConditions directly', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Access the deprecated property
    const _ = fixture.testEnv._loadedConditions;

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deprecated')
    );

    warnSpy.mockRestore();
  });

  it('should allow re-registering same condition (overwrites)', () => {
    fixture.registerCondition('test:condition', { logic: { '==': [1, 1] } });
    fixture.registerCondition('test:condition', { logic: { '==': [2, 2] } });

    // Should not throw, just overwrite
    expect(fixture.isConditionRegistered('test:condition')).toBe(true);
  });
});
```

## Acceptance Criteria

### Tests that must pass

- `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js`:
  - `should register condition for use in rules`
  - `should throw if definition missing logic property`
  - `should clean up registered conditions on cleanup()`
  - `should clean up on clearRegisteredConditions()`
  - `should allow multiple condition registrations`
  - `should warn when accessing _loadedConditions directly`

### Invariants

- All existing tests using `_loadedConditions` continue to work (with warning)
- Conditions registered via API work identically to those loaded from files
- `fixture.cleanup()` removes all registered conditions
- No memory leaks from unreleased condition references

## Verification

```bash
# Run new tests
npm run test:unit -- tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js

# Verify no regressions
npm run test:unit
npm run test:integration
```

## Migration Example

Before (private API access):

```javascript
testEnv._loadedConditions.set('test:my-condition', {
  logic: { '==': [{ var: 'entity.type' }, 'actor'] },
});
```

After (public API):

```javascript
fixture.registerCondition('test:my-condition', {
  logic: { '==': [{ var: 'entity.type' }, 'actor'] },
});
```
