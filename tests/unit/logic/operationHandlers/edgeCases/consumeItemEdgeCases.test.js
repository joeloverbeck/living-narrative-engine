/**
 * @jest-environment node
 */
/**
 * @file Edge case tests for ConsumeItemHandler
 * Tests for HUNMETSYS-018 edge cases:
 * - Edge Case 3: Invalid fuel type rejection
 * - Edge Case 8: Item no longer available (race condition prevention)
 * - Missing fuel_converter component validation
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

import ConsumeItemHandler from '../../../../../src/logic/operationHandlers/consumeItemHandler.js';

/** @typedef {import('../../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../../src/entities/entityManager.js').default} IEntityManager */

const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
const FUEL_SOURCE_COMPONENT_ID = 'metabolism:fuel_source';
const FUEL_CONVERTER_COMPONENT_ID = 'metabolism:fuel_converter';

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

describe('ConsumeItemHandler - Edge Cases', () => {
  describe('Edge Case 3: Invalid Fuel Type Rejection', () => {
    let handler;

    beforeEach(() => {
      handler = new ConsumeItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('rejects consumption when fuel tags are incompatible', async () => {
      const fuelSource = {
        energy_content: 200,
        bulk: 30,
        fuel_tags: ['electricity'], // Item is electric fuel
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
        efficiency: 1.0,
        accepted_fuel_tags: ['food', 'organic'], // Consumer only accepts organic fuel
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource) // item fuel_source
        .mockReturnValueOnce(metabolicStore) // consumer metabolic_store
        .mockReturnValueOnce(fuelConverter); // consumer fuel_converter

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'human_actor',
          item_ref: 'battery_item',
        },
        executionContext
      );

      // Should not modify anything
      expect(em.addComponent).not.toHaveBeenCalled();
      expect(em.removeEntityInstance).not.toHaveBeenCalled();

      // Should dispatch error with incompatible fuel types
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Incompatible fuel type'),
        })
      );
    });

    test('accepts consumption when at least one fuel tag matches', async () => {
      const fuelSource = {
        energy_content: 200,
        bulk: 30,
        fuel_tags: ['organic', 'perishable'], // Has multiple tags
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
        efficiency: 1.0,
        accepted_fuel_tags: ['food', 'organic'], // Matches 'organic'
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
          item_ref: 'food_item',
        },
        executionContext
      );

      // Should successfully consume
      expect(em.addComponent).toHaveBeenCalled();
      expect(em.removeEntityInstance).toHaveBeenCalledWith('food_item');
    });

    test('uses fuel_type fallback when fuel_tags is not present', async () => {
      const fuelSource = {
        energy_content: 150,
        bulk: 20,
        fuel_type: 'food', // Legacy single fuel_type
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
        efficiency: 1.0,
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
          item_ref: 'food_item',
        },
        executionContext
      );

      // Should successfully consume using fuel_type fallback
      expect(em.addComponent).toHaveBeenCalled();
      expect(em.removeEntityInstance).toHaveBeenCalledWith('food_item');
    });

    test('rejects when fuel_type does not match accepted tags', async () => {
      const fuelSource = {
        energy_content: 150,
        bulk: 20,
        fuel_type: 'coal', // Coal fuel type
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
        efficiency: 1.0,
        accepted_fuel_tags: ['food', 'organic'], // Does not accept coal
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource)
        .mockReturnValueOnce(metabolicStore)
        .mockReturnValueOnce(fuelConverter);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'human_actor',
          item_ref: 'coal_item',
        },
        executionContext
      );

      expect(em.addComponent).not.toHaveBeenCalled();
      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Incompatible fuel type'),
        })
      );
    });
  });

  describe('Edge Case 8: Item No Longer Available (Race Condition)', () => {
    let handler;

    beforeEach(() => {
      handler = new ConsumeItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('rejects consumption when item has been removed', async () => {
      // Simulate race condition: item was removed between discovery and consumption
      em.hasEntity.mockReturnValue(false);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_1',
          item_ref: 'deleted_item',
        },
        executionContext
      );

      // Should not attempt to get component data for missing item
      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(em.addComponent).not.toHaveBeenCalled();
      expect(em.removeEntityInstance).not.toHaveBeenCalled();

      // Should dispatch error about item not available
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Item no longer available'),
        })
      );
    });

    test('proceeds when item exists', async () => {
      em.hasEntity.mockReturnValue(true);

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
        efficiency: 1.0,
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
          item_ref: 'food_item',
        },
        executionContext
      );

      // Should proceed with consumption
      expect(em.hasEntity).toHaveBeenCalledWith('food_item');
      expect(em.addComponent).toHaveBeenCalled();
      expect(em.removeEntityInstance).toHaveBeenCalledWith('food_item');
    });
  });

  describe('Missing fuel_converter Component', () => {
    let handler;

    beforeEach(() => {
      handler = new ConsumeItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('rejects consumption when consumer lacks fuel_converter component', async () => {
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

      em.getComponentData
        .mockReturnValueOnce(fuelSource) // item fuel_source
        .mockReturnValueOnce(metabolicStore) // consumer metabolic_store
        .mockReturnValueOnce(null); // consumer fuel_converter is missing

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'actor_no_converter',
          item_ref: 'food_item',
        },
        executionContext
      );

      expect(em.addComponent).not.toHaveBeenCalled();
      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(FUEL_CONVERTER_COMPONENT_ID),
        })
      );
    });
  });

  describe('Edge Case: Empty Accepted Fuel Tags', () => {
    let handler;

    beforeEach(() => {
      handler = new ConsumeItemHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('rejects all items when accepted_fuel_tags is empty', async () => {
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
        efficiency: 1.0,
        accepted_fuel_tags: [], // Empty - accepts nothing
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelSource)
        .mockReturnValueOnce(metabolicStore)
        .mockReturnValueOnce(fuelConverter);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          consumer_ref: 'restrictive_actor',
          item_ref: 'food_item',
        },
        executionContext
      );

      expect(em.addComponent).not.toHaveBeenCalled();
      expect(em.removeEntityInstance).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Incompatible fuel type'),
        })
      );
    });
  });
});
