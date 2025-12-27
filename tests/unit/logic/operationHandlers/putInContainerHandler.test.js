import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import * as contextVariableUtils from '../../../../src/utils/contextVariableUtils.js';
import * as safeDispatchErrorUtils from '../../../../src/utils/safeDispatchErrorUtils.js';
import PutInContainerHandler from '../../../../src/logic/operationHandlers/putInContainerHandler.js';
import { ITEM_PUT_IN_CONTAINER_EVENT_ID } from '../../../../src/constants/eventIds.js';
import {
  INVENTORY_COMPONENT_ID,
  CONTAINER_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

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

  afterEach(() => {
    jest.restoreAllMocks();
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
            componentTypeId: INVENTORY_COMPONENT_ID,
            componentData: expect.objectContaining({
              items: ['item2'],
            }),
          }),
          expect.objectContaining({
            instanceId: 'container1',
            componentTypeId: CONTAINER_COMPONENT_ID,
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
        ITEM_PUT_IN_CONTAINER_EVENT_ID,
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

    it('should return validation failure when params are not an object', async () => {
      const safeDispatchErrorSpy = jest.spyOn(
        safeDispatchErrorUtils,
        'safeDispatchError'
      );

      const result = await handler.execute(null, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(safeDispatchErrorSpy).toHaveBeenCalledWith(
        mockSafeEventDispatcher,
        'PUT_IN_CONTAINER: params missing or invalid.',
        { params: null },
        mockSafeEventDispatcher
      );
    });

    it('should dispatch validation error and write result when actorEntity is invalid', async () => {
      const tryWriteContextVariableSpy = jest.spyOn(
        contextVariableUtils,
        'tryWriteContextVariable'
      );
      const safeDispatchErrorSpy = jest.spyOn(
        safeDispatchErrorUtils,
        'safeDispatchError'
      );

      const params = {
        actorEntity: '   ',
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: ' resultVar ',
      };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(safeDispatchErrorSpy).toHaveBeenCalledWith(
        mockSafeEventDispatcher,
        'PUT_IN_CONTAINER: actorEntity is required',
        { actorEntity: '   ' },
        mockLogger
      );
      expect(tryWriteContextVariableSpy).toHaveBeenCalledWith(
        ' resultVar ',
        { success: false, error: 'validation_failed' },
        executionContext,
        mockSafeEventDispatcher,
        mockLogger
      );
    });

    it('should dispatch validation error when containerEntity is invalid', async () => {
      const safeDispatchErrorSpy = jest.spyOn(
        safeDispatchErrorUtils,
        'safeDispatchError'
      );

      const params = {
        actorEntity: 'actor1',
        containerEntity: '',
        itemEntity: 'item1',
      };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(safeDispatchErrorSpy).toHaveBeenCalledWith(
        mockSafeEventDispatcher,
        'PUT_IN_CONTAINER: containerEntity is required',
        { containerEntity: '' },
        mockLogger
      );
    });

    it('should dispatch validation error when itemEntity is invalid', async () => {
      const safeDispatchErrorSpy = jest.spyOn(
        safeDispatchErrorUtils,
        'safeDispatchError'
      );

      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: '   ',
      };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(safeDispatchErrorSpy).toHaveBeenCalledWith(
        mockSafeEventDispatcher,
        'PUT_IN_CONTAINER: itemEntity is required',
        { itemEntity: '   ' },
        mockLogger
      );
    });

    it('should reject invalid result_variable values', async () => {
      const safeDispatchErrorSpy = jest.spyOn(
        safeDispatchErrorUtils,
        'safeDispatchError'
      );

      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: '   ',
      };

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'validation_failed' });
      expect(safeDispatchErrorSpy).toHaveBeenCalledWith(
        mockSafeEventDispatcher,
        'PUT_IN_CONTAINER: result_variable must be a non-empty string when provided',
        { result_variable: '   ' },
        mockLogger
      );
    });

    it('should fail if actor does not have the item', async () => {
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
      };

      // Mock actor inventory without the item
      mockEntityManager.getComponentData.mockReturnValueOnce({
        items: ['item2', 'item3'],
      });

      await handler.execute(params, executionContext);

      // Verify no batch update
      expect(
        mockEntityManager.batchAddComponentsOptimized
      ).not.toHaveBeenCalled();

      // Verify no event was dispatched
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should store result when actor lacks the item', async () => {
      const tryWriteContextVariableSpy = jest.spyOn(
        contextVariableUtils,
        'tryWriteContextVariable'
      );

      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'missing',
        result_variable: ' outcome ',
      };

      mockEntityManager.getComponentData.mockReturnValueOnce({
        items: 'not-an-array',
      });

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({
        success: false,
        error: 'item_not_in_inventory',
      });
      expect(tryWriteContextVariableSpy).toHaveBeenCalledWith(
        'outcome',
        { success: false, error: 'item_not_in_inventory' },
        executionContext,
        mockSafeEventDispatcher,
        mockLogger
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
      expect(
        mockEntityManager.batchAddComponentsOptimized
      ).not.toHaveBeenCalled();

      // Verify no event was dispatched
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should write result when container is closed', async () => {
      const tryWriteContextVariableSpy = jest.spyOn(
        contextVariableUtils,
        'tryWriteContextVariable'
      );

      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'closedResult',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ items: ['item1'] })
        .mockReturnValueOnce({ isOpen: false });

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'container_closed' });
      expect(tryWriteContextVariableSpy).toHaveBeenCalledWith(
        'closedResult',
        { success: false, error: 'container_closed' },
        executionContext,
        mockSafeEventDispatcher,
        mockLogger
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
        .mockReturnValueOnce(null); // missing container component

      const result = await handler.execute(params, executionContext);

      // Verify no batch update
      expect(
        mockEntityManager.batchAddComponentsOptimized
      ).not.toHaveBeenCalled();

      expect(result).toEqual({ success: false, error: 'not_a_container' });
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should write result when container component is missing', async () => {
      const tryWriteContextVariableSpy = jest.spyOn(
        contextVariableUtils,
        'tryWriteContextVariable'
      );

      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'missingContainer',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ items: ['item1'] })
        .mockReturnValueOnce(null);

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'not_a_container' });
      expect(tryWriteContextVariableSpy).toHaveBeenCalledWith(
        'missingContainer',
        { success: false, error: 'not_a_container' },
        executionContext,
        mockSafeEventDispatcher,
        mockLogger
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
        .mockReturnValueOnce({ isOpen: true, contents: [] });

      await handler.execute(params, executionContext);

      // Should still execute successfully
      expect(mockEntityManager.batchAddComponentsOptimized).toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'containers:item_put_in_container',
        expect.objectContaining({
          actorEntity: 'actor1',
          containerEntity: 'container1',
          itemEntity: 'item1',
        })
      );
    });

    it('should write result when actor inventory is missing', async () => {
      const tryWriteContextVariableSpy = jest.spyOn(
        contextVariableUtils,
        'tryWriteContextVariable'
      );

      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'noInventory',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ isOpen: true, contents: [] });

      const result = await handler.execute(params, executionContext);

      expect(result).toEqual({ success: false, error: 'no_inventory' });
      expect(tryWriteContextVariableSpy).toHaveBeenCalledWith(
        'noInventory',
        { success: false, error: 'no_inventory' },
        executionContext,
        mockSafeEventDispatcher,
        mockLogger
      );
    });

    it('should write result when operation throws and include error message', async () => {
      const tryWriteContextVariableSpy = jest.spyOn(
        contextVariableUtils,
        'tryWriteContextVariable'
      );

      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
        itemEntity: 'item1',
        result_variable: 'operationResult',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ items: ['item1'] })
        .mockReturnValueOnce({ isOpen: true, contents: [] });

      const error = new Error('database failure');
      mockEntityManager.batchAddComponentsOptimized.mockRejectedValue(error);

      const result = await handler.execute(params, executionContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Put in container failed',
        error,
        {
          actorEntity: 'actor1',
          containerEntity: 'container1',
          itemEntity: 'item1',
        }
      );
      expect(result).toEqual({ success: false, error: 'database failure' });
      expect(tryWriteContextVariableSpy).toHaveBeenCalledWith(
        'operationResult',
        { success: false, error: 'database failure' },
        executionContext,
        mockSafeEventDispatcher,
        mockLogger
      );
    });
  });
});
