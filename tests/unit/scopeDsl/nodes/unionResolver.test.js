import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import createUnionResolver from '../../../../src/scopeDsl/nodes/unionResolver.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('unionResolver', () => {
  let resolver;
  let dispatcher;
  let mockErrorHandler;

  beforeEach(() => {
    // Create a mock dispatcher for recursive resolution
    dispatcher = {
      resolve: jest.fn(),
    };

    // Create a mock error handler
    mockErrorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn().mockReturnValue([]),
    };

    resolver = createUnionResolver();
  });

  describe('canResolve', () => {
    it('should return true for Union nodes', () => {
      expect(resolver.canResolve({ type: 'Union' })).toBe(true);
    });

    it('should return false for non-Union nodes', () => {
      expect(resolver.canResolve({ type: 'Source' })).toBe(false);
      expect(resolver.canResolve({ type: 'Step' })).toBe(false);
      expect(resolver.canResolve({ type: 'Filter' })).toBe(false);
    });
  });

  describe('resolve', () => {
    describe('basic union operations', () => {
      it('should union two disjoint sets', () => {
        const leftResult = new Set(['entity1', 'entity2']);
        const rightResult = new Set(['entity3', 'entity4']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source', kind: 'entities', param: 'core:name' },
          right: { type: 'Source', kind: 'entities', param: 'core:position' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(4);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
        expect(result.has('entity3')).toBe(true);
        expect(result.has('entity4')).toBe(true);

        // Verify both sides were resolved
        expect(dispatcher.resolve).toHaveBeenCalledTimes(2);
        expect(dispatcher.resolve).toHaveBeenCalledWith(node.left, ctx);
        expect(dispatcher.resolve).toHaveBeenCalledWith(node.right, ctx);
      });

      it('should handle overlapping sets correctly', () => {
        const leftResult = new Set(['entity1', 'entity2', 'entity3']);
        const rightResult = new Set(['entity2', 'entity3', 'entity4']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(4); // entity1, entity2, entity3, entity4 (no duplicates)
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
        expect(result.has('entity3')).toBe(true);
        expect(result.has('entity4')).toBe(true);
      });

      it('should handle empty sets', () => {
        const leftResult = new Set(['entity1', 'entity2']);
        const rightResult = new Set();

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
      });

      it('should handle both empty sets', () => {
        const leftResult = new Set();
        const rightResult = new Set();

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      });
    });

    describe('diverse data types', () => {
      it('should union sets containing different types of values', () => {
        const obj1 = { id: 'exit1', direction: 'north' };
        const obj2 = { id: 'exit2', direction: 'south' };

        const leftResult = new Set(['entity1', 'entity2']);
        const rightResult = new Set([obj1, obj2]);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Step' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(4);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
        expect(result.has(obj1)).toBe(true);
        expect(result.has(obj2)).toBe(true);
      });

      it('should handle arrays in sets', () => {
        const arr1 = ['entity1', 'entity2'];
        const arr2 = ['entity3'];

        const leftResult = new Set([arr1]);
        const rightResult = new Set([arr2, 'entity4']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Step' },
          right: { type: 'Step' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(4); // Arrays are flattened: entity1, entity2, entity3, entity4
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
        expect(result.has('entity3')).toBe(true);
        expect(result.has('entity4')).toBe(true);
      });
    });

    describe('trace logging', () => {
      it('should not throw when trace is not provided', () => {
        const leftResult = new Set(['entity1']);
        const rightResult = new Set(['entity2']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        expect(() => resolver.resolve(node, ctx)).not.toThrow();
      });
    });

    describe('identical items', () => {
      it('should correctly handle identical string values', () => {
        const leftResult = new Set(['entity1', 'entity2', 'entity3']);
        const rightResult = new Set(['entity1', 'entity2', 'entity3']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(3); // No duplicates
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
        expect(result.has('entity3')).toBe(true);
      });

      it('should handle object reference equality correctly', () => {
        const sharedObj = { id: 'shared', value: 42 };
        const leftResult = new Set([sharedObj, { id: 'left' }]);
        const rightResult = new Set([sharedObj, { id: 'right' }]);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Step' },
          right: { type: 'Step' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(3); // sharedObj counted once
        expect(result.has(sharedObj)).toBe(true);
      });
    });

    describe('large sets', () => {
      it('should efficiently handle large sets', () => {
        const leftItems = [];
        const rightItems = [];

        // Create 1000 items for each side with 200 overlapping
        for (let i = 0; i < 1000; i++) {
          leftItems.push(`left-${i}`);
          rightItems.push(`right-${i}`);
        }
        // Add overlapping items
        for (let i = 0; i < 200; i++) {
          leftItems.push(`shared-${i}`);
          rightItems.push(`shared-${i}`);
        }

        const leftResult = new Set(leftItems);
        const rightResult = new Set(rightItems);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2200); // 1000 + 1000 + 200 shared (counted once)
      });
    });

    describe('error handling', () => {
      describe('missing context validation', () => {
        it('should throw error when actorEntity is missing and no errorHandler', () => {
          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            dispatcher, // Missing actorEntity
          };

          expect(() => resolver.resolve(node, ctx)).toThrow(
            'UnionResolver: actorEntity is missing from context'
          );
        });

        it('should use error handler when actorEntity is missing', () => {
          const resolverWithHandler = createUnionResolver({
            errorHandler: mockErrorHandler,
          });
          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            dispatcher, // Missing actorEntity
          };

          resolverWithHandler.resolve(node, ctx);

          expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
            expect.any(Error),
            ctx,
            'UnionResolver',
            ErrorCodes.MISSING_ACTOR
          );
        });
      });

      describe('operand validation', () => {
        it('should throw error when left operand is not iterable and no errorHandler', () => {
          const leftResult = 'not-iterable';
          const rightResult = new Set(['entity1']);

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          expect(() => resolver.resolve(node, ctx)).toThrow(
            'Cannot union string with object - both operands must be iterable collections (Set, Array, etc.)'
          );
        });

        it('should use error handler when operand is not iterable', () => {
          const resolverWithHandler = createUnionResolver({
            errorHandler: mockErrorHandler,
          });
          const leftResult = null;
          const rightResult = new Set(['entity1']);

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          resolverWithHandler.resolve(node, ctx);

          expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
            expect.any(Error),
            ctx,
            'UnionResolver',
            ErrorCodes.DATA_TYPE_MISMATCH
          );
        });

        it('should treat plain objects without iterators as invalid operands', () => {
          const resolverWithHandler = createUnionResolver({
            errorHandler: mockErrorHandler,
          });
          const leftResult = { id: 'non-iterable-object' };
          const rightResult = new Set(['entity1']);

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          resolverWithHandler.resolve(node, ctx);

          expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
            expect.any(Error),
            ctx,
            'UnionResolver',
            ErrorCodes.DATA_TYPE_MISMATCH
          );
        });

        it('should reject string wrapper objects to exercise constructor branch', () => {
          const resolverWithHandler = createUnionResolver({
            errorHandler: mockErrorHandler,
          });
          const leftResult = new Set(['entity1']);
          const rightResult = new String('wrapped-entity');

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          resolverWithHandler.resolve(node, ctx);

          expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
            expect.any(Error),
            ctx,
            'UnionResolver',
            ErrorCodes.DATA_TYPE_MISMATCH
          );
        });

        it('should throw error when right operand is not iterable and no errorHandler', () => {
          const leftResult = new Set(['entity1']);
          const rightResult = 42;

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          expect(() => resolver.resolve(node, ctx)).toThrow(
            'Cannot union object with number - both operands must be iterable collections (Set, Array, etc.)'
          );
        });
      });

      describe('memory threshold validation', () => {
        it('should use error handler for memory threshold exceeded', () => {
          const resolverWithHandler = createUnionResolver({
            errorHandler: mockErrorHandler,
          });

          // Create large sets that exceed the 10000 threshold
          const leftItems = Array.from({ length: 7000 }, (_, i) => `left-${i}`);
          const rightItems = Array.from(
            { length: 4000 },
            (_, i) => `right-${i}`
          );

          const leftResult = new Set(leftItems);
          const rightResult = new Set(rightItems);

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          resolverWithHandler.resolve(node, ctx);

          expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
              ...ctx,
              estimatedSize: 11000,
              leftSize: 7000,
              rightSize: 4000,
            }),
            'UnionResolver',
            ErrorCodes.MEMORY_LIMIT
          );
        });

        it('should continue union when memory threshold is exceeded without an error handler', () => {
          const leftItems = Array.from({ length: 6000 }, (_, i) => `left-${i}`);
          const rightItems = Array.from(
            { length: 5000 },
            (_, i) => `right-${i}`
          );

          dispatcher.resolve
            .mockReturnValueOnce(new Set(leftItems))
            .mockReturnValueOnce(new Set(rightItems));

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          const result = resolver.resolve(node, ctx);

          expect(result).toBeInstanceOf(Set);
          expect(result.size).toBe(11000);
        });

        it('should not trigger memory warning for small unions', () => {
          const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

          const leftResult = new Set(['entity1', 'entity2']);
          const rightResult = new Set(['entity3', 'entity4']);

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          const result = resolver.resolve(node, ctx);

          expect(consoleSpy).not.toHaveBeenCalled();
          expect(result).toBeInstanceOf(Set);
          expect(result.size).toBe(4);

          consoleSpy.mockRestore();
        });
      });

      describe('backward compatibility', () => {
        it('should work without errorHandler parameter', () => {
          const backwardResolver = createUnionResolver();

          const leftResult = new Set(['entity1']);
          const rightResult = new Set(['entity2']);

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          const result = backwardResolver.resolve(node, ctx);

          expect(result).toBeInstanceOf(Set);
          expect(result.size).toBe(2);
        });

        it('should work with undefined errorHandler', () => {
          const backwardResolver = createUnionResolver({ errorHandler: null });

          const leftResult = new Set(['entity1']);
          const rightResult = new Set(['entity2']);

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          const result = backwardResolver.resolve(node, ctx);

          expect(result).toBeInstanceOf(Set);
          expect(result.size).toBe(2);
        });
      });

      describe('dependency validation', () => {
        it('should validate errorHandler has required methods', () => {
          const invalidErrorHandler = {
            // Missing required methods
          };

          expect(() => {
            createUnionResolver({ errorHandler: invalidErrorHandler });
          }).toThrow();
        });

        it('should accept valid errorHandler', () => {
          expect(() => {
            createUnionResolver({ errorHandler: mockErrorHandler });
          }).not.toThrow();
        });
      });

      describe('array flattening branches', () => {
        it('should skip nullish values while flattening nested arrays', () => {
          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          const leftResult = new Set([['entity1', null, undefined, 'entity2']]);
          const rightResult = new Set([['entity3', null]]);

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const result = resolver.resolve(node, ctx);

          expect(result).toEqual(new Set(['entity1', 'entity2', 'entity3']));
        });

        it('should ignore nullish direct items that are not arrays', () => {
          const node = {
            type: 'Union',
            left: { type: 'Source' },
            right: { type: 'Source' },
          };
          const ctx = {
            actorEntity: { id: 'actor123' },
            dispatcher,
          };

          const leftResult = new Set([null, 'entityA']);
          const rightResult = new Set([undefined, 'entityB']);

          dispatcher.resolve
            .mockReturnValueOnce(leftResult)
            .mockReturnValueOnce(rightResult);

          const result = resolver.resolve(node, ctx);

          expect(result).toEqual(new Set(['entityA', 'entityB']));
        });
      });
    });
  });
});
