# TESDATREG-004: Add Helper for Custom Scope Registration

**Priority**: Medium
**Category**: Testing Infrastructure
**Timeline**: Mid-term (Next Sprint)
**Effort**: Medium (1-2 days)
**Related Report**: reports/test-dataregistry-scope-dsl-issues.md
**Status**: PARTIALLY IMPLEMENTED - Core method exists, needs unit tests and static helper

## Overview

**UPDATE**: The core `registerCustomScope()` method has already been implemented in ModActionTestFixture (lines 2141-2257 of tests/common/mods/ModTestFixture.js). This ticket now focuses on:
1. Adding comprehensive unit tests for the existing implementation
2. Adding static helper method to ScopeResolverHelpers
3. Updating documentation
4. Refactoring remaining test files to use the method

Original goal: Add a convenience method to simplify custom scope registration in tests. Currently, registering a custom mod-specific scope requires 30+ lines of boilerplate code involving manual file loading, AST parsing, resolver function creation, and registration. This ticket provides a one-line method that handles all these steps automatically.

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

**Already Implemented:**
- [x] Method `registerCustomScope()` added to ModActionTestFixture (lines 2141-2257)
- [x] Method accepts mod ID and scope name (simple API)
- [x] Method constructs correct file path automatically
- [x] Method parses scope file and extracts AST
- [x] Method creates properly-structured resolver function
- [x] Method registers resolver with UnifiedScopeResolver via ScopeResolverHelpers
- [x] Method handles errors with clear messages (file not found, parse errors)
- [x] Method tested with integration tests using real scope files (tests/integration/common/ModTestFixture.autoLoadConditions.integration.test.js)
- [x] Method auto-loads dependency conditions (from TESDATREG-003)
- [x] Some existing tests refactored to use method (insert_finger_into_asshole, insert_multiple_fingers_into_asshole, push_glans_into_asshole)

**Still Needed:**
- [ ] Add comprehensive unit tests (90%+ coverage) for registerCustomScope method
- [ ] Add static `registerCustomScope()` helper to ScopeResolverHelpers class
- [ ] Documentation updated in mod-testing-guide.md
- [ ] Remaining tests refactored to use new method (if any exist)

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
   - ✅ ALREADY DONE: `registerCustomScope()` method exists (lines 2141-2257)
   - Location: ModActionTestFixture class

2. **Secondary**: `tests/common/mods/scopeResolverHelpers.js`
   - ⚠️ TODO: Add static `registerCustomScope()` helper method

3. **Testing**: `tests/unit/common/mods/ModTestFixture.registerCustomScope.test.js`
   - ⚠️ TODO: Create comprehensive unit test file

4. **Documentation**: `docs/testing/mod-testing-guide.md`
   - ⚠️ TODO: Document the registerCustomScope API

### Implementation Approach

#### In ModTestFixture.js (ALREADY IMPLEMENTED)

**ACTUAL IMPLEMENTATION** (already exists at lines 2141-2257):

```javascript
// Correct imports that are actually used:
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';  // Note: scopeDefinitionParser.js, not parseScopeDefinitions.js
import { ScopeResolverHelpers } from './scopeResolverHelpers.js';
import ScopeConditionAnalyzer from '../engine/scopeConditionAnalyzer.js';

// Actual implementation is in ModActionTestFixture class (lines 2141-2257)
// Key differences from workflow proposal:
//
// 1. File reading: Must read file first, then parse
//    ACTUAL: const scopeContent = await fs.readFile(scopePath, 'utf-8');
//            const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);
//    PROPOSED (WRONG): const scopeDef = await parseScopeDefinitions(scopePath);
//
// 2. Return type: parseScopeDefinitions returns a Map, not an object
//    ACTUAL: parsedScopes.get(fullScopeName)
//    PROPOSED (WRONG): scopeDef[scopeName]
//
// 3. Scope name: Must use full namespaced name
//    ACTUAL: const fullScopeName = `${modId}:${scopeName}`;
//            const scopeData = parsedScopes.get(fullScopeName);
//    PROPOSED (WRONG): scopeDef[scopeName]
//
// 4. Scope resolution: Creates local ScopeEngine instance
//    ACTUAL: const { default: ScopeEngine } = await import('../../../src/scopeDsl/engine.js');
//            const scopeEngine = new ScopeEngine();
//            const result = scopeEngine.resolve(scopeData.ast, context, runtimeCtx);
//    PROPOSED (WRONG): this.testEnv.scopeEngine.resolve(scopeAst, context, runtimeCtx);
//
// 5. _registerResolvers signature: Takes 3 parameters
//    ACTUAL: ScopeResolverHelpers._registerResolvers(this.testEnv, this.testEnv.entityManager, { [fullScopeName]: resolver });
//    PROPOSED (WRONG): ScopeResolverHelpers._registerResolvers(this.testEnv, { [scopeId]: resolver });
//
// 6. Path construction: Uses process.cwd() and resolve()
//    ACTUAL: const scopePath = resolve(process.cwd(), `data/mods/${modId}/scopes/${scopeName}.scope`);
//    PROPOSED (WRONG): path.join(__dirname, `../../../data/mods/${modId}/scopes/${scopeName}.scope`)
//
// The actual implementation is correct and working. See tests/common/mods/ModTestFixture.js lines 2141-2257.
```

