import { describe, it, expect, beforeEach } from '@jest/globals';
import PutInContainerHandler from '../../../../src/logic/operationHandlers/putInContainerHandler.js';

describe('PutInContainerHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let executionContext;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      batchAddComponentsOptimized: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    executionContext = {
      context: {},
      executionContext: 'test-context',
    };

    handler = new PutInContainerHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  describe('execute', () => {
    it('should successfully move item from inventory to container', async () => {
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'putResult',
      };

      // Mock actor inventory
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ items: ['item1', 'item2'] }) // actor inventory
        .mockReturnValueOnce({ isOpen: true }) // container openable
        .mockReturnValueOnce({ contents: ['existingItem'] }); // container contents

      await handler.execute(params, executionContext);

      // Verify batch update was called
      expect(mockEntityManager.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.objectContaining({
          'actor1': expect.objectContaining({
            'items:inventory': { items: ['item2'] },
          }),
          'container1': expect.objectContaining({
            'items:container': { contents: ['existingItem', 'item1'] },
          }),
        }),
        expect.any(Object),
        'PUT_IN_CONTAINER',
        expect.any(Object)
      );

      // Verify event was dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'items:item_put_in_container',
          payload: expect.objectContaining({
            actorEntity: 'actor1',
            containerEntity: 'container1',
            itemEntity: 'item1',
          }),
        }),
        expect.any(Object)
      );

      // Verify result variable was set
      expect(executionContext.context.putResult).toEqual({ success: true });
    });

    it('should fail if actor does not have the item', async () => {
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
      };

      // Mock actor inventory without the item
      mockEntityManager.getComponentData.mockReturnValueOnce({ items: ['item2', 'item3'] });

      await handler.execute(params, executionContext);

      // Verify no batch update
      expect(mockEntityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();

      // Verify error event was dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_ERROR_OCCURRED',
          payload: expect.objectContaining({
            error: expect.stringContaining('does not have item'),
          }),
        }),
        expect.any(Object)
      );
    });

    it('should fail if container is not open', async () => {
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ items: ['item1'] }) // actor has item
        .mockReturnValueOnce({ isOpen: false }); // container is not open

      await handler.execute(params, executionContext);

      // Verify no batch update
      expect(mockEntityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();

      // Verify error event was dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_ERROR_OCCURRED',
          payload: expect.objectContaining({
            error: expect.stringContaining('not open'),
          }),
        }),
        expect.any(Object)
      );
    });

    it('should fail if container does not have container component', async () => {
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ items: ['item1'] }) // actor has item
        .mockReturnValueOnce({ isOpen: true }) // container is open
        .mockReturnValueOnce(null); // no container component

      await handler.execute(params, executionContext);

      // Verify no batch update
      expect(mockEntityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();

      // Verify error event was dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_ERROR_OCCURRED',
          payload: expect.objectContaining({
            error: expect.stringContaining('does not have items:container component'),
          }),
        }),
        expect.any(Object)
      );
    });

    it('should handle missing result_variable parameter', async () => {
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
        // No result_variable
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ items: ['item1'] })
        .mockReturnValueOnce({ isOpen: true })
        .mockReturnValueOnce({ contents: [] });

      await handler.execute(params, executionContext);

      // Should still execute successfully
      expect(mockEntityManager.batchAddComponentsOptimized).toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'items:item_put_in_container',
        }),
        expect.any(Object)
      );
    });
  });
});
