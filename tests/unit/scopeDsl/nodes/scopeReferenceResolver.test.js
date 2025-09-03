import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import createScopeReferenceResolver from '../../../../src/scopeDsl/nodes/scopeReferenceResolver.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('scopeReferenceResolver', () => {
  let resolver;
  let scopeRegistry;
  let cycleDetector;
  let errorHandler;
  let mockDispatcher;
  let mockTrace;

  beforeEach(() => {
    // Create mock scope registry
    scopeRegistry = {
      getScopeAst: jest.fn(),
    };

    // Create mock cycle detector
    cycleDetector = {
      enter: jest.fn(),
      leave: jest.fn(),
    };

    // Create mock error handler
    errorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(() => []),
    };

    // Create mock dispatcher
    mockDispatcher = {
      resolve: jest.fn(() => new Set(['entity1', 'entity2'])),
    };

    // Create mock trace
    mockTrace = {
      addLog: jest.fn(),
    };

    resolver = createScopeReferenceResolver({
      scopeRegistry,
      cycleDetector,
      errorHandler,
    });
  });

  describe('canResolve', () => {
    it('should return true for ScopeReference nodes', () => {
      expect(resolver.canResolve({ type: 'ScopeReference' })).toBe(true);
    });

    it('should return false for non-ScopeReference nodes', () => {
      expect(resolver.canResolve({ type: 'Source' })).toBe(false);
      expect(resolver.canResolve({ type: 'Step' })).toBe(false);
      expect(resolver.canResolve({ type: 'Filter' })).toBe(false);
      expect(resolver.canResolve({ type: 'Union' })).toBe(false);
    });
  });

  describe('resolve', () => {
    describe('successful resolution', () => {
      it('should resolve scope reference and return entities', () => {
        const mockScopeAst = { type: 'Source', kind: 'actor' };
        scopeRegistry.getScopeAst.mockReturnValue(mockScopeAst);

        const node = { type: 'ScopeReference', scopeId: 'test:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          actorEntity: { id: 'actor123' },
          runtimeCtx: {},
          cycleDetector,
        };

        const result = resolver.resolve(node, ctx);

        expect(scopeRegistry.getScopeAst).toHaveBeenCalledWith('test:scope');
        expect(cycleDetector.enter).toHaveBeenCalledWith('test:scope');
        expect(mockDispatcher.resolve).toHaveBeenCalledWith(mockScopeAst, ctx);
        expect(cycleDetector.leave).toHaveBeenCalled();
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
      });

      it('should add trace logs when trace context is available', () => {
        const mockScopeAst = { type: 'Source', kind: 'actor' };
        scopeRegistry.getScopeAst.mockReturnValue(mockScopeAst);

        const node = { type: 'ScopeReference', scopeId: 'test:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          actorEntity: { id: 'actor123' },
          runtimeCtx: {},
          trace: mockTrace,
          cycleDetector,
        };

        resolver.resolve(node, ctx);

        expect(mockTrace.addLog).toHaveBeenCalledWith(
          'info',
          'Resolving scope reference: test:scope',
          'ScopeReferenceResolver'
        );
        expect(mockTrace.addLog).toHaveBeenCalledWith(
          'info',
          'Scope reference test:scope resolved to 2 entities',
          'ScopeReferenceResolver'
        );
      });

      it('should handle cycle detection correctly', () => {
        const mockScopeAst = { type: 'Source', kind: 'actor' };
        scopeRegistry.getScopeAst.mockReturnValue(mockScopeAst);

        const node = { type: 'ScopeReference', scopeId: 'test:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          actorEntity: { id: 'actor123' },
          runtimeCtx: {},
          cycleDetector,
        };

        resolver.resolve(node, ctx);

        expect(cycleDetector.enter).toHaveBeenCalledWith('test:scope');
        expect(cycleDetector.leave).toHaveBeenCalled();
      });
    });

    describe('error handling with errorHandler', () => {
      it('should handle missing actorEntity with error handler', () => {
        const node = { type: 'ScopeReference', scopeId: 'test:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          runtimeCtx: {},
          cycleDetector,
        };

        const result = resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          'ScopeReferenceResolver: actorEntity is missing from context',
          { ...ctx, requestedScope: 'test:scope' },
          'ScopeReferenceResolver',
          ErrorCodes.MISSING_ACTOR
        );
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      });

      it('should handle scope not found with error handler', () => {
        scopeRegistry.getScopeAst.mockReturnValue(null);

        const node = { type: 'ScopeReference', scopeId: 'nonexistent:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          actorEntity: { id: 'actor123' },
          runtimeCtx: {},
          cycleDetector,
        };

        const result = resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          'Referenced scope not found: nonexistent:scope',
          { ...ctx, requestedScope: 'nonexistent:scope' },
          'ScopeReferenceResolver',
          ErrorCodes.SCOPE_NOT_FOUND
        );
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
        expect(cycleDetector.leave).toHaveBeenCalled(); // Should still clean up cycle detector
      });
    });

    describe('backward compatibility without errorHandler', () => {
      beforeEach(() => {
        resolver = createScopeReferenceResolver({
          scopeRegistry,
          cycleDetector,
          // No errorHandler provided
        });
      });

      it('should throw error when actorEntity is missing', () => {
        const node = { type: 'ScopeReference', scopeId: 'test:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          runtimeCtx: {},
          cycleDetector,
        };

        expect(() => resolver.resolve(node, ctx)).toThrow(
          'ScopeReferenceResolver: actorEntity is missing from context'
        );
      });

      it('should throw error when scope is not found', () => {
        scopeRegistry.getScopeAst.mockReturnValue(null);

        const node = { type: 'ScopeReference', scopeId: 'nonexistent:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          actorEntity: { id: 'actor123' },
          runtimeCtx: {},
          cycleDetector,
        };

        expect(() => resolver.resolve(node, ctx)).toThrow(
          'Referenced scope not found: nonexistent:scope'
        );
        expect(cycleDetector.leave).toHaveBeenCalled(); // Should still clean up cycle detector
      });
    });

    describe('missing scopeRegistry validation', () => {
      it('should handle missing scopeRegistry with error handler', () => {
        // This test is covered by the dependency validation in the constructor
        // The actual scenario would be handled during runtime when scopeRegistry
        // becomes unavailable or returns null/undefined
        
        // Test the runtime scenario where scopeRegistry exists but becomes unavailable
        const unreliableScopeRegistry = {
          getScopeAst: jest.fn(() => {
            throw new Error('Registry service unavailable');
          }),
        };
        
        resolver = createScopeReferenceResolver({
          scopeRegistry: unreliableScopeRegistry,
          cycleDetector,
          errorHandler,
        });

        const node = { type: 'ScopeReference', scopeId: 'test:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          actorEntity: { id: 'actor123' },
          runtimeCtx: {},
          cycleDetector,
        };

        // This should throw due to registry failure, but would be caught
        // by higher-level error handling in real usage
        expect(() => resolver.resolve(node, ctx)).toThrow('Registry service unavailable');
      });
    });

    describe('dependency validation', () => {
      it('should validate scopeRegistry dependency', () => {
        expect(() => {
          createScopeReferenceResolver({
            scopeRegistry: {}, // Missing getScopeAst method
            cycleDetector,
            errorHandler,
          });
        }).toThrow();
      });

      it('should validate errorHandler dependency when provided', () => {
        expect(() => {
          createScopeReferenceResolver({
            scopeRegistry,
            cycleDetector,
            errorHandler: {}, // Missing handleError method
          });
        }).toThrow();
      });

      it('should not validate errorHandler when not provided', () => {
        expect(() => {
          createScopeReferenceResolver({
            scopeRegistry,
            cycleDetector,
            // No errorHandler provided - should not throw
          });
        }).not.toThrow();
      });
    });

    describe('cycle detector edge cases', () => {
      it('should handle resolution when cycleDetector is not provided in context', () => {
        resolver = createScopeReferenceResolver({
          scopeRegistry,
          cycleDetector: null, // Unused - cycle detection handled via context
          errorHandler,
        });

        const mockScopeAst = { type: 'Source', kind: 'actor' };
        scopeRegistry.getScopeAst.mockReturnValue(mockScopeAst);

        // Create a mock context cycle detector to verify it's not called when not in context
        const mockContextCycleDetector = {
          enter: jest.fn(),
          leave: jest.fn(),
        };

        const node = { type: 'ScopeReference', scopeId: 'test:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          actorEntity: { id: 'actor123' },
          runtimeCtx: {},
          // No cycleDetector provided in context - this is what we're testing
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        // Verify that no cycle detection occurs when cycleDetector is not in context
        // Note: We can't test mockContextCycleDetector because it's not passed in ctx
        // The test validates that resolution works without cycle detection
        expect(mockDispatcher.resolve).toHaveBeenCalledWith(mockScopeAst, ctx);
      });

      it('should use context cycleDetector when provided', () => {
        resolver = createScopeReferenceResolver({
          scopeRegistry,
          cycleDetector: null, // Unused - cycle detection handled via context
          errorHandler,
        });

        const mockScopeAst = { type: 'Source', kind: 'actor' };
        scopeRegistry.getScopeAst.mockReturnValue(mockScopeAst);

        // Create a mock context cycle detector to verify it IS called when in context
        const mockContextCycleDetector = {
          enter: jest.fn(),
          leave: jest.fn(),
        };

        const node = { type: 'ScopeReference', scopeId: 'test:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          actorEntity: { id: 'actor123' },
          runtimeCtx: {},
          cycleDetector: mockContextCycleDetector, // Provide cycle detector in context
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        // Verify that context cycle detection is used
        expect(mockContextCycleDetector.enter).toHaveBeenCalledWith('test:scope');
        expect(mockContextCycleDetector.leave).toHaveBeenCalled();
      });

      it('should clean up cycle detector even when error occurs', () => {
        scopeRegistry.getScopeAst.mockReturnValue(null);

        const node = { type: 'ScopeReference', scopeId: 'test:scope' };
        const ctx = {
          dispatcher: mockDispatcher,
          actorEntity: { id: 'actor123' },
          runtimeCtx: {},
          cycleDetector,
        };

        resolver.resolve(node, ctx);

        expect(cycleDetector.enter).toHaveBeenCalledWith('test:scope');
        expect(cycleDetector.leave).toHaveBeenCalled();
      });
    });
  });
});