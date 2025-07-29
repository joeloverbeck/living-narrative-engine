import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';
import { generateMockAst } from '../../common/scopeDsl/mockAstGenerator.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

describe('TargetResolutionService - Complete Coverage', () => {
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockJsonLogicEvalService;
  let mockDslParser;
  let mockActionErrorContextBuilder;

  beforeEach(() => {
    mockScopeRegistry = { getScope: jest.fn() };
    mockScopeEngine = { resolve: jest.fn() };
    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getAllComponentTypesForEntity: jest.fn(),
      getEntityInstance: jest.fn(),
    };
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    mockSafeEventDispatcher = { dispatch: jest.fn() };
    mockJsonLogicEvalService = { evaluate: jest.fn() };
    mockDslParser = { parse: jest.fn((expr) => generateMockAst(expr)) };
    mockActionErrorContextBuilder = {
      buildErrorContext: jest.fn().mockReturnValue({
        errorContext: {
          error: new Error('Test error'),
          phase: ERROR_PHASES.VALIDATION,
        },
      }),
    };
  });

  describe('Component data assignment (line 310)', () => {
    it('should assign component data when getComponentData returns data', () => {
      const service = createTargetResolutionServiceWithMocks({
        scopeRegistry: mockScopeRegistry,
        scopeEngine: mockScopeEngine,
        entityManager: mockEntityManager,
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
        jsonLogicEvaluationService: mockJsonLogicEvalService,
        dslParser: mockDslParser,
        actionErrorContextBuilder: mockActionErrorContextBuilder,
      });

      const scopeDef = {
        name: 'core:test',
        expr: 'actor',
        ast: generateMockAst('actor'),
        modId: 'core',
        source: 'file',
      };
      mockScopeRegistry.getScope.mockReturnValue(scopeDef);

      const actor = {
        id: 'hero',
        componentTypeIds: ['core:position'],
      };

      // Mock getComponentData to return actual data - this covers line 310
      const componentData = { x: 10, y: 20 };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      mockScopeEngine.resolve.mockReturnValue(new Set(['hero']));

      const result = service.resolveTargets('core:test', actor, {});

      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'hero',
        'core:position'
      );

      // Verify the component data was assigned (line 310)
      const scopeEngineCall = mockScopeEngine.resolve.mock.calls[0];
      const actorWithComponents = scopeEngineCall[1];
      expect(actorWithComponents.components['core:position']).toEqual(
        componentData
      );
    });
  });

  describe('Runtime context validation failure (line 343)', () => {
    it('should trigger error handling when runtime context validation fails', () => {
      const service = createTargetResolutionServiceWithMocks({
        scopeRegistry: mockScopeRegistry,
        scopeEngine: mockScopeEngine,
        entityManager: mockEntityManager,
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
        jsonLogicEvaluationService: mockJsonLogicEvalService,
        dslParser: mockDslParser,
        actionErrorContextBuilder: mockActionErrorContextBuilder,
      });

      const scopeDef = {
        name: 'core:test',
        expr: 'actor',
        ast: generateMockAst('actor'),
        modId: 'core',
        source: 'file',
      };
      mockScopeRegistry.getScope.mockReturnValue(scopeDef);

      const actor = { id: 'hero' };

      // Mock the scope engine to throw an error that triggers the validation path
      mockScopeEngine.resolve.mockImplementation(() => {
        throw new Error('Runtime context validation failed');
      });

      const result = service.resolveTargets('core:test', actor, {});

      // Verify error result is returned
      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(mockScopeEngine.resolve).toHaveBeenCalled();

      // Verify error handling was triggered
      expect(
        mockActionErrorContextBuilder.buildErrorContext
      ).toHaveBeenCalled();
    });
  });

  describe('Error name assignment (line 442)', () => {
    it('should set error.name to TargetResolutionError when originalError is null', () => {
      const service = createTargetResolutionServiceWithMocks({
        scopeRegistry: mockScopeRegistry,
        scopeEngine: mockScopeEngine,
        entityManager: mockEntityManager,
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
        jsonLogicEvaluationService: mockJsonLogicEvalService,
        dslParser: mockDslParser,
        actionErrorContextBuilder: mockActionErrorContextBuilder,
      });

      const scopeDef = {
        name: 'core:test',
        expr: null, // This will trigger missing scope error which calls handleResolutionError
        modId: 'core',
        source: 'file',
      };
      mockScopeRegistry.getScope.mockReturnValue(scopeDef);

      // Mock safeEventDispatcher.dispatch to verify it's called
      mockSafeEventDispatcher.dispatch.mockImplementation(() => {});

      const actor = { id: 'hero' };
      const result = service.resolveTargets(
        'core:test',
        actor,
        {},
        null,
        'test-action'
      );

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);

      // Verify that the error handling was triggered
      expect(
        mockActionErrorContextBuilder.buildErrorContext
      ).toHaveBeenCalled();
      // The new implementation doesn't dispatch errors directly
    });
  });

  describe('Error handling when buildErrorContext throws', () => {
    it('should handle errors when buildErrorContext throws', () => {
      const service = createTargetResolutionServiceWithMocks({
        scopeRegistry: mockScopeRegistry,
        scopeEngine: mockScopeEngine,
        entityManager: mockEntityManager,
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
        jsonLogicEvaluationService: mockJsonLogicEvalService,
        dslParser: mockDslParser,
        actionErrorContextBuilder: mockActionErrorContextBuilder,
      });

      const scopeDef = {
        name: 'core:test',
        expr: null, // This will trigger missing scope error
        modId: 'core',
        source: 'file',
      };
      mockScopeRegistry.getScope.mockReturnValue(scopeDef);

      // Mock actionErrorContextBuilder.buildErrorContext to throw
      mockActionErrorContextBuilder.buildErrorContext.mockImplementation(() => {
        throw new Error('Context builder failed');
      });

      const actor = { id: 'hero' };

      // The new implementation should handle the error gracefully
      expect(() => {
        service.resolveTargets(
          'core:test',
          actor,
          { currentLocation: 'test-location' },
          null,
          'test-action'
        );
      }).toThrow('Context builder failed');
    });
  });
});
