import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';

describe('TargetResolutionService - Scope Loading Issue', () => {
  let targetResolutionService;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockJsonLogicEvalService;
  let mockRuntimeContextBuilder;

  beforeEach(() => {
    mockScopeRegistry = {
      getScope: jest.fn(),
    };

    mockScopeEngine = {
      resolve: jest.fn(),
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
    mockRuntimeContextBuilder = { build: jest.fn(() => ({})) };

    targetResolutionService = new TargetResolutionService({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
      jsonLogicEvaluationService: mockJsonLogicEvalService,
      runtimeContextBuilder: mockRuntimeContextBuilder,
    });
  });

  describe('core:clear_directions scope resolution', () => {
    it('should find the core:clear_directions scope when properly loaded', async () => {
      // Mock a properly loaded scope
      const mockScopeDefinition = {
        name: 'core:clear_directions',
        expr: 'location.core:exits[{ "condition_ref": "core:exit-is-unblocked" }].target',
        ast: {},
        modId: 'core',
        source: 'file',
      };

      mockScopeRegistry.getScope.mockReturnValue(mockScopeDefinition);
      mockScopeEngine.resolve.mockReturnValue(
        new Set(['location1', 'location2'])
      );

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = await targetResolutionService.resolveTargets(
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

    it('should handle missing scope gracefully and dispatch error event', async () => {
      // Mock missing scope (returns null)
      mockScopeRegistry.getScope.mockReturnValue(null);

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = await targetResolutionService.resolveTargets(
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

    it('should handle scope with empty expression gracefully', async () => {
      // Mock scope with empty expression
      const mockScopeDefinition = {
        name: 'core:clear_directions',
        expr: '',
        ast: null,
        modId: 'core',
        source: 'file',
      };

      mockScopeRegistry.getScope.mockReturnValue(mockScopeDefinition);

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = await targetResolutionService.resolveTargets(
        'core:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(result).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "TargetResolutionService: Missing scope definition: Scope 'core:clear_directions' not found or has no expression in registry."
      );
    });

    it('should handle scope parsing errors gracefully', async () => {
      // Mock scope with invalid DSL expression
      const mockScopeDefinition = {
        name: 'core:clear_directions',
        expr: 'invalid.expression[syntax]',
        ast: null,
        modId: 'core',
        source: 'file',
      };

      mockScopeRegistry.getScope.mockReturnValue(mockScopeDefinition);

      const mockActor = { id: 'hero', type: 'character' };
      const mockDiscoveryContext = { currentLocation: { id: 'room1' } };

      const result = await targetResolutionService.resolveTargets(
        'core:clear_directions',
        mockActor,
        mockDiscoveryContext
      );

      expect(result).toHaveLength(0);
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message:
            "Error resolving scope 'core:clear_directions': AST not available",
          details: { scopeName: 'core:clear_directions' },
        })
      );
    });
  });

  describe('Real ScopeRegistry integration', () => {
    it('should work with a real scope registry containing core:clear_directions', () => {
      const realScopeRegistry = new ScopeRegistry();

      // Initialize with the expected scope definition
      realScopeRegistry.initialize({
        'core:clear_directions': {
          name: 'core:clear_directions',
          expr: 'location.core:exits[{ "condition_ref": "core:exit-is-unblocked" }].target',
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
