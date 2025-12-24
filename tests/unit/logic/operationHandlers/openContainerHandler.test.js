import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import OpenContainerHandler from '../../../../src/logic/operationHandlers/openContainerHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createDispatcher = () => ({
  dispatch: jest.fn(),
});

const createEntityManager = () => ({
  getComponentData: jest.fn(),
  batchAddComponentsOptimized: jest.fn().mockResolvedValue(undefined),
});

describe('OpenContainerHandler', () => {
  let logger;
  let dispatcher;
  let entityManager;
  let handler;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = createDispatcher();
    entityManager = createEntityManager();
    handler = new OpenContainerHandler({
      logger,
      entityManager,
      safeEventDispatcher: dispatcher,
    });
    jest.clearAllMocks();
  });

  const validParams = () => ({
    actorEntity: 'actor-123',
    containerEntity: 'container-456',
    result_variable: 'openResult',
  });

  describe('Parameter Validation', () => {
    it('returns validation failure when params object is missing', async () => {
      const result = await handler.execute(null);

      expect(result).toEqual({ success: false, error: 'invalid_parameters' });
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'OPEN_CONTAINER: params missing or invalid.',
          details: { params: null },
        })
      );
    });

    it('dispatches validation error when actorEntity is missing', async () => {
      const params = { ...validParams(), actorEntity: undefined };

      const result = await handler.execute(params);

      expect(result).toEqual({ success: false, error: 'invalid_parameters' });
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Invalid "actorEntity" parameter',
        })
      );
    });

    it('dispatches validation error when containerEntity is missing', async () => {
      const params = { ...validParams(), containerEntity: undefined };

      const result = await handler.execute(params);

      expect(result).toEqual({ success: false, error: 'invalid_parameters' });
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Invalid "containerEntity" parameter',
        })
      );
    });

    it('dispatches validation error when actorEntity is blank string', async () => {
      const params = { ...validParams(), actorEntity: '   ' };

      const result = await handler.execute(params);

      expect(result).toEqual({ success: false, error: 'invalid_parameters' });
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Invalid "actorEntity" parameter',
        })
      );
    });

    it('dispatches validation error when containerEntity is blank string', async () => {
      const params = { ...validParams(), containerEntity: '   ' };

      const result = await handler.execute(params);

      expect(result).toEqual({ success: false, error: 'invalid_parameters' });
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Invalid "containerEntity" parameter',
        })
      );
    });
  });

  describe('Container State Validation', () => {
    it('returns error when container has no openable component', async () => {
      entityManager.getComponentData.mockReturnValueOnce(null);

      const result = await handler.execute(validParams());

      expect(result).toEqual({
        success: false,
        error: 'container_not_openable',
      });
      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        'container-456',
        'items-core:openable'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'OpenContainerHandler: Container is not openable',
        { containerEntity: 'container-456' }
      );
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(entityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });

    it('returns error when container is already open', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({
          isOpen: true,
          contents: ['gold_bar'],
          requiresKey: false,
        });

      const result = await handler.execute(validParams());

      expect(result).toEqual({ success: false, error: 'already_open' });
      expect(logger.warn).toHaveBeenCalledWith(
        'OpenContainerHandler: Container is already open',
        { containerEntity: 'container-456' }
      );
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(entityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });
  });

  describe('Key Validation', () => {
    it('returns error when locked container requires key that actor does not have', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({
          isOpen: false,
          requiresKey: true,
          keyItemId: 'brass_key',
          contents: ['gold_bar', 'revolver'],
        })
        .mockReturnValueOnce({ items: ['gold_bar', 'revolver'] });

      const result = await handler.execute(validParams());

      expect(result).toEqual({ success: false, error: 'missing_key' });
      expect(entityManager.getComponentData).toHaveBeenNthCalledWith(
        1,
        'container-456',
        'items-core:openable'
      );
      expect(entityManager.getComponentData).toHaveBeenNthCalledWith(
        2,
        'container-456',
        'containers-core:container'
      );
      expect(entityManager.getComponentData).toHaveBeenNthCalledWith(
        3,
        'actor-123',
        'inventory:inventory'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'OpenContainerHandler: Actor does not have required key',
        { actorEntity: 'actor-123', requiredKey: 'brass_key' }
      );
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(entityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });

    it('returns error when locked container requires key but actor has no inventory', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({
          isOpen: false,
          requiresKey: true,
          keyItemId: 'brass_key',
          contents: ['gold_bar', 'revolver'],
        })
        .mockReturnValueOnce(null);

      const result = await handler.execute(validParams());

      expect(result).toEqual({ success: false, error: 'missing_key' });
      expect(entityManager.getComponentData).toHaveBeenNthCalledWith(
        3,
        'actor-123',
        'inventory:inventory'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'OpenContainerHandler: Actor does not have required key',
        { actorEntity: 'actor-123', requiredKey: 'brass_key' }
      );
    });

    it('successfully opens locked container when actor has the required key', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({
          isOpen: false,
          requiresKey: true,
          keyItemId: 'brass_key',
          contents: ['revolver', 'letter'],
        })
        .mockReturnValueOnce({ items: ['gold_bar', 'brass_key'] });

      const result = await handler.execute(validParams());

      expect(result).toEqual({
        success: true,
        contents: ['revolver', 'letter'],
      });
      expect(entityManager.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: 'container-456',
            componentTypeId: 'containers-core:container',
            componentData: {
              isOpen: true,
              requiresKey: true,
              keyItemId: 'brass_key',
              contents: ['revolver', 'letter'],
            },
          },
        ],
        true
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'containers:container_opened',
        {
          actorEntity: 'actor-123',
          containerEntity: 'container-456',
          contents: ['revolver', 'letter'],
        }
      );
    });
  });

  describe('Successful Opening', () => {
    it('successfully opens unlocked container and returns contents', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({
          isOpen: false,
          contents: ['gold_bar', 'revolver'],
          requiresKey: false,
        });

      const result = await handler.execute(validParams());

      expect(result).toEqual({
        success: true,
        contents: ['gold_bar', 'revolver'],
      });
      expect(entityManager.getComponentData).toHaveBeenNthCalledWith(
        1,
        'container-456',
        'items-core:openable'
      );
      expect(entityManager.getComponentData).toHaveBeenNthCalledWith(
        2,
        'container-456',
        'containers-core:container'
      );
      expect(entityManager.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: 'container-456',
            componentTypeId: 'containers-core:container',
            componentData: {
              isOpen: true,
              contents: ['gold_bar', 'revolver'],
              requiresKey: false,
            },
          },
        ],
        true
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'containers:container_opened',
        {
          actorEntity: 'actor-123',
          containerEntity: 'container-456',
          contents: ['gold_bar', 'revolver'],
        }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'OpenContainerHandler: Container opened successfully',
        {
          actorEntity: 'actor-123',
          containerEntity: 'container-456',
          contentsCount: 2,
        }
      );
    });

    it('successfully opens empty container with empty contents array', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ isOpen: false, contents: [] });

      const result = await handler.execute(validParams());

      expect(result).toEqual({ success: true, contents: [] });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'containers:container_opened',
        {
          actorEntity: 'actor-123',
          containerEntity: 'container-456',
          contents: [],
        }
      );
    });

    it('trims whitespace from entity IDs', async () => {
      const params = {
        actorEntity: ' actor-123 ',
        containerEntity: ' container-456 ',
        result_variable: 'openResult',
      };
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ isOpen: false, contents: ['item-1'] });

      await handler.execute(params);

      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        'container-456',
        'items-core:openable'
      );
      expect(entityManager.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: 'container-456',
            componentTypeId: 'containers-core:container',
            componentData: { isOpen: true, contents: ['item-1'] },
          },
        ],
        true
      );
    });
  });

  describe('Error Handling', () => {
    it('logs and returns failure when batch update throws', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ isOpen: false, contents: [] });
      const failure = new Error('batch failed');
      entityManager.batchAddComponentsOptimized.mockRejectedValue(failure);

      const result = await handler.execute(validParams());

      expect(result).toEqual({ success: false, error: 'batch failed' });
      expect(logger.error).toHaveBeenCalledWith(
        'OpenContainerHandler: Failed to open container',
        failure,
        {
          actorEntity: 'actor-123',
          containerEntity: 'container-456',
        }
      );
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('handles unexpected errors gracefully', async () => {
      const error = new Error('unexpected error');
      entityManager.getComponentData.mockImplementation(() => {
        throw error;
      });

      const result = await handler.execute(validParams());

      expect(result).toEqual({ success: false, error: 'unexpected error' });
      expect(logger.error).toHaveBeenCalledWith(
        'OpenContainerHandler: Failed to open container',
        error,
        expect.any(Object)
      );
    });
  });

  describe('Container Component Retrieval', () => {
    it('returns failure when container component is missing', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce(null);

      const result = await handler.execute(validParams());

      expect(result).toEqual({
        success: false,
        error: 'container_missing_component',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'OpenContainerHandler: Container has no container component',
        { containerEntity: 'container-456' }
      );
    });

    it('returns empty array when container has no contents field', async () => {
      entityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ isOpen: false });

      const result = await handler.execute(validParams());

      expect(result).toEqual({ success: true, contents: [] });
    });
  });
});
