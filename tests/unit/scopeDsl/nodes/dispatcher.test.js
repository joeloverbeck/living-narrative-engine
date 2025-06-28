/**
 * @file Tests for Node Dispatcher
 * @description Unit tests for the node dispatcher that routes AST nodes to appropriate resolvers
 */

const createDispatcher =
  require('../../../../src/scopeDsl/nodes/dispatcher').default;
const {
  ScopeDslError,
} = require('../../../../src/scopeDsl/errors/scopeDslError');

describe('Node Dispatcher', () => {
  describe('createDispatcher', () => {
    let fakeResolver1;
    let fakeResolver2;
    let dispatcher;

    beforeEach(() => {
      // Create two fake resolvers
      fakeResolver1 = {
        canResolve: jest.fn(),
        resolve: jest.fn(),
      };

      fakeResolver2 = {
        canResolve: jest.fn(),
        resolve: jest.fn(),
      };
    });

    test('should dispatch to the correct resolver when first resolver matches', () => {
      // Setup
      const node = { type: 'Source', kind: 'actor' };
      const ctx = { entityManager: {} };
      const expectedResult = new Set(['entity1', 'entity2']);

      fakeResolver1.canResolve.mockReturnValue(true);
      fakeResolver1.resolve.mockReturnValue(expectedResult);
      fakeResolver2.canResolve.mockReturnValue(false);

      dispatcher = createDispatcher([fakeResolver1, fakeResolver2]);

      // Execute
      const result = dispatcher.resolve(node, ctx);

      // Assert
      expect(fakeResolver1.canResolve).toHaveBeenCalledWith(node);
      expect(fakeResolver1.resolve).toHaveBeenCalledWith(node, ctx);
      expect(fakeResolver2.canResolve).not.toHaveBeenCalled();
      expect(result).toBe(expectedResult);
    });

    test('should dispatch to the correct resolver when second resolver matches', () => {
      // Setup
      const node = { type: 'Step', kind: 'field' };
      const ctx = { entityManager: {} };
      const expectedResult = new Set(['entity3', 'entity4']);

      fakeResolver1.canResolve.mockReturnValue(false);
      fakeResolver2.canResolve.mockReturnValue(true);
      fakeResolver2.resolve.mockReturnValue(expectedResult);

      dispatcher = createDispatcher([fakeResolver1, fakeResolver2]);

      // Execute
      const result = dispatcher.resolve(node, ctx);

      // Assert
      expect(fakeResolver1.canResolve).toHaveBeenCalledWith(node);
      expect(fakeResolver2.canResolve).toHaveBeenCalledWith(node);
      expect(fakeResolver1.resolve).not.toHaveBeenCalled();
      expect(fakeResolver2.resolve).toHaveBeenCalledWith(node, ctx);
      expect(result).toBe(expectedResult);
    });

    test('should throw ScopeDslError when no resolver matches', () => {
      // Setup
      const node = { type: 'UnknownType' };
      const ctx = { entityManager: {} };

      fakeResolver1.canResolve.mockReturnValue(false);
      fakeResolver2.canResolve.mockReturnValue(false);

      dispatcher = createDispatcher([fakeResolver1, fakeResolver2]);

      // Execute & Assert
      expect(() => {
        dispatcher.resolve(node, ctx);
      }).toThrow(ScopeDslError);

      expect(() => {
        dispatcher.resolve(node, ctx);
      }).toThrow("Unknown node kind: 'UnknownType'");

      expect(fakeResolver1.canResolve).toHaveBeenCalledWith(node);
      expect(fakeResolver2.canResolve).toHaveBeenCalledWith(node);
      expect(fakeResolver1.resolve).not.toHaveBeenCalled();
      expect(fakeResolver2.resolve).not.toHaveBeenCalled();
    });

    test('should handle empty resolver array', () => {
      // Setup
      const node = { type: 'Source' };
      const ctx = { entityManager: {} };

      dispatcher = createDispatcher([]);

      // Execute & Assert
      expect(() => {
        dispatcher.resolve(node, ctx);
      }).toThrow(ScopeDslError);

      expect(() => {
        dispatcher.resolve(node, ctx);
      }).toThrow("Unknown node kind: 'Source'");
    });

    test('should stop checking resolvers after finding a match', () => {
      // Setup
      const node = { type: 'Source' };
      const ctx = { entityManager: {} };
      const expectedResult = new Set(['entity5']);

      // Both resolvers can handle the node, but only first should be called
      fakeResolver1.canResolve.mockReturnValue(true);
      fakeResolver1.resolve.mockReturnValue(expectedResult);
      fakeResolver2.canResolve.mockReturnValue(true);

      dispatcher = createDispatcher([fakeResolver1, fakeResolver2]);

      // Execute
      const result = dispatcher.resolve(node, ctx);

      // Assert
      expect(fakeResolver1.canResolve).toHaveBeenCalledWith(node);
      expect(fakeResolver1.resolve).toHaveBeenCalledWith(node, ctx);
      expect(fakeResolver2.canResolve).not.toHaveBeenCalled();
      expect(fakeResolver2.resolve).not.toHaveBeenCalled();
      expect(result).toBe(expectedResult);
    });
  });
});
