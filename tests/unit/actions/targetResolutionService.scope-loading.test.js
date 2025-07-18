import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
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

    mockEntityManager = {};

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

    targetResolutionService = new TargetResolutionService({
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

  describe('core:clear_directions scope resolution', () => {
    it('should find the core:clear_directions scope when properly loaded', () => {
      // Mock a properly loaded scope
      const expr =
        'location.core:exits[{ "condition_ref": "core:exit-is-unblocked" }].target';
      const mockScopeDefinition = {
        name: 'core:clear_directions',
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
        'core:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(mockScopeRegistry.getScope).toHaveBeenCalledWith(
        'core:clear_directions'
      );
      expect(result.targets).toHaveLength(2);
      expect(result.error).toBeUndefined();
      expectNoDispatch(mockSafeEventDispatcher.dispatch);
    });

    it('should handle missing scope gracefully and dispatch error event', () => {
      // Mock missing scope (returns null)
      mockScopeRegistry.getScope.mockReturnValue(null);

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = targetResolutionService.resolveTargets(
        'core:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(mockScopeRegistry.getScope).toHaveBeenCalledWith(
        'core:clear_directions'
      );
      expect(result.targets).toHaveLength(0);
      expect(result.error).toBeDefined();
      // Note: Enhanced error context changes logger behavior and error structure
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Test error'),
          details: expect.objectContaining({
            errorContext: expect.objectContaining({
              phase: 'resolution',
            }),
          }),
        })
      );
    });

    it('should handle scope with empty expression gracefully', () => {
      // Mock scope with empty expression
      const mockScopeDefinition = {
        name: 'core:clear_directions',
        expr: '',
        modId: 'core',
        source: 'file',
      };

      mockScopeRegistry.getScope.mockReturnValue(mockScopeDefinition);

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = targetResolutionService.resolveTargets(
        'core:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(result.targets).toHaveLength(0);
      expect(result.error).toBeDefined();
      // Note: Enhanced error context changes logger behavior and error structure
    });

    it('should handle scope with missing AST gracefully', () => {
      // Mock scope without AST (which is now required)
      const mockScopeDefinition = {
        name: 'core:clear_directions',
        expr: 'location.core:exits[].target',
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
        'core:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(result.targets).toHaveLength(2);
      expect(result.error).toBeUndefined();
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockDslParser.parse).toHaveBeenCalledWith(
        'location.core:exits[].target'
      );
    });
  });

  describe('Real ScopeRegistry integration', () => {
    it('should work with a real scope registry containing core:clear_directions', () => {
      const realScopeRegistry = new ScopeRegistry();

      // Initialize with the expected scope definition
      const expr =
        'location.core:exits[{ "condition_ref": "core:exit-is-unblocked" }].target';
      realScopeRegistry.initialize({
        'core:clear_directions': {
          name: 'core:clear_directions',
          expr: expr,
          ast: generateMockAst(expr),
          modId: 'core',
          source: 'file',
        },
      });

      const scope = realScopeRegistry.getScope('core:clear_directions');
      expect(scope).toBeDefined();
      expect(scope.name).toBe('core:clear_directions');
      expect(scope.expr).toBe(
        'location.core:exits[{ "condition_ref": "core:exit-is-unblocked" }].target'
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
