# TESDATREG-004: Add Helper for Custom Scope Registration

**Priority**: Medium
**Category**: Testing Infrastructure
**Timeline**: Mid-term (Next Sprint)
**Effort**: Medium (1-2 days)
**Related Report**: reports/test-dataregistry-scope-dsl-issues.md

## Overview

Add a convenience method to simplify custom scope registration in tests. Currently, registering a custom mod-specific scope requires 30+ lines of boilerplate code involving manual file loading, AST parsing, resolver function creation, and registration. This ticket provides a one-line method that handles all these steps automatically.

## Problem Statement

Testing mods with custom scopes (`.scope` files) requires verbose manual setup:

1. Load the scope file with correct path construction
2. Parse scope definitions using `parseScopeDefinitions()`
3. Extract the specific scope AST from parsed definitions
4. Create a resolver function that wraps `scopeEngine.resolve()`
5. Build the correct context object for the resolver
6. Register the resolver with `ScopeResolverHelpers._registerResolvers()`

This is 30-40 lines of repetitive code per scope, makes tests harder to read, and is error-prone.

### Current Manual Pattern

```javascript
// Current workaround - 36 lines of boilerplate
const scopeDefPath = path.join(
  __dirname,
  '../../../data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope'
);

const scopeDef = await parseScopeDefinitions(scopeDefPath);

const scopeId = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
const scopeName = 'actors_with_exposed_asshole_accessible_from_behind';

const resolver = (runtimeCtx) => {
  const scopeAst = scopeDef[scopeName];
  const context = { actor: runtimeCtx.actor };

  try {
    return testFixture.testEnv.scopeEngine.resolve(
      scopeAst,
      context,
      runtimeCtx
    );
  } catch (err) {
    testFixture.testEnv.logger.error(
      `Failed to resolve custom scope "${scopeId}":`,
      err
    );
    throw err;
  }
};

ScopeResolverHelpers._registerResolvers(testFixture.testEnv, {
  [scopeId]: resolver,
});
```

## Success Criteria

- [ ] New method `registerCustomScope()` added to ModTestFixture
- [ ] Method accepts mod ID and scope name (simple API)
- [ ] Method constructs correct file path automatically
- [ ] Method parses scope file and extracts AST
- [ ] Method creates properly-structured resolver function
- [ ] Method registers resolver with ScopeEngine
- [ ] Method handles errors with clear messages (file not found, parse errors)
- [ ] Method is tested with unit tests (90%+ coverage)
- [ ] Method is tested with integration tests using real scope files
- [ ] Method optionally auto-loads dependency conditions (from TESDATREG-003)
- [ ] Documentation updated in mod-testing-guide.md
- [ ] Existing tests refactored to use new method

## Proposed API

### Method Signature

```javascript
/**
 * Registers a custom scope from the specified mod for use in tests.
 * Automatically loads the scope file, parses it, creates a resolver,
 * and registers it with the ScopeEngine.
 *
 * @param {string} modId - The mod containing the scope
 * @param {string} scopeName - The scope name (without .scope extension)
 * @param {object} options - Optional configuration
 * @param {boolean} options.loadConditions - Auto-load dependency conditions (default: true)
 * @param {number} options.maxDepth - Max depth for condition discovery (default: 5)
 * @returns {Promise<void>}
 * @throws {Error} If scope file not found or parsing fails
 *
 * @example
 * // Simple registration
 * await testFixture.registerCustomScope(
 *   'sex-anal-penetration',
 *   'actors_with_exposed_asshole_accessible_from_behind'
 * );
 *
 * @example
 * // Disable auto-loading of conditions
 * await testFixture.registerCustomScope(
 *   'my-mod',
 *   'my-custom-scope',
 *   { loadConditions: false }
 * );
 */
async registerCustomScope(modId, scopeName, options = {})
```

### Also Add Helper to ScopeResolverHelpers

For consistency with existing helper patterns, also add a static method:

