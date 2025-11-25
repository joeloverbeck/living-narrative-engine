/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of BurnEnergyHandler
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

import BurnEnergyHandler from '../../../../src/logic/operationHandlers/burnEnergyHandler.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
const ENERGY_BURNED_EVENT = 'metabolism:energy_burned';

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

describe('BurnEnergyHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new BurnEnergyHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(BurnEnergyHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new BurnEnergyHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new BurnEnergyHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () => new BurnEnergyHandler({ logger: log, entityManager: em })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Success Scenarios
  describe('execute - success scenarios', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new BurnEnergyHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('reduces energy based on burn rate and activity multiplier', async () => {
      const metabolicStore = {
        currentEnergy: 1000,
        maxEnergy: 1000,
        baseBurnRate: 10,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData.mockReturnValue(metabolicStore);
      em.batchAddComponentsOptimized.mockResolvedValue(true);

      await handler.execute(
        {
          entity_ref: 'actor1',
          activity_multiplier: 2.0,
          turns: 1,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'actor1',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              currentEnergy: 980, // 1000 - (10 * 2.0 * 1)
            }),
          }),
        ]),
        true
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(ENERGY_BURNED_EVENT, {
        entityId: 'actor1',
        energyBurned: 20,
        newEnergy: 980,
        activityMultiplier: 2.0,
        turns: 1,
      });
    });

    test('handles multiple turns correctly', async () => {
      const metabolicStore = {
        currentEnergy: 1000,
        maxEnergy: 1000,
        baseBurnRate: 10,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData.mockReturnValue(metabolicStore);
      em.batchAddComponentsOptimized.mockResolvedValue(true);

      await handler.execute(
        {
          entity_ref: 'actor1',
          activity_multiplier: 1.5,
          turns: 3,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'actor1',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              currentEnergy: 955, // 1000 - (10 * 1.5 * 3) = 1000 - 45
            }),
          }),
        ]),
        true
      );
    });

    test('does not reduce energy below zero', async () => {
      const metabolicStore = {
        currentEnergy: 5,
        maxEnergy: 1000,
        baseBurnRate: 10,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData.mockReturnValue(metabolicStore);
      em.batchAddComponentsOptimized.mockResolvedValue(true);

      await handler.execute(
        {
          entity_ref: 'actor1',
          activity_multiplier: 1.0,
          turns: 1,
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'actor1',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              currentEnergy: 0,
            }),
          }),
        ]),
        true
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        ENERGY_BURNED_EVENT,
        expect.objectContaining({
          newEnergy: 0,
        })
      );
    });

    test('dispatches energy_burned event with correct data', async () => {
      const metabolicStore = {
        currentEnergy: 500,
        maxEnergy: 1000,
        baseBurnRate: 15,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData.mockReturnValue(metabolicStore);
      em.batchAddComponentsOptimized.mockResolvedValue(true);

      await handler.execute(
        {
          entity_ref: 'actor1',
          activity_multiplier: 1.2,
          turns: 2,
        },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(ENERGY_BURNED_EVENT, {
        entityId: 'actor1',
        energyBurned: 36, // 15 * 1.2 * 2
        newEnergy: 464, // 500 - 36
        activityMultiplier: 1.2,
        turns: 2,
      });
    });

    test('handles default parameters correctly', async () => {
      const metabolicStore = {
        currentEnergy: 1000,
        maxEnergy: 1000,
        baseBurnRate: 10,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData.mockReturnValue(metabolicStore);
      em.batchAddComponentsOptimized.mockResolvedValue(true);

      await handler.execute(
        {
          entity_ref: 'actor1',
          // activity_multiplier defaults to 1.0
          // turns defaults to 1
        },
        executionContext
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'actor1',
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: expect.objectContaining({
              currentEnergy: 990, // 1000 - (10 * 1.0 * 1)
            }),
          }),
        ]),
        true
      );
    });

    test('handles object entity reference with entityId property', async () => {
      const metabolicStore = {
        currentEnergy: 1000,
        maxEnergy: 1000,
        baseBurnRate: 10,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      em.getComponentData.mockReturnValue(metabolicStore);
      em.batchAddComponentsOptimized.mockResolvedValue(true);

      await handler.execute(
        {
          entity_ref: { entityId: 'actor1' },
          activity_multiplier: 1.0,
          turns: 1,
        },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        METABOLIC_STORE_COMPONENT_ID
      );
    });

    test('resolves "actor" keyword to actor entity ID from execution context', async () => {
      const metabolicStore = {
        currentEnergy: 1000,
        maxEnergy: 1000,
        baseBurnRate: 10,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      // Set up execution context with actor
      executionContext.evaluationContext.actor = { id: 'real-actor-entity-123' };

      em.getComponentData.mockReturnValue(metabolicStore);
      em.batchAddComponentsOptimized.mockResolvedValue(true);

      await handler.execute(
        {
          entity_ref: 'actor',
          activity_multiplier: 1.2,
          turns: 1,
        },
        executionContext
      );

      // Should resolve "actor" to the actual actor ID
      expect(em.getComponentData).toHaveBeenCalledWith(
        'real-actor-entity-123',
        METABOLIC_STORE_COMPONENT_ID
      );

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: 'real-actor-entity-123',
          }),
        ]),
        true
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(ENERGY_BURNED_EVENT, {
        entityId: 'real-actor-entity-123',
        energyBurned: 12, // 10 * 1.2 * 1
        newEnergy: 988,
        activityMultiplier: 1.2,
        turns: 1,
      });
    });

    test('resolves "target" keyword to target entity ID from execution context', async () => {
      const metabolicStore = {
        currentEnergy: 500,
        maxEnergy: 1000,
        baseBurnRate: 5,
        activityMultiplier: 1.0,
        lastUpdateTurn: 0,
      };

      // Set up execution context with target
      executionContext.evaluationContext.target = { id: 'target-entity-456' };

      em.getComponentData.mockReturnValue(metabolicStore);
      em.batchAddComponentsOptimized.mockResolvedValue(true);

      await handler.execute(
        {
          entity_ref: 'target',
          activity_multiplier: 2.0,
          turns: 1,
        },
        executionContext
      );

      // Should resolve "target" to the actual target ID
      expect(em.getComponentData).toHaveBeenCalledWith(
        'target-entity-456',
        METABOLIC_STORE_COMPONENT_ID
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(ENERGY_BURNED_EVENT, {
        entityId: 'target-entity-456',
        energyBurned: 10,
        newEnergy: 490,
        activityMultiplier: 2.0,
        turns: 1,
      });
    });

    test('fails gracefully when "actor" keyword cannot be resolved', async () => {
      // No actor in execution context
      executionContext.evaluationContext.actor = null;

      await handler.execute(
        {
          entity_ref: 'actor',
          activity_multiplier: 1.0,
          turns: 1,
        },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_ref is required'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });
  });

  // Execute Tests - Error Scenarios
  describe('execute - error scenarios', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new BurnEnergyHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('handles missing metabolic_store component', async () => {
      em.getComponentData.mockReturnValue(null);

      await handler.execute(
        {
          entity_ref: 'actor1',
          activity_multiplier: 1.0,
          turns: 1,
        },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('does not have'),
        })
      );
      expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference', async () => {
      await handler.execute(
        {
          entity_ref: null,
          activity_multiplier: 1.0,
          turns: 1,
        },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_ref is required'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles negative activity multiplier', async () => {
      await handler.execute(
        {
          entity_ref: 'actor1',
          activity_multiplier: -1.0,
          turns: 1,
        },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('non-negative number'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles zero turns', async () => {
      await handler.execute(
        {
          entity_ref: 'actor1',
          activity_multiplier: 1.0,
          turns: 0,
        },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('positive integer'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles negative turns', async () => {
      await handler.execute(
        {
          entity_ref: 'actor1',
          activity_multiplier: 1.0,
          turns: -1,
        },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('positive integer'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles non-integer turns', async () => {
      await handler.execute(
        {
          entity_ref: 'actor1',
          activity_multiplier: 1.0,
          turns: 1.5,
        },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('positive integer'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles null params object', async () => {
      await handler.execute(null, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('params'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });
  });
});
