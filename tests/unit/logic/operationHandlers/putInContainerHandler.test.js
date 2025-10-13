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
      batchAddComponentsOptimized: jest.fn().mockResolvedValue(undefined),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    executionContext = {
      logger: mockLogger,
      evaluationContext: {
        context: {},
      },
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
        .mockReturnValueOnce({
          isOpen: true,
          contents: ['existingItem'],
        }); // container component

      await handler.execute(params, executionContext);

      // Verify batch update was called
      expect(
        mockEntityManager.batchAddComponentsOptimized
      ).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            instanceId: 'actor1',
            componentTypeId: 'items:inventory',
            componentData: expect.objectContaining({
              items: ['item2'],
            }),
          }),
          expect.objectContaining({
            instanceId: 'container1',
            componentTypeId: 'items:container',
            componentData: expect.objectContaining({
              isOpen: true,
              contents: ['existingItem', 'item1'],
            }),
          }),
        ],
        true
      );

      // Verify event was dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'items:item_put_in_container',
        expect.objectContaining({
          actorEntity: 'actor1',
          containerEntity: 'container1',
          itemEntity: 'item1',
        })
      );

      // Verify result variable was set
      expect(executionContext.evaluationContext.context.putResult).toEqual({
        success: true,
      });
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

      // Verify no event was dispatched
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
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

      // Verify no event was dispatched
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should fail if container does not have container component', async () => {
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ items: ['item1'] }) // actor has item
        .mockReturnValueOnce(null); // missing container component

      const result = await handler.execute(params, executionContext);

      // Verify no batch update
      expect(mockEntityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();

      expect(result).toEqual({ success: false, error: 'not_a_container' });
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
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
        .mockReturnValueOnce({ isOpen: true, contents: [] });

      await handler.execute(params, executionContext);

      // Should still execute successfully
      expect(mockEntityManager.batchAddComponentsOptimized).toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'items:item_put_in_container',
        expect.objectContaining({
          actorEntity: 'actor1',
          containerEntity: 'container1',
          itemEntity: 'item1',
        })
      );
    });
  });
});
