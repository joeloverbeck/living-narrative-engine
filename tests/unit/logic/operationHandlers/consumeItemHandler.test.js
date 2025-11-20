/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of ConsumeItemHandler
 * @see src/logic/operationHandlers/consumeItemHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import ConsumeItemHandler from '../../../../src/logic/operationHandlers/consumeItemHandler.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const FUEL_CONVERTER_COMPONENT_ID = 'metabolism:fuel_converter';
const FUEL_SOURCE_COMPONENT_ID = 'metabolism:fuel_source';
const ITEM_CONSUMED_EVENT = 'metabolism:item_consumed';

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
    batchAddComponentsOptimized: jest.fn().mockResolvedValue(undefined),
    removeEntityInstance: jest.fn(),
    getEntityInstance: jest.fn(),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => jest.clearAllMocks());

describe('ConsumeItemHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new ConsumeItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(ConsumeItemHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new ConsumeItemHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new ConsumeItemHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () => new ConsumeItemHandler({ logger: log, entityManager: em })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Successful Consumption
  describe('execute - successful consumption', () => {
    let handler;

    beforeEach(() => {
      handler = new ConsumeItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('successfully consumes compatible food and adds to buffer', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 30,
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        activity_multiplier: 1.0,
      };

      const fuelSource = {
        energy_density: 200,
        bulk: 30,
        fuel_tags: ['organic', 'cooked'],
        digestion_speed: 'medium',
        spoilage_rate: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter) // consumer fuel_converter
        .mockReturnValueOnce(fuelSource); // item fuel_source

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'bread_1',
        },
        executionContext
      );

      // Verify buffer was updated
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith([
        {
          entityId: 'actor_1',
          componentId: FUEL_CONVERTER_COMPONENT_ID,
          componentData: expect.objectContaining({
            buffer_storage: 60, // 30 + 30
          }),
        },
      ]);

      // Verify item was removed
      expect(em.removeEntityInstance).toHaveBeenCalledWith('bread_1');

      // Verify event was dispatched
      expect(dispatcher.dispatch).toHaveBeenCalledWith({
        type: ITEM_CONSUMED_EVENT,
        payload: {
          consumerId: 'actor_1',
          itemId: 'bread_1',
          bulkAdded: 30,
          energyDensity: 200,
          newBufferStorage: 60,
        },
      });
    });

    test('handles multiple fuel tags correctly', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 0,
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['blood', 'organic'],
        activity_multiplier: 1.0,
      };

      const fuelSource = {
        energy_density: 150,
        bulk: 20,
        fuel_tags: ['blood', 'liquid'],
        digestion_speed: 'fast',
        spoilage_rate: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(fuelSource);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'vampire_1',
          item_ref: 'blood_vial_1',
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();
      expect(em.removeEntityInstance).toHaveBeenCalledWith('blood_vial_1');
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ITEM_CONSUMED_EVENT,
        })
      );
    });

    test('validates capacity boundary - exactly at limit', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 70,
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        activity_multiplier: 1.0,
      };

      const fuelSource = {
        energy_density: 200,
        bulk: 30, // Exactly fills remaining capacity
        fuel_tags: ['organic'],
        digestion_speed: 'medium',
        spoilage_rate: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(fuelSource);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'food_1',
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith([
        {
          entityId: 'actor_1',
          componentId: FUEL_CONVERTER_COMPONENT_ID,
          componentData: expect.objectContaining({
            buffer_storage: 100, // Exactly at capacity
          }),
        },
      ]);
      expect(em.removeEntityInstance).toHaveBeenCalled();
    });
  });

  // Execute Tests - Validation Failures
  describe('execute - validation failures', () => {
    let handler;

    beforeEach(() => {
      handler = new ConsumeItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('rejects consumption when consumer_ref is missing', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          item_ref: 'bread_1',
        },
        executionContext
      );

      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('consumer_ref is required'),
        })
      );
    });

    test('rejects consumption when item_ref is missing', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
        },
        executionContext
      );

      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('item_ref is required'),
        })
      );
    });

    test('rejects consumption when params is null', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(null, executionContext);

      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(em.removeEntityInstance).not.toHaveBeenCalled();
    });

    test('rejects when consumer does not have fuel_converter component', async () => {
      em.getComponentData.mockReturnValueOnce(null); // No fuel_converter

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'bread_1',
        },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        FUEL_CONVERTER_COMPONENT_ID
      );
      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('fuel_converter'),
        })
      );
    });

    test('rejects when item does not have fuel_source component', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 30,
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        activity_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(null); // No fuel_source

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'rock_1',
        },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'rock_1',
        FUEL_SOURCE_COMPONENT_ID
      );
      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('fuel_source'),
        })
      );
    });

    test('rejects incompatible fuel tags', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 0,
        conversion_rate: 20,
        efficiency: 0.95,
        accepted_fuel_tags: ['blood'], // Vampire only accepts blood
        activity_multiplier: 1.0,
      };

      const fuelSource = {
        energy_density: 200,
        bulk: 30,
        fuel_tags: ['organic', 'cooked'], // Regular food
        digestion_speed: 'medium',
        spoilage_rate: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(fuelSource);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'vampire_1',
          item_ref: 'bread_1',
        },
        executionContext
      );

      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Incompatible fuel type'),
        })
      );
    });

    test('rejects when buffer capacity is exceeded', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 90, // Almost full
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        activity_multiplier: 1.0,
      };

      const fuelSource = {
        energy_density: 300,
        bulk: 50, // Too large for remaining space
        fuel_tags: ['organic', 'meat'],
        digestion_speed: 'slow',
        spoilage_rate: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(fuelSource);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'steak_1',
        },
        executionContext
      );

      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Insufficient buffer capacity'),
        })
      );
    });
  });

  // Error Handling Tests
  describe('execute - error handling', () => {
    let handler;

    beforeEach(() => {
      handler = new ConsumeItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('handles errors during buffer update gracefully', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 30,
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        activity_multiplier: 1.0,
      };

      const fuelSource = {
        energy_density: 200,
        bulk: 30,
        fuel_tags: ['organic'],
        digestion_speed: 'medium',
        spoilage_rate: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(fuelSource);
      em.batchAddComponentsOptimized.mockRejectedValueOnce(
        new Error('Database error')
      );

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'bread_1',
        },
        executionContext
      );

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('CONSUME_ITEM operation failed'),
        expect.any(Error),
        expect.objectContaining({
          consumerId: 'actor_1',
          itemId: 'bread_1',
        })
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Operation failed'),
        })
      );
    });
  });

  // Edge Cases
  describe('execute - edge cases', () => {
    let handler;

    beforeEach(() => {
      handler = new ConsumeItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('handles empty buffer consumption', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 0,
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        activity_multiplier: 1.0,
      };

      const fuelSource = {
        energy_density: 150,
        bulk: 20,
        fuel_tags: ['organic'],
        digestion_speed: 'fast',
        spoilage_rate: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(fuelSource);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'snack_1',
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith([
        {
          entityId: 'actor_1',
          componentId: FUEL_CONVERTER_COMPONENT_ID,
          componentData: expect.objectContaining({
            buffer_storage: 20, // 0 + 20
          }),
        },
      ]);
    });

    test('handles fuel tag with single matching tag', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 0,
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic', 'synthetic', 'energy'],
        activity_multiplier: 1.0,
      };

      const fuelSource = {
        energy_density: 100,
        bulk: 10,
        fuel_tags: ['synthetic'], // Only one tag, but it matches
        digestion_speed: 'medium',
        spoilage_rate: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(fuelSource);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'robot_1',
          item_ref: 'battery_1',
        },
        executionContext
      );

      expect(em.removeEntityInstance).toHaveBeenCalledWith('battery_1');
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ITEM_CONSUMED_EVENT,
        })
      );
    });

    test('preserves all fuel converter properties during update', async () => {
      const fuelConverter = {
        capacity: 100,
        buffer_storage: 30,
        conversion_rate: 5,
        efficiency: 0.8,
        accepted_fuel_tags: ['organic'],
        activity_multiplier: 1.2,
        custom_property: 'preserved',
      };

      const fuelSource = {
        energy_density: 200,
        bulk: 20,
        fuel_tags: ['organic'],
        digestion_speed: 'medium',
        spoilage_rate: 0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(fuelSource);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'food_1',
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith([
        {
          entityId: 'actor_1',
          componentId: FUEL_CONVERTER_COMPONENT_ID,
          componentData: {
            ...fuelConverter,
            buffer_storage: 50, // Updated
            custom_property: 'preserved', // Preserved
          },
        },
      ]);
    });
  });
});
