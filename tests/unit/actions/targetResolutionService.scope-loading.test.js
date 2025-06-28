import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';
import { generateMockAst } from '../../common/scopeDsl/mockAstGenerator.js';

describe('TargetResolutionService - Scope Loading Issue', () => {
  let targetResolutionService;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockJsonLogicEvalService;

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

    targetResolutionService = new TargetResolutionService({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
      jsonLogicEvaluationService: mockJsonLogicEvalService,
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
      expect(result).toHaveLength(2);
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
      expect(result).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "TargetResolutionService: Missing scope definition: Scope 'core:clear_directions' not found or has no expression in registry."
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        {
          message:
            "Missing scope definition: Scope 'core:clear_directions' not found or has no expression in registry.",
          details: { scopeName: 'core:clear_directions' },
        }
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

      expect(result).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "TargetResolutionService: Missing scope definition: Scope 'core:clear_directions' not found or has no expression in registry."
      );
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

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = targetResolutionService.resolveTargets(
        'core:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(result).toHaveLength(0);
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(
            "Error resolving scope 'core:clear_directions'"
          ),
          details: expect.objectContaining({
            error: expect.stringContaining('missing the required AST property'),
          }),
        })
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
