import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';
import { generateMockAst } from '../../common/scopeDsl/mockAstGenerator.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

describe('TargetResolutionService - Scope Loading Issue', () => {
  let targetResolutionService;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockJsonLogicEvalService;
  let mockDslParser;

  beforeEach(() => {
    mockScopeRegistry = {
      getScope: jest.fn(),
    };

    mockScopeEngine = {
      resolve: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockJsonLogicEvalService = {
      evaluate: jest.fn(),
    };
    mockDslParser = { parse: jest.fn((expr) => generateMockAst(expr)) };

    targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
      jsonLogicEvaluationService: mockJsonLogicEvalService,
      dslParser: mockDslParser,
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });
  });

  describe('movement:clear_directions scope resolution', () => {
    it('should find the movement:clear_directions scope when properly loaded', () => {
      // Mock a properly loaded scope
      const expr =
        'location.locations:exits[{ "condition_ref": "movement:exit-is-unblocked" }].target';
      const mockScopeDefinition = {
        name: 'movement:clear_directions',
        expr: expr,
        ast: generateMockAst(expr),
        modId: 'core',
        source: 'file',
      };

      mockScopeRegistry.getScope.mockReturnValue(mockScopeDefinition);
      mockScopeEngine.resolve.mockReturnValue(
        new Set(['location1', 'location2'])
      );

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = targetResolutionService.resolveTargets(
        'movement:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(mockScopeRegistry.getScope).toHaveBeenCalledWith(
        'movement:clear_directions'
      );
      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.errors).toEqual([]);
      expectNoDispatch(mockSafeEventDispatcher.dispatch);
    });

    it('should handle missing scope gracefully and dispatch error event', () => {
      // Mock missing scope (returns null)
      mockScopeRegistry.getScope.mockReturnValue(null);

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = targetResolutionService.resolveTargets(
        'movement:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(mockScopeRegistry.getScope).toHaveBeenCalledWith(
        'movement:clear_directions'
      );
      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
      // The error is about missing scope, not the test error since getScope returns null
      expect(result.errors[0].message).toContain('Missing scope definition');
    });

    it('should handle scope with empty expression gracefully', () => {
      // Mock scope with empty expression
      const mockScopeDefinition = {
        name: 'movement:clear_directions',
        expr: '',
        modId: 'core',
        source: 'file',
      };

      mockScopeRegistry.getScope.mockReturnValue(mockScopeDefinition);

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = targetResolutionService.resolveTargets(
        'movement:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
      // Note: Enhanced error context changes logger behavior and error structure
    });

    it('should handle scope with missing AST gracefully', () => {
      // Mock scope without AST (which is now required)
      const mockScopeDefinition = {
        name: 'movement:clear_directions',
        expr: 'location.locations:exits[].target',
        modId: 'core',
        source: 'file',
        // Intentionally missing ast property
      };

      mockScopeRegistry.getScope.mockReturnValue(mockScopeDefinition);
      // Mock scope engine to return a valid Set since the AST will be parsed on demand
      mockScopeEngine.resolve.mockReturnValue(
        new Set(['location3', 'location4'])
      );

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = targetResolutionService.resolveTargets(
        'movement:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.errors).toEqual([]);
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockDslParser.parse).toHaveBeenCalledWith(
        'location.locations:exits[].target'
      );
    });
  });

  describe('Real ScopeRegistry integration', () => {
    it('should work with a real scope registry containing movement:clear_directions', () => {
      const realScopeRegistry = new ScopeRegistry();

      // Initialize with the expected scope definition
      const expr =
        'location.locations:exits[{ "condition_ref": "movement:exit-is-unblocked" }].target';
      realScopeRegistry.initialize({
        'movement:clear_directions': {
          name: 'movement:clear_directions',
          expr: expr,
          ast: generateMockAst(expr),
          modId: 'core',
          source: 'file',
        },
      });

      const scope = realScopeRegistry.getScope('movement:clear_directions');
      expect(scope).toBeDefined();
      expect(scope.name).toBe('movement:clear_directions');
      expect(scope.expr).toBe(
        'location.locations:exits[{ "condition_ref": "movement:exit-is-unblocked" }].target'
      );
    });

    it('should enforce namespaced scope names in real registry', () => {
      const realScopeRegistry = new ScopeRegistry();

      expect(() => {
        realScopeRegistry.getScope('clear_directions'); // Non-namespaced
      }).toThrow('Scope names must be namespaced');
    });
  });
});
