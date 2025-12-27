/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of TakeFromContainerHandler
 * @see src/logic/operationHandlers/takeFromContainerHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import TakeFromContainerHandler from '../../../../src/logic/operationHandlers/takeFromContainerHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import {
  INVENTORY_COMPONENT_ID,
  CONTAINER_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ITEM_TAKEN_FROM_CONTAINER_EVENT_ID } from '../../../../src/constants/eventIds.js';

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

describe('TakeFromContainerHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new TakeFromContainerHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(TakeFromContainerHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new TakeFromContainerHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new TakeFromContainerHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () => new TakeFromContainerHandler({ logger: log, entityManager: em })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Success Scenarios
  describe('execute - success scenarios', () => {
    let handler;

    beforeEach(() => {
      handler = new TakeFromContainerHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('successfully takes item from open container', async () => {
      const container = {
        isOpen: true,
        contents: ['item1', 'item2', 'item3'],
      };
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: ['item4'],
      };

      em.getComponentData
        .mockReturnValueOnce(container) // container component
        .mockReturnValueOnce(inventory); // actor inventory

      em.batchAddComponentsOptimized.mockResolvedValue({
        updateCount: 2,
        errors: [],
      });

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'chest1',
        itemEntity: 'item2',
      });

      expect(result).toEqual({ success: true });
      expect(em.getComponentData).toHaveBeenCalledWith(
        'chest1',
        CONTAINER_COMPONENT_ID
      );
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        INVENTORY_COMPONENT_ID
      );
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: 'chest1',
            componentTypeId: CONTAINER_COMPONENT_ID,
            componentData: {
              ...container,
              contents: ['item1', 'item3'],
            },
          },
          {
            instanceId: 'actor1',
            componentTypeId: INVENTORY_COMPONENT_ID,
            componentData: {
              ...inventory,
              items: ['item4', 'item2'],
            },
          },
        ],
        true
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(ITEM_TAKEN_FROM_CONTAINER_EVENT_ID, {
        actorEntity: 'actor1',
        containerEntity: 'chest1',
        itemEntity: 'item2',
      });
      expect(log.debug).toHaveBeenCalledWith(
        'TakeFromContainerHandler: Item taken from container',
        expect.any(Object)
      );
    });

    test('handles taking last item from container', async () => {
      const container = {
        isOpen: true,
        contents: ['item1'],
      };
      const inventory = {
        capacity: { maxItems: 5, maxWeight: 50 },
        items: [],
      };

      em.getComponentData
        .mockReturnValueOnce(container)
        .mockReturnValueOnce(inventory);
      em.batchAddComponentsOptimized.mockResolvedValue({
        updateCount: 2,
        errors: [],
      });

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'chest1',
        itemEntity: 'item1',
      });

      expect(result).toEqual({ success: true });
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({ contents: [] }),
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
      handler = new TakeFromContainerHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('fails when actorEntity parameter is missing', async () => {
      const result = await handler.execute({
        containerEntity: 'chest1',
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

    test('fails when containerEntity parameter is missing', async () => {
      const result = await handler.execute({
        actorEntity: 'actor1',
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
        actorEntity: 'actor1',
        containerEntity: 'chest1',
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

    test('fails when target has no container component', async () => {
      em.getComponentData.mockReturnValueOnce(null); // container missing

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'chest1',
        itemEntity: 'item1',
      });

      expect(result).toEqual({
        success: false,
        error: 'not_a_container',
      });
      expect(log.warn).toHaveBeenCalledWith(
        'TakeFromContainerHandler: No container component',
        expect.any(Object)
      );
    });

    test('fails when container is closed', async () => {
      const container = {
        isOpen: false,
        contents: ['item1', 'item2'],
      };

      em.getComponentData.mockReturnValueOnce(container);

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'chest1',
        itemEntity: 'item1',
      });

      expect(result).toEqual({
        success: false,
        error: 'container_closed',
      });
      expect(log.debug).toHaveBeenCalledWith(
        'TakeFromContainerHandler: Container is closed',
        expect.any(Object)
      );
    });

    test('fails when item is not in container', async () => {
      const container = {
        isOpen: true,
        contents: ['item1', 'item2'],
      };

      em.getComponentData.mockReturnValueOnce(container);

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'chest1',
        itemEntity: 'item3', // not in container
      });

      expect(result).toEqual({
        success: false,
        error: 'item_not_in_container',
      });
      expect(log.warn).toHaveBeenCalledWith(
        'TakeFromContainerHandler: Item not in container',
        expect.any(Object)
      );
    });

    test('fails when actor has no inventory component', async () => {
      const container = {
        isOpen: true,
        contents: ['item1'],
      };

      em.getComponentData
        .mockReturnValueOnce(container) // container exists
        .mockReturnValueOnce(null); // inventory missing

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'chest1',
        itemEntity: 'item1',
      });

      expect(result).toEqual({
        success: false,
        error: 'no_inventory',
      });
      expect(log.warn).toHaveBeenCalledWith(
        'TakeFromContainerHandler: No inventory on actor',
        expect.any(Object)
      );
    });

    test('handles batch update errors gracefully', async () => {
      const container = {
        isOpen: true,
        contents: ['item1'],
      };
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: [],
      };

      em.getComponentData
        .mockReturnValueOnce(container)
        .mockReturnValueOnce(inventory);

      const batchError = new Error('Batch update failed');
      em.batchAddComponentsOptimized.mockRejectedValue(batchError);

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'chest1',
        itemEntity: 'item1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Batch update failed',
      });
      expect(log.error).toHaveBeenCalledWith(
        'TakeFromContainerHandler: Take from container failed',
        batchError,
        expect.any(Object)
      );
    });
  });

  // Parameter Trimming Tests
  describe('parameter trimming', () => {
    let handler;

    beforeEach(() => {
      handler = new TakeFromContainerHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('trims whitespace from entity IDs', async () => {
      const container = { isOpen: true, contents: ['item1'] };
      const inventory = { capacity: {}, items: [] };

      em.getComponentData
        .mockReturnValueOnce(container)
        .mockReturnValueOnce(inventory);
      em.batchAddComponentsOptimized.mockResolvedValue({
        updateCount: 2,
        errors: [],
      });

      await handler.execute({
        actorEntity: '  actor1  ',
        containerEntity: '  chest1  ',
        itemEntity: '  item1  ',
      });

      expect(em.getComponentData).toHaveBeenCalledWith(
        'chest1',
        CONTAINER_COMPONENT_ID
      );
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        INVENTORY_COMPONENT_ID
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        ITEM_TAKEN_FROM_CONTAINER_EVENT_ID,
        expect.objectContaining({
          actorEntity: 'actor1',
          containerEntity: 'chest1',
          itemEntity: 'item1',
        })
      );
    });
  });
});
