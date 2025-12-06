/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of PickUpItemFromLocationHandler
 * @see src/logic/operationHandlers/pickUpItemFromLocationHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import PickUpItemFromLocationHandler from '../../../../src/logic/operationHandlers/pickUpItemFromLocationHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const INVENTORY_COMPONENT_ID = 'items:inventory';
const POSITION_COMPONENT_ID = 'core:position';
const ITEM_PICKED_UP_EVENT = 'items:item_picked_up';

// Test Doubles
/** @type {jest.Mocked<ILogger>} */ let log;
/** @type {jest.Mocked<IEntityManager>} */ let em;
/** @type {{ dispatch: jest.Mock }} */ let dispatcher;

beforeEach(() => {
  log = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  em = {
    getComponentData: jest.fn(),
    batchAddComponentsOptimized: jest.fn(),
    removeComponent: jest.fn(),
    hasComponent: jest.fn(),
    addComponent: jest.fn(),
    getEntityInstance: jest.fn(),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => jest.clearAllMocks());

describe('PickUpItemFromLocationHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new PickUpItemFromLocationHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(PickUpItemFromLocationHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new PickUpItemFromLocationHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new PickUpItemFromLocationHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new PickUpItemFromLocationHandler({
            logger: log,
            entityManager: em,
          })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  describe('execute - Success Path', () => {
    let handler;
    const ctx = { debugMode: false };

    beforeEach(() => {
      handler = new PickUpItemFromLocationHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('successfully picks up item and adds to inventory', async () => {
      const actorEntity = 'actor-1';
      const itemEntity = 'item-1';
      const existingInventory = { items: ['existing-item'] };

      em.getComponentData.mockReturnValue(existingInventory);
      em.batchAddComponentsOptimized.mockResolvedValue(undefined);

      const result = await handler.execute({ actorEntity, itemEntity }, ctx);

      expect(result.success).toBe(true);
      expect(em.getComponentData).toHaveBeenCalledWith(
        actorEntity,
        INVENTORY_COMPONENT_ID
      );
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: actorEntity,
            componentTypeId: INVENTORY_COMPONENT_ID,
            componentData: {
              items: ['existing-item', itemEntity],
            },
          },
        ],
        true
      );
    });

    test('removes position component from item after pickup', async () => {
      const actorEntity = 'actor-1';
      const itemEntity = 'item-1';
      em.getComponentData.mockReturnValue({ items: [] });
      em.batchAddComponentsOptimized.mockResolvedValue(undefined);

      await handler.execute({ actorEntity, itemEntity }, ctx);

      expect(em.removeComponent).toHaveBeenCalledWith(
        itemEntity,
        POSITION_COMPONENT_ID
      );
    });

    test('dispatches ITEM_PICKED_UP event on success', async () => {
      const actorEntity = 'actor-1';
      const itemEntity = 'item-1';
      em.getComponentData.mockReturnValue({ items: [] });
      em.batchAddComponentsOptimized.mockResolvedValue(undefined);

      await handler.execute({ actorEntity, itemEntity }, ctx);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(ITEM_PICKED_UP_EVENT, {
        actorEntity,
        itemEntity,
      });
    });

    test('logs debug message on successful pickup', async () => {
      const actorEntity = 'actor-1';
      const itemEntity = 'item-1';
      em.getComponentData.mockReturnValue({ items: [] });
      em.batchAddComponentsOptimized.mockResolvedValue(undefined);

      await handler.execute({ actorEntity, itemEntity }, ctx);

      expect(log.debug).toHaveBeenCalledWith(
        'PickUpItemFromLocationHandler: Item picked up',
        expect.objectContaining({ actorEntity, itemEntity })
      );
    });
  });

  describe('execute - Parameter Validation', () => {
    let handler;
    const ctx = { debugMode: false };

    beforeEach(() => {
      handler = new PickUpItemFromLocationHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('returns failure when params is null', async () => {
      const result = await handler.execute(null, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    test('returns failure when params is undefined', async () => {
      const result = await handler.execute(undefined, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
    });

    test('returns failure when actorEntity is missing', async () => {
      const result = await handler.execute({ itemEntity: 'item-1' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
    });

    test('returns failure when itemEntity is missing', async () => {
      const result = await handler.execute({ actorEntity: 'actor-1' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
    });

    test('returns failure when actorEntity is empty string', async () => {
      const result = await handler.execute(
        { actorEntity: '', itemEntity: 'item-1' },
        ctx
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
    });

    test('returns failure when itemEntity is empty string', async () => {
      const result = await handler.execute(
        { actorEntity: 'actor-1', itemEntity: '' },
        ctx
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
    });
  });

  describe('execute - Error Scenarios', () => {
    let handler;
    const ctx = { debugMode: false };

    beforeEach(() => {
      handler = new PickUpItemFromLocationHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('returns failure when actor has no inventory', async () => {
      em.getComponentData.mockReturnValue(null);

      const result = await handler.execute(
        { actorEntity: 'actor-1', itemEntity: 'item-1' },
        ctx
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('no_inventory');
      expect(log.warn).toHaveBeenCalledWith(
        'PickUpItemFromLocationHandler: No inventory on actor',
        expect.objectContaining({ actorEntity: 'actor-1' })
      );
    });

    test('handles batch update errors gracefully', async () => {
      em.getComponentData.mockReturnValue({ items: [] });
      const error = new Error('Batch update failed');
      em.batchAddComponentsOptimized.mockRejectedValue(error);

      const result = await handler.execute(
        { actorEntity: 'actor-1', itemEntity: 'item-1' },
        ctx
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch update failed');
      expect(log.error).toHaveBeenCalledWith(
        'PickUpItemFromLocationHandler: Pick up item failed',
        error,
        expect.any(Object)
      );
    });

    test('does not dispatch event when pickup fails', async () => {
      em.getComponentData.mockReturnValue(null);

      await handler.execute(
        { actorEntity: 'actor-1', itemEntity: 'item-1' },
        ctx
      );

      // Should only dispatch system error, not item_picked_up event
      const pickupEventCalls = dispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === ITEM_PICKED_UP_EVENT
      );
      expect(pickupEventCalls).toHaveLength(0);
    });

    test('does not remove position when pickup fails', async () => {
      em.getComponentData.mockReturnValue(null);

      await handler.execute(
        { actorEntity: 'actor-1', itemEntity: 'item-1' },
        ctx
      );

      expect(em.removeComponent).not.toHaveBeenCalled();
    });
  });
});