```javascript
/**
 * Convenience method for registering a custom scope.
 * Can be used when you don't have a ModTestFixture instance.
 *
 * @param {object} testEnv - Test environment from systemLogicTestEnv
 * @param {string} modId - The mod containing the scope
 * @param {string} scopeName - The scope name (without .scope extension)
 * @returns {Promise<void>}
 *
 * @example
 * ScopeResolverHelpers.registerCustomScope(
 *   testEnv,
 *   'sex-anal-penetration',
 *   'actors_with_exposed_asshole_accessible_from_behind'
 * );
 */
static async registerCustomScope(testEnv, modId, scopeName)
```

### Usage Example

```javascript
describe('insert_finger_into_asshole Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_finger_into_asshole'
    );

    // NEW: One line replaces 36 lines of boilerplate
    await testFixture.registerCustomScope(
      'sex-anal-penetration',
      'actors_with_exposed_asshole_accessible_from_behind'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should discover action when conditions are met', async () => {
    // Test implementation
  });
});
```

## Implementation Details

### Files to Modify

1. **Primary**: `tests/common/mods/ModTestFixture.js`
   - Add `registerCustomScope()` method

2. **Secondary**: `tests/common/mods/scopeResolverHelpers.js`
   - Add static `registerCustomScope()` helper method

### Implementation Approach

#### In ModTestFixture.js

```javascript
import path from 'path';
import { parseScopeDefinitions } from '../../../src/scopeDsl/parseScopeDefinitions.js';
import ScopeResolverHelpers from './scopeResolverHelpers.js';
import ScopeConditionAnalyzer from '../engine/scopeConditionAnalyzer.js'; // From TESDATREG-003

class ModTestFixture {
  /**
   * Registers a custom scope from the specified mod for use in tests.
   */
  async registerCustomScope(modId, scopeName, options = {}) {
    const {
      loadConditions = true,
      maxDepth = 5,
    } = options;

    // Validate inputs
    if (typeof modId !== 'string' || modId.trim() === '') {
      throw new Error('modId must be a non-empty string');
    }
    if (typeof scopeName !== 'string' || scopeName.trim() === '') {
      throw new Error('scopeName must be a non-empty string');
    }

    // Construct scope file path
    const scopePath = path.join(
      __dirname,
      `../../../data/mods/${modId}/scopes/${scopeName}.scope`
    );

    // Parse scope definition
    let scopeDef;
    try {
      scopeDef = await parseScopeDefinitions(scopePath);
    } catch (err) {
      throw new Error(
        `Failed to load scope file for "${modId}:${scopeName}" from ${scopePath}: ${err.message}\n\n` +
        `Verify that:\n` +
        `  1. The mod ID "${modId}" is correct\n` +
        `  2. The scope file exists at: data/mods/${modId}/scopes/${scopeName}.scope\n` +
        `  3. The scope file is valid JSON`
      );
    }

    // Verify scope name exists in parsed definition
    if (!scopeDef[scopeName]) {
      const availableScopes = Object.keys(scopeDef).join(', ');
      throw new Error(
        `Scope "${scopeName}" not found in ${scopePath}.\n` +
        `Available scopes: ${availableScopes || '(none)'}`
      );
    }

    // Auto-load dependency conditions if enabled (from TESDATREG-003)
    if (loadConditions) {
      const conditionRefs = ScopeConditionAnalyzer.extractConditionRefs(scopeDef);

      if (conditionRefs.size > 0) {
        const allConditions = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
          Array.from(conditionRefs),
          ScopeConditionAnalyzer.loadConditionDefinition.bind(ScopeConditionAnalyzer),
          maxDepth
        );

        const validation = await ScopeConditionAnalyzer.validateConditions(
          allConditions,
          scopePath
        );

        if (validation.missing.length > 0) {
          throw new Error(
            `Scope "${modId}:${scopeName}" references missing conditions:\n` +
            validation.missing.map(id => `  - ${id}`).join('\n') +
            `\n\nReferenced in: ${scopePath}`
          );
        }

        await this.loadDependencyConditions(Array.from(allConditions));
      }
    }

    // Create and register the resolver
    const scopeId = `${modId}:${scopeName}`;
    const scopeAst = scopeDef[scopeName];

    const resolver = (runtimeCtx) => {
      // Build context with actor
      const context = { actor: runtimeCtx.actor };

      try {
        return this.testEnv.scopeEngine.resolve(scopeAst, context, runtimeCtx);
      } catch (err) {
        this.testEnv.logger.error(
          `Failed to resolve custom scope "${scopeId}":`,
          err
        );
        throw new Error(
          `Scope resolution failed for "${scopeId}": ${err.message}`
        );
      }
    };

    // Register with ScopeEngine
    ScopeResolverHelpers._registerResolvers(this.testEnv, {
      [scopeId]: resolver,
    });

    this.testEnv.logger.info(
      `Registered custom scope: ${scopeId}` +
      (loadConditions ? ` (with ${conditionRefs?.size || 0} dependency conditions)` : '')
    );
  }
}
```

