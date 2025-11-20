/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of DigestFoodHandler
 * @see src/logic/operationHandlers/digestFoodHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import DigestFoodHandler from '../../../../src/logic/operationHandlers/digestFoodHandler.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const FUEL_CONVERTER_COMPONENT_ID = 'metabolism:fuel_converter';
const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
const FOOD_DIGESTED_EVENT = 'metabolism:food_digested';

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

describe('DigestFoodHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new DigestFoodHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(DigestFoodHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new DigestFoodHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new DigestFoodHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () => new DigestFoodHandler({ logger: log, entityManager: em })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Success Scenarios
  describe('execute - success scenarios', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DigestFoodHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      executionContext = { logger: log };
    });

    test('should convert buffer to energy with efficiency', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        bufferStorage: 40,
        conversionRate: 5,
        efficiency: 0.8,
        acceptedFuelTags: ['organic'],
        activityMultiplier: 1.0,
      };
      const metabolicStore = {
        currentEnergy: 600,
        maxEnergy: 1000,
        baseBurnRate: 1.0,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Digested: min(40, 5 * 1.0 * 1) = 5
      // Energy gained: 5 * 0.8 = 4
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: entityId,
            componentTypeId: FUEL_CONVERTER_COMPONENT_ID,
            componentData: {
              capacity: 100,
              bufferStorage: 35, // 40 - 5
              conversionRate: 5,
              efficiency: 0.8,
              acceptedFuelTags: ['organic'],
              activityMultiplier: 1.0,
            },
          },
          {
            instanceId: entityId,
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: {
              currentEnergy: 604, // 600 + 4
              maxEnergy: 1000,
              baseBurnRate: 1.0,
              activityMultiplier: 1.0,
              lastUpdateTurn: 0,
            },
          },
        ],
        true
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(FOOD_DIGESTED_EVENT, {
        entityId,
        bufferReduced: 5,
        energyGained: 4,
        newBuffer: 35,
        newEnergy: 604,
        efficiency: 0.8,
      });
    });

    test('should handle multiple turns correctly', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        bufferStorage: 50,
        conversionRate: 5,
        efficiency: 0.9,
        acceptedFuelTags: ['organic'],
        activityMultiplier: 1.0,
      };
      const metabolicStore = {
        currentEnergy: 500,
        maxEnergy: 1000,
        baseBurnRate: 1.0,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 3 },
        executionContext
      );

      // Digested: min(50, 5 * 1.0 * 3) = 15
      // Energy gained: 15 * 0.9 = 13.5
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              bufferStorage: 35, // 50 - 15
            }),
          }),
          expect.objectContaining({
            componentData: expect.objectContaining({
              currentEnergy: 513.5, // 500 + 13.5
            }),
          }),
        ]),
        true
      );
    });

    test('cannot digest more than bufferStorage', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        bufferStorage: 3, // Very little in buffer
        conversionRate: 10, // High conversion rate
        efficiency: 0.8,
        acceptedFuelTags: ['organic'],
        activityMultiplier: 1.0,
      };
      const metabolicStore = {
        currentEnergy: 500,
        maxEnergy: 1000,
        baseBurnRate: 1.0,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Should only digest 3 (all that's available), not 10
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              bufferStorage: 0, // 3 - 3
            }),
          }),
          expect.objectContaining({
            componentData: expect.objectContaining({
              currentEnergy: 502.4, // 500 + (3 * 0.8)
            }),
          }),
        ]),
        true
      );
    });

    test('should cap energy at maxEnergy', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        bufferStorage: 50,
        conversionRate: 10,
        efficiency: 1.0, // Perfect efficiency
        acceptedFuelTags: ['organic'],
        activityMultiplier: 1.0,
      };
      const metabolicStore = {
        currentEnergy: 995,
        maxEnergy: 1000,
        baseBurnRate: 1.0,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Would gain 10 energy, but capped at 1000
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              currentEnergy: 1000, // Capped at maxEnergy
            }),
          }),
        ]),
        true
      );
    });

    test('should handle empty buffer (no-op)', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        bufferStorage: 0, // Empty buffer
        conversionRate: 5,
        efficiency: 0.8,
        acceptedFuelTags: ['organic'],
        activityMultiplier: 1.0,
      };
      const metabolicStore = {
        currentEnergy: 600,
        maxEnergy: 1000,
        baseBurnRate: 1.0,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // No digestion, no energy gained - both components remain unchanged
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              bufferStorage: 0,
            }),
          }),
          expect.objectContaining({
            componentData: expect.objectContaining({
              currentEnergy: 600,
            }),
          }),
        ]),
        true
      );
    });

    test('should use activityMultiplier correctly', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        bufferStorage: 50,
        conversionRate: 5,
        efficiency: 1.0,
        acceptedFuelTags: ['organic'],
        activityMultiplier: 2.0, // Doubled activity
      };
      const metabolicStore = {
        currentEnergy: 500,
        maxEnergy: 1000,
        baseBurnRate: 1.0,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Digested: min(50, 5 * 2.0 * 1) = 10
      // Energy gained: 10 * 1.0 = 10
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              bufferStorage: 40, // 50 - 10
            }),
          }),
          expect.objectContaining({
            componentData: expect.objectContaining({
              currentEnergy: 510, // 500 + 10
            }),
          }),
        ]),
        true
      );
    });
  });

  // Execute Tests - Validation Failures
  describe('execute - validation failures', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DigestFoodHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      executionContext = { logger: log };
    });

    test('throws error when fuel_converter component missing', async () => {
      em.getComponentData.mockReturnValueOnce(null); // No fuel_converter

      await handler.execute(
        { entity_ref: 'actor_1', turns: 1 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(FUEL_CONVERTER_COMPONENT_ID),
        })
      );
      expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });

    test('throws error when metabolic_store component missing', async () => {
      const fuelConverter = {
        capacity: 100,
        bufferStorage: 40,
        conversionRate: 5,
        efficiency: 0.8,
        acceptedFuelTags: ['organic'],
        activityMultiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(null); // No metabolic_store

      await handler.execute(
        { entity_ref: 'actor_1', turns: 1 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(METABOLIC_STORE_COMPONENT_ID),
        })
      );
      expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });

    test('validates entity_ref is required', async () => {
      await handler.execute({}, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_ref'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('validates turns must be positive integer', async () => {
      await handler.execute(
        { entity_ref: 'actor_1', turns: 0 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('turns'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('validates turns must be an integer', async () => {
      await handler.execute(
        { entity_ref: 'actor_1', turns: 1.5 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('turns'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });
  });

  // Execute Tests - Edge Cases
  describe('execute - edge cases', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DigestFoodHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      executionContext = { logger: log };
    });

    test('updates both components atomically', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        bufferStorage: 40,
        conversionRate: 5,
        efficiency: 0.8,
        acceptedFuelTags: ['organic'],
        activityMultiplier: 1.0,
      };
      const metabolicStore = {
        currentEnergy: 600,
        maxEnergy: 1000,
        baseBurnRate: 1.0,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Verify both components are updated in single batch call
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledTimes(1);
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: entityId,
            componentTypeId: FUEL_CONVERTER_COMPONENT_ID,
          }),
          expect.objectContaining({
            instanceId: entityId,
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
          }),
        ]),
        true
      );
    });

    test('handles object entity reference', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        bufferStorage: 40,
        conversionRate: 5,
        efficiency: 0.8,
        acceptedFuelTags: ['organic'],
        activityMultiplier: 1.0,
      };
      const metabolicStore = {
        currentEnergy: 600,
        maxEnergy: 1000,
        baseBurnRate: 1.0,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: { id: entityId }, turns: 1 },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        entityId,
        FUEL_CONVERTER_COMPONENT_ID
      );
    });
  });
});
