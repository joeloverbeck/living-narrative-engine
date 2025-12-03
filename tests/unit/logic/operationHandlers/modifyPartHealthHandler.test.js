/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of ModifyPartHealthHandler
 * @see src/logic/operationHandlers/modifyPartHealthHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import ModifyPartHealthHandler from '../../../../src/logic/operationHandlers/modifyPartHealthHandler.js';
import { calculateStateFromPercentage } from '../../../../src/anatomy/registries/healthStateRegistry.js';

jest.mock('../../../../src/anatomy/registries/healthStateRegistry.js', () => {
  const original = jest.requireActual(
    '../../../../src/anatomy/registries/healthStateRegistry.js'
  );
  return {
    ...original,
    calculateStateFromPercentage: jest.fn(
      original.calculateStateFromPercentage
    ),
  };
});

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const PART_HEALTH_CHANGED_EVENT = 'anatomy:part_health_changed';

// Test Doubles
/** @type {jest.Mocked<ILogger>} */ let log;
/** @type {jest.Mocked<IEntityManager>} */ let em;
/** @type {{ dispatch: jest.Mock }} */ let dispatcher;
/** @type {{ evaluate: jest.Mock }} */ let jsonLogicService;

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
    addComponent: jest.fn(),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
  jsonLogicService = { evaluate: jest.fn() };
});

afterEach(() => jest.clearAllMocks());

