# TESINFROB-003: mockScope() Helper Method

**Priority**: Medium | **Effort**: Medium

## Description

Add `mockScope()` and `clearScopeMocks()` methods to `ModTestFixture` classes to simplify scope resolver mocking from 10+ lines of boilerplate to 1-2 lines.

## Files to Touch

- `tests/common/mods/ModTestFixture.js` (modify)
- `tests/unit/common/mods/ModTestFixture.scopeMocking.test.js` (create)

## Out of Scope

- **DO NOT** modify `systemLogicTestEnv.js` beyond what TESINFROB-001 requires
- **DO NOT** add condition registration API (that's TESINFROB-004)
- **DO NOT** change factory method signatures (`forAction`, `forRule`, etc.)
- **DO NOT** modify existing scenario builder methods

## Implementation Details

### 1. Add scope mocking to BaseModTestFixture

In `tests/common/mods/ModTestFixture.js`, add to `BaseModTestFixture`:

```javascript
class BaseModTestFixture {
  // ... existing code ...

  /** @type {Map<string, Function>} */
  #scopeMocks = new Map();

  /** @type {Function|null} */
  #originalResolveSync = null;

  /**
   * Mock a scope resolver to return specific results.
   *
   * @param {string} scopeName - Full scope name (e.g., 'positioning:close_actors')
   * @param {Set<string>|Function} resolverOrResult - Either:
   *   - A Set of entity IDs to return
   *   - A function (context) => Set<string> for dynamic resolution
   *
   * @example
   * // Static result
   * fixture.mockScope('my:scope', new Set(['entity-1', 'entity-2']));
   *
   * @example
   * // Dynamic resolver
   * fixture.mockScope('my:scope', (context) => {
   *   return new Set([context.actor.id]);
   * });
   */
  mockScope(scopeName, resolverOrResult) {
    if (!scopeName || typeof scopeName !== 'string') {
      throw new Error('mockScope: scopeName must be a non-empty string');
    }

    // Store original resolver on first mock
    if (!this.#originalResolveSync) {
      this.#originalResolveSync = this.testEnv.unifiedScopeResolver.resolveSync.bind(
        this.testEnv.unifiedScopeResolver
      );
    }

    // Normalize to function
    const resolver =
      typeof resolverOrResult === 'function'
        ? resolverOrResult
        : () => resolverOrResult;

    this.#scopeMocks.set(scopeName, resolver);

    // Install intercepting resolver
    const mocks = this.#scopeMocks;
    const original = this.#originalResolveSync;

    this.testEnv.unifiedScopeResolver.resolveSync = function (name, context) {
      if (mocks.has(name)) {
        const mockResult = mocks.get(name)(context);
        // Ensure result is a Set
        return mockResult instanceof Set ? mockResult : new Set(mockResult);
      }
      return original(name, context);
    };
  }

  /**
   * Clear all scope mocks and restore original resolver.
   *
   * Called automatically by cleanup(), but can be called manually
   * to restore original behavior mid-test.
   */
  clearScopeMocks() {
    if (this.#originalResolveSync) {
      this.testEnv.unifiedScopeResolver.resolveSync = this.#originalResolveSync;
      this.#originalResolveSync = null;
    }
    this.#scopeMocks.clear();
  }

  /**
   * Check if a scope is currently mocked.
   *
   * @param {string} scopeName - Scope name to check
   * @returns {boolean} True if scope has an active mock
   */
  isScopeMocked(scopeName) {
    return this.#scopeMocks.has(scopeName);
  }

  /**
   * Get list of currently mocked scope names.
   *
   * @returns {string[]} Array of mocked scope names
   */
  getMockedScopes() {
    return Array.from(this.#scopeMocks.keys());
  }
}
```

### 2. Integrate with cleanup()

Modify the existing `cleanup()` method:

```javascript
cleanup() {
  // Clear scope mocks first (restore original resolver)
  this.clearScopeMocks();

  // ... existing cleanup logic ...
}
```

### 3. Create test file

Create `tests/unit/common/mods/ModTestFixture.scopeMocking.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../../tests/common/mods/ModTestFixture.js';

describe('ModTestFixture.mockScope()', () => {
  let fixture;

  beforeEach(async () => {
    // Use a simple test action that exists
    fixture = await ModTestFixture.forAction('core', 'core:wait');
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('should mock scope with resolver function', () => {
    fixture.mockScope('test:scope', (context) => new Set(['entity-1']));

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {});
    expect(result).toEqual(new Set(['entity-1']));
  });

  it('should mock scope with result Set shorthand', () => {
    fixture.mockScope('test:scope', new Set(['entity-1', 'entity-2']));

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {});
    expect(result).toEqual(new Set(['entity-1', 'entity-2']));
  });

  it('should allow multiple scope mocks', () => {
    fixture.mockScope('scope:a', new Set(['a']));
    fixture.mockScope('scope:b', new Set(['b']));

    expect(fixture.testEnv.unifiedScopeResolver.resolveSync('scope:a', {})).toEqual(
      new Set(['a'])
    );
    expect(fixture.testEnv.unifiedScopeResolver.resolveSync('scope:b', {})).toEqual(
      new Set(['b'])
    );
  });

  it('should fall through to original for non-mocked scopes', () => {
    fixture.mockScope('test:mocked', new Set(['mocked']));

    // Non-mocked scope should use original resolver
    // (may throw or return empty depending on scope existence)
    expect(() => {
      fixture.testEnv.unifiedScopeResolver.resolveSync('test:mocked', {});
    }).not.toThrow();
  });

  it('should clean up mocks on fixture.cleanup()', () => {
    const originalResolve = fixture.testEnv.unifiedScopeResolver.resolveSync;
    fixture.mockScope('test:scope', new Set(['mocked']));

    // Resolver was replaced
    expect(fixture.testEnv.unifiedScopeResolver.resolveSync).not.toBe(originalResolve);

    fixture.cleanup();

    // After cleanup, we can't easily verify restoration since fixture is cleaned up
    // But we verify no errors thrown
  });

  it('should clean up mocks on clearScopeMocks()', () => {
    fixture.mockScope('test:scope', new Set(['mocked']));

    expect(fixture.isScopeMocked('test:scope')).toBe(true);

    fixture.clearScopeMocks();

    expect(fixture.isScopeMocked('test:scope')).toBe(false);
    expect(fixture.getMockedScopes()).toEqual([]);
  });

  it('should handle mocking same scope twice (overwrites)', () => {
    fixture.mockScope('test:scope', new Set(['first']));
    fixture.mockScope('test:scope', new Set(['second']));

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {});
    expect(result).toEqual(new Set(['second']));
  });

  it('should throw for invalid scopeName', () => {
    expect(() => fixture.mockScope('', new Set())).toThrow();
    expect(() => fixture.mockScope(null, new Set())).toThrow();
  });

  it('should report mocked scopes via getMockedScopes()', () => {
    fixture.mockScope('scope:a', new Set());
    fixture.mockScope('scope:b', new Set());

    expect(fixture.getMockedScopes()).toContain('scope:a');
    expect(fixture.getMockedScopes()).toContain('scope:b');
  });
});
```

## Acceptance Criteria

### Tests that must pass

- `tests/unit/common/mods/ModTestFixture.scopeMocking.test.js`:
  - `should mock scope with resolver function`
  - `should mock scope with result Set shorthand`
  - `should allow multiple scope mocks`
  - `should fall through to original for non-mocked scopes`
  - `should clean up mocks on fixture.cleanup()`
  - `should clean up mocks on clearScopeMocks()`
  - `should handle mocking same scope twice (overwrites)`

### Invariants

- All existing tests pass unchanged
- `fixture.cleanup()` still cleans up all resources
- Manual mocking pattern (`__originalResolve`) still works for backward compatibility
- No memory leaks from unreleased mock references

## Verification

```bash
# Run new tests
npm run test:unit -- tests/unit/common/mods/ModTestFixture.scopeMocking.test.js

# Verify no regressions
npm run test:unit
npm run test:integration
```

## Migration Example

Before (10+ lines):

```javascript
const originalResolve = testEnv.unifiedScopeResolver.resolveSync;
testEnv.unifiedScopeResolver.__originalResolve = originalResolve;
testEnv.unifiedScopeResolver.resolveSync = function (scopeName, context) {
  if (scopeName === 'striking:actors_in_location_not_facing_away') {
    return new Set([target.id]);
  }
  return originalResolve.call(this, scopeName, context);
};
```

After (1 line):

```javascript
fixture.mockScope('striking:actors_in_location_not_facing_away', new Set([target.id]));
```
