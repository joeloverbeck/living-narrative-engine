/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of DrinkEntirelyHandler
 * @see src/logic/operationHandlers/drinkEntirelyHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import DrinkEntirelyHandler from '../../../../src/logic/operationHandlers/drinkEntirelyHandler.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  LIQUID_CONSUMED_ENTIRELY_EVENT_ID,
} from '../../../../src/constants/eventIds.js';
import {
  POSITION_COMPONENT_ID,
  DRINKABLE_COMPONENT_ID,
  EMPTY_COMPONENT_ID,
  LIQUID_CONTAINER_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

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
    hasComponent: jest.fn(),
    batchAddComponentsOptimized: jest.fn(),
    removeComponent: jest.fn(),
    modifyComponent: jest.fn(),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => jest.clearAllMocks());

describe('DrinkEntirelyHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new DrinkEntirelyHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(DrinkEntirelyHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new DrinkEntirelyHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new DrinkEntirelyHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () => new DrinkEntirelyHandler({ logger: log, entityManager: em })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Success Scenarios
  describe('execute - success scenarios', () => {
    let handler;

    beforeEach(() => {
      handler = new DrinkEntirelyHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('successfully empties container completely', async () => {
      const liquidData = {
        currentVolumeMilliliters: 500,
        servingSizeMilliliters: 200,
        flavorText: 'You drink the last drops.',
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
        volumeConsumed: 500,
        flavorText: 'You drink the last drops.',
      });

      // Verify empty component added
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

      // Verify drinkable component removed
      expect(em.removeComponent).toHaveBeenCalledWith(
        'bottle1',
        DRINKABLE_COMPONENT_ID
      );

      // Verify volume set to 0 using batchAddComponentsOptimized
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

      // Verify event dispatched
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        LIQUID_CONSUMED_ENTIRELY_EVENT_ID,
        {
          actorEntity: 'actor1',
          containerEntity: 'bottle1',
          volumeConsumed: 500,
        }
      );
    });

    test('empties container with small volume remaining', async () => {
      const liquidData = {
        currentVolumeMilliliters: 50,
        servingSizeMilliliters: 200,
        flavorText: 'The last bit.',
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
        volumeConsumed: 50,
        flavorText: 'The last bit.',
      });
    });

    test('empties container with large volume', async () => {
      const liquidData = {
        currentVolumeMilliliters: 2000,
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
        volumeConsumed: 2000,
        flavorText: '',
      });
    });
  });

  // Execute Tests - Failure Scenarios
  describe('execute - failure scenarios', () => {
    let handler;

    beforeEach(() => {
      handler = new DrinkEntirelyHandler({
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
    // After fix: inventory items don't have position components, so these checks were removed
    // See: drinkFromHandler.js for the same fix pattern

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

    test('handles errors during execution', async () => {
      const liquidData = { currentVolumeMilliliters: 500 };
      const actorPosition = { locationId: 'loc1' };

      em.getComponentData
        .mockReturnValueOnce(actorPosition)
        .mockReturnValueOnce(liquidData);

      em.hasComponent
        .mockReturnValueOnce(true) // drinkable
        .mockReturnValueOnce(false); // not empty

      // Make batchAddComponentsOptimized throw an error
      em.batchAddComponentsOptimized.mockRejectedValueOnce(
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
      handler = new DrinkEntirelyHandler({
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
        volumeConsumed: 500,
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

      em.batchAddComponentsOptimized.mockResolvedValue({
        updateCount: 1,
        errors: [],
      });
      em.removeComponent.mockResolvedValue(true);
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
