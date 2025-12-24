import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import DropItemAtLocationHandler from '../../../../src/logic/operationHandlers/dropItemAtLocationHandler.js';
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
  getEntityInstance: jest.fn(() => ({
    getComponentTypeIds: jest.fn(() => [
      'core:position',
      'items-core:item',
      'items-core:portable',
    ]),
  })),
});

describe('DropItemAtLocationHandler', () => {
  let logger;
  let dispatcher;
  let entityManager;
  let handler;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = createDispatcher();
    entityManager = createEntityManager();
    handler = new DropItemAtLocationHandler({
      logger,
      entityManager,
      safeEventDispatcher: dispatcher,
    });
    jest.clearAllMocks();
  });

  const validParams = () => ({
    actorEntity: 'actor-123',
    itemEntity: 'item-999',
    locationId: 'loc-42',
  });

  it('returns validation failure when params object is missing', async () => {
    const result = await handler.execute(null);

    expect(result).toEqual({ success: false, error: 'validation_failed' });
    expect(entityManager.getComponentData).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'DROP_ITEM_AT_LOCATION: params missing or invalid.',
        details: { params: null },
      })
    );
  });

  it('dispatches validation error when string params are invalid', async () => {
    const params = { ...validParams(), actorEntity: '   ' };

    const result = await handler.execute(params);

    expect(result).toEqual({ success: false, error: 'validation_failed' });
    expect(entityManager.getComponentData).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'Invalid "actorEntity" parameter',
        details: { actorEntity: '   ' },
      })
    );
  });

  it('returns error when actor has no inventory component', async () => {
    entityManager.getComponentData.mockReturnValue(null);

    const result = await handler.execute(validParams());

    expect(result).toEqual({ success: false, error: 'no_inventory' });
    expect(entityManager.getComponentData).toHaveBeenCalledWith(
      'actor-123',
      'inventory:inventory'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'DropItemAtLocationHandler: [DROP_ITEM] No inventory component on actor',
      { actorEntity: 'actor-123', componentType: 'inventory:inventory' }
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(entityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();
  });

  it('returns error when item is not in the actor inventory', async () => {
    entityManager.getComponentData.mockReturnValue({ items: ['other-item'] });

    const result = await handler.execute(validParams());

    expect(result).toEqual({ success: false, error: 'item_not_in_inventory' });
    expect(logger.warn).toHaveBeenCalledWith(
      'DropItemAtLocationHandler: [DROP_ITEM] Item not in actor inventory',
      {
        actorEntity: 'actor-123',
        itemEntity: 'item-999',
        currentInventory: ['other-item'],
      }
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(entityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();
  });

  it('removes the item from inventory, updates position and dispatches success event', async () => {
    const params = {
      actorEntity: ' actor-123 ',
      itemEntity: ' item-999 ',
      locationId: ' loc-42 ',
    };
    entityManager.getComponentData.mockReturnValue({
      items: ['item-999', 'item-123'],
      capacity: 10,
    });

    const result = await handler.execute(params);

    expect(result).toEqual({ success: true });
    expect(entityManager.getComponentData).toHaveBeenCalledWith(
      'actor-123',
      'inventory:inventory'
    );
    expect(entityManager.batchAddComponentsOptimized).toHaveBeenCalledWith(
      [
        {
          instanceId: 'actor-123',
          componentTypeId: 'inventory:inventory',
          componentData: {
            items: ['item-123'],
            capacity: 10,
          },
        },
        {
          instanceId: 'item-999',
          componentTypeId: 'core:position',
          componentData: { locationId: 'loc-42' },
        },
      ],
      true
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith('items-core:item_dropped', {
      actorEntity: 'actor-123',
      itemEntity: 'item-999',
      locationId: 'loc-42',
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'DropItemAtLocationHandler: [DROP_ITEM] Operation completed successfully',
      {
        actorEntity: 'actor-123',
        itemEntity: 'item-999',
        locationId: 'loc-42',
      }
    );
  });

  it('uses the execution context logger and falls back to component list "N/A" when metadata is unavailable', async () => {
    const params = validParams();
    const contextLogger = createLogger();

    entityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        if (entityId === 'actor-123' && componentId === 'inventory:inventory') {
          return { items: ['item-999'], capacity: 3 };
        }
        return null;
      }
    );
    entityManager.getEntityInstance.mockReturnValueOnce(null);

    const result = await handler.execute(params, { logger: contextLogger });

    expect(result).toEqual({ success: true });
    expect(contextLogger.debug).toHaveBeenCalledWith(
      '[DROP_ITEM] Handler invoked',
      expect.objectContaining({
        rawParams: params,
        executionContext: 'present',
      })
    );

    const infoCall = contextLogger.debug.mock.calls.find(([message]) =>
      message.includes('POST-DROP VERIFICATION')
    );
    expect(infoCall?.[1]).toMatchObject({ allComponents: 'N/A' });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'items-core:item_dropped',
      expect.objectContaining({
        actorEntity: 'actor-123',
        itemEntity: 'item-999',
      })
    );
  });

  it('logs and returns failure when batch update throws', async () => {
    const params = validParams();
    entityManager.getComponentData.mockReturnValue({ items: ['item-999'] });
    const failure = new Error('batch failed');
    entityManager.batchAddComponentsOptimized.mockRejectedValue(failure);

    const result = await handler.execute(params);

    expect(result).toEqual({ success: false, error: 'batch failed' });
    expect(logger.error).toHaveBeenCalledWith(
      'DropItemAtLocationHandler: [DROP_ITEM] Operation failed with exception',
      failure,
      expect.objectContaining({
        actorEntity: 'actor-123',
        itemEntity: 'item-999',
        locationId: 'loc-42',
        errorMessage: 'batch failed',
        errorStack: expect.stringContaining('batch failed'),
      })
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });
});