#### In scopeResolverHelpers.js

```javascript
import path from 'path';
import { parseScopeDefinitions } from '../../../src/scopeDsl/parseScopeDefinitions.js';

class ScopeResolverHelpers {
  /**
   * Convenience method for registering a custom scope.
   */
  static async registerCustomScope(testEnv, modId, scopeName) {
    // Construct scope file path
    const scopePath = path.join(
      __dirname,
      `../../../data/mods/${modId}/scopes/${scopeName}.scope`
    );

    // Parse scope definition
    const scopeDef = await parseScopeDefinitions(scopePath);

    if (!scopeDef[scopeName]) {
      const availableScopes = Object.keys(scopeDef).join(', ');
      throw new Error(
        `Scope "${scopeName}" not found in ${scopePath}.\n` +
        `Available scopes: ${availableScopes || '(none)'}`
      );
    }

    // Create and register the resolver
    const scopeId = `${modId}:${scopeName}`;
    const scopeAst = scopeDef[scopeName];

    const resolver = (runtimeCtx) => {
      const context = { actor: runtimeCtx.actor };

      try {
        return testEnv.scopeEngine.resolve(scopeAst, context, runtimeCtx);
      } catch (err) {
        testEnv.logger.error(`Failed to resolve custom scope "${scopeId}":`, err);
        throw err;
      }
    };

    this._registerResolvers(testEnv, {
      [scopeId]: resolver,
    });
  }
}
```

## Testing Requirements

### Unit Tests

Create `tests/unit/common/mods/ModTestFixture.registerCustomScope.test.js`:

