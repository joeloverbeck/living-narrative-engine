import { describe, it, expect, beforeEach } from '@jest/globals';
import ValidateContainerCapacityHandler from '../../../../src/logic/operationHandlers/validateContainerCapacityHandler.js';

describe('ValidateContainerCapacityHandler', () => {
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
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    executionContext = {
      executionContext: 'test-context',
      evaluationContext: {
        context: {},
      },
    };

    handler = new ValidateContainerCapacityHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  describe('execute', () => {
    it('should validate successfully when capacity is available', async () => {
      const params = {
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'capacityCheck',
      };

      // Mock container with capacity
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          contents: ['existingItem1'],
          capacity: { maxItems: 5, maxWeight: 100 },
          isOpen: true,
        }) // container
        .mockReturnValueOnce({ weight: 10 }) // item weight
        .mockReturnValueOnce({ weight: 20 }); // existing item weight

      await handler.execute(params, executionContext);

      expect(
        executionContext.evaluationContext.context.capacityCheck
      ).toEqual({
        valid: true,
      });
    });

    it('should fail validation when max items exceeded', async () => {
      const params = {
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'capacityCheck',
      };

      // Mock container at max items
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          contents: ['item1', 'item2', 'item3'],
          capacity: { maxItems: 3, maxWeight: 100 },
          isOpen: true,
        })
        .mockReturnValueOnce({ weight: 10 });

      await handler.execute(params, executionContext);

      expect(
        executionContext.evaluationContext.context.capacityCheck
      ).toEqual({
        valid: false,
        reason: 'max_items_exceeded',
      });
    });

    it('should fail validation when max weight exceeded', async () => {
      const params = {
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'capacityCheck',
      };

      // Mock container with weight constraint
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          contents: ['existingItem1', 'existingItem2'],
          capacity: { maxItems: 10, maxWeight: 50 },
          isOpen: true,
        }) // container
        .mockReturnValueOnce({ weight: 30 }) // item weight
        .mockReturnValueOnce({ weight: 25 }) // existing item 1 weight
        .mockReturnValueOnce({ weight: 15 }); // existing item 2 weight

      await handler.execute(params, executionContext);

      expect(
        executionContext.evaluationContext.context.capacityCheck
      ).toEqual({
        valid: false,
        reason: 'max_weight_exceeded',
      });
    });

    it('should handle items without weight component', async () => {
      const params = {
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'capacityCheck',
      };

      // Mock container with some items without weight
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          contents: ['existingItem1', 'existingItem2'],
          capacity: { maxItems: 10, maxWeight: 100 },
          isOpen: true,
        }) // container
        .mockReturnValueOnce({ weight: 10 }) // item weight
        .mockReturnValueOnce(null) // existing item 1 has no weight
        .mockReturnValueOnce({ weight: 20 }); // existing item 2 weight

      await handler.execute(params, executionContext);

      // Should still validate successfully
      expect(
        executionContext.evaluationContext.context.capacityCheck
      ).toEqual({
        valid: true,
      });
    });

    it('should fail if result_variable is missing', async () => {
      const params = {
        containerEntity: 'container1',
        itemEntity: 'item1',
        // Missing result_variable
      };

      await handler.execute(params, executionContext);

      // Verify error event was dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('result_variable is required'),
          details: expect.objectContaining({
            result_variable: undefined,
          }),
        })
      );
    });

    it('should fail if container does not have container component', async () => {
      const params = {
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'capacityCheck',
      };

      mockEntityManager.getComponentData.mockReturnValueOnce(null);

      await handler.execute(params, executionContext);

      expect(
        executionContext.evaluationContext.context.capacityCheck
      ).toEqual({
        valid: false,
        reason: 'no_container',
      });
    });

    it('should handle empty container', async () => {
      const params = {
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'capacityCheck',
      };

      // Mock empty container
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          contents: [],
          capacity: { maxItems: 5, maxWeight: 100 },
          isOpen: true,
        })
        .mockReturnValueOnce({ weight: 10 });

      await handler.execute(params, executionContext);

      expect(
        executionContext.evaluationContext.context.capacityCheck
      ).toEqual({
        valid: true,
      });
    });
  });
});