#### In scopeResolverHelpers.js (TODO - NOT YET IMPLEMENTED)

**STATUS**: This static helper method does NOT exist yet and needs to be added.

**PROPOSED IMPLEMENTATION** (based on actual codebase patterns):

```javascript
import { promises as fs } from 'fs';
import { resolve } from 'path';
import process from 'node:process';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';

export class ScopeResolverHelpers {
  // ... existing methods ...

  /**
   * Convenience method for registering a custom scope without a ModTestFixture instance.
   *
   * @param {object} testEnv - Test environment from createSystemLogicTestEnv()
   * @param {string} modId - The mod containing the scope
   * @param {string} scopeName - The scope name (without .scope extension)
   * @returns {Promise<void>}
   * @throws {Error} If scope file not found or parsing fails
   */
  static async registerCustomScope(testEnv, modId, scopeName) {
    // Validate inputs
    if (!modId || typeof modId !== 'string') {
      throw new Error('modId must be a non-empty string');
    }
    if (!scopeName || typeof scopeName !== 'string') {
      throw new Error('scopeName must be a non-empty string');
    }

    // Construct scope file path
    const scopePath = resolve(
      process.cwd(),
      `data/mods/${modId}/scopes/${scopeName}.scope`
    );

    // Read scope file
    let scopeContent;
    try {
      scopeContent = await fs.readFile(scopePath, 'utf-8');
    } catch (err) {
      throw new Error(
        `Failed to read scope file at ${scopePath}: ${err.message}`
      );
    }

    // Parse scope definitions (returns Map)
    let parsedScopes;
    try {
      parsedScopes = parseScopeDefinitions(scopeContent, scopePath);
    } catch (err) {
      throw new Error(
        `Failed to parse scope file at ${scopePath}: ${err.message}`
      );
    }

    // Get scope data (must use full namespaced name)
    const fullScopeName = `${modId}:${scopeName}`;
    const scopeData = parsedScopes.get(fullScopeName);

    if (!scopeData) {
      const availableScopes = Array.from(parsedScopes.keys()).join(', ');
      throw new Error(
        `Scope "${fullScopeName}" not found in file ${scopePath}. ` +
        `Available scopes: ${availableScopes || '(none)'}`
      );
    }

    // Create and register the resolver (note: creates local ScopeEngine instance)
    const { default: ScopeEngine } = await import(
      '../../../src/scopeDsl/engine.js'
    );
    const scopeEngine = new ScopeEngine();

    const resolver = (context) => {
      const runtimeCtx = {
        entityManager: testEnv.entityManager,
        jsonLogicEval: testEnv.jsonLogic,
        logger: testEnv.logger,
      };

      try {
        const result = scopeEngine.resolve(scopeData.ast, context, runtimeCtx);
        return { success: true, value: result };
      } catch (err) {
        return {
          success: false,
          error: `Failed to resolve scope "${fullScopeName}": ${err.message}`,
        };
      }
    };

    // Register with proper signature (3 parameters)
    this._registerResolvers(testEnv, testEnv.entityManager, {
      [fullScopeName]: resolver,
    });
  }
}
```

**IMPLEMENTATION NOTES**:
- Must mirror the actual implementation in ModActionTestFixture
- parseScopeDefinitions takes (content, filePath), not just filePath
- Returns a Map, access with .get(fullScopeName)
- fullScopeName must include mod prefix: `${modId}:${scopeName}`
- _registerResolvers takes 3 params: (testEnv, entityManager, resolvers)
- Creates local ScopeEngine instance via dynamic import

## Testing Requirements

### Integration Tests (ALREADY EXIST)

**STATUS**: Integration tests already exist at:
- `tests/integration/common/ModTestFixture.autoLoadConditions.integration.test.js`

These tests cover:
- Auto-loading conditions when registering custom scope
- Error handling for missing scope files
- Error handling for scope name not found in file
- Disabling auto-load with `loadConditions: false` option
- Handling scopes with multiple condition_refs

### Unit Tests (TODO - STILL NEEDED)

**STATUS**: No unit tests exist yet. Must create comprehensive unit test file.

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

### Additional Integration Test Scenarios (OPTIONAL)

**STATUS**: Basic integration tests exist. Could add more comprehensive scenarios if needed.

**ALREADY TESTED** in existing files:
- `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`
- `tests/integration/mods/sex-anal-penetration/insert_multiple_fingers_into_asshole_action_discovery.test.js`
- `tests/integration/mods/sex-anal-penetration/push_glans_into_asshole_action_discovery.test.js`

These files demonstrate real-world usage of `registerCustomScope()` in action discovery tests.

