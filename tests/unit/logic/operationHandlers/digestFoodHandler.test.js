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
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 600,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 40, energy_content: 40 }], // 40 bulk, 40 energy
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Digested: min(40 total bulk, 5 * 1.0 * 1) = 5
      // Energy gained: 5 bulk * 0.8 efficiency = 4 energy (proportional to bulk digested)
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: entityId,
            componentTypeId: FUEL_CONVERTER_COMPONENT_ID,
            componentData: {
              capacity: 100,
              conversion_rate: 5,
              efficiency: 0.8,
              accepted_fuel_tags: ['organic'],
              metabolic_efficiency_multiplier: 1.0,
            },
          },
          {
            instanceId: entityId,
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: {
              current_energy: 604, // 600 + 4
              max_energy: 1000,
              base_burn_rate: 1.0,
              activity_multiplier: 1.0,
              last_update_turn: 0,
              buffer_storage: [{ bulk: 35, energy_content: 35 }], // 40 - 5
              buffer_capacity: 100,
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
        conversion_rate: 5,
        efficiency: 0.9,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 50, energy_content: 50 }],
        buffer_capacity: 100,
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
              conversion_rate: 5,
            }),
          }),
          expect.objectContaining({
            componentData: expect.objectContaining({
              current_energy: 513.5, // 500 + 13.5
              buffer_storage: [{ bulk: 35, energy_content: 35 }], // 50 - 15
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
        conversion_rate: 10, // High conversion rate
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 3, energy_content: 3 }], // Very little in buffer
        buffer_capacity: 100,
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
              conversion_rate: 10,
            }),
          }),
          expect.objectContaining({
            componentData: expect.objectContaining({
              current_energy: 502.4, // 500 + (3 * 0.8)
              buffer_storage: [], // All consumed
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
        conversion_rate: 10,
        efficiency: 1.0, // Perfect efficiency
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 995,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 50, energy_content: 50 }],
        buffer_capacity: 100,
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
              current_energy: 1000, // Capped at maxEnergy
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
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 600,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [], // Empty buffer
        buffer_capacity: 100,
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
              conversion_rate: 5,
            }),
          }),
          expect.objectContaining({
            componentData: expect.objectContaining({
              current_energy: 600,
              buffer_storage: [],
            }),
          }),
        ]),
        true
      );
    });

    test('should use metabolic_efficiency_multiplier correctly', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        conversion_rate: 5,
        efficiency: 1.0,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 2.0, // Doubled efficiency
      };
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 50, energy_content: 50 }],
        buffer_capacity: 100,
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
              conversion_rate: 5,
            }),
          }),
          expect.objectContaining({
            componentData: expect.objectContaining({
              current_energy: 510, // 500 + 10
              buffer_storage: [{ bulk: 40, energy_content: 40 }], // 50 - 10
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
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
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
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 600,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 40, energy_content: 40 }],
        buffer_capacity: 100,
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
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 600,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 40, energy_content: 40 }],
        buffer_capacity: 100,
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

    // Branch coverage: Line 73 - assertParamsObject returns false (null params)
    test('returns early when params is null', async () => {
      await handler.execute(null, executionContext);

      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });

    // Branch coverage: Lines 179-185 - conversion_rate is zero or negative (warning branch)
    test('warns and uses minimum 0.1 when conversion_rate is zero', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        conversion_rate: 0, // Zero conversion rate - triggers warning
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 10, energy_content: 10 }],
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Should log warning about zero conversion rate
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('conversion_rate was zero or negative'),
        expect.objectContaining({
          entityId,
          originalRate: 0,
          adjustedRate: 0.1,
        })
      );

      // Should still process with minimum rate of 0.1
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              conversion_rate: 0.1, // Adjusted to minimum
            }),
          }),
        ]),
        true
      );
    });

    // Branch coverage: Lines 179-185 - conversion_rate is negative
    test('warns and uses minimum 0.1 when conversion_rate is negative', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        conversion_rate: -5, // Negative conversion rate - triggers warning
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 10, energy_content: 10 }],
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Should log warning about negative conversion rate
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('conversion_rate was zero or negative'),
        expect.objectContaining({
          entityId,
          originalRate: -5,
          adjustedRate: 0.1,
        })
      );
    });

    // Branch coverage: Lines 205-207 - remainingDigestion <= 0 (preserves items when capacity exhausted)
    test('preserves buffer items when digestion capacity exhausted', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        conversion_rate: 2, // Low conversion rate
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      // Buffer with 3 items totaling 60 bulk - but only 2 bulk can be digested per turn
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [
          { bulk: 2, energy_content: 20 }, // This will be fully digested
          { bulk: 30, energy_content: 300 }, // This will be pushed unchanged
          { bulk: 28, energy_content: 280 }, // This will also be pushed unchanged
        ],
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Digested: min(60 total bulk, 2 * 1.0 * 1) = 2
      // Only first item is consumed, remaining items pushed unchanged
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              buffer_storage: [
                { bulk: 30, energy_content: 300 }, // Pushed unchanged
                { bulk: 28, energy_content: 280 }, // Pushed unchanged
              ],
            }),
          }),
        ]),
        true
      );
    });

    // Branch coverage: Lines 283-287 - Exception in try block (catch branch)
    test('dispatches error when batchAddComponentsOptimized throws', async () => {
      const entityId = 'actor_1';
      const fuelConverter = {
        capacity: 100,
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        metabolic_efficiency_multiplier: 1.0,
      };
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
        base_burn_rate: 1.0,
        activity_multiplier: 1.0,
        last_update_turn: 0,
        buffer_storage: [{ bulk: 10, energy_content: 10 }],
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      em.batchAddComponentsOptimized.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await handler.execute(
        { entity_ref: entityId, turns: 1 },
        executionContext
      );

      // Should log the error
      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Digest food operation failed'),
        expect.any(Error),
        expect.objectContaining({
          entityId,
          turns: 1,
        })
      );

      // Should dispatch error event
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Operation failed'),
        })
      );
    });
  });
});
