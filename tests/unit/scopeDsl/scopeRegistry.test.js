// tests/scopeDsl/scopeRegistry.spec.js

import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';

describe('ScopeRegistry', () => {
  /** @type {ScopeRegistry} */
  let scopeRegistry;
  /** @type {object} */
  let mockScopeDefinitions;

  // Arrange: Create a fresh registry and mock data before each test
  beforeEach(() => {
    scopeRegistry = new ScopeRegistry();
    mockScopeDefinitions = {
      'core:all_characters': {
        expr: 'entities() | filter(e -> e.hasComponent("c-character-sheet"))',
        description: 'All entities with a character sheet.',
      },
      'core:nearby_items': {
        expr: 'in_location(actor) | filter(e -> e.hasComponent("c-item"))',
        description: 'All items in the same location as the actor.',
      },
      'mod:custom_scope': {
        expr: 'location -> entities(Item)',
        description: 'A custom scope from a mod.',
      },
    };
  });

  describe('constructor', () => {
    it('should create an instance with an empty map of scopes and be uninitialized', () => {
      // Assert
      expect(scopeRegistry.getAllScopes()).toEqual(new Map());
      expect(scopeRegistry.getStats().initialized).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should load scope definitions from an object into the registry', () => {
      // Act
      scopeRegistry.initialize({
        'core:all_characters': mockScopeDefinitions['core:all_characters'],
        'core:nearby_items': mockScopeDefinitions['core:nearby_items'],
      });

      // Assert
      expect(scopeRegistry.getStats().size).toBe(2);
      expect(scopeRegistry.getStats().initialized).toBe(true);
      expect(scopeRegistry.hasScope('core:all_characters')).toBe(true);
      expect(scopeRegistry.hasScope('core:nearby_items')).toBe(true);
    });

    it('should handle empty or undefined scope definitions gracefully', () => {
      // Act
      scopeRegistry.initialize({});

      // Assert
      expect(scopeRegistry.getStats().size).toBe(0);
      expect(scopeRegistry.getStats().initialized).toBe(true);

      // Act again with undefined
      scopeRegistry.initialize();
      expect(scopeRegistry.getStats().size).toBe(0);
      expect(scopeRegistry.getStats().initialized).toBe(true);
    });

    it('should clear any existing scopes on re-initialization', () => {
      // Arrange: Initialize with one set of scopes
      const initialScopes = {
        'initial:scope': { expr: 'entities()' },
      };
      scopeRegistry.initialize(initialScopes);
      expect(scopeRegistry.hasScope('initial:scope')).toBe(true);

      // Act: Re-initialize with a new set of scopes
      const newScopes = { 'new:scope': { expr: 'location' } };
      scopeRegistry.initialize(newScopes);

      // Assert
      expect(scopeRegistry.getStats().size).toBe(1);
      expect(scopeRegistry.hasScope('initial:scope')).toBe(false);
      expect(scopeRegistry.hasScope('new:scope')).toBe(true);
    });
  });

  describe('scope access', () => {
    beforeEach(() => {
      scopeRegistry.initialize(mockScopeDefinitions);
    });

    it('should get a scope definition by its name', () => {
      // Act
      const scope = scopeRegistry.getScope('core:all_characters');

      // Assert
      expect(scope).toEqual(mockScopeDefinitions['core:all_characters']);
    });

    it('should return null for a non-existent scope name', () => {
      // Act
      const scope = scopeRegistry.getScope('non:existent');

      // Assert
      expect(scope).toBeNull();
    });

    it('should correctly check if a scope exists with hasScope()', () => {
      // Assert
      expect(scopeRegistry.hasScope('core:nearby_items')).toBe(true);
      expect(scopeRegistry.hasScope('mod:custom_scope')).toBe(true);
      expect(scopeRegistry.hasScope('non:existent')).toBe(false);
    });

    it('should get an array of all scope names', () => {
      // Act
      const names = scopeRegistry.getAllScopeNames();

      // Assert
      expect(names).toHaveLength(3);
      expect(names).toEqual(
        expect.arrayContaining([
          'core:all_characters',
          'core:nearby_items',
          'mod:custom_scope',
        ])
      );
    });

    it('should get a map of all scopes', () => {
      // Act
      const scopes = scopeRegistry.getAllScopes();

      // Assert
      expect(scopes).toBeInstanceOf(Map);
      expect(scopes.size).toBe(3);
      expect(scopes.get('mod:custom_scope')).toEqual(
        mockScopeDefinitions['mod:custom_scope']
      );
    });

    it('should return a copy of the scopes map, not a reference', () => {
      // Act
      const scopesCopy = scopeRegistry.getAllScopes();
      scopesCopy.delete('core:all_characters'); // Modify the copy

      // Assert
      expect(scopesCopy.has('core:all_characters')).toBe(false); // The copy is changed
      expect(scopeRegistry.hasScope('core:all_characters')).toBe(true); // The original is untouched
    });

    it('should find scopes by base name when stored with namespaced names', () => {
      // Assert: Can find by exact namespaced name
      expect(scopeRegistry.getScope('core:all_characters')).toEqual(
        mockScopeDefinitions['core:all_characters']
      );
      expect(scopeRegistry.getScope('mod:custom_scope')).toEqual(
        mockScopeDefinitions['mod:custom_scope']
      );

      // Assert: Can find by base name (fallback mechanism)
      expect(scopeRegistry.getScope('all_characters')).toEqual(
        mockScopeDefinitions['core:all_characters']
      );
      expect(scopeRegistry.getScope('nearby_items')).toEqual(
        mockScopeDefinitions['core:nearby_items']
      );
      expect(scopeRegistry.getScope('custom_scope')).toEqual(
        mockScopeDefinitions['mod:custom_scope']
      );

      // Assert: Returns null for non-existent base names
      expect(scopeRegistry.getScope('nonexistent')).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics for an initialized registry', () => {
      // Arrange
      scopeRegistry.initialize({
        'core:test1': { expr: 'actor' },
        'core:test2': { expr: 'location' },
      });

      // Act
      const stats = scopeRegistry.getStats();

      // Assert
      expect(stats.size).toBe(2);
      expect(stats.initialized).toBe(true);
      expect(stats.scopeNames).toEqual(
        expect.arrayContaining(['core:test1', 'core:test2'])
      );
    });

    it('should provide accurate statistics for a new, uninitialized registry', () => {
      // Act
      const stats = scopeRegistry.getStats();

      // Assert
      expect(stats).toEqual({
        size: 0,
        initialized: false,
        scopeNames: [],
      });
    });
  });

  describe('clear', () => {
    it('should clear all scopes and reset the initialized flag', () => {
      // Arrange
      scopeRegistry.initialize(mockScopeDefinitions);
      expect(scopeRegistry.getStats().size).toBe(3);
      expect(scopeRegistry.getStats().initialized).toBe(true);

      // Act
      scopeRegistry.clear();

      // Assert
      expect(scopeRegistry.getStats().size).toBe(0);
      expect(scopeRegistry.getStats().initialized).toBe(false);
      expect(scopeRegistry.getAllScopeNames()).toEqual([]);
    });
  });
});