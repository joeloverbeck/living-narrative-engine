/**
 * @file Integration test for scope registry fallback behavior
 * @description Tests that scopes stored with qualified names (e.g., 'core:environment') 
 * can be found when accessed with base names (e.g., 'environment')
 */

import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { getEntityIdsForScopes } from '../../../src/entities/entityScopeService.js';
import { createMockLogger, createMockScopeEngine } from '../../common/mockFactories/index.js';

describe('Scope Registry Fallback Integration', () => {
  let scopeRegistry;
  let mockLogger;
  let mockContext;
  let mockScopeEngine;

  beforeEach(() => {
    scopeRegistry = new ScopeRegistry();
    mockLogger = createMockLogger();
    
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
      resolve: jest.fn().mockReturnValue(new Set(['test:target1', 'test:target2'])),
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
      expect(environmentScope.expr).toBe('entities(core:position)[{"and": [{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}, {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]}]');
      expect(environmentScope.description).toBe('Entities in the same location as the actor');
    });

    it('should resolve entities using base scope names through getEntityIdsForScopes', () => {
      // Test each scope that's failing in the logs
      const testScopes = ['environment', 'directions', 'followers'];
      
      for (const scopeName of testScopes) {
        // Reset mock for each test
        mockScopeEngine.resolve.mockClear();
        
        const result = getEntityIdsForScopes(
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
      const result = getEntityIdsForScopes(
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

      const result = getEntityIdsForScopes(
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