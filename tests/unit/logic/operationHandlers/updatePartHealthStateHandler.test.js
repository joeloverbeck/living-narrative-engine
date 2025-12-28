/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of UpdatePartHealthStateHandler
 * @see src/logic/operationHandlers/updatePartHealthStateHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import UpdatePartHealthStateHandler from '../../../../src/logic/operationHandlers/updatePartHealthStateHandler.js';
import {
  calculateStateFromPercentage,
  isDeterioration,
} from '../../../../src/anatomy/registries/healthStateRegistry.js';
import {
  ANATOMY_PART_COMPONENT_ID,
  ANATOMY_PART_HEALTH_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { PART_STATE_CHANGED_EVENT_ID } from '../../../../src/constants/eventIds.js';

jest.mock('../../../../src/anatomy/registries/healthStateRegistry.js', () => {
  const original = jest.requireActual(
    '../../../../src/anatomy/registries/healthStateRegistry.js'
  );
  return {
    ...original,
    calculateStateFromPercentage: jest.fn(
      original.calculateStateFromPercentage
    ),
    isDeterioration: jest.fn(original.isDeterioration),
  };
});

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

describe('UpdatePartHealthStateHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new UpdatePartHealthStateHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(UpdatePartHealthStateHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new UpdatePartHealthStateHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new UpdatePartHealthStateHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new UpdatePartHealthStateHandler({ logger: log, entityManager: em })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Health State Calculation Thresholds
  describe('execute - health state thresholds', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new UpdatePartHealthStateHandler({
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

    test('uses registry to calculate state and check deterioration', async () => {
      const partHealth = {
        currentHealth: 60,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 2,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(calculateStateFromPercentage).toHaveBeenCalled();
      expect(isDeterioration).toHaveBeenCalled();
    });

    test('calculates healthy state when health >= 81% (100%)', async () => {
      const partHealth = {
        currentHealth: 100,
        maxHealth: 100,
        state: 'scratched',
        turnsInState: 2,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'healthy',
              turnsInState: 0,
            }),
          }),
        ]),
        true
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_STATE_CHANGED_EVENT_ID,
        expect.objectContaining({
          previousState: 'scratched',
          newState: 'healthy',
        })
      );
    });

    test('calculates healthy state when health >= 81% (81%)', async () => {
      const partHealth = {
        currentHealth: 81,
        maxHealth: 100,
        state: 'scratched',
        turnsInState: 3,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'leg', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'healthy',
              currentHealth: 81,
              maxHealth: 100,
            }),
          }),
        ]),
        true
      );
    });

    test('calculates scratched state when health is 61-80% (80%)', async () => {
      const partHealth = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 5,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'scratched',
              turnsInState: 0,
            }),
          }),
        ]),
        true
      );
    });

    test('calculates scratched state when health is 61-80% (61%)', async () => {
      const partHealth = {
        currentHealth: 61,
        maxHealth: 100,
        state: 'wounded',
        turnsInState: 2,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'torso', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'scratched',
            }),
          }),
        ]),
        true
      );
    });

    test('calculates wounded state when health is 41-60% (60%)', async () => {
      const partHealth = {
        currentHealth: 60,
        maxHealth: 100,
        state: 'scratched',
        turnsInState: 1,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'head', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'wounded',
            }),
          }),
        ]),
        true
      );
    });

    test('calculates wounded state when health is 41-60% (41%)', async () => {
      const partHealth = {
        currentHealth: 41,
        maxHealth: 100,
        state: 'injured',
        turnsInState: 4,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'wounded',
            }),
          }),
        ]),
        true
      );
    });

    test('calculates injured state when health is 21-40% (40%)', async () => {
      const partHealth = {
        currentHealth: 40,
        maxHealth: 100,
        state: 'wounded',
        turnsInState: 3,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'leg', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'injured',
            }),
          }),
        ]),
        true
      );
    });

    test('calculates injured state when health is 21-40% (21%)', async () => {
      const partHealth = {
        currentHealth: 21,
        maxHealth: 100,
        state: 'critical',
        turnsInState: 2,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'hand', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'injured',
            }),
          }),
        ]),
        true
      );
    });

    test('calculates critical state when health is 1-20% (20%)', async () => {
      const partHealth = {
        currentHealth: 20,
        maxHealth: 100,
        state: 'injured',
        turnsInState: 4,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'leg', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'critical',
            }),
          }),
        ]),
        true
      );
    });

    test('calculates critical state when health is 1-20% (1%)', async () => {
      const partHealth = {
        currentHealth: 1,
        maxHealth: 100,
        state: 'injured',
        turnsInState: 6,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'hand', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'critical',
            }),
          }),
        ]),
        true
      );
    });

    test('calculates destroyed state when health is 0%', async () => {
      const partHealth = {
        currentHealth: 0,
        maxHealth: 100,
        state: 'critical',
        turnsInState: 10,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'destroyed',
              turnsInState: 0,
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
      handler = new UpdatePartHealthStateHandler({
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
      const partHealth = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'scratched',
        turnsInState: 3,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'scratched',
              turnsInState: 4, // incremented from 3
            }),
          }),
        ]),
        true
      );

      // Should NOT dispatch event when state unchanged
      expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
        PART_STATE_CHANGED_EVENT_ID,
        expect.anything()
      );
    });

    test('resets turnsInState to 0 when state changes', async () => {
      const partHealth = {
        currentHealth: 60,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 10,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              state: 'wounded',
              turnsInState: 0, // reset to 0
            }),
          }),
        ]),
        true
      );

      // Should dispatch event when state changed
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_STATE_CHANGED_EVENT_ID,
        expect.objectContaining({
          previousState: 'healthy',
          newState: 'wounded',
          turnsInPreviousState: 10,
        })
      );
    });

    test('handles missing turnsInState (defaults to 0)', async () => {
      const partHealth = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'scratched',
        // turnsInState intentionally missing
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              turnsInState: 1, // 0 + 1
            }),
          }),
        ]),
        true
      );
    });

    test('dispatches event with correct isDeterioration for worsening health', async () => {
      const partHealth = {
        currentHealth: 20,
        maxHealth: 100,
        state: 'injured',
        turnsInState: 5,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'leg', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_STATE_CHANGED_EVENT_ID,
        expect.objectContaining({
          previousState: 'injured',
          newState: 'critical',
          isDeterioration: true,
        })
      );
    });

    test('dispatches event with correct isDeterioration for improving health', async () => {
      const partHealth = {
        currentHealth: 81,
        maxHealth: 100,
        state: 'scratched',
        turnsInState: 3,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_STATE_CHANGED_EVENT_ID,
        expect.objectContaining({
          previousState: 'scratched',
          newState: 'healthy',
          isDeterioration: false,
        })
      );
    });

    test('dispatches event with all required payload fields', async () => {
      const partHealth = {
        currentHealth: 40,
        maxHealth: 100,
        state: 'scratched',
        turnsInState: 7,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_STATE_CHANGED_EVENT_ID,
        expect.objectContaining({
          partEntityId: 'part1',
          ownerEntityId: 'char1',
          partType: 'arm',
          previousState: 'scratched',
          newState: 'injured',
          turnsInPreviousState: 7,
          healthPercentage: 40,
          isDeterioration: true,
          timestamp: expect.any(Number),
        })
      );
    });

    test('does not dispatch event when state unchanged', async () => {
      const partHealth = {
        currentHealth: 90,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 2,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
        PART_STATE_CHANGED_EVENT_ID,
        expect.anything()
      );
      expect(log.debug).toHaveBeenCalledWith(
        'Part health state unchanged',
        expect.objectContaining({
          state: 'healthy',
        })
      );
    });
  });

  // Execute Tests - Owner and Part Type Resolution
  describe('execute - owner and part type resolution', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new UpdatePartHealthStateHandler({
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

    test('uses null ownerEntityId when part component missing', async () => {
      const partHealth = {
        currentHealth: 60,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 1,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID) return null; // No part component
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_STATE_CHANGED_EVENT_ID,
        expect.objectContaining({
          ownerEntityId: null,
          partType: 'unknown',
        })
      );
    });

    test('uses unknown partType when subType missing from part component', async () => {
      const partHealth = {
        currentHealth: 60,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 1,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { ownerEntityId: 'char1' }; // No subType
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_STATE_CHANGED_EVENT_ID,
        expect.objectContaining({
          ownerEntityId: 'char1',
          partType: 'unknown',
        })
      );
    });
  });

  // Execute Tests - Entity Reference Handling
  describe('execute - entity reference handling', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new UpdatePartHealthStateHandler({
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
      const partHealth = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.getComponentData).toHaveBeenCalledWith(
        'part1',
        ANATOMY_PART_HEALTH_COMPONENT_ID
      );
    });

    test('handles object entity reference with id field', async () => {
      const partHealth = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'leg', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute(
        { part_entity_ref: { id: 'part1' } },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'part1',
        ANATOMY_PART_HEALTH_COMPONENT_ID
      );
    });

    test('handles object entity reference with entityId field', async () => {
      const partHealth = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'head', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute(
        { part_entity_ref: { entityId: 'part1' } },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'part1',
        ANATOMY_PART_HEALTH_COMPONENT_ID
      );
    });

    test('trims whitespace from string references', async () => {
      const partHealth = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: '  part1  ' }, executionContext);

      expect(em.getComponentData).toHaveBeenCalledWith(
        'part1',
        ANATOMY_PART_HEALTH_COMPONENT_ID
      );
    });
  });

  // Execute Tests - Error Scenarios
  describe('execute - error scenarios', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new UpdatePartHealthStateHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('handles missing part_health component', async () => {
      em.getComponentData.mockReturnValue(null);

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringMatching(/does not have.*part_health/),
        })
      );
      expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (null)', async () => {
      await handler.execute({ part_entity_ref: null }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('part_entity_ref is required'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (empty string)', async () => {
      await handler.execute({ part_entity_ref: '' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('part_entity_ref is required'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (whitespace only)', async () => {
      await handler.execute({ part_entity_ref: '   ' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('part_entity_ref is required'),
        })
      );
      expect(em.getComponentData).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (empty object)', async () => {
      await handler.execute({ part_entity_ref: {} }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('part_entity_ref is required'),
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
      const partHealth = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'arm', ownerEntityId: 'char1' };
        return null;
      });

      const testError = new Error('Component update failed');
      em.batchAddComponentsOptimized.mockRejectedValue(testError);

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(log.error).toHaveBeenCalledWith(
        'Update part health state operation failed',
        testError,
        expect.objectContaining({ partEntityId: 'part1' })
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Operation failed'),
        })
      );
    });
  });

  // Preserves health values
  describe('execute - preserves health values', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new UpdatePartHealthStateHandler({
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

    test('preserves currentHealth and maxHealth when updating component', async () => {
      const partHealth = {
        currentHealth: 42,
        maxHealth: 150,
        state: 'wounded',
        turnsInState: 5,
      };

      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === ANATOMY_PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === ANATOMY_PART_COMPONENT_ID)
          return { subType: 'torso', ownerEntityId: 'char1' };
        return null;
      });

      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentData: expect.objectContaining({
              currentHealth: 42, // preserved
              maxHealth: 150, // preserved
            }),
          }),
        ]),
        true
      );
    });
  });
});
