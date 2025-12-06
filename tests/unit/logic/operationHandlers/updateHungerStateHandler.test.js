/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of UpdateHungerStateHandler
 * @see src/logic/operationHandlers/updateHungerStateHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import UpdateHungerStateHandler from '../../../../src/logic/operationHandlers/updateHungerStateHandler.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
const HUNGER_STATE_COMPONENT_ID = 'metabolism:hunger_state';
const HUNGER_STATE_CHANGED_EVENT = 'metabolism:hunger_state_changed';

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

describe('UpdateHungerStateHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new UpdateHungerStateHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(UpdateHungerStateHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new UpdateHungerStateHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new UpdateHungerStateHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () => new UpdateHungerStateHandler({ logger: log, entityManager: em })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Hunger State Calculation
  describe('execute - hunger state thresholds', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new UpdateHungerStateHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.batchAddComponentsOptimized.mockResolvedValue(true);
    });

    test('calculates gluttonous state when energy > 100%', async () => {
      const metabolicStore = {
        current_energy: 1200,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'satiated',
        energyPercentage: 100,
        turnsInState: 5,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'gluttonous',
              energyPercentage: 120,
              turnsInState: 0,
            }),
          }),
        ]),
        true
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        HUNGER_STATE_CHANGED_EVENT,
        expect.objectContaining({
          previousState: 'satiated',
          newState: 'gluttonous',
        })
      );
    });

    test('calculates satiated state when energy is 75-100%', async () => {
      const metabolicStore = {
        current_energy: 900,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'neutral',
        energyPercentage: 50,
        turnsInState: 3,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'satiated',
              energyPercentage: 90,
              turnsInState: 0,
            }),
          }),
        ]),
        true
      );
    });

    test('calculates neutral state when energy is 30-75%', async () => {
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'satiated',
        energyPercentage: 80,
        turnsInState: 2,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'neutral',
              energyPercentage: 50,
              turnsInState: 0,
            }),
          }),
        ]),
        true
      );
    });

    test('calculates hungry state when energy is 10-30%', async () => {
      const metabolicStore = {
        current_energy: 200,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'neutral',
        energyPercentage: 40,
        turnsInState: 1,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'hungry',
              energyPercentage: 20,
              turnsInState: 0,
            }),
          }),
        ]),
        true
      );
    });

    test('calculates starving state when energy is 0.1-10%', async () => {
      const metabolicStore = {
        current_energy: 50,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'hungry',
        energyPercentage: 15,
        turnsInState: 4,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'starving',
              energyPercentage: 5,
              turnsInState: 0,
            }),
          }),
        ]),
        true
      );
    });

    test('calculates critical state when energy is 0%', async () => {
      const metabolicStore = {
        current_energy: 0,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'starving',
        energyPercentage: 5,
        turnsInState: 10,
        starvationDamage: 50,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'critical',
              energyPercentage: 0,
              turnsInState: 0,
              starvationDamage: 50,
            }),
          }),
        ]),
        true
      );
    });
  });

  // Execute Tests - State Transitions and turnsInState
  describe('execute - state transitions and turnsInState', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new UpdateHungerStateHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.batchAddComponentsOptimized.mockResolvedValue(true);
    });

    test('increments turnsInState when state remains the same', async () => {
      const metabolicStore = {
        current_energy: 850,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'satiated',
        energyPercentage: 85,
        turnsInState: 3,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'satiated',
              turnsInState: 4, // incremented from 3
            }),
          }),
        ]),
        true
      );

      // Should NOT dispatch event when state unchanged
      expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
        HUNGER_STATE_CHANGED_EVENT,
        expect.anything()
      );
    });

    test('resets turnsInState to 0 when state changes', async () => {
      const metabolicStore = {
        current_energy: 700,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'satiated',
        energyPercentage: 80,
        turnsInState: 10,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'neutral',
              turnsInState: 0, // reset to 0
            }),
          }),
        ]),
        true
      );

      // Should dispatch event when state changed
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        HUNGER_STATE_CHANGED_EVENT,
        expect.objectContaining({
          previousState: 'satiated',
          newState: 'neutral',
          turnsInPreviousState: 10,
        })
      );
    });

    test('dispatches event with correct data when state changes', async () => {
      const metabolicStore = {
        current_energy: 150,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'neutral',
        energyPercentage: 50,
        turnsInState: 7,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        HUNGER_STATE_CHANGED_EVENT,
        {
          entityId: 'actor1',
          previousState: 'neutral',
          newState: 'hungry',
          energyPercentage: 15,
          turnsInPreviousState: 7,
        }
      );
    });

    test('does not dispatch event when state unchanged', async () => {
      const metabolicStore = {
        current_energy: 900,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'satiated',
        energyPercentage: 90,
        turnsInState: 2,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
        HUNGER_STATE_CHANGED_EVENT,
        expect.anything()
      );
      expect(log.debug).toHaveBeenCalledWith(
        'Hunger state unchanged',
        expect.objectContaining({
          state: 'satiated',
        })
      );
    });

    test('preserves starvationDamage when updating component', async () => {
      const metabolicStore = {
        current_energy: 30,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'starving',
        energyPercentage: 3,
        turnsInState: 15,
        starvationDamage: 75,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              starvationDamage: 75, // preserved
            }),
          }),
        ]),
        true
      );
    });
  });

  // Execute Tests - Entity Reference Handling
  describe('execute - entity reference handling', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new UpdateHungerStateHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.batchAddComponentsOptimized.mockResolvedValue(true);
    });

    test('handles string entity reference', async () => {
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'neutral',
        energyPercentage: 50,
        turnsInState: 0,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        METABOLIC_STORE_COMPONENT_ID
      );
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        HUNGER_STATE_COMPONENT_ID
      );
    });

    test('handles object entity reference with id field', async () => {
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'neutral',
        energyPercentage: 50,
        turnsInState: 0,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute({ entity_ref: { id: 'actor1' } }, executionContext);

      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        METABOLIC_STORE_COMPONENT_ID
      );
    });

    test('handles object entity reference with entityId field', async () => {
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'neutral',
        energyPercentage: 50,
        turnsInState: 0,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      await handler.execute(
        { entity_ref: { entityId: 'actor1' } },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        METABOLIC_STORE_COMPONENT_ID
      );
    });
  });

  // Execute Tests - Error Scenarios
  describe('execute - error scenarios', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new UpdateHungerStateHandler({
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

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('does not have'),
          message: expect.stringContaining('metabolic_store'),
        })
      );
      expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });

    test('handles missing hunger_state component', async () => {
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return null;
        return null;
      });

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('does not have'),
          message: expect.stringContaining('hunger_state'),
        })
      );
      expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (null)', async () => {
      await handler.execute({ entity_ref: null }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_ref is required'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (empty string)', async () => {
      await handler.execute({ entity_ref: '' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_ref is required'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (empty object)', async () => {
      await handler.execute({ entity_ref: {} }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_ref is required'),
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

    test('handles exception during component update', async () => {
      const metabolicStore = {
        current_energy: 500,
        max_energy: 1000,
      };
      const hungerState = {
        state: 'neutral',
        energyPercentage: 50,
        turnsInState: 0,
        starvationDamage: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === METABOLIC_STORE_COMPONENT_ID) return metabolicStore;
        if (componentId === HUNGER_STATE_COMPONENT_ID) return hungerState;
        return null;
      });

      const testError = new Error('Component update failed');
      em.batchAddComponentsOptimized.mockRejectedValue(testError);

      await handler.execute({ entity_ref: 'actor1' }, executionContext);

      expect(log.error).toHaveBeenCalledWith(
        'Update hunger state operation failed',
        testError,
        expect.objectContaining({ entityId: 'actor1' })
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Operation failed'),
        })
      );
    });
  });
});
