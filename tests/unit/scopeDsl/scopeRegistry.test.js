// tests/scopeDsl/scopeRegistry.spec.js

import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { ScopeResolutionError } from '../../../src/scopeDsl/errors/scopeResolutionError.js';
import { addMockAstsToScopes } from '../../common/scopeDsl/mockAstGenerator.js';

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
      scopeRegistry.initialize(
        addMockAstsToScopes({
          'core:all_characters': mockScopeDefinitions['core:all_characters'],
          'core:nearby_items': mockScopeDefinitions['core:nearby_items'],
        })
      );

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
      scopeRegistry.initialize(addMockAstsToScopes(initialScopes));
      expect(scopeRegistry.hasScope('initial:scope')).toBe(true);

      // Act: Re-initialize with a new set of scopes
      const newScopes = { 'new:scope': { expr: 'location' } };
      scopeRegistry.initialize(addMockAstsToScopes(newScopes));

      // Assert
      expect(scopeRegistry.getStats().size).toBe(1);
      expect(scopeRegistry.hasScope('initial:scope')).toBe(false);
      expect(scopeRegistry.hasScope('new:scope')).toBe(true);
    });

    it('should throw error when scope definition is not an object', () => {
      // Test various non-object types
      const invalidDefinitions = [
        { 'test:scope': 'string' },
        { 'test:scope': 123 },
        { 'test:scope': true },
      ];

      invalidDefinitions.forEach((invalidDef) => {
        expect(() => scopeRegistry.initialize(invalidDef)).toThrow(
          `Invalid scope definition for 'test:scope': expected an object but got ${typeof Object.values(invalidDef)[0]}`
        );
      });

      // Test null specifically - it passes typeof object check but fails truthy check
      expect(() => scopeRegistry.initialize({ 'test:scope': null })).toThrow(
        "Invalid scope definition for 'test:scope': expected an object but got object"
      );
    });

    it('should throw error when scope definition is an array (which is object type but invalid)', () => {
      // Arrays are typeof 'object' but don't have expr property
      expect(() => scopeRegistry.initialize({ 'test:scope': [] })).toThrow(
        "Invalid scope definition for 'test:scope': missing or invalid 'expr' property"
      );
    });

    it('should throw error when scope definition has missing expr property', () => {
      const scopeWithoutExpr = {
        'test:scope': { description: 'A scope without expr' },
      };

      expect(() => scopeRegistry.initialize(scopeWithoutExpr)).toThrow(
        "Invalid scope definition for 'test:scope': missing or invalid 'expr' property"
      );
    });

    it('should throw error when scope definition has invalid expr property', () => {
      const invalidExprTypes = [
        { 'test:scope': { expr: null } },
        { 'test:scope': { expr: 123 } },
        { 'test:scope': { expr: [] } },
        { 'test:scope': { expr: {} } },
      ];

      invalidExprTypes.forEach((invalidDef) => {
        expect(() => scopeRegistry.initialize(invalidDef)).toThrow(
          "Invalid scope definition for 'test:scope': missing or invalid 'expr' property"
        );
      });
    });

    it('should throw error when scope definition has missing ast property', () => {
      const scopeWithoutAst = {
        'test:scope': { expr: 'entities()' },
      };

      expect(() => scopeRegistry.initialize(scopeWithoutAst)).toThrow(
        "Invalid scope definition for 'test:scope': missing or invalid 'ast' property. All scopes must have pre-parsed ASTs."
      );
    });

    it('should throw error when scope definition has invalid ast property', () => {
      const invalidAstTypes = [
        { 'test:scope': { expr: 'entities()', ast: null } },
        { 'test:scope': { expr: 'entities()', ast: 'string' } },
        { 'test:scope': { expr: 'entities()', ast: 123 } },
        { 'test:scope': { expr: 'entities()', ast: true } },
      ];

      invalidAstTypes.forEach((invalidDef) => {
        expect(() => scopeRegistry.initialize(invalidDef)).toThrow(
          "Invalid scope definition for 'test:scope': missing or invalid 'ast' property. All scopes must have pre-parsed ASTs."
        );
      });
    });
  });

  describe('scope access', () => {
    beforeEach(() => {
      scopeRegistry.initialize(addMockAstsToScopes(mockScopeDefinitions));
    });

    describe('getScopeOrThrow', () => {
      it('returns the scope data when the scope exists', () => {
        const scope = scopeRegistry.getScopeOrThrow('core:all_characters');

        expect(scope).toBeDefined();
        expect(scope.expr).toBe(
          mockScopeDefinitions['core:all_characters'].expr
        );
      });

      it('throws a ScopeResolutionError with helpful suggestions when the scope is missing', () => {
        // Arrange: add additional scopes to verify suggestion trimming
        const extendedScopes = addMockAstsToScopes({
          'core:scope1': { expr: 'scope1()' },
          'core:scope2': { expr: 'scope2()' },
          'core:scope3': { expr: 'scope3()' },
          'core:scope4': { expr: 'scope4()' },
          'core:scope5': { expr: 'scope5()' },
          'core:scope6': { expr: 'scope6()' },
        });
        scopeRegistry.initialize({
          ...addMockAstsToScopes(mockScopeDefinitions),
          ...extendedScopes,
        });

        expect(() =>
          scopeRegistry.getScopeOrThrow('core:missing_scope')
        ).toThrow(ScopeResolutionError);

        try {
          scopeRegistry.getScopeOrThrow('core:missing_scope');
        } catch (error) {
          expect(error).toBeInstanceOf(ScopeResolutionError);
          expect(error.message).toBe('Scope "core:missing_scope" not found');

          const context = error.context;
          expect(context.scopeName).toBe('core:missing_scope');
          expect(context.phase).toBe('scope lookup');
          expect(context.parameters).toEqual({
            requestedScope: 'core:missing_scope',
            totalRegisteredScopes: scopeRegistry.getAllScopeNames().length,
          });
          expect(context.hint).toBe(
            'Check that the scope is registered and the name is correct'
          );
          expect(context.suggestion).toMatch(/Available scopes \(first 5\):/);
          expect(context.suggestion.split(': ')[1].split(', ').length).toBe(5);
          expect(context.example).toMatch(/scopeRegistry\.getScope\('/);
        }
      });

      it('throws a ScopeResolutionError without suggestions when no scopes are registered', () => {
        const emptyRegistry = new ScopeRegistry();

        expect(() =>
          emptyRegistry.getScopeOrThrow('core:missing_scope')
        ).toThrow(ScopeResolutionError);

        try {
          emptyRegistry.getScopeOrThrow('core:missing_scope');
        } catch (error) {
          expect(error.context.scopeName).toBe('core:missing_scope');
          expect(error.context.suggestion).toBe(
            'No scopes are currently registered'
          );
          expect(error.context.example).toBeUndefined();
        }
      });
    });

    it('should get a scope definition by its name', () => {
      // Act
      const scope = scopeRegistry.getScope('core:all_characters');

      // Assert
      expect(scope).toBeDefined();
      expect(scope.expr).toBe(mockScopeDefinitions['core:all_characters'].expr);
      expect(scope.description).toBe(
        mockScopeDefinitions['core:all_characters'].description
      );
      expect(scope.ast).toBeDefined();
      expect(scope.ast._mock).toBe(true);
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
      const customScope = scopes.get('mod:custom_scope');
      expect(customScope.expr).toBe(
        mockScopeDefinitions['mod:custom_scope'].expr
      );
      expect(customScope.description).toBe(
        mockScopeDefinitions['mod:custom_scope'].description
      );
      expect(customScope.ast).toBeDefined();
    });

    it('should return a copy of the scopes map, not a reference', () => {
      // Act
      const scopesCopy = scopeRegistry.getAllScopes();
      scopesCopy.delete('core:all_characters'); // Modify the copy

      // Assert
      expect(scopesCopy.has('core:all_characters')).toBe(false); // The copy is changed
      expect(scopeRegistry.hasScope('core:all_characters')).toBe(true); // The original is untouched
    });

    it('should require namespaced scope names (no fallback)', () => {
      // Assert: Can find by exact namespaced name
      const allCharsScope = scopeRegistry.getScope('core:all_characters');
      expect(allCharsScope.expr).toBe(
        mockScopeDefinitions['core:all_characters'].expr
      );
      expect(allCharsScope.ast).toBeDefined();

      const customScope = scopeRegistry.getScope('mod:custom_scope');
      expect(customScope.expr).toBe(
        mockScopeDefinitions['mod:custom_scope'].expr
      );
      expect(customScope.ast).toBeDefined();

      // Assert: Should throw error for non-namespaced names (no fallback)
      expect(() => scopeRegistry.getScope('all_characters')).toThrow(
        "Scope names must be namespaced (e.g., 'core:all_characters'), but got: 'all_characters'. Only 'none' and 'self' are allowed without namespace."
      );
      expect(() => scopeRegistry.getScope('nearby_items')).toThrow(
        "Scope names must be namespaced (e.g., 'core:nearby_items'), but got: 'nearby_items'. Only 'none' and 'self' are allowed without namespace."
      );
      expect(() => scopeRegistry.getScope('custom_scope')).toThrow(
        "Scope names must be namespaced (e.g., 'core:custom_scope'), but got: 'custom_scope'. Only 'none' and 'self' are allowed without namespace."
      );

      // Assert: Returns null for non-existent namespaced names
      expect(scopeRegistry.getScope('nonexistent:scope')).toBeNull();
    });

    it('should return null for special scope names "none" and "self"', () => {
      // These special cases are handled by target resolution service, not registry
      expect(scopeRegistry.getScope('none')).toBeNull();
      expect(scopeRegistry.getScope('self')).toBeNull();
    });
  });

  describe('getScopeAst', () => {
    beforeEach(() => {
      scopeRegistry.initialize(addMockAstsToScopes(mockScopeDefinitions));
    });

    it('should return the AST for a valid scope name', () => {
      // Act
      const ast = scopeRegistry.getScopeAst('core:all_characters');

      // Assert
      expect(ast).toBeDefined();
      expect(ast).toMatchObject({
        type: 'Source',
        kind: 'mock',
        expression: mockScopeDefinitions['core:all_characters'].expr,
        _mock: true,
      });
      expect(typeof ast._timestamp).toBe('number');
    });

    it('should return null for a non-existent scope name', () => {
      // Act
      const ast = scopeRegistry.getScopeAst('nonexistent:scope');

      // Assert
      expect(ast).toBeNull();
    });

    it('should return null for special scope names "none" and "self"', () => {
      // Act & Assert
      expect(scopeRegistry.getScopeAst('none')).toBeNull();
      expect(scopeRegistry.getScopeAst('self')).toBeNull();
    });

    it('should throw error for non-namespaced scope names', () => {
      // Assert
      expect(() => scopeRegistry.getScopeAst('all_characters')).toThrow(
        "Scope names must be namespaced (e.g., 'core:all_characters'), but got: 'all_characters'. Only 'none' and 'self' are allowed without namespace."
      );
    });

    it('should return null when scope exists but has no AST', () => {
      // Arrange: Manually add a scope without AST (bypassing normal validation)
      scopeRegistry._scopes.set('test:no_ast', { expr: 'entities()' });

      // Act
      const ast = scopeRegistry.getScopeAst('test:no_ast');

      // Assert
      expect(ast).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics for an initialized registry', () => {
      // Arrange
      scopeRegistry.initialize(
        addMockAstsToScopes({
          'core:test1': { expr: 'actor' },
          'core:test2': { expr: 'location' },
        })
      );

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
      scopeRegistry.initialize(addMockAstsToScopes(mockScopeDefinitions));
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
