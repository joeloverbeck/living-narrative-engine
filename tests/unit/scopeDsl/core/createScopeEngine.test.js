/**
 * @file createScopeEngine.test.js
 * @description Tests for the createScopeEngine factory function
 */

import createScopeEngine from '../../../../src/scopeDsl/core/createScopeEngine.js';
import ScopeDepthError from '../../../../src/errors/scopeDepthError.js';
import ScopeCycleError from '../../../../src/errors/scopeCycleError.js';
import { UnknownAstNodeError } from '../../../../src/errors/unknownAstNodeError.js';

describe('createScopeEngine', () => {
  let mockLogger;
  let mockResolvers;
  let mockRuntimeCtx;
  let mockActorEntity;
  let mockTrace;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    mockResolvers = [];

    mockRuntimeCtx = {
      entityManager: {},
      spatialIndexManager: {},
      jsonLogicEval: {},
      logger: mockLogger,
    };

    mockActorEntity = {
      id: 'actor123',
      components: {},
    };

    mockTrace = {
      addLog: jest.fn(),
    };
  });

  describe('factory validation', () => {
    it('should throw error if logger is not provided', () => {
      expect(() => createScopeEngine({ resolvers: mockResolvers })).toThrow(
        'Logger is required for createScopeEngine'
      );
    });

    it('should throw error if resolvers array is not provided', () => {
      expect(() => createScopeEngine({ logger: mockLogger })).toThrow(
        'Resolvers array is required and must not be empty'
      );
    });

    it('should throw error if resolvers array is empty', () => {
      expect(() =>
        createScopeEngine({ logger: mockLogger, resolvers: [] })
      ).toThrow('Resolvers array is required and must not be empty');
    });

    it('should create scope engine with valid configuration', () => {
      const mockResolver = {
        canResolve: () => true,
        resolve: () => new Set(['entity1']),
      };

      const engine = createScopeEngine({
        logger: mockLogger,
        resolvers: [mockResolver],
      });

      expect(engine).toBeDefined();
      expect(engine.resolve).toBeInstanceOf(Function);
      expect(engine.setMaxDepth).toBeInstanceOf(Function);
    });
  });

  describe('resolve method', () => {
    let engine;
    let mockSourceResolver;

    beforeEach(() => {
      mockSourceResolver = {
        canResolve: (node) => node.type === 'Source',
        resolve: jest.fn((node) => {
          if (node.kind === 'actor') {
            return new Set(['actor123']);
          }
          return new Set();
        }),
      };

      engine = createScopeEngine({
        logger: mockLogger,
        resolvers: [mockSourceResolver],
        maxDepth: 4,
      });
    });

    it('should resolve simple source node', () => {
      const ast = { type: 'Source', kind: 'actor' };

      const result = engine.resolve(ast, mockActorEntity, mockRuntimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('actor123')).toBe(true);
      expect(mockSourceResolver.resolve).toHaveBeenCalled();
    });

    it('should add trace logs when trace context is provided', () => {
      const ast = { type: 'Source', kind: 'actor' };

      engine.resolve(ast, mockActorEntity, mockRuntimeCtx, mockTrace);

      expect(mockTrace.addLog).toHaveBeenCalledWith(
        'step',
        'Starting scope resolution.',
        'ScopeEngine',
        { ast }
      );
      expect(mockTrace.addLog).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('Scope resolution finished'),
        'ScopeEngine',
        expect.any(Object)
      );
    });

    it('should throw UnknownAstNodeError for unhandled node types', () => {
      const ast = { type: 'UnknownType' };

      expect(() =>
        engine.resolve(ast, mockActorEntity, mockRuntimeCtx)
      ).toThrow(UnknownAstNodeError);
    });
  });

  describe('depth limiting', () => {
    let engine;
    let deepResolver;

    beforeEach(() => {
      // Create a resolver that creates infinite depth
      deepResolver = {
        canResolve: () => true,
        resolve: (node, ctx) => {
          if (node.depth < 10) {
            // Prevent actual infinite recursion
            const childNode = {
              type: 'Test',
              field: `field${node.depth}`,
              depth: node.depth + 1,
            };
            return ctx.walk(childNode);
          }
          return new Set(['final']);
        },
      };

      engine = createScopeEngine({
        logger: mockLogger,
        resolvers: [deepResolver],
        maxDepth: 3,
      });
    });

    it('should throw ScopeDepthError when depth limit is exceeded', () => {
      const ast = { type: 'Test', depth: 0 };

      expect(() =>
        engine.resolve(ast, mockActorEntity, mockRuntimeCtx)
      ).toThrow(ScopeDepthError);
    });
  });

  describe('cycle detection', () => {
    let engine;
    let cyclicResolver;

    beforeEach(() => {
      // Create a resolver that creates cycles
      cyclicResolver = {
        canResolve: () => true,
        resolve: (node, ctx) => {
          if (!node.visited) {
            // Create a node that will cycle back
            const nextNode = {
              type: 'Cyclic',
              field: 'test',
              param: 'param1',
              visited: true,
            };
            return ctx.walk(nextNode);
          }
          // Try to resolve the same node key again
          const cycleNode = {
            type: 'Cyclic',
            field: 'test',
            param: 'param1',
          };
          return ctx.walk(cycleNode);
        },
      };

      engine = createScopeEngine({
        logger: mockLogger,
        resolvers: [cyclicResolver],
      });
    });

    it('should throw ScopeCycleError when cycle is detected', () => {
      const ast = { type: 'Cyclic', field: 'test', param: 'param1' };

      expect(() =>
        engine.resolve(ast, mockActorEntity, mockRuntimeCtx)
      ).toThrow(ScopeCycleError);
    });
  });

  describe('setMaxDepth method', () => {
    let engine;

    beforeEach(() => {
      const mockResolver = {
        canResolve: () => true,
        resolve: () => new Set(['entity1']),
      };

      engine = createScopeEngine({
        logger: mockLogger,
        resolvers: [mockResolver],
      });
    });

    it('should update max depth', () => {
      engine.setMaxDepth(10);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Scope engine max depth updated to 10'
      );
    });

    it('should throw error for invalid max depth', () => {
      expect(() => engine.setMaxDepth(0)).toThrow(
        'Max depth must be a positive number'
      );

      expect(() => engine.setMaxDepth('invalid')).toThrow(
        'Max depth must be a positive number'
      );

      expect(() => engine.setMaxDepth(-5)).toThrow(
        'Max depth must be a positive number'
      );
    });

    it('should apply new max depth to subsequent resolutions', () => {
      // Create a resolver that goes to depth 6
      const deepResolver = {
        canResolve: () => true,
        resolve: (node, ctx) => {
          if (node.level < 6) {
            return ctx.walk({
              type: 'Deep',
              field: `level${node.level || 0}`,
              level: (node.level || 0) + 1,
            });
          }
          return new Set(['deep-entity']);
        },
      };

      const deepEngine = createScopeEngine({
        logger: mockLogger,
        resolvers: [deepResolver],
        maxDepth: 4,
      });

      // Should fail with default depth of 4
      expect(() =>
        deepEngine.resolve(
          { type: 'Deep', level: 0 },
          mockActorEntity,
          mockRuntimeCtx
        )
      ).toThrow(ScopeDepthError);

      // Update max depth to 8
      deepEngine.setMaxDepth(8);

      // Should now succeed
      const result = deepEngine.resolve(
        { type: 'Deep', level: 0 },
        mockActorEntity,
        mockRuntimeCtx
      );
      expect(result).toBeInstanceOf(Set);
      expect(result.has('deep-entity')).toBe(true);
    });
  });

  describe('resolver context', () => {
    it('should provide correct context to resolvers', () => {
      const contextCapture = jest.fn();
      const mockResolver = {
        canResolve: () => true,
        resolve: (node, ctx) => {
          contextCapture(ctx);
          return new Set(['test']);
        },
      };

      const engine = createScopeEngine({
        logger: mockLogger,
        resolvers: [mockResolver],
      });

      const ast = { type: 'Test' };
      engine.resolve(ast, mockActorEntity, mockRuntimeCtx, mockTrace);

      expect(contextCapture).toHaveBeenCalled();
      const capturedCtx = contextCapture.mock.calls[0][0];

      expect(capturedCtx.actorEntity).toBe(mockActorEntity);
      expect(capturedCtx.runtimeCtx).toBe(mockRuntimeCtx);
      expect(capturedCtx.depth).toBe(0);
      expect(capturedCtx.trace).toBe(mockTrace);
      expect(capturedCtx.walk).toBeInstanceOf(Function);
    });
  });
});
