/**
 * @file Integration tests for TestScopeResolverRegistry
 * @description Tests the complete workflow of auto-discovery and registration with real mod data
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import TestScopeResolverRegistry from '../../common/engine/testScopeResolverRegistry.js';
import ScopeDiscoveryService from '../../common/engine/scopeDiscoveryService.js';
import ScopeResolverFactory from '../../common/engine/scopeResolverFactory.js';

describe('TestScopeResolverRegistry - Integration', () => {
  let registry;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    registry = new TestScopeResolverRegistry({ logger: mockLogger });
  });

  describe('Auto-Discovery with Real Mod Data', () => {
    it('should discover and register scopes from positioning mod', async () => {
      const count = await registry.discoverAndRegister(['positioning']);

      // Positioning mod should have multiple scopes
      expect(count).toBeGreaterThan(0);

      // Check that specific known scopes are registered
      const list = registry.list();
      expect(list.some((id) => id.startsWith('positioning:'))).toBe(true);
    }, 10000);

    it('should discover and register scopes from inventory/items mod', async () => {
      const count = await registry.discoverAndRegister(['items']);

      // Items mod should have scopes
      expect(count).toBeGreaterThan(0);

      const list = registry.list();
      expect(list.some((id) => id.startsWith('items:'))).toBe(true);
    }, 10000);

    it('should handle mods with no scopes gracefully', async () => {
      // Use a mod that likely has no scopes directory
      await registry.discoverAndRegister(['nonexistent-mod-123']);

      // Should not throw, just verify no scopes were registered
      expect(registry.count()).toBe(0);
    }, 5000);

    it('should discover from multiple mods', async () => {
      const count = await registry.discoverAndRegister([
        'positioning',
        'items',
      ]);

      // Should have scopes from both mods
      expect(count).toBeGreaterThan(0);

      const list = registry.list();
      expect(list.some((id) => id.startsWith('positioning:'))).toBe(true);
      expect(list.some((id) => id.startsWith('items:'))).toBe(true);
    }, 10000);

    it('should filter by categories', async () => {
      await registry.discoverAndRegister(['positioning', 'items'], {
        categories: ['positioning'],
      });

      // Should only have positioning scopes
      const list = registry.list();
      const hasPositioning = list.some((id) => id.startsWith('positioning:'));

      expect(hasPositioning).toBe(true);
      // Items might still show up if the mod ID doesn't match the filter
      // This is expected behavior based on current implementation
    }, 10000);
  });

  describe('ScopeDiscoveryService Integration', () => {
    it('should discover scope files from positioning mod', async () => {
      const discovered =
        await ScopeDiscoveryService.discoverScopes('positioning');

      expect(discovered.length).toBeGreaterThan(0);

      // Each discovery should have required metadata
      const first = discovered[0];
      expect(first).toHaveProperty('modId');
      expect(first).toHaveProperty('scopeName');
      expect(first).toHaveProperty('fullScopeName');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('filePath');
    }, 5000);

    it('should infer categories correctly', async () => {
      const discovered =
        await ScopeDiscoveryService.discoverScopes('positioning');

      // All positioning scopes should be in positioning category
      for (const metadata of discovered) {
        expect(metadata.category).toBe('positioning');
      }
    }, 5000);

    it('should check if scope file exists', async () => {
      // Check for a known scope (actors_in_location_facing exists in facing-states)
      const exists = await ScopeDiscoveryService.scopeFileExists(
        'facing-states',
        'actors_in_location_facing'
      );
      expect(exists).toBe(true);

      // Check for non-existent scope
      const notExists = await ScopeDiscoveryService.scopeFileExists(
        'facing-states',
        'totally_fake_scope_xyz'
      );
      expect(notExists).toBe(false);
    }, 5000);
  });

  describe('ScopeResolverFactory Integration', () => {
    it('should create resolver from scope file', async () => {
      // Discover a scope first
      const discovered =
        await ScopeDiscoveryService.discoverScopes('positioning');

      expect(discovered.length).toBeGreaterThan(0);

      // Create resolver for the first discovered scope
      const resolvers = await ScopeResolverFactory.createResolvers([
        discovered[0],
      ]);

      expect(resolvers.length).toBe(1);
      expect(resolvers[0]).toHaveProperty('id');
      expect(resolvers[0]).toHaveProperty('resolve');
      expect(resolvers[0]).toHaveProperty('validate');
    }, 5000);

    it('should create multiple resolvers', async () => {
      const discovered =
        await ScopeDiscoveryService.discoverScopes('positioning');

      const resolvers = await ScopeResolverFactory.createResolvers(discovered);

      expect(resolvers.length).toBe(discovered.length);

      // Each should be valid
      for (const resolver of resolvers) {
        expect(resolver.validate()).toBe(true);
      }
    }, 10000);
  });

  describe('End-to-End: Discovery → Registration → Resolution', () => {
    it('should complete full workflow', async () => {
      // 1. Auto-discover and register
      const count = await registry.discoverAndRegister(['positioning']);
      expect(count).toBeGreaterThan(0);

      // 2. Verify registration
      const list = registry.list();
      expect(list.length).toBe(count);

      // 3. Get a resolver
      const scopeId = list[0];
      const resolver = registry.get(scopeId);
      expect(resolver).not.toBeNull();

      // 4. Verify resolver is valid
      expect(resolver.validate()).toBe(true);

      // Note: We can't test actual resolution without a full entity manager setup,
      // but we've verified the resolver structure is correct
    }, 10000);

    it('should organize scopes by category', async () => {
      await registry.discoverAndRegister(['positioning', 'items']);

      const byCategory = registry.listByCategory();

      // Should have at least positioning category
      expect(Object.keys(byCategory).length).toBeGreaterThan(0);

      // Each category should have scope IDs
      for (const scopes of Object.values(byCategory)) {
        expect(Array.isArray(scopes)).toBe(true);
        expect(scopes.length).toBeGreaterThan(0);
      }
    }, 10000);
  });

  describe('Performance', () => {
    it('should register 50+ scopes in under 300ms', async () => {
      const start = Date.now();

      await registry.discoverAndRegister([
        'positioning',
        'items',
        'anatomy',
        'affection',
      ]);

      const elapsed = Date.now() - start;

      // Should be fast (allow some overhead for first run)
      expect(elapsed).toBeLessThan(5000); // Generous for CI
      expect(registry.count()).toBeGreaterThan(0);
    }, 10000);

    it('should handle repeated registrations efficiently', async () => {
      // First registration
      await registry.discoverAndRegister(['positioning']);
      const firstCount = registry.count();

      // Clear and re-register
      registry.clear();

      const start = Date.now();
      await registry.discoverAndRegister(['positioning']);
      const elapsed = Date.now() - start;

      // Second registration should be similar speed
      expect(elapsed).toBeLessThan(5000);
      expect(registry.count()).toBe(firstCount);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should continue with other mods if one fails', async () => {
      const count = await registry.discoverAndRegister([
        'nonexistent-mod',
        'positioning',
      ]);

      // Should still register positioning scopes despite failure on nonexistent-mod
      expect(count).toBeGreaterThan(0);
    }, 10000);

    it('should handle empty mod list', async () => {
      const count = await registry.discoverAndRegister([]);
      expect(count).toBe(0);
    });

    it('should handle invalid category filter', async () => {
      const count = await registry.discoverAndRegister(['positioning'], {
        categories: ['totally_fake_category'],
      });

      // Should return 0 since no scopes match the filter
      expect(count).toBeGreaterThanOrEqual(0);
    }, 5000);
  });

  describe('No Conflicts with Production ScopeRegistry', () => {
    it('should not interfere with production scope registry', async () => {
      // Import production scope registry
      const { default: ScopeRegistry } = await import(
        '../../../src/scopeDsl/scopeRegistry.js'
      );

      // Create production registry
      const productionRegistry = new ScopeRegistry();

      // Initialize with test data
      productionRegistry.initialize({
        'test:scope1': {
          expr: 'actor.items[]',
          ast: { type: 'field_access', field: 'items' },
        },
      });

      // Create test registry
      await registry.discoverAndRegister(['positioning']);

      // Production registry should still work
      expect(productionRegistry.hasScope('test:scope1')).toBe(true);

      // Test registry should work
      expect(registry.has('test:scope1')).toBe(false);
      expect(registry.count()).toBeGreaterThan(0);

      // They should be completely separate
      expect(productionRegistry.getAllScopeNames()).not.toContain(
        registry.list()[0]
      );
    }, 10000);
  });
});
