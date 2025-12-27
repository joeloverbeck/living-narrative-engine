/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of TransferItemHandler
 * @see src/logic/operationHandlers/transferItemHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import TransferItemHandler from '../../../../src/logic/operationHandlers/transferItemHandler.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  ITEM_TRANSFERRED_EVENT_ID,
} from '../../../../src/constants/eventIds.js';
import { INVENTORY_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

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
    // Additional methods that might be referenced
    hasComponent: jest.fn(),
    addComponent: jest.fn(),
    getEntityInstance: jest.fn(),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => jest.clearAllMocks());

describe('TransferItemHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new TransferItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(TransferItemHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new TransferItemHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new TransferItemHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () => new TransferItemHandler({ logger: log, entityManager: em })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Success Scenarios
  describe('execute - success scenarios', () => {
    let handler;

    beforeEach(() => {
      handler = new TransferItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('successfully transfers item between inventories', async () => {
      const fromInventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: ['item1', 'item2', 'item3'],
      };
      const toInventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: ['item4'],
      };

      em.getComponentData
        .mockReturnValueOnce(fromInventory) // fromEntity inventory
        .mockReturnValueOnce(toInventory); // toEntity inventory

      em.batchAddComponentsOptimized.mockResolvedValue({
        updateCount: 2,
        errors: [],
      });

      const result = await handler.execute({
        fromEntity: 'actor1',
        toEntity: 'actor2',
        itemEntity: 'item2',
      });

      expect(result).toEqual({ success: true });
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        INVENTORY_COMPONENT_ID
      );
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor2',
        INVENTORY_COMPONENT_ID
      );
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: 'actor1',
            componentTypeId: INVENTORY_COMPONENT_ID,
            componentData: {
              ...fromInventory,
              items: ['item1', 'item3'],
            },
          },
          {
            instanceId: 'actor2',
            componentTypeId: INVENTORY_COMPONENT_ID,
            componentData: {
              ...toInventory,
              items: ['item4', 'item2'],
            },
          },
        ],
        true
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(ITEM_TRANSFERRED_EVENT_ID, {
        fromEntity: 'actor1',
        toEntity: 'actor2',
        itemEntity: 'item2',
      });
      expect(log.debug).toHaveBeenCalledWith(
        'TransferItemHandler: Item transferred successfully',
        expect.any(Object)
      );
    });

    test('handles transfer of last item from inventory', async () => {
      const fromInventory = {
        capacity: { maxItems: 5, maxWeight: 50 },
        items: ['item1'],
      };
      const toInventory = {
        capacity: { maxItems: 5, maxWeight: 50 },
        items: [],
      };

      em.getComponentData
        .mockReturnValueOnce(fromInventory)
        .mockReturnValueOnce(toInventory);
      em.batchAddComponentsOptimized.mockResolvedValue({
        updateCount: 2,
        errors: [],
      });

      const result = await handler.execute({
        fromEntity: 'actor1',
        toEntity: 'actor2',
        itemEntity: 'item1',
      });

      expect(result).toEqual({ success: true });
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({ items: [] }),
          }),
          expect.objectContaining({
            componentData: expect.objectContaining({ items: ['item1'] }),
          }),
        ]),
        true
      );
    });
  });

  // Execute Tests - Failure Scenarios
  describe('execute - failure scenarios', () => {
    let handler;

    beforeEach(() => {
      handler = new TransferItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('fails when fromEntity parameter is missing', async () => {
      const result = await handler.execute({
        toEntity: 'actor2',
        itemEntity: 'item1',
      });

      expect(result).toEqual({
        success: false,
        error: 'validation_failed',
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    test('fails when toEntity parameter is missing', async () => {
      const result = await handler.execute({
        fromEntity: 'actor1',
        itemEntity: 'item1',
      });

      expect(result).toEqual({
        success: false,
        error: 'validation_failed',
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    test('fails when itemEntity parameter is missing', async () => {
      const result = await handler.execute({
        fromEntity: 'actor1',
        toEntity: 'actor2',
      });

      expect(result).toEqual({
        success: false,
        error: 'validation_failed',
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    test('fails when params is null', async () => {
      const result = await handler.execute(null);

      expect(result).toEqual({
        success: false,
        error: 'validation_failed',
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    test('fails when fromEntity has no inventory component', async () => {
      em.getComponentData
        .mockReturnValueOnce(null) // fromEntity inventory missing
        .mockReturnValueOnce({ capacity: {}, items: [] }); // toEntity inventory

      const result = await handler.execute({
        fromEntity: 'actor1',
        toEntity: 'actor2',
        itemEntity: 'item1',
      });

      expect(result).toEqual({
        success: false,
        error: 'missing_inventory',
      });
      expect(log.warn).toHaveBeenCalledWith(
        'TransferItemHandler: Missing inventory component for transfer',
        expect.any(Object)
      );
    });

    test('fails when toEntity has no inventory component', async () => {
      em.getComponentData
        .mockReturnValueOnce({ capacity: {}, items: ['item1'] }) // fromEntity inventory
        .mockReturnValueOnce(null); // toEntity inventory missing

      const result = await handler.execute({
        fromEntity: 'actor1',
        toEntity: 'actor2',
        itemEntity: 'item1',
      });

      expect(result).toEqual({
        success: false,
        error: 'missing_inventory',
      });
      expect(log.warn).toHaveBeenCalledWith(
        'TransferItemHandler: Missing inventory component for transfer',
        expect.any(Object)
      );
    });

    test('fails when item is not in source inventory', async () => {
      const fromInventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: ['item1', 'item2'],
      };
      const toInventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: [],
      };

      em.getComponentData
        .mockReturnValueOnce(fromInventory)
        .mockReturnValueOnce(toInventory);

      const result = await handler.execute({
        fromEntity: 'actor1',
        toEntity: 'actor2',
        itemEntity: 'item3', // not in fromInventory
      });

      expect(result).toEqual({
        success: false,
        error: 'item_not_found',
      });
      expect(log.warn).toHaveBeenCalledWith(
        'TransferItemHandler: Item not in source inventory',
        expect.any(Object)
      );
    });

    test('handles batch update errors gracefully', async () => {
      const fromInventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: ['item1'],
      };
      const toInventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: [],
      };

      em.getComponentData
        .mockReturnValueOnce(fromInventory)
        .mockReturnValueOnce(toInventory);

      const batchError = new Error('Batch update failed');
      em.batchAddComponentsOptimized.mockRejectedValue(batchError);

      const result = await handler.execute({
        fromEntity: 'actor1',
        toEntity: 'actor2',
        itemEntity: 'item1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Batch update failed',
      });
      expect(log.error).toHaveBeenCalledWith(
        'TransferItemHandler: Transfer failed',
        batchError,
        expect.any(Object)
      );
    });
  });

  // Parameter Trimming Tests
  describe('parameter trimming', () => {
    let handler;

    beforeEach(() => {
      handler = new TransferItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('trims whitespace from entity IDs', async () => {
      const fromInventory = { capacity: {}, items: ['item1'] };
      const toInventory = { capacity: {}, items: [] };

      em.getComponentData
        .mockReturnValueOnce(fromInventory)
        .mockReturnValueOnce(toInventory);
      em.batchAddComponentsOptimized.mockResolvedValue({
        updateCount: 2,
        errors: [],
      });

      await handler.execute({
        fromEntity: '  actor1  ',
        toEntity: '  actor2  ',
        itemEntity: '  item1  ',
      });

      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        INVENTORY_COMPONENT_ID
      );
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor2',
        INVENTORY_COMPONENT_ID
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        ITEM_TRANSFERRED_EVENT_ID,
        expect.objectContaining({
          fromEntity: 'actor1',
          toEntity: 'actor2',
          itemEntity: 'item1',
        })
      );
    });
  });
});
