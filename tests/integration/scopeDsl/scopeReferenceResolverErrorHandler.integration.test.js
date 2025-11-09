import { describe, expect, it, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

describe('ScopeReferenceResolver Error Handler Integration', () => {
  let testBed;
  let scopeEngine;
  let scopeRegistry;
  let errorHandler;
  let runtimeContext;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mock scope registry
    scopeRegistry = {
      getScopeAst: testBed.createMock('getScopeAst', []),
    };

    // Create mock error handler that captures errors
    errorHandler = {
      handleError: testBed.createMock('handleError', []),
      getErrorBuffer: testBed.createMock('getErrorBuffer', [], () => []),
    };

    const mockLogger = createMockLogger();
    const jsonLogicEval = new JsonLogicEvaluationService({
      entityManager: {
        getEntities: () => [],
        getEntitiesWithComponent: () => [],
        hasComponent: () => false,
        getComponentData: () => null,
        getEntity: () => null,
        getEntityInstance: () => null,
      },
      logger: mockLogger,
    });

    // Create mock runtime context with complete entity manager
    runtimeContext = {
      entityManager: {
        getEntities: () => [],
        getEntitiesWithComponent: () => [],
        hasComponent: () => false,
        getComponentData: () => null,
        getEntity: () => null,
        getEntityInstance: () => null,
      },
      jsonLogicEval,
      logger: mockLogger,
      location: { id: 'test-location' },
      // Add required services for other resolvers
      spatialIndexManager: {
        findEntitiesInRadius: () => [],
        findEntitiesAtLocation: () => [],
      },
    };

    // Create ScopeEngine with error handler
    scopeEngine = new ScopeEngine({
      scopeRegistry,
      errorHandler,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('ScopeEngine integration with scopeReferenceResolver', () => {
    it('should inject errorHandler into scopeReferenceResolver', () => {
      // This test verifies that the ScopeEngine properly injects the errorHandler
      // by testing error handling directly through the engine's resolve method

      const ast = { type: 'ScopeReference', scopeId: 'nonexistent:scope' };
      const actorEntity = { id: 'test-actor' };

      // Mock scope not found
      scopeRegistry.getScopeAst.mockReturnValue(null);

      const result = scopeEngine.resolve(ast, actorEntity, runtimeContext);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        'Referenced scope not found: nonexistent:scope',
        expect.objectContaining({
          actorEntity,
          requestedScope: 'nonexistent:scope',
        }),
        'ScopeReferenceResolver',
        ErrorCodes.SCOPE_NOT_FOUND
      );
    });

    it('should handle scope not found errors through ScopeEngine resolve', () => {
      const ast = { type: 'ScopeReference', scopeId: 'missing:scope' };
      const actorEntity = { id: 'test-actor' };

      // Mock scope not found
      scopeRegistry.getScopeAst.mockReturnValue(null);

      const result = scopeEngine.resolve(ast, actorEntity, runtimeContext);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        'Referenced scope not found: missing:scope',
        expect.objectContaining({
          actorEntity,
          requestedScope: 'missing:scope',
        }),
        'ScopeReferenceResolver',
        ErrorCodes.SCOPE_NOT_FOUND
      );
    });

    it('should handle missing actor errors through ScopeEngine resolve', () => {
      const ast = { type: 'ScopeReference', scopeId: 'test:scope' };
      const actorEntity = null; // Missing actor

      // With new parameter validation, this throws immediately (fail-fast)
      // The validation error is thrown before ScopeReferenceResolver can handle it
      expect(() => {
        scopeEngine.resolve(ast, actorEntity, runtimeContext);
      }).toThrow(/actorEntity must be an object/);

      // Parameter validation errors bypass the error handler - they throw immediately
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should handle successful scope resolution through ScopeEngine', () => {
      const mockScopeAst = { type: 'Source', kind: 'actor' };
      const ast = { type: 'ScopeReference', scopeId: 'valid:scope' };
      const actorEntity = { id: 'test-actor' };

      // Mock successful scope lookup
      scopeRegistry.getScopeAst.mockReturnValue(mockScopeAst);

      const result = scopeEngine.resolve(ast, actorEntity, runtimeContext);

      expect(result).toBeInstanceOf(Set);
      expect(result.has('test-actor')).toBe(true); // Should resolve to the actor
      expect(scopeRegistry.getScopeAst).toHaveBeenCalledWith('valid:scope');
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should preserve trace functionality with error handling', () => {
      const mockScopeAst = { type: 'Source', kind: 'actor' };
      const ast = { type: 'ScopeReference', scopeId: 'traced:scope' };
      const actorEntity = { id: 'test-actor' };
      const trace = {
        addLog: testBed.createMock('addLog', []),
      };

      // Mock successful scope lookup
      scopeRegistry.getScopeAst.mockReturnValue(mockScopeAst);

      const result = scopeEngine.resolve(
        ast,
        actorEntity,
        runtimeContext,
        trace
      );

      expect(result).toBeInstanceOf(Set);
      expect(trace.addLog).toHaveBeenCalledWith(
        'info',
        'Resolving scope reference: traced:scope',
        'ScopeReferenceResolver'
      );
      expect(trace.addLog).toHaveBeenCalledWith(
        'info',
        'Scope reference traced:scope resolved to 1 entities',
        'ScopeReferenceResolver'
      );
    });

    it('should maintain cycle detection behavior with error handling', () => {
      // This test ensures that cycle detection still works correctly
      // when error handling is integrated

      const mockScopeAst = {
        type: 'ScopeReference',
        scopeId: 'recursive:scope', // Self-referencing scope
      };
      const ast = { type: 'ScopeReference', scopeId: 'recursive:scope' };
      const actorEntity = { id: 'test-actor' };

      // Mock scope that references itself
      scopeRegistry.getScopeAst.mockReturnValue(mockScopeAst);

      // This should trigger cycle detection in the engine and throw a ScopeCycleError
      expect(() => {
        scopeEngine.resolve(ast, actorEntity, runtimeContext);
      }).toThrow('Cycle: ScopeReference:recursive:scope');
    });
  });

  describe('Error buffer integration', () => {
    it('should accumulate errors in error buffer', () => {
      const errors = [];
      errorHandler.getErrorBuffer.mockReturnValue(errors);
      errorHandler.handleError.mockImplementation(
        (message, context, source, code) => {
          errors.push({ message, context, source, code });
        }
      );

      // Trigger multiple errors
      const ast1 = { type: 'ScopeReference', scopeId: 'missing1:scope' };
      const ast2 = { type: 'ScopeReference', scopeId: 'missing2:scope' };
      const actorEntity = { id: 'test-actor' };

      scopeRegistry.getScopeAst.mockReturnValue(null);

      scopeEngine.resolve(ast1, actorEntity, runtimeContext);
      scopeEngine.resolve(ast2, actorEntity, runtimeContext);

      const errorBuffer = errorHandler.getErrorBuffer();
      expect(errorBuffer).toHaveLength(2);
      expect(errorBuffer[0].message).toContain('missing1:scope');
      expect(errorBuffer[1].message).toContain('missing2:scope');
    });
  });

  describe('Backward compatibility', () => {
    it('should work without errorHandler for backward compatibility', () => {
      // Create ScopeEngine without errorHandler
      const engineWithoutErrorHandler = new ScopeEngine({
        scopeRegistry,
        // No errorHandler provided
      });

      const ast = { type: 'ScopeReference', scopeId: 'nonexistent:scope' };
      const actorEntity = { id: 'test-actor' };

      scopeRegistry.getScopeAst.mockReturnValue(null);

      // Should throw instead of using error handler
      expect(() => {
        engineWithoutErrorHandler.resolve(ast, actorEntity, runtimeContext);
      }).toThrow('Referenced scope not found: nonexistent:scope');
    });
  });
});