**OPTIONAL ADDITION**: Test for ScopeResolverHelpers static method (when implemented):

```javascript
// Add to tests/integration/common/ModTestFixture.autoLoadConditions.integration.test.js

it('should work with ScopeResolverHelpers static method', async () => {
  const testEnv = createSystemLogicTestEnv();

  // Use static helper (once implemented)
  await ScopeResolverHelpers.registerCustomScope(
    testEnv,
    'sex-dry-intimacy',
    'actors_with_exposed_ass_facing_away'
  );

  // Verify scope was registered
  const fullScopeName = 'sex-dry-intimacy:actors_with_exposed_ass_facing_away';

  // Note: testEnv uses unifiedScopeResolver, not scopeEngine
  // Verification would need to check if resolver was registered via _registeredResolvers
  expect(testEnv._registeredResolvers.has(fullScopeName)).toBe(true);
});
```

## Edge Cases to Handle

**STATUS**: All edge cases are already handled in the existing implementation.

1. ✅ **Scope file doesn't exist**: Clear error with correct path (implemented)
2. ✅ **Scope name not in file**: List available scopes in error (implemented)
3. ✅ **Invalid scope file**: Parse error with file path (implemented)
4. ✅ **Scope references missing conditions**: Error from TESDATREG-003 validation (implemented)
5. ✅ **Scope has syntax errors**: AST parsing error with context (implemented via parseScopeDefinitions)
6. ✅ **Empty scope file**: Error indicating no scopes found (handled by parseScopeDefinitions)
7. ✅ **Multiple scopes in same file**: Successfully extracts the requested one (implemented)
8. ✅ **Scope already registered**: Idempotent - re-registration works (implemented)

## Refactoring Impact

**STATUS**: Most refactoring is already complete.

**ALREADY REFACTORED** (using registerCustomScope):
1. ✅ `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`
2. ✅ `tests/integration/mods/sex-anal-penetration/insert_multiple_fingers_into_asshole_action_discovery.test.js`
3. ✅ `tests/integration/mods/sex-anal-penetration/push_glans_into_asshole_action_discovery.test.js`

**TODO**: Check if any other tests need refactoring (search for manual scope registration patterns)

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

**Core Method (COMPLETE):**
- [x] Method validates modId is non-empty string
- [x] Method validates scopeName is non-empty string
- [x] Method constructs correct file path
- [x] Method loads and parses scope file
- [x] Method throws clear error when file not found
- [x] Method throws clear error when scope name not in file
- [x] Method lists available scopes in error messages
- [x] Method creates working resolver function
- [x] Method registers resolver with UnifiedScopeResolver
- [x] Method auto-loads dependency conditions by default
- [x] Method respects loadConditions: false option
- [x] Method handles scopes with no conditions
- [x] Integration tests work with real scope files
- [x] Existing tests successfully refactored (3 files)
- [x] No performance regression (registration is fast)

**Still Needed:**
- [ ] Static helper method works without ModTestFixture (ScopeResolverHelpers.registerCustomScope)
- [ ] Unit tests achieve 90%+ coverage
- [ ] Documentation is comprehensive and accurate

## Dependencies

- **TESDATREG-002**: ✅ COMPLETE (provides `loadDependencyConditions()`)
- **TESDATREG-003**: ✅ COMPLETE (provides auto-loading logic - already integrated)

## Blockers

None - core implementation is complete. Remaining work is independent.

## Related Tickets

- **TESDATREG-002**: Provides underlying condition loading
- **TESDATREG-003**: Provides auto-loading logic (can be integrated)
- **TESDATREG-001**: Documentation will reference this new method

## Implementation Checklist

**Core Implementation (COMPLETE):**
- [x] Add `registerCustomScope()` method to ModActionTestFixture (lines 2141-2257)
- [x] Implement input validation (modId, scopeName)
- [x] Implement file path construction
- [x] Implement scope file loading and parsing
- [x] Implement error handling for file not found
- [x] Implement error handling for scope name not found
- [x] Implement resolver function creation
- [x] Integrate auto-loading of conditions (TESDATREG-003)
- [x] Implement resolver registration with UnifiedScopeResolver
- [x] Add informative error messages
- [x] Create integration test file with real scope (ModTestFixture.autoLoadConditions.integration.test.js)
- [x] Refactor 3 existing test files (insert_finger, insert_multiple_fingers, push_glans)
- [x] Add JSDoc comments to methods

**Remaining Tasks:**
- [ ] Add static `registerCustomScope()` method to ScopeResolverHelpers class
- [ ] Create unit test file: `tests/unit/common/mods/ModTestFixture.registerCustomScope.test.js` with 15+ test cases
- [ ] Achieve 90%+ code coverage for registerCustomScope method
- [ ] Update documentation: `docs/testing/mod-testing-guide.md`
- [ ] Search for and refactor any remaining manual scope registration patterns
- [ ] Run full test suite after adding unit tests
- [ ] Run `npm run typecheck` on modified files
- [ ] Run `npx eslint` on modified files
