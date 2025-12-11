/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of DrinkFromHandler
 * @see src/logic/operationHandlers/drinkFromHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import DrinkFromHandler from '../../../../src/logic/operationHandlers/drinkFromHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const LIQUID_CONTAINER_COMPONENT_ID = 'containers-core:liquid_container';
const DRINKABLE_COMPONENT_ID = 'items:drinkable';
const EMPTY_COMPONENT_ID = 'items:empty';
const POSITION_COMPONENT_ID = 'core:position';
const LIQUID_CONSUMED_EVENT = 'items:liquid_consumed';

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
    hasComponent: jest.fn(),
    batchAddComponentsOptimized: jest.fn(),
    removeComponent: jest.fn(),
    modifyComponent: jest.fn(),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => jest.clearAllMocks());

describe('DrinkFromHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new DrinkFromHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(DrinkFromHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new DrinkFromHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new DrinkFromHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () => new DrinkFromHandler({ logger: log, entityManager: em })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Success Scenarios
  describe('execute - success scenarios', () => {
    let handler;

    beforeEach(() => {
      handler = new DrinkFromHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('successfully consumes one serving from container', async () => {
      const liquidData = {
        currentVolumeMilliliters: 500,
        servingSizeMilliliters: 200,
        flavorText: 'It tastes refreshing.',
      };
      const actorPosition = { locationId: 'loc1' };
      const containerPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition) // actor position
        .mockReturnValueOnce(liquidData) // liquid container
        .mockReturnValueOnce(containerPosition); // container position

      em.hasComponent
        .mockReturnValueOnce(true) // drinkable
        .mockReturnValueOnce(false); // not empty

      em.modifyComponent.mockResolvedValue(true);

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: true,
        volumeConsumed: 200,
        flavorText: 'It tastes refreshing.',
      });

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'bottle1',
            componentTypeId: LIQUID_CONTAINER_COMPONENT_ID,
            componentData: expect.objectContaining({
              currentVolumeMilliliters: 300,
            }),
          }),
        ]),
        true
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(LIQUID_CONSUMED_EVENT, {
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
        volumeConsumed: 200,
      });
    });

    test('empties container when remaining volume equals serving size', async () => {
      const liquidData = {
        currentVolumeMilliliters: 200,
        servingSizeMilliliters: 200,
        flavorText: 'Final sip.',
      };
      const actorPosition = { locationId: 'loc1' };
      const containerPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(liquidData)
        .mockReturnValueOnce(containerPosition);

      em.hasComponent
        .mockReturnValueOnce(true) // drinkable
        .mockReturnValueOnce(false); // not empty

      em.batchAddComponentsOptimized.mockResolvedValue({
        updateCount: 1,
        errors: [],
      });
      em.removeComponent.mockResolvedValue(true);
      em.modifyComponent.mockResolvedValue(true);

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: true,
        volumeConsumed: 200,
        flavorText: 'Final sip.',
      });

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: 'bottle1',
            componentTypeId: EMPTY_COMPONENT_ID,
            componentData: {},
          },
        ],
        true
      );

      expect(em.removeComponent).toHaveBeenCalledWith(
        'bottle1',
        DRINKABLE_COMPONENT_ID
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'bottle1',
            componentTypeId: LIQUID_CONTAINER_COMPONENT_ID,
            componentData: expect.objectContaining({
              currentVolumeMilliliters: 0,
            }),
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
      handler = new DrinkFromHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('fails when params is null', async () => {
      const result = await handler.execute(null);

      expect(result).toEqual({
        success: false,
        error: 'validation_failed',
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('params'),
        })
      );
    });

    test('fails when actorEntity is missing', async () => {
      const result = await handler.execute({
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: false,
        error: 'validation_failed',
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('actorEntity'),
        })
      );
    });

    test('fails when containerEntity is missing', async () => {
      const result = await handler.execute({
        actorEntity: 'actor1',
      });

      expect(result).toEqual({
        success: false,
        error: 'validation_failed',
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('containerEntity'),
        })
      );
    });

    test('fails when actor has no position component', async () => {
      em.getComponentData.mockReturnValueOnce(null); // no position

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Actor does not have position component',
      });
    });

    test('fails when container is not a liquid container', async () => {
      const actorPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(null); // no liquid container

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Container is not a liquid container',
      });
    });

    test('fails when container is not drinkable', async () => {
      const liquidData = { currentVolumeMilliliters: 500 };
      const actorPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(liquidData);

      em.hasComponent.mockReturnValueOnce(false); // not drinkable

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Container is not drinkable',
      });
    });

    test('fails when container is empty', async () => {
      const liquidData = { currentVolumeMilliliters: 500 };
      const actorPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(liquidData);

      em.hasComponent
        .mockReturnValueOnce(true) // drinkable
        .mockReturnValueOnce(true); // empty

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Container is empty',
      });
    });

    // NOTE: Tests for "container has no position" and "not co-located" removed
    // Reason: Items in inventory don't have position components by design.
    // See: drinkFromHandler.js lines 169-172 for explanation

    test('fails when container has no liquid', async () => {
      const liquidData = {
        currentVolumeMilliliters: 0,
        servingSizeMilliliters: 200,
      };
      const actorPosition = { locationId: 'loc1' };
      const containerPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(liquidData)
        .mockReturnValueOnce(containerPosition);

      em.hasComponent
        .mockReturnValueOnce(true) // drinkable
        .mockReturnValueOnce(false); // not empty

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Container has no liquid',
      });
    });

    test('fails when insufficient volume in container', async () => {
      const liquidData = {
        currentVolumeMilliliters: 100,
        servingSizeMilliliters: 200,
      };
      const actorPosition = { locationId: 'loc1' };
      const containerPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(liquidData)
        .mockReturnValueOnce(containerPosition);

      em.hasComponent
        .mockReturnValueOnce(true) // drinkable
        .mockReturnValueOnce(false); // not empty

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Insufficient volume in container',
      });
    });

    test('handles errors during execution', async () => {
      const liquidData = {
        currentVolumeMilliliters: 500,
        servingSizeMilliliters: 200,
        maxCapacityMilliliters: 1000,
      };
      const actorPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(liquidData);

      em.hasComponent
        .mockReturnValueOnce(true) // drinkable
        .mockReturnValueOnce(false); // not empty

      // Make batch operation throw error
      em.batchAddComponentsOptimized.mockRejectedValue(
        new Error('Database error')
      );

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Database error',
      });
      expect(log.error).toHaveBeenCalled();
    });
  });

  // Edge Cases
  describe('edge cases', () => {
    let handler;

    beforeEach(() => {
      handler = new DrinkFromHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('handles missing flavorText gracefully', async () => {
      const liquidData = {
        currentVolumeMilliliters: 500,
        servingSizeMilliliters: 200,
        // no flavorText
      };
      const actorPosition = { locationId: 'loc1' };
      const containerPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(liquidData)
        .mockReturnValueOnce(containerPosition);

      em.hasComponent
        .mockReturnValueOnce(true) // drinkable
        .mockReturnValueOnce(false); // not empty

      em.modifyComponent.mockResolvedValue(true);

      const result = await handler.execute({
        actorEntity: 'actor1',
        containerEntity: 'bottle1',
      });

      expect(result).toEqual({
        success: true,
        volumeConsumed: 200,
        flavorText: '',
      });
    });

    test('trims whitespace from entity IDs', async () => {
      const liquidData = {
        currentVolumeMilliliters: 500,
        servingSizeMilliliters: 200,
      };
      const actorPosition = { locationId: 'loc1' };
      const containerPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(liquidData)
        .mockReturnValueOnce(containerPosition);

      em.hasComponent
        .mockReturnValueOnce(true) // drinkable
        .mockReturnValueOnce(false); // not empty

      em.modifyComponent.mockResolvedValue(true);

      const result = await handler.execute({
        actorEntity: '  actor1  ',
        containerEntity: '  bottle1  ',
      });

      expect(result.success).toBe(true);
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        POSITION_COMPONENT_ID
      );
    });
  });
});
