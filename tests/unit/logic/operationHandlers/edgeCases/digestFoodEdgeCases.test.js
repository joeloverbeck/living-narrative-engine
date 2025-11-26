/**
 * @jest-environment node
 */
/**
 * @file Edge case tests for DigestFoodHandler
 * Tests for HUNMETSYS-018 edge cases:
 * - Edge Case 7: Division by zero prevention (conversion_rate clamping)
 * - Missing component validation
 * - Empty buffer storage handling
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

import DigestFoodHandler from '../../../../../src/logic/operationHandlers/digestFoodHandler.js';

/** @typedef {import('../../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../../src/entities/entityManager.js').default} IEntityManager */

const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
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
    batchAddComponentsOptimized: jest.fn().mockResolvedValue(undefined),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => jest.clearAllMocks());

describe('DigestFoodHandler - Edge Cases', () => {
  describe('Edge Case 7: Division by Zero Prevention', () => {
    let handler;

    beforeEach(() => {
      handler = new DigestFoodHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('clamps zero conversion_rate to minimum 0.1', async () => {
      const fuelConverter = {
        capacity: 100,
        conversion_rate: 0, // Zero - should be clamped to 0.1
        efficiency: 1.0,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [{ bulk: 5, energy_content: 50 }],
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      // Should log warning about adjusted rate
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('conversion_rate was zero or negative'),
        expect.objectContaining({
          originalRate: 0,
          adjustedRate: 0.1,
        })
      );

      // Should still proceed with digestion using minimum rate
      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();
    });

    test('clamps negative conversion_rate to minimum 0.1', async () => {
      const fuelConverter = {
        capacity: 100,
        conversion_rate: -5, // Negative - should be clamped to 0.1
        efficiency: 1.0,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [{ bulk: 5, energy_content: 50 }],
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      // Should log warning about adjusted rate
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('conversion_rate was zero or negative'),
        expect.objectContaining({
          originalRate: -5,
          adjustedRate: 0.1,
        })
      );

      // Should still proceed with digestion
      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();
    });

    test('uses valid positive conversion_rate without clamping', async () => {
      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10, // Valid positive rate
        efficiency: 1.0,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [{ bulk: 5, energy_content: 50 }],
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      // Should NOT log warning
      expect(log.warn).not.toHaveBeenCalled();

      // Should proceed with digestion
      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();
    });

    test('handles undefined conversion_rate gracefully', async () => {
      const fuelConverter = {
        capacity: 100,
        // conversion_rate is undefined
        efficiency: 1.0,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [{ bulk: 5, energy_content: 50 }],
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      // Should proceed without crashing (fallback to 0, then clamped to 0.1)
      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();
    });
  });

  describe('Missing Component Validation', () => {
    let handler;

    beforeEach(() => {
      handler = new DigestFoodHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('rejects when entity lacks fuel_converter component', async () => {
      em.getComponentData.mockReturnValueOnce(null); // No fuel_converter

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_no_converter',
          turns: 1,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(FUEL_CONVERTER_COMPONENT_ID),
        })
      );
    });

    test('rejects when entity lacks metabolic_store component', async () => {
      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 1.0,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(null); // No metabolic_store

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_no_store',
          turns: 1,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(METABOLIC_STORE_COMPONENT_ID),
        })
      );
    });
  });

  describe('Empty Buffer Storage', () => {
    let handler;

    beforeEach(() => {
      handler = new DigestFoodHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('handles empty buffer storage gracefully', async () => {
      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 1.0,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        buffer_storage: [], // Empty buffer
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      // Should still update components (with zero digestion)
      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();

      // Should dispatch event with zero values
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'metabolism:food_digested',
        expect.objectContaining({
          bufferReduced: 0,
          energyGained: 0,
        })
      );
    });

    test('handles undefined buffer storage gracefully', async () => {
      const fuelConverter = {
        capacity: 100,
        conversion_rate: 10,
        efficiency: 1.0,
        accepted_fuel_tags: ['food'],
        metabolic_efficiency_multiplier: 1.0,
      };

      const metabolicStore = {
        current_energy: 50,
        max_energy: 100,
        base_burn_rate: 1.0,
        // buffer_storage is undefined
        buffer_capacity: 100,
      };

      em.getComponentData
        .mockReturnValueOnce(fuelConverter)
        .mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      // Should handle undefined as empty array
      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();
    });
  });

  describe('Parameter Validation', () => {
    let handler;

    beforeEach(() => {
      handler = new DigestFoodHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('rejects invalid turns parameter (zero)', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 0, // Invalid - must be positive integer
        },
        executionContext
      );

      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('positive integer'),
        })
      );
    });

    test('rejects invalid turns parameter (negative)', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: -1, // Invalid
        },
        executionContext
      );

      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('positive integer'),
        })
      );
    });

    test('rejects invalid turns parameter (non-integer)', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1.5, // Invalid - not an integer
        },
        executionContext
      );

      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('positive integer'),
        })
      );
    });

    test('rejects missing entity_ref', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          // entity_ref is missing
          turns: 1,
        },
        executionContext
      );

      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_ref'),
        })
      );
    });
  });
});
