import { jest } from '@jest/globals';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';

describe('ScopeRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ScopeRegistry();
  });

  describe('initialization', () => {
    test('should initialize with scope definitions from registry', () => {
      const mockScopeDefinitions = {
        'core:inventory_items': {
          name: 'core:inventory_items',
          dsl: 'actor -> inventory.items[]',
          modId: 'core',
          source: 'file'
        },
        'core:equipment_items': {
          name: 'core:equipment_items',
          dsl: 'actor -> equipment.equipped[]',
          modId: 'core',
          source: 'file'
        }
      };

      registry.initialize(mockScopeDefinitions);

      expect(registry.getStats().size).toBe(2);
      expect(registry.getStats().initialized).toBe(true);
      expect(registry.hasScope('core:inventory_items')).toBe(true);
      expect(registry.hasScope('core:equipment_items')).toBe(true);
    });

    test('should handle empty scope definitions', () => {
      registry.initialize({});

      expect(registry.getStats().size).toBe(0);
      expect(registry.getStats().initialized).toBe(true);
    });

    test('should clear existing scopes on re-initialization', () => {
      const initialScopes = {
        'core:test': { name: 'core:test', dsl: 'actor', modId: 'core', source: 'file' }
      };
      const newScopes = {
        'core:new': { name: 'core:new', dsl: 'location', modId: 'core', source: 'file' }
      };

      registry.initialize(initialScopes);
      expect(registry.getStats().size).toBe(1);

      registry.initialize(newScopes);
      expect(registry.getStats().size).toBe(1);
      expect(registry.hasScope('core:test')).toBe(false);
      expect(registry.hasScope('core:new')).toBe(true);
    });
  });

  describe('scope access', () => {
    beforeEach(() => {
      const mockScopeDefinitions = {
        'core:inventory_items': {
          name: 'core:inventory_items',
          dsl: 'actor -> inventory.items[]',
          modId: 'core',
          source: 'file'
        },
        'mod:custom_scope': {
          name: 'mod:custom_scope',
          dsl: 'location -> entities(Item)',
          modId: 'mod',
          source: 'file'
        }
      };
      registry.initialize(mockScopeDefinitions);
    });

    test('should get scope by name', () => {
      const scope = registry.getScope('core:inventory_items');
      expect(scope).toEqual({
        name: 'core:inventory_items',
        dsl: 'actor -> inventory.items[]',
        modId: 'core',
        source: 'file'
      });
    });

    test('should return null for non-existent scope', () => {
      const scope = registry.getScope('non:existent');
      expect(scope).toBeNull();
    });

    test('should check if scope exists', () => {
      expect(registry.hasScope('core:inventory_items')).toBe(true);
      expect(registry.hasScope('mod:custom_scope')).toBe(true);
      expect(registry.hasScope('non:existent')).toBe(false);
    });

    test('should get all scope names', () => {
      const names = registry.getAllScopeNames();
      expect(names).toContain('core:inventory_items');
      expect(names).toContain('mod:custom_scope');
      expect(names).toHaveLength(2);
    });

    test('should get all scopes', () => {
      const scopes = registry.getAllScopes();
      expect(scopes).toBeInstanceOf(Map);
      expect(scopes.size).toBe(2);
      expect(scopes.get('core:inventory_items')).toBeDefined();
      expect(scopes.get('mod:custom_scope')).toBeDefined();
    });
  });

  describe('statistics', () => {
    test('should provide accurate statistics', () => {
      const mockScopeDefinitions = {
        'core:test1': { name: 'core:test1', dsl: 'actor', modId: 'core', source: 'file' },
        'core:test2': { name: 'core:test2', dsl: 'location', modId: 'core', source: 'file' }
      };

      registry.initialize(mockScopeDefinitions);
      const stats = registry.getStats();

      expect(stats.size).toBe(2);
      expect(stats.initialized).toBe(true);
      expect(stats.scopeNames).toContain('core:test1');
      expect(stats.scopeNames).toContain('core:test2');
    });
  });

  describe('clear functionality', () => {
    test('should clear all scopes', () => {
      const mockScopeDefinitions = {
        'core:test': { name: 'core:test', dsl: 'actor', modId: 'core', source: 'file' }
      };

      registry.initialize(mockScopeDefinitions);
      expect(registry.getStats().size).toBe(1);

      registry.clear();
      expect(registry.getStats().size).toBe(0);
      expect(registry.getStats().initialized).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    test('should return the same instance', () => {
      const instance1 = ScopeRegistry.getInstance();
      const instance2 = ScopeRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should maintain state across getInstance calls', () => {
      const instance1 = ScopeRegistry.getInstance();
      const mockScopeDefinitions = {
        'core:test': { name: 'core:test', dsl: 'actor', modId: 'core', source: 'file' }
      };
      instance1.initialize(mockScopeDefinitions);

      const instance2 = ScopeRegistry.getInstance();
      expect(instance2.hasScope('core:test')).toBe(true);
    });
  });
}); 