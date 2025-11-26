/**
 * @jest-environment node
 */
/**
 * @file Edge case tests for BurnEnergyHandler
 * Tests for HUNMETSYS-018 edge cases:
 * - Edge Case 1: Negative energy clamping (energy cannot go below 0)
 * - Missing component validation
 * - Parameter validation
 * @see src/logic/operationHandlers/burnEnergyHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import BurnEnergyHandler from '../../../../../src/logic/operationHandlers/burnEnergyHandler.js';

/** @typedef {import('../../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../../src/entities/entityManager.js').default} IEntityManager */

const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';

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

describe('BurnEnergyHandler - Edge Cases', () => {
  describe('Edge Case 1: Negative Energy Clamping', () => {
    let handler;

    beforeEach(() => {
      handler = new BurnEnergyHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('clamps energy to zero when burn exceeds current energy', async () => {
      const metabolicStore = {
        current_energy: 10, // Low energy
        max_energy: 100,
        base_burn_rate: 50, // High burn rate - would go negative
        activity_multiplier: 1.0,
        buffer_storage: [],
        buffer_capacity: 100,
      };

      em.getComponentData.mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'starving_actor',
          turns: 1,
        },
        executionContext
      );

      // Should update component with clamped energy (0, not -40)
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'starving_actor',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              current_energy: 0, // Clamped to 0, not -40
            }),
          }),
        ]),
        true
      );

      // Event should reflect actual burn (limited by available energy)
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'metabolism:energy_burned',
        expect.objectContaining({
          entityId: 'starving_actor',
          newEnergy: 0,
        })
      );
    });

    test('handles exact depletion (energy equals burn amount)', async () => {
      const metabolicStore = {
        current_energy: 25,
        max_energy: 100,
        base_burn_rate: 25, // Exactly matches current energy
        activity_multiplier: 1.0,
        buffer_storage: [],
        buffer_capacity: 100,
      };

      em.getComponentData.mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'actor_1',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              current_energy: 0, // Exactly depleted
            }),
          }),
        ]),
        true
      );
    });

    test('handles multiple turns causing depletion', async () => {
      const metabolicStore = {
        current_energy: 20,
        max_energy: 100,
        base_burn_rate: 10,
        activity_multiplier: 1.0, // 10 energy per turn
        buffer_storage: [],
        buffer_capacity: 100,
      };

      em.getComponentData.mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 5, // Would burn 50, but only has 20
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'actor_1',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              current_energy: 0, // Clamped to 0
            }),
          }),
        ]),
        true
      );
    });

    test('burns normally when sufficient energy available', async () => {
      const metabolicStore = {
        current_energy: 100,
        max_energy: 100,
        base_burn_rate: 10,
        activity_multiplier: 1.0,
        buffer_storage: [],
        buffer_capacity: 100,
      };

      em.getComponentData.mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'actor_1',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              current_energy: 90, // Normal burn
            }),
          }),
        ]),
        true
      );
    });

    test('handles zero current energy gracefully', async () => {
      const metabolicStore = {
        current_energy: 0, // Already depleted
        max_energy: 100,
        base_burn_rate: 10,
        activity_multiplier: 1.0,
        buffer_storage: [],
        buffer_capacity: 100,
      };

      em.getComponentData.mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'actor_1',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              current_energy: 0, // Stays at 0
            }),
          }),
        ]),
        true
      );
    });
  });

  describe('Missing Component Validation', () => {
    let handler;

    beforeEach(() => {
      handler = new BurnEnergyHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('rejects when entity lacks metabolic_store component', async () => {
      em.getComponentData.mockReturnValueOnce(null); // No metabolic_store

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_no_metabolism',
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

  describe('Activity Multiplier Handling', () => {
    let handler;

    beforeEach(() => {
      handler = new BurnEnergyHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('applies activity multiplier to burn calculation', async () => {
      const metabolicStore = {
        current_energy: 100,
        max_energy: 100,
        base_burn_rate: 10,
        activity_multiplier: 1.0, // Component value (not used for calc)
        buffer_storage: [],
        buffer_capacity: 100,
      };

      em.getComponentData.mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'active_actor',
          activity_multiplier: 2.0, // Parameter multiplier - double burn rate
          turns: 1,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'active_actor',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              current_energy: 80, // 100 - (10 * 2.0) = 80
            }),
          }),
        ]),
        true
      );
    });

    test('handles undefined activity multiplier (defaults to 1.0)', async () => {
      const metabolicStore = {
        current_energy: 100,
        max_energy: 100,
        base_burn_rate: 10,
        // activity_multiplier is undefined
        buffer_storage: [],
        buffer_capacity: 100,
      };

      em.getComponentData.mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 1,
        },
        executionContext
      );

      // Should use default multiplier of 1.0
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'actor_1',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              current_energy: 90, // 100 - (10 * 1.0) = 90
            }),
          }),
        ]),
        true
      );
    });

    test('handles zero activity multiplier (no energy burn)', async () => {
      const metabolicStore = {
        current_energy: 100,
        max_energy: 100,
        base_burn_rate: 10,
        activity_multiplier: 1.0, // Component value
        buffer_storage: [],
        buffer_capacity: 100,
      };

      em.getComponentData.mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'resting_actor',
          activity_multiplier: 0, // Zero parameter - no burn
          turns: 1,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'resting_actor',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              current_energy: 100, // No change
            }),
          }),
        ]),
        true
      );
    });
  });

  describe('Parameter Validation', () => {
    let handler;

    beforeEach(() => {
      handler = new BurnEnergyHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
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

    test('rejects invalid turns parameter', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: 'actor_1',
          turns: 0, // Invalid
        },
        executionContext
      );

      expect(em.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('turns'),
        })
      );
    });

    test('accepts object entity reference', async () => {
      const metabolicStore = {
        current_energy: 100,
        max_energy: 100,
        base_burn_rate: 10,
        activity_multiplier: 1.0,
        buffer_storage: [],
        buffer_capacity: 100,
      };

      em.getComponentData.mockReturnValueOnce(metabolicStore);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          entity_ref: { entityId: 'actor_from_scope' }, // Object reference - uses entityId property
          turns: 1,
        },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor_from_scope',
        METABOLIC_STORE_COMPONENT_ID
      );
    });
  });
});
