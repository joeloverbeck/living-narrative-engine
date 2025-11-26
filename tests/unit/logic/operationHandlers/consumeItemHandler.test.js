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

const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
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
    addComponent: jest.fn().mockResolvedValue(undefined),
    hasComponent: jest.fn(),
    removeEntityInstance: jest.fn(),
    getEntityInstance: jest.fn(),
    hasEntity: jest.fn().mockReturnValue(true), // Default: entity exists
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
      const fuelSource = {
        energy_content: 200,
        bulk: 30,
        fuel_tags: ['food'],
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [{ bulk: 10, energy_content: 100 }],
        buffer_capacity: 100,
      };

      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 0.8,
        accepted_fuel_tags: ['food', 'organic'],
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource) // item fuel_source
        .mockReturnValueOnce(metabolicStore) // consumer metabolic_store
        .mockReturnValueOnce(fuelConverter); // consumer fuel_converter

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'bread_1',
        },
        executionContext
      );

      // Verify buffer was updated
      expect(em.addComponent).toHaveBeenCalledWith(
        'actor_1',
        METABOLIC_STORE_COMPONENT_ID,
        expect.objectContaining({
          buffer_storage: [
            { bulk: 10, energy_content: 100 },
            { bulk: 30, energy_content: 200 },
          ],
        })
      );

      // Verify item was removed
      expect(em.removeEntityInstance).toHaveBeenCalledWith('bread_1');

      // Verify event was dispatched
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        ITEM_CONSUMED_EVENT,
        {
          consumerId: 'actor_1',
          itemId: 'bread_1',
          fuelBulk: 30,
          fuelEnergy: 200,
          newBufferUsage: 40,
        }
      );
    });

    test('handles multiple fuel tags correctly', async () => {
      const fuelSource = {
        energy_content: 150,
        bulk: 20,
        fuel_tags: ['blood', 'organic'],
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [],
        buffer_capacity: 100,
      };

      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 0.8,
        accepted_fuel_tags: ['blood', 'organic'],
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource)
        .mockReturnValueOnce(metabolicStore)
        .mockReturnValueOnce(fuelConverter);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'vampire_1',
          item_ref: 'blood_vial_1',
        },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalled();
      expect(em.removeEntityInstance).toHaveBeenCalledWith('blood_vial_1');
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        ITEM_CONSUMED_EVENT,
        expect.objectContaining({
          consumerId: 'vampire_1',
          itemId: 'blood_vial_1',
          fuelBulk: 20,
          fuelEnergy: 150,
        })
      );
    });

    test('validates capacity boundary - exactly at limit', async () => {
      const fuelSource = {
        energy_content: 200,
        bulk: 30, // Exactly fills remaining capacity
        fuel_tags: ['food'],
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [{ bulk: 70, energy_content: 700 }],
        buffer_capacity: 100,
      };

      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 0.8,
        accepted_fuel_tags: ['food', 'organic'],
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource)
        .mockReturnValueOnce(metabolicStore)
        .mockReturnValueOnce(fuelConverter);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'food_1',
        },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'actor_1',
        METABOLIC_STORE_COMPONENT_ID,
        expect.objectContaining({
          buffer_storage: expect.arrayContaining([
            { bulk: 70, energy_content: 700 },
            { bulk: 30, energy_content: 200 },
          ]),
        })
      );
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

    test('rejects when consumer does not have metabolic_store component', async () => {
      const fuelSource = {
        bulk: 30,
        energy_content: 200,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource) // Item has fuel_source
        .mockReturnValueOnce(null); // Consumer has no metabolic_store

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'bread_1',
        },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'bread_1',
        FUEL_SOURCE_COMPONENT_ID
      );
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        METABOLIC_STORE_COMPONENT_ID
      );
      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('metabolic_store'),
        })
      );
    });

    test('rejects when item does not have fuel_source component', async () => {
      em.getComponentData.mockReturnValueOnce(null); // No fuel_source on item

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


    test('rejects when buffer capacity is exceeded', async () => {
      const fuelSource = {
        energy_content: 300,
        bulk: 50, // Too large for remaining space
        fuel_tags: ['food'],
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [{ bulk: 90, energy_content: 900 }], // Almost full
        buffer_capacity: 100,
      };

      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 0.8,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource)
        .mockReturnValueOnce(metabolicStore)
        .mockReturnValueOnce(fuelConverter);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'steak_1',
        },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'steak_1',
        FUEL_SOURCE_COMPONENT_ID
      );
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        METABOLIC_STORE_COMPONENT_ID
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
      const fuelSource = {
        energy_content: 200,
        bulk: 30,
        fuel_tags: ['food'],
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [],
        buffer_capacity: 100,
      };

      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 0.8,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource) // item fuel_source
        .mockReturnValueOnce(metabolicStore) // consumer metabolic_store
        .mockReturnValueOnce(fuelConverter); // consumer fuel_converter
      em.addComponent.mockRejectedValueOnce(
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
        expect.stringContaining('Consume item operation failed'),
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
      const fuelSource = {
        energy_content: 150,
        bulk: 20,
        fuel_tags: ['food'],
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [],
        buffer_capacity: 100,
      };

      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 0.8,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource) // item fuel_source
        .mockReturnValueOnce(metabolicStore) // consumer metabolic_store
        .mockReturnValueOnce(fuelConverter); // consumer fuel_converter

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'snack_1',
        },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'actor_1',
        METABOLIC_STORE_COMPONENT_ID,
        expect.objectContaining({
          buffer_storage: [{ bulk: 20, energy_content: 150 }],
        })
      );
    });

    test('handles fuel tag with single matching tag', async () => {
      const fuelSource = {
        energy_content: 100,
        bulk: 10,
        fuel_tags: ['electric'],
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [],
        buffer_capacity: 100,
      };

      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 0.8,
        accepted_fuel_tags: ['electric'],
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource) // item fuel_source
        .mockReturnValueOnce(metabolicStore) // consumer metabolic_store
        .mockReturnValueOnce(fuelConverter); // consumer fuel_converter

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
        ITEM_CONSUMED_EVENT,
        expect.objectContaining({
          consumerId: 'robot_1',
          itemId: 'battery_1',
        })
      );
    });

    test('preserves all metabolic store properties during update', async () => {
      const fuelSource = {
        energy_content: 200,
        bulk: 20,
        fuel_tags: ['food'],
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [{ bulk: 30, energy_content: 300 }],
        buffer_capacity: 100,
        custom_property: 'preserved',
      };

      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 0.8,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource) // item fuel_source
        .mockReturnValueOnce(metabolicStore) // consumer metabolic_store
        .mockReturnValueOnce(fuelConverter); // consumer fuel_converter

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'food_1',
        },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'actor_1',
        METABOLIC_STORE_COMPONENT_ID,
        expect.objectContaining({
          buffer_storage: [
            { bulk: 30, energy_content: 300 },
            { bulk: 20, energy_content: 200 },
          ],
          custom_property: 'preserved',
        })
      );
    });
  });
});