```javascript
describe('ModTestFixture - registerCustomScope', () => {
  describe('Input Validation', () => {
    it('should throw when modId is not a string', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await expect(
        fixture.registerCustomScope(null, 'scope-name')
      ).rejects.toThrow('modId must be a non-empty string');
    });

    it('should throw when modId is empty string', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await expect(
        fixture.registerCustomScope('', 'scope-name')
      ).rejects.toThrow('modId must be a non-empty string');
    });

    it('should throw when scopeName is not a string', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await expect(
        fixture.registerCustomScope('mod-id', null)
      ).rejects.toThrow('scopeName must be a non-empty string');
    });

    it('should throw when scopeName is empty string', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await expect(
        fixture.registerCustomScope('mod-id', '')
      ).rejects.toThrow('scopeName must be a non-empty string');
    });
  });

  describe('Scope Loading', () => {
    it('should throw clear error when scope file not found', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await expect(
        fixture.registerCustomScope('nonexistent-mod', 'scope-name')
      ).rejects.toThrow(/Failed to load scope file.*nonexistent-mod/);
    });

    it('should throw clear error when scope name not in file', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      // This assumes a scope file exists but doesn't contain the requested scope
      await expect(
        fixture.registerCustomScope('positioning', 'nonexistent_scope')
      ).rejects.toThrow(/Scope "nonexistent_scope" not found/);
    });

    it('should list available scopes in error message', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      try {
        await fixture.registerCustomScope('positioning', 'nonexistent_scope');
        fail('Should have thrown');
      } catch (err) {
        expect(err.message).toMatch(/Available scopes:/);
      }
    });
  });

  describe('Scope Registration', () => {
    it('should successfully register valid custom scope', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      // Use real scope from positioning mod
      await expect(
        fixture.registerCustomScope('positioning', 'close_actors')
      ).resolves.not.toThrow();

      // Verify scope is registered
      const scopeId = 'positioning:close_actors';
      expect(fixture.testEnv.scopeEngine.resolvers.has(scopeId)).toBe(true);
    });

    it('should create working resolver function', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await fixture.registerCustomScope('positioning', 'close_actors');

      const scopeId = 'positioning:close_actors';
      const resolver = fixture.testEnv.scopeEngine.resolvers.get(scopeId);

      expect(typeof resolver).toBe('function');

      // Should be callable (actual resolution tested in integration tests)
      const mockRuntimeCtx = {
        actor: { id: 'test-actor' },
        entityManager: fixture.testEnv.entityManager,
      };

      expect(() => resolver(mockRuntimeCtx)).not.toThrow();
    });
  });

  describe('Options Handling', () => {
    it('should respect loadConditions: false option', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      // Mock ScopeConditionAnalyzer to verify it's not called
      const extractSpy = jest.spyOn(ScopeConditionAnalyzer, 'extractConditionRefs');

      await fixture.registerCustomScope(
        'positioning',
        'close_actors',
        { loadConditions: false }
      );

      expect(extractSpy).not.toHaveBeenCalled();
    });

    it('should auto-load conditions by default', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      const loadSpy = jest.spyOn(fixture, 'loadDependencyConditions');

      // Use scope that has condition refs
      await fixture.registerCustomScope(
        'sex-anal-penetration',
        'actors_with_exposed_asshole_accessible_from_behind'
      );

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('Error Messages', () => {
    it('should provide actionable error for missing scope file', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      try {
        await fixture.registerCustomScope('my-mod', 'my-scope');
        fail('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Verify that:');
        expect(err.message).toContain('The mod ID "my-mod" is correct');
        expect(err.message).toContain('data/mods/my-mod/scopes/my-scope.scope');
      }
    });
  });
});
```

### Integration Tests

Create `tests/integration/common/ModTestFixture.registerCustomScope.integration.test.js`:

```javascript
describe('ModTestFixture - registerCustomScope Integration', () => {
  it('should work end-to-end with real custom scope', async () => {
    const testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_finger_into_asshole'
    );

    // Register custom scope with auto-load
    await testFixture.registerCustomScope(
      'sex-anal-penetration',
      'actors_with_exposed_asshole_accessible_from_behind'
    );

    // Create test scenario
    const scenario = testFixture.createStandardActorTarget();

    // Set up positioning so scope resolves correctly
    testFixture.testEnv.componentMutationService.addComponents(
      scenario.target.id,
      [
        { type: 'positioning:actor_position', data: { x: 5, y: 5, z: 0, facing: 0 } },
        { type: 'anatomy:body', data: { parts: [{ type: 'asshole' }] } },
      ]
    );

    testFixture.testEnv.componentMutationService.addComponents(
      scenario.actor.id,
      [
        { type: 'positioning:actor_position', data: { x: 6, y: 5, z: 0, facing: 180 } },
      ]
    );

    // Execute action discovery
    const actions = await testFixture.discoverAvailableActions(scenario.actor.id);

    // Should discover the action
    expect(actions).toContainEqual(
      expect.objectContaining({
        actionId: 'sex-anal-penetration:insert_finger_into_asshole',
      })
    );
  });

  it('should work with ScopeResolverHelpers static method', async () => {
    const testEnv = createSystemLogicTestEnv();

    // Use static helper
    await ScopeResolverHelpers.registerCustomScope(
      testEnv,
      'sex-anal-penetration',
      'actors_with_exposed_asshole_accessible_from_behind'
    );

    // Verify scope is registered
    const scopeId = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
    expect(testEnv.scopeEngine.resolvers.has(scopeId)).toBe(true);
  });
});
```

## Edge Cases to Handle

1. **Scope file doesn't exist**: Clear error with correct path
2. **Scope name not in file**: List available scopes in error
3. **Invalid JSON in scope file**: JSON parse error with file path
4. **Scope references missing conditions**: Error from TESDATREG-003 validation
5. **Scope has syntax errors**: AST parsing error with context
6. **Empty scope file**: Error indicating no scopes found
7. **Multiple scopes in same file**: Successfully extract the requested one
8. **Scope already registered**: Idempotent (re-registration should work)

