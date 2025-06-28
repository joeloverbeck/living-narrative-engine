import createScopeEngine from '../../src/scopeDsl/core/createScopeEngine.js';
import createDepthGuard from '../../src/scopeDsl/core/depthGuard.js';
import createCycleDetector from '../../src/scopeDsl/core/cycleDetector.js';
import createDispatcher from '../../src/scopeDsl/nodes/dispatcher.js';
import ScopeDepthError from '../../src/errors/scopeDepthError.js';
import ScopeCycleError from '../../src/errors/scopeCycleError.js';

describe('createScopeEngine', () => {
  let mockResolvers;
  let mockEntityManager;
  let mockLogger;
  let mockActorEntity;
  let mockPorts;

  beforeEach(() => {
    // Mock resolvers
    mockResolvers = [
      {
        canResolve: (node) => node.type === 'Source',
        resolve: jest.fn((node, ctx) => {
          if (node.kind === 'actor') {
            return new Set([ctx.actorEntity.id]);
          }
          return new Set();
        }),
      },
      {
        canResolve: (node) => node.type === 'Step',
        resolve: jest.fn((node, ctx) => {
          // Resolve parent and access field
          const parentResult = ctx.walk(node.parent);
          const result = new Set();
          for (const item of parentResult) {
            result.add({ id: item, field: node.field });
          }
          return result;
        }),
      },
    ];

    // Mock entity manager
    mockEntityManager = {
      getEntity: jest.fn(),
      getComponentData: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    // Mock actor entity
    mockActorEntity = {
      id: 'actor-123',
      components: {
        'core:name': { value: 'Test Actor' },
      },
    };

    // Mock ports (runtime context)
    mockPorts = {
      entityManager: mockEntityManager,
      logger: mockLogger,
    };
  });

  describe('factory creation', () => {
    it('should create a scope engine with resolve and setMaxDepth methods', () => {
      const engine = createScopeEngine(mockResolvers);

      expect(engine).toHaveProperty('resolve');
      expect(engine).toHaveProperty('setMaxDepth');
      expect(typeof engine.resolve).toBe('function');
      expect(typeof engine.setMaxDepth).toBe('function');
    });

    it('should accept custom max depth', () => {
      const engine = createScopeEngine(mockResolvers, 6);

      // Test that deep nesting up to 6 works
      const deepAST = createDeepAST(6);
      expect(() => {
        engine.resolve(deepAST, mockActorEntity, mockPorts);
      }).not.toThrow();
    });
  });

  describe('resolve method', () => {
    it('should resolve a simple Source node', () => {
      const engine = createScopeEngine(mockResolvers);
      const ast = { type: 'Source', kind: 'actor' };

      const result = engine.resolve(ast, mockActorEntity, mockPorts);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('actor-123')).toBe(true);
    });

    it('should resolve nested Step nodes', () => {
      const engine = createScopeEngine(mockResolvers);
      const ast = {
        type: 'Step',
        field: 'name',
        parent: { type: 'Source', kind: 'actor' },
      };

      const result = engine.resolve(ast, mockActorEntity, mockPorts);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      const [item] = result;
      expect(item).toEqual({ id: 'actor-123', field: 'name' });
    });

    it('should pass context correctly through walk function', () => {
      const engine = createScopeEngine(mockResolvers);
      const ast = { type: 'Source', kind: 'actor' };

      engine.resolve(ast, mockActorEntity, mockPorts);

      expect(mockResolvers[0].resolve).toHaveBeenCalledWith(
        ast,
        expect.objectContaining({
          actorEntity: mockActorEntity,
          entityManager: mockEntityManager,
          logger: mockLogger,
          walk: expect.any(Function),
        })
      );
    });
  });

  describe('depth limiting', () => {
    it('should throw ScopeDepthError when depth exceeds max', () => {
      const engine = createScopeEngine(mockResolvers, 2);
      const deepAST = createDeepAST(3);

      expect(() => {
        engine.resolve(deepAST, mockActorEntity, mockPorts);
      }).toThrow(ScopeDepthError);
    });

    it('should respect setMaxDepth updates', () => {
      const engine = createScopeEngine(mockResolvers, 2);
      const deepAST = createDeepAST(3);

      // Initially should throw
      expect(() => {
        engine.resolve(deepAST, mockActorEntity, mockPorts);
      }).toThrow(ScopeDepthError);

      // Update max depth
      engine.setMaxDepth(4);

      // Now should not throw
      expect(() => {
        engine.resolve(deepAST, mockActorEntity, mockPorts);
      }).not.toThrow();
    });
  });

  describe('cycle detection', () => {
    it('should throw ScopeCycleError when a cycle is detected', () => {
      // Create a resolver that creates cycles
      const cyclicResolvers = [
        {
          canResolve: (node) => node.type === 'Cyclic',
          resolve: jest.fn((node, ctx) => {
            // Create a self-referencing cycle
            return ctx.walk({ type: 'Cyclic', id: node.id });
          }),
        },
      ];

      const engine = createScopeEngine(cyclicResolvers);
      const ast = { type: 'Cyclic', id: '1' };

      expect(() => {
        engine.resolve(ast, mockActorEntity, mockPorts);
      }).toThrow(ScopeCycleError);
    });

    it('should properly release cycle tracking after successful resolution', () => {
      const engine = createScopeEngine(mockResolvers);
      const ast = { type: 'Source', kind: 'actor' };

      // First resolution should succeed
      const result1 = engine.resolve(ast, mockActorEntity, mockPorts);
      expect(result1.size).toBe(1);

      // Second resolution with same AST should also succeed (cycle detector cleared)
      const result2 = engine.resolve(ast, mockActorEntity, mockPorts);
      expect(result2.size).toBe(1);
    });
  });

  describe('smoke test with real resolvers', () => {
    it('should reproduce old behavior with actual resolver implementations', () => {
      // This test would use actual resolver implementations
      // For now, we'll use simplified mocks that mimic real behavior
      const realishResolvers = [
        {
          canResolve: (node) => node.type === 'Source',
          resolve: (node, ctx) => {
            switch (node.kind) {
              case 'actor':
                return new Set([ctx.actorEntity.id]);
              case 'entities':
                // Simulate getting entities with a component
                return new Set(['entity-1', 'entity-2']);
              default:
                return new Set();
            }
          },
        },
        {
          canResolve: (node) => node.type === 'Filter',
          resolve: (node, ctx) => {
            const parentResult = ctx.walk(node.parent);
            // Simulate filtering
            const filtered = new Set();
            for (const item of parentResult) {
              if (item !== 'entity-2') {
                // Simple filter logic
                filtered.add(item);
              }
            }
            return filtered;
          },
        },
        {
          canResolve: (node) => node.type === 'Union',
          resolve: (node, ctx) => {
            const left = ctx.walk(node.left);
            const right = ctx.walk(node.right);
            return new Set([...left, ...right]);
          },
        },
      ];

      const engine = createScopeEngine(realishResolvers);

      // Test complex AST
      const complexAST = {
        type: 'Union',
        left: {
          type: 'Filter',
          parent: { type: 'Source', kind: 'entities', param: 'core:actor' },
          logic: { '!=': [{ var: 'entity.id' }, 'entity-2'] },
        },
        right: { type: 'Source', kind: 'actor' },
      };

      const result = engine.resolve(complexAST, mockActorEntity, mockPorts);

      expect(result).toBeInstanceOf(Set);
      expect(result.has('entity-1')).toBe(true);
      expect(result.has('actor-123')).toBe(true);
      expect(result.has('entity-2')).toBe(false);
    });
  });
});

// Helper function to create deeply nested AST
/**
 *
 * @param depth
 */
function createDeepAST(depth) {
  let ast = { type: 'Source', kind: 'actor' };
  for (let i = 0; i < depth; i++) {
    ast = { type: 'Step', field: `field${i}`, parent: ast };
  }
  return ast;
}
