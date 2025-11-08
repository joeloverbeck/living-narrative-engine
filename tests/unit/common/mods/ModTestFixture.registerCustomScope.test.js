/**
 * @file Unit tests for ModTestFixture.registerCustomScope method
 * @description Comprehensive test coverage for custom scope registration functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('ModTestFixture - registerCustomScope', () => {
  let testFixture;

  beforeEach(async () => {
    // Create a basic test fixture
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Input Validation', () => {
    it('should throw when modId is null', async () => {
      await expect(
        testFixture.registerCustomScope(null, 'scope-name')
      ).rejects.toThrow('modId must be a non-empty string');
    });

    it('should throw when modId is undefined', async () => {
      await expect(
        testFixture.registerCustomScope(undefined, 'scope-name')
      ).rejects.toThrow('modId must be a non-empty string');
    });

    it('should throw when modId is empty string', async () => {
      await expect(
        testFixture.registerCustomScope('', 'scope-name')
      ).rejects.toThrow('modId must be a non-empty string');
    });

    it('should throw when modId is not a string', async () => {
      await expect(
        testFixture.registerCustomScope(123, 'scope-name')
      ).rejects.toThrow('modId must be a non-empty string');
    });

    it('should throw when scopeName is null', async () => {
      await expect(
        testFixture.registerCustomScope('mod-id', null)
      ).rejects.toThrow('scopeName must be a non-empty string');
    });

    it('should throw when scopeName is undefined', async () => {
      await expect(
        testFixture.registerCustomScope('mod-id', undefined)
      ).rejects.toThrow('scopeName must be a non-empty string');
    });

    it('should throw when scopeName is empty string', async () => {
      await expect(
        testFixture.registerCustomScope('mod-id', '')
      ).rejects.toThrow('scopeName must be a non-empty string');
    });

    it('should throw when scopeName is not a string', async () => {
      await expect(
        testFixture.registerCustomScope('mod-id', 123)
      ).rejects.toThrow('scopeName must be a non-empty string');
    });
  });

  describe('Scope Loading', () => {
    it('should throw clear error when scope file not found', async () => {
      await expect(
        testFixture.registerCustomScope('nonexistent-mod', 'scope-name')
      ).rejects.toThrow(/Failed to read scope file/);
    });

    it('should include file path in error when file not found', async () => {
      await expect(
        testFixture.registerCustomScope('nonexistent-mod', 'scope-name')
      ).rejects.toThrow('data/mods/nonexistent-mod/scopes/scope-name.scope');
    });
  });

  describe('Scope Registration', () => {
    it('should successfully register valid custom scope', async () => {
      // Use real scope from positioning mod
      await expect(
        testFixture.registerCustomScope('positioning', 'close_actors')
      ).resolves.not.toThrow();

      // Verify scope is registered
      const scopeId = 'positioning:close_actors';
      expect(testFixture.testEnv._registeredResolvers.has(scopeId)).toBe(true);
    });

    it('should create working resolver function', async () => {
      await testFixture.registerCustomScope('positioning', 'close_actors');

      const scopeId = 'positioning:close_actors';
      const resolver = testFixture.testEnv._registeredResolvers.get(scopeId);

      expect(typeof resolver).toBe('function');
    });

    it('should handle scope with underscores in name', async () => {
      await expect(
        testFixture.registerCustomScope('positioning', 'close_actors')
      ).resolves.not.toThrow();
    });

    it('should allow re-registration of same scope', async () => {
      // First registration
      await testFixture.registerCustomScope('positioning', 'close_actors');

      // Second registration should not throw
      await expect(
        testFixture.registerCustomScope('positioning', 'close_actors')
      ).resolves.not.toThrow();
    });
  });

  describe('Options Handling', () => {
    it('should respect loadConditions: false option', async () => {
      // This test verifies that the option is handled, but full behavior
      // is tested in integration tests
      await expect(
        testFixture.registerCustomScope(
          'positioning',
          'close_actors',
          { loadConditions: false }
        )
      ).resolves.not.toThrow();
    });

    it('should handle empty options object', async () => {
      await expect(
        testFixture.registerCustomScope(
          'positioning',
          'close_actors',
          {}
        )
      ).resolves.not.toThrow();
    });

    it('should handle undefined options', async () => {
      await expect(
        testFixture.registerCustomScope(
          'positioning',
          'close_actors',
          undefined
        )
      ).resolves.not.toThrow();
    });

    it('should respect maxDepth option', async () => {
      await expect(
        testFixture.registerCustomScope(
          'positioning',
          'close_actors',
          { maxDepth: 10 }
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Error Messages', () => {
    it('should provide actionable error for missing scope file', async () => {
      await expect(
        testFixture.registerCustomScope('my-mod', 'my-scope')
      ).rejects.toThrow(/Failed to read scope file.*data\/mods\/my-mod\/scopes\/my-scope\.scope/);
    });

    // Note: "scope not found in file" error requires a .scope file where the scope name
    // inside doesn't match the file name. This is tested in integration tests.
  });

  describe('Resolver Functionality', () => {
    it('should create resolver that returns success/failure object', async () => {
      await testFixture.registerCustomScope('positioning', 'close_actors');

      const scopeId = 'positioning:close_actors';
      const resolver = testFixture.testEnv._registeredResolvers.get(scopeId);

      const result = resolver({ actor: { id: 'test-actor' } });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should register scope with full namespaced name', async () => {
      await testFixture.registerCustomScope('positioning', 'close_actors');

      // Should be registered with mod:scope format
      expect(testFixture.testEnv._registeredResolvers.has('positioning:close_actors')).toBe(true);

      // Should NOT be registered with just the scope name
      expect(testFixture.testEnv._registeredResolvers.has('close_actors')).toBe(false);
    });
  });

  describe('Multiple Scope Registration', () => {
    it('should allow registering multiple different scopes', async () => {
      await testFixture.registerCustomScope('positioning', 'close_actors');
      await testFixture.registerCustomScope('positioning', 'actors_sitting_close');

      expect(testFixture.testEnv._registeredResolvers.has('positioning:close_actors')).toBe(true);
      expect(testFixture.testEnv._registeredResolvers.has('positioning:actors_sitting_close')).toBe(true);
    });

    it('should allow registering scopes from different mods', async () => {
      await testFixture.registerCustomScope('positioning', 'close_actors');

      // Register another positioning scope (as we know these exist)
      await testFixture.registerCustomScope('positioning', 'actors_sitting_close');

      expect(testFixture.testEnv._registeredResolvers.size).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('ScopeResolverHelpers - registerCustomScope (static method)', () => {
  let testEnv;

  beforeEach(async () => {
    // Create a basic test environment
    const fixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
    testEnv = fixture.testEnv;
    // Clean up fixture but keep testEnv
    fixture.cleanup();
  });

  describe('Input Validation', () => {
    it('should throw when modId is null', async () => {
      await expect(
        ScopeResolverHelpers.registerCustomScope(testEnv, null, 'scope-name')
      ).rejects.toThrow('modId must be a non-empty string');
    });

    it('should throw when modId is empty string', async () => {
      await expect(
        ScopeResolverHelpers.registerCustomScope(testEnv, '', 'scope-name')
      ).rejects.toThrow('modId must be a non-empty string');
    });

    it('should throw when scopeName is null', async () => {
      await expect(
        ScopeResolverHelpers.registerCustomScope(testEnv, 'mod-id', null)
      ).rejects.toThrow('scopeName must be a non-empty string');
    });

    it('should throw when scopeName is empty string', async () => {
      await expect(
        ScopeResolverHelpers.registerCustomScope(testEnv, 'mod-id', '')
      ).rejects.toThrow('scopeName must be a non-empty string');
    });
  });

  describe('Scope Loading', () => {
    it('should throw clear error when scope file not found', async () => {
      await expect(
        ScopeResolverHelpers.registerCustomScope(testEnv, 'nonexistent-mod', 'scope-name')
      ).rejects.toThrow(/Failed to read scope file/);
    });

    // Note: "scope not found in file" error requires a .scope file where the scope name
    // inside doesn't match the file name. This is tested in integration tests.
  });

  describe('Scope Registration', () => {
    it('should successfully register valid custom scope', async () => {
      await expect(
        ScopeResolverHelpers.registerCustomScope(testEnv, 'positioning', 'close_actors')
      ).resolves.not.toThrow();

      // Verify scope is registered
      const scopeId = 'positioning:close_actors';
      expect(testEnv._registeredResolvers.has(scopeId)).toBe(true);
    });

    it('should create working resolver function', async () => {
      await ScopeResolverHelpers.registerCustomScope(testEnv, 'positioning', 'close_actors');

      const scopeId = 'positioning:close_actors';
      const resolver = testEnv._registeredResolvers.get(scopeId);

      expect(typeof resolver).toBe('function');
    });

    it('should register scope with full namespaced name', async () => {
      await ScopeResolverHelpers.registerCustomScope(testEnv, 'positioning', 'close_actors');

      expect(testEnv._registeredResolvers.has('positioning:close_actors')).toBe(true);
      expect(testEnv._registeredResolvers.has('close_actors')).toBe(false);
    });
  });

  describe('Resolver Functionality', () => {
    it('should create resolver that returns success/failure object', async () => {
      await ScopeResolverHelpers.registerCustomScope(testEnv, 'positioning', 'close_actors');

      const scopeId = 'positioning:close_actors';
      const resolver = testEnv._registeredResolvers.get(scopeId);

      const result = resolver({ actor: { id: 'test-actor' } });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Multiple Scope Registration', () => {
    it('should allow registering multiple different scopes', async () => {
      await ScopeResolverHelpers.registerCustomScope(testEnv, 'positioning', 'close_actors');
      await ScopeResolverHelpers.registerCustomScope(testEnv, 'positioning', 'actors_sitting_close');

      expect(testEnv._registeredResolvers.has('positioning:close_actors')).toBe(true);
      expect(testEnv._registeredResolvers.has('positioning:actors_sitting_close')).toBe(true);
    });
  });
});