## Refactoring Impact

After implementing this ticket, update existing tests:

1. `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`
2. `tests/integration/mods/sex-anal-penetration/insert_multiple_fingers_into_asshole_action_discovery.test.js`

### Before (36 lines)

```javascript
const scopeDefPath = path.join(
  __dirname,
  '../../../data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope'
);

const scopeDef = await parseScopeDefinitions(scopeDefPath);

const scopeId = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
const scopeName = 'actors_with_exposed_asshole_accessible_from_behind';

const resolver = (runtimeCtx) => {
  const scopeAst = scopeDef[scopeName];
  const context = { actor: runtimeCtx.actor };

  try {
    return testFixture.testEnv.scopeEngine.resolve(
      scopeAst,
      context,
      runtimeCtx
    );
  } catch (err) {
    testFixture.testEnv.logger.error(
      `Failed to resolve custom scope "${scopeId}":`,
      err
    );
    throw err;
  }
};

ScopeResolverHelpers._registerResolvers(testFixture.testEnv, {
  [scopeId]: resolver,
});
```

### After (1 line)

```javascript
await testFixture.registerCustomScope(
  'sex-anal-penetration',
  'actors_with_exposed_asshole_accessible_from_behind'
);
```

**Lines reduced**: 36 → 1 (97% reduction)

## Documentation Updates

Update `docs/testing/mod-testing-guide.md`:

1. Add section "Registering Custom Scopes"
2. Show `registerCustomScope()` API
3. Document auto-loading of conditions
4. Show how to disable auto-loading when needed
5. Provide before/after comparison
6. Add troubleshooting for common errors
7. Cross-reference to TESDATREG-003 for condition loading details

## Acceptance Tests

- [ ] Method validates modId is non-empty string
- [ ] Method validates scopeName is non-empty string
- [ ] Method constructs correct file path
- [ ] Method loads and parses scope file
- [ ] Method throws clear error when file not found
- [ ] Method throws clear error when scope name not in file
- [ ] Method lists available scopes in error messages
- [ ] Method creates working resolver function
- [ ] Method registers resolver with ScopeEngine
- [ ] Method auto-loads dependency conditions by default
- [ ] Method respects loadConditions: false option
- [ ] Method handles scopes with no conditions
- [ ] Static helper method works without ModTestFixture
- [ ] Unit tests achieve 90%+ coverage
- [ ] Integration tests work with real scope files
- [ ] Existing tests successfully refactored
- [ ] Documentation is comprehensive and accurate
- [ ] No performance regression (registration < 100ms)

## Dependencies

- **TESDATREG-002**: Required (provides `loadDependencyConditions()`)
- **TESDATREG-003**: Optional but recommended (provides auto-loading logic)

## Blockers

None (can proceed after TESDATREG-002)

## Related Tickets

- **TESDATREG-002**: Provides underlying condition loading
- **TESDATREG-003**: Provides auto-loading logic (can be integrated)
- **TESDATREG-001**: Documentation will reference this new method

## Implementation Checklist

- [ ] Add `registerCustomScope()` method to ModTestFixture
- [ ] Implement input validation (modId, scopeName)
- [ ] Implement file path construction
- [ ] Implement scope file loading and parsing
- [ ] Implement error handling for file not found
- [ ] Implement error handling for scope name not found
- [ ] Implement resolver function creation
- [ ] Integrate auto-loading of conditions (if TESDATREG-003 done)
- [ ] Implement resolver registration with ScopeEngine
- [ ] Add static method to ScopeResolverHelpers
- [ ] Add informative error messages
- [ ] Add logging for successful registration
- [ ] Create unit test file with 15+ test cases
- [ ] Create integration test file with real scope
- [ ] Achieve 90%+ code coverage
- [ ] Refactor 2 existing test files
- [ ] Update documentation
- [ ] Add JSDoc comments to methods
- [ ] Run full test suite
- [ ] Run `npm run typecheck`
- [ ] Run `npx eslint` on modified files
