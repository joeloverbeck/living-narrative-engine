/**
 * @file Integration test for scope registry fallback behavior
 * @description Tests that scopes stored with qualified names (e.g., 'core:environment')
 * can be found when accessed with base names (e.g., 'environment')
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser.js';
import {
  createMockLogger,
  createMockScopeEngine,
} from '../../common/mockFactories';

// Mock the parser dependency, as its specific output is not under test here.
jest.mock('../../../src/scopeDsl/parser.js');

describe('Scope Registry Fallback Integration', () => {
  let scopeRegistry;
  let mockLogger;
  let mockContext;
  let mockScopeEngine;

  /**
   * Replicates the core scope resolution logic from ActionDiscoveryService for testing.
   *
   * @param {string} scopeName - The name of the scope to resolve.
   * @param {object} context - The action context.
   * @param {ScopeRegistry} registry - The scope registry instance.
   * @param {object} logger - The logger instance.
   * @param {object} engine - The scope engine instance.
   * @param {object} [dispatcher] - Optional event dispatcher.
   * @returns {Set<string>} A set of entity IDs.
   */
  const resolveScopeHelper = (
    scopeName,
    context,
    registry,
    logger,
    engine,
    dispatcher
  ) => {
    const scopeDefinition = registry.getScope(scopeName);

    if (
      !scopeDefinition ||
      typeof scopeDefinition.expr !== 'string' ||
      !scopeDefinition.expr.trim()
    ) {
      const errorMessage = `Missing scope definition: Scope '${scopeName}' not found or has no expression in registry.`;
      logger.warn(errorMessage);
      if (dispatcher) {
        dispatcher.dispatch('core:system_error_occurred', {
          message: errorMessage,
          scopeName,
        });
      }
      return new Set();
    }

    try {
      const ast = parseDslExpression(scopeDefinition.expr);
      const runtimeCtx = {
        entityManager: context.entityManager,
        jsonLogicEval: context.jsonLogicEval || {},
        logger: logger,
        actor: context.actingEntity,
        location: context.location,
      };
      return engine.resolve(ast, context.actingEntity, runtimeCtx) ?? new Set();
    } catch (error) {
      logger.error(`Error resolving scope '${scopeName}' with DSL:`, error);
      if (dispatcher) {
        dispatcher.dispatch('core:system_error_occurred', {
          message: `Error resolving scope '${scopeName}': ${error.message}`,
          error,
        });
      }
      return new Set();
    }
  };

  beforeEach(() => {
    scopeRegistry = new ScopeRegistry();
    mockLogger = createMockLogger();

    // Provide a mock implementation for the imported parser function.
    parseDslExpression.mockImplementation((expr) => ({
      type: 'ast',
      original: expr,
    }));

    // Mock context that matches what ActionDiscoveryService provides
    mockContext = {
      entityManager: {
        getComponentData: jest.fn(),
        getEntityInstance: jest.fn(),
      },
      actingEntity: {
        id: 'test:actor',
      },
      location: {
        id: 'test:location',
      },
      jsonLogicEval: jest.fn(),
    };

    // Mock scope engine
    mockScopeEngine = createMockScopeEngine({
      resolve: jest
        .fn()
        .mockReturnValue(new Set(['test:target1', 'test:target2'])),
    });
  });

  describe('when scopes are stored with qualified names', () => {
    beforeEach(() => {
      // Initialize registry with qualified scope names (as they would be loaded from mods)
      scopeRegistry.initialize({
        'core:environment': {
          expr: 'entities(core:position)[{"and": [{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}, {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]}]',
          description: 'Entities in the same location as the actor',
        },
        'core:directions': {
          expr: 'location.core:exits[].target',
          description: 'Locations connected to the current location',
        },
        'core:followers': {
          expr: 'actor.core:leading.followers[]',
          description: 'Entities following the actor',
        },
      });
    });

    it('should find scopes by base name when actions use unqualified names', () => {
      // Test that the registry can find scopes by base name
      expect(scopeRegistry.getScope('environment')).toBeTruthy();
      expect(scopeRegistry.getScope('directions')).toBeTruthy();
      expect(scopeRegistry.getScope('followers')).toBeTruthy();

      // Test that the scope definitions are returned correctly
      const environmentScope = scopeRegistry.getScope('environment');
      expect(environmentScope.expr).toBe(
        'entities(core:position)[{"and": [{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}, {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]}]'
      );
      expect(environmentScope.description).toBe(
        'Entities in the same location as the actor'
      );
    });

    it('should resolve entities using base scope names', () => {
      // Test each scope that's failing in the logs
      const testScopes = ['environment', 'directions', 'followers'];

      for (const scopeName of testScopes) {
        // Reset mock for each test
        mockScopeEngine.resolve.mockClear();

        const result = resolveScopeHelper(
          scopeName,
          mockContext,
          scopeRegistry,
          mockLogger,
          mockScopeEngine
        );

        // Should not return empty set
        expect(result.size).toBeGreaterThan(0);
        expect(result).toEqual(new Set(['test:target1', 'test:target2']));

        // Verify the scope engine was called
        expect(mockScopeEngine.resolve).toHaveBeenCalled();
      }
    });

    it('should not dispatch errors when using base scope names', () => {
      const mockDispatcher = {
        dispatch: jest.fn(),
      };

      // This should work without errors
      const result = resolveScopeHelper(
        'environment',
        mockContext,
        scopeRegistry,
        mockLogger,
        mockScopeEngine,
        mockDispatcher
      );

      expect(result.size).toBeGreaterThan(0);
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should still work with qualified scope names', () => {
      // Verify that qualified names still work
      expect(scopeRegistry.getScope('core:environment')).toBeTruthy();
      expect(scopeRegistry.getScope('core:directions')).toBeTruthy();
      expect(scopeRegistry.getScope('core:followers')).toBeTruthy();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      scopeRegistry.initialize({
        'core:valid_scope': {
          expr: 'entities()',
          description: 'A valid scope',
        },
      });
    });

    it('should dispatch error for truly non-existent scopes', () => {
      const mockDispatcher = {
        dispatch: jest.fn(),
      };

      const result = resolveScopeHelper(
        'nonexistent_scope',
        mockContext,
        scopeRegistry,
        mockLogger,
        mockScopeEngine,
        mockDispatcher
      );

      expect(result.size).toBe(0);
      expect(mockDispatcher.dispatch).toHaveBeenCalled();

      // Check that the error message includes the scope name
      const errorCall = mockDispatcher.dispatch.mock.calls[0];
      expect(errorCall[0]).toBe('core:system_error_occurred');
      expect(errorCall[1].message).toContain('nonexistent_scope');
    });
  });
});