describe('ModifyPartHealthHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      expect(handler).toBeInstanceOf(ModifyPartHealthHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new ModifyPartHealthHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
            jsonLogicService,
          })
      ).toThrow(/logger/i);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new ModifyPartHealthHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
            jsonLogicService,
          })
      ).toThrow(/entityManager/i);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new ModifyPartHealthHandler({
            logger: log,
            entityManager: em,
            jsonLogicService,
          })
      ).toThrow(/safeEventDispatcher/i);
    });

    test('throws if jsonLogicService is missing', () => {
      expect(
        () =>
          new ModifyPartHealthHandler({
            logger: log,
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/jsonLogicService/i);
    });
  });

  // Execute Tests - Health State Calculation
  describe('execute - health state thresholds', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    test('uses registry to calculate health state', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 2,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: 10 },
        executionContext
      );

      expect(calculateStateFromPercentage).toHaveBeenCalled();
    });

    test('calculates healthy state when health is 81-100%', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 2,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Apply delta of 10 -> health becomes 90 (90% = healthy)
      await handler.execute(
        { part_entity_ref: 'part1', delta: 10 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 90,
          state: 'healthy',
        })
      );
    });

    test('calculates scratched state when health is 61-80%', async () => {
      const healthComponent = {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 5,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Apply delta of -30 -> health becomes 70 (70% = scratched)
      await handler.execute(
        { part_entity_ref: 'part1', delta: -30 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 70,
          state: 'scratched',
        })
      );
    });

    test('calculates wounded state when health is 41-60%', async () => {
      const healthComponent = {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 3,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Apply delta of -50 -> health becomes 50 (50% = wounded)
      await handler.execute(
        { part_entity_ref: 'part1', delta: -50 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 50,
          state: 'wounded',
        })
      );
    });

    test('calculates critical state when health is 1-20%', async () => {
      const healthComponent = {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 1,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Apply delta of -85 -> health becomes 15 (15% = critical)
      await handler.execute(
        { part_entity_ref: 'part1', delta: -85 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 15,
          state: 'critical',
        })
      );
    });

    test('calculates destroyed state when health is 0%', async () => {
      const healthComponent = {
        currentHealth: 50,
        maxHealth: 100,
        state: 'wounded',
        turnsInState: 10,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Apply delta of -100 -> health becomes 0 (clamped, 0% = destroyed)
      await handler.execute(
        { part_entity_ref: 'part1', delta: -100 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 0,
          state: 'destroyed',
        })
      );
    });
  });

  // Execute Tests - Damage and Healing
  describe('execute - damage and healing', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    test('positive delta (healing) increases health', async () => {
      const healthComponent = {
        currentHealth: 50,
        maxHealth: 100,
        state: 'wounded',
        turnsInState: 2,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: 20 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 70,
        })
      );
    });

    test('negative delta (damage) decreases health', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 3,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: -30 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 50,
        })
      );
    });

    test('clamps to maxHealth when healing exceeds max', async () => {
      const healthComponent = {
        currentHealth: 90,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 1,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Apply delta of 50 -> would be 140, clamped to 100
      await handler.execute(
        { part_entity_ref: 'part1', delta: 50 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 100,
        })
      );
    });

    test('clamps to 0 when damage exceeds current health', async () => {
      const healthComponent = {
        currentHealth: 20,
        maxHealth: 100,
        state: 'critical',
        turnsInState: 4,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Apply delta of -50 -> would be -30, clamped to 0
      await handler.execute(
        { part_entity_ref: 'part1', delta: -50 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 0,
        })
      );
    });
  });

  // Execute Tests - Clamping Behavior
  describe('execute - clamping behavior', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    test('clamp_to_bounds: true (default) respects [0, maxHealth]', async () => {
      const healthComponent = {
        currentHealth: 90,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Default clamp_to_bounds is true
      await handler.execute(
        { part_entity_ref: 'part1', delta: 50 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 100, // clamped to maxHealth
        })
      );
    });

    test('clamp_to_bounds: false allows overflow above maxHealth', async () => {
      const healthComponent = {
        currentHealth: 90,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: 50, clamp_to_bounds: false },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 140, // not clamped
        })
      );
    });

    test('clamp_to_bounds: false allows underflow below 0', async () => {
      const healthComponent = {
        currentHealth: 10,
        maxHealth: 100,
        state: 'critical',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: -50, clamp_to_bounds: false },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: -40, // not clamped
        })
      );
    });
  });

  // Execute Tests - State Transitions and turnsInState
  describe('execute - state transitions and turnsInState', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    test('increments turnsInState when state remains the same', async () => {
      const healthComponent = {
        currentHealth: 85,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 3,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Apply small delta that keeps us in healthy state (76-100%)
      await handler.execute(
        { part_entity_ref: 'part1', delta: 5 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 90,
          state: 'healthy',
          turnsInState: 4, // incremented from 3
        })
      );
    });

    test('resets turnsInState to 0 when state changes', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 10,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Apply delta that changes state to wounded (41-60%)
      await handler.execute(
        { part_entity_ref: 'part1', delta: -20 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 60,
          state: 'wounded',
          turnsInState: 0, // reset to 0
        })
      );
    });
  });

  // Execute Tests - Event Dispatch
  describe('execute - event dispatch', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    test('dispatches anatomy:part_health_changed on every operation', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 2,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: -10 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_HEALTH_CHANGED_EVENT,
        expect.any(Object)
      );
    });

    test('event payload includes all required fields', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 5,
      };
      const partComponent = {
        subType: 'arm',
        ownerEntityId: 'character1',
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return (
          componentId === PART_HEALTH_COMPONENT_ID ||
          componentId === PART_COMPONENT_ID
        );
      });
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_HEALTH_COMPONENT_ID) return healthComponent;
        if (componentId === PART_COMPONENT_ID) return partComponent;
        return null;
      });

      await handler.execute(
        { part_entity_ref: 'part1', delta: -20 },
        executionContext
      );

      // 60% health is 'wounded' (41-60% threshold)
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_HEALTH_CHANGED_EVENT,
        expect.objectContaining({
          partEntityId: 'part1',
          ownerEntityId: 'character1',
          partType: 'arm',
          previousHealth: 80,
          newHealth: 60,
          maxHealth: 100,
          healthPercentage: 60,
          previousState: 'healthy',
          newState: 'wounded',
          delta: -20,
          timestamp: expect.any(Number),
        })
      );
    });

    test('event includes correct healthPercentage calculation', async () => {
      const healthComponent = {
        currentHealth: 100,
        maxHealth: 200,
        state: 'wounded',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: -50 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_HEALTH_CHANGED_EVENT,
        expect.objectContaining({
          healthPercentage: 25, // 50/200 * 100 = 25%
        })
      );
    });

    test('partType defaults to unknown when anatomy:part component missing', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: -10 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        PART_HEALTH_CHANGED_EVENT,
        expect.objectContaining({
          partType: 'unknown',
          ownerEntityId: null,
        })
      );
    });
  });

  // Execute Tests - Entity Reference Handling
  describe('execute - entity reference handling', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    test('handles string entity reference', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: -10 },
        executionContext
      );

      expect(em.hasComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID
      );
    });

    test('handles JSON Logic object reference (resolved via jsonLogicService)', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);
      jsonLogicService.evaluate.mockReturnValue('resolved_part_id');

      await handler.execute(
        { part_entity_ref: { var: 'target.partId' }, delta: -10 },
        executionContext
      );

      expect(jsonLogicService.evaluate).toHaveBeenCalledWith(
        { var: 'target.partId' },
        executionContext
      );
      expect(em.hasComponent).toHaveBeenCalledWith(
        'resolved_part_id',
        PART_HEALTH_COMPONENT_ID
      );
    });

    test('handles object reference with id property', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);
      jsonLogicService.evaluate.mockReturnValue({ id: 'part_from_logic' });

      await handler.execute(
        { part_entity_ref: { var: 'target' }, delta: -10 },
        executionContext
      );

      expect(em.hasComponent).toHaveBeenCalledWith(
        'part_from_logic',
        PART_HEALTH_COMPONENT_ID
      );
    });

    test('handles object reference with entityId property', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);
      jsonLogicService.evaluate.mockReturnValue({ entityId: 'part_entity' });

      await handler.execute(
        { part_entity_ref: { var: 'target' }, delta: -10 },
        executionContext
      );

      expect(em.hasComponent).toHaveBeenCalledWith(
        'part_entity',
        PART_HEALTH_COMPONENT_ID
      );
    });
  });

  // Execute Tests - Delta Resolution
  describe('execute - delta resolution', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    test('handles numeric delta value', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: -25 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 55,
        })
      );
    });

    test('handles JSON Logic expression delta', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);
      jsonLogicService.evaluate.mockReturnValue(-30);

      await handler.execute(
        { part_entity_ref: 'part1', delta: { var: 'damage.amount' } },
        executionContext
      );

      expect(jsonLogicService.evaluate).toHaveBeenCalledWith(
        { var: 'damage.amount' },
        executionContext
      );
      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 50,
        })
      );
    });
  });

  // Execute Tests - Error Scenarios
  describe('execute - error scenarios', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('handles missing anatomy:part_health component', async () => {
      em.hasComponent.mockReturnValue(false);

      await handler.execute(
        { part_entity_ref: 'part1', delta: -10 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(PART_HEALTH_COMPONENT_ID),
        })
      );
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (null)', async () => {
      await handler.execute(
        { part_entity_ref: null, delta: -10 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('part_entity_ref'),
        })
      );
      expect(em.hasComponent).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (empty string)', async () => {
      await handler.execute(
        { part_entity_ref: '', delta: -10 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('part_entity_ref'),
        })
      );
      expect(em.hasComponent).not.toHaveBeenCalled();
    });

    test('handles invalid entity reference (whitespace only)', async () => {
      await handler.execute(
        { part_entity_ref: '   ', delta: -10 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('part_entity_ref'),
        })
      );
      expect(em.hasComponent).not.toHaveBeenCalled();
    });

    test('handles invalid delta (non-numeric)', async () => {
      await handler.execute(
        { part_entity_ref: 'part1', delta: 'invalid' },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('delta'),
        })
      );
      expect(em.hasComponent).not.toHaveBeenCalled();
    });

    test('handles invalid delta (NaN)', async () => {
      jsonLogicService.evaluate.mockReturnValue(NaN);

      await handler.execute(
        { part_entity_ref: 'part1', delta: { var: 'invalid' } },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('delta'),
        })
      );
    });

    test('handles null params object', async () => {
      await handler.execute(null, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('params'),
        })
      );
      expect(em.hasComponent).not.toHaveBeenCalled();
    });

    test('handles exception during component update', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      const testError = new Error('Component update failed');
      em.addComponent.mockRejectedValue(testError);

      await handler.execute(
        { part_entity_ref: 'part1', delta: -10 },
        executionContext
      );

      expect(log.error).toHaveBeenCalledWith(
        'MODIFY_PART_HEALTH operation failed',
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

    test('handles missing delta parameter', async () => {
      await handler.execute({ part_entity_ref: 'part1' }, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('delta'),
        })
      );
    });

    test('handles JSON Logic evaluation failure for entity ref', async () => {
      jsonLogicService.evaluate.mockImplementation(() => {
        throw new Error('Evaluation failed');
      });

      await handler.execute(
        { part_entity_ref: { var: 'invalid' }, delta: -10 },
        executionContext
      );

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to evaluate part_entity_ref'),
        expect.any(Object)
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('part_entity_ref'),
        })
      );
    });

    test('handles JSON Logic evaluation failure for delta', async () => {
      // When part_entity_ref is a string, evaluate is NOT called for it
      // Only the delta (as an object) triggers evaluate
      jsonLogicService.evaluate.mockImplementation(() => {
        throw new Error('Delta evaluation failed');
      });

      await handler.execute(
        { part_entity_ref: 'part1', delta: { var: 'invalid' } },
        executionContext
      );

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to evaluate delta'),
        expect.any(Object)
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('delta'),
        })
      );
    });
  });

  // Execute Tests - Edge Cases
  describe('execute - edge cases', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ModifyPartHealthHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    test('handles zero delta (no change)', async () => {
      // Use 81% health which is at the 'healthy' threshold (>= 81%)
      const healthComponent = {
        currentHealth: 81,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 5,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: 0 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 81,
          state: 'healthy',
          turnsInState: 6, // Still increments because state unchanged
        })
      );
    });

    test('handles state boundary at exactly 76% (healthy threshold)', async () => {
      const healthComponent = {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Reduce to exactly 81% (threshold for healthy)
      await handler.execute(
        { part_entity_ref: 'part1', delta: -19 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 81,
          state: 'healthy', // 81% is still healthy
        })
      );
    });

    test('handles state boundary at exactly 80% (scratched threshold)', async () => {
      const healthComponent = {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      // Reduce to exactly 80% (below healthy threshold)
      await handler.execute(
        { part_entity_ref: 'part1', delta: -20 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          currentHealth: 80,
          state: 'scratched', // 80% is scratched (below 81%)
        })
      );
    });

    test('handles entity reference with leading/trailing whitespace', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: '  part1  ', delta: -10 },
        executionContext
      );

      // Should trim the whitespace
      expect(em.hasComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID
      );
    });

    test('handles missing turnsInState in existing component (defaults to 0)', async () => {
      const healthComponent = {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        // turnsInState intentionally missing
      };

      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_HEALTH_COMPONENT_ID;
      });
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(
        { part_entity_ref: 'part1', delta: 5 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({
          turnsInState: 1, // 0 + 1 when state unchanged
        })
      );
    });
  });
});
