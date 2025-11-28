/**
 * @file Integration tests for health state transitions
 * @description Tests all possible state transitions and event correctness
 * @see tickets/PERPARHEAANDNARTHR-012-integration-tests.md
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';

// Core system components
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

// Handlers under test
import ModifyPartHealthHandler from '../../../../src/logic/operationHandlers/modifyPartHealthHandler.js';
import UpdatePartHealthStateHandler from '../../../../src/logic/operationHandlers/updatePartHealthStateHandler.js';

// Test utilities
import { SimpleEntityManager } from '../../../common/entities/index.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */

const PART_HEALTH_COMPONENT = 'anatomy:part_health';
const PART_COMPONENT = 'anatomy:part';
const PART_HEALTH_CHANGED_EVENT = 'anatomy:part_health_changed';
const PART_STATE_CHANGED_EVENT = 'anatomy:part_state_changed';

describe('Part Health State Transitions - Integration Tests', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {OperationRegistry} */
  let operationRegistry;
  /** @type {JsonLogicEvaluationService} */
  let jsonLogicService;
  /** @type {ModifyPartHealthHandler} */
  let modifyHandler;
  /** @type {UpdatePartHealthStateHandler} */
  let updateHandler;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {{ dispatch: jest.Mock }} */
  let mockDispatcher;
  /** @type {object} */
  let executionContext;

  const PART_ENTITY_ID = 'part_arm_001';
  const OWNER_ENTITY_ID = 'character_001';

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    entityManager = new SimpleEntityManager();
    operationRegistry = new OperationRegistry({ logger: mockLogger });
    jsonLogicService = new JsonLogicEvaluationService({ logger: mockLogger });

    modifyHandler = new ModifyPartHealthHandler({
      logger: mockLogger,
      entityManager,
      safeEventDispatcher: mockDispatcher,
      jsonLogicService,
    });

    updateHandler = new UpdatePartHealthStateHandler({
      logger: mockLogger,
      entityManager,
      safeEventDispatcher: mockDispatcher,
    });

    operationRegistry.register(
      'MODIFY_PART_HEALTH',
      modifyHandler.execute.bind(modifyHandler)
    );
    operationRegistry.register(
      'UPDATE_PART_HEALTH_STATE',
      updateHandler.execute.bind(updateHandler)
    );

    executionContext = {
      evaluationContext: {
        actor: { id: OWNER_ENTITY_ID },
        context: {},
      },
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to create a body part entity with health component
   *
   * @param partId
   * @param root0
   * @param root0.currentHealth
   * @param root0.maxHealth
   * @param root0.state
   * @param root0.turnsInState
   * @param root0.subType
   * @param root0.ownerEntityId
   */
  function createPartWithHealth(
    partId,
    {
      currentHealth = 100,
      maxHealth = 100,
      state = 'healthy',
      turnsInState = 0,
      subType = 'arm',
      ownerEntityId = OWNER_ENTITY_ID,
    } = {}
  ) {
    entityManager.addComponent(partId, PART_COMPONENT, {
      subType,
      ownerEntityId,
    });
    entityManager.addComponent(partId, PART_HEALTH_COMPONENT, {
      currentHealth,
      maxHealth,
      state,
      turnsInState,
    });
  }

  /**
   * Helper to get state_changed events from mock dispatcher
   */
  function getStateChangedEvents() {
    return mockDispatcher.dispatch.mock.calls
      .filter((call) => call[0] === PART_STATE_CHANGED_EVENT)
      .map((call) => call[1]);
  }

  /**
   * Helper to get health_changed events from mock dispatcher
   */
  function getHealthChangedEvents() {
    return mockDispatcher.dispatch.mock.calls
      .filter((call) => call[0] === PART_HEALTH_CHANGED_EVENT)
      .map((call) => call[1]);
  }

  describe('Deterioration (damage)', () => {
    test('should transition healthy -> bruised', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 5,
      });

      // Damage from 80% to 70% (crosses 75% threshold)
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -10 },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('bruised');
      expect(healthData.turnsInState).toBe(0);

      // MODIFY_PART_HEALTH includes state info in health_changed event
      const healthEvents = getHealthChangedEvents();
      expect(healthEvents).toHaveLength(1);
      expect(healthEvents[0]).toMatchObject({
        previousState: 'healthy',
        newState: 'bruised',
      });
    });

    test('should transition healthy -> wounded (skipping bruised)', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 3,
      });

      // Massive damage from 80% to 40% (skips bruised)
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -40 },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('wounded');

      // State transition is captured in health_changed event
      const healthEvents = getHealthChangedEvents();
      expect(healthEvents).toHaveLength(1);
      expect(healthEvents[0]).toMatchObject({
        previousState: 'healthy',
        newState: 'wounded',
      });
    });

    test('should transition through all states to destroyed', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      });

      const transitions = [
        { delta: -30, expectedState: 'bruised', from: 'healthy' }, // 100 -> 70
        { delta: -20, expectedState: 'wounded', from: 'bruised' }, // 70 -> 50
        { delta: -25, expectedState: 'badly_damaged', from: 'wounded' }, // 50 -> 25
        { delta: -25, expectedState: 'destroyed', from: 'badly_damaged' }, // 25 -> 0
      ];

      for (const transition of transitions) {
        mockDispatcher.dispatch.mockClear();

        await modifyHandler.execute(
          { part_entity_ref: PART_ENTITY_ID, delta: transition.delta },
          executionContext
        );

        const healthData = entityManager.getComponentData(
          PART_ENTITY_ID,
          PART_HEALTH_COMPONENT
        );
        expect(healthData.state).toBe(transition.expectedState);

        // State transition is captured in health_changed event
        const healthEvents = getHealthChangedEvents();
        expect(healthEvents).toHaveLength(1);
        expect(healthEvents[0]).toMatchObject({
          previousState: transition.from,
          newState: transition.expectedState,
        });
      }
    });
  });

  describe('Recovery (healing)', () => {
    test('should transition bruised -> healthy', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 70,
        maxHealth: 100,
        state: 'bruised',
        turnsInState: 2,
      });

      // Heal from 70% to 80%
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: +10 },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('healthy');
      expect(healthData.turnsInState).toBe(0);

      // MODIFY_PART_HEALTH includes state info in health_changed event
      const healthEvents = getHealthChangedEvents();
      expect(healthEvents).toHaveLength(1);
      expect(healthEvents[0]).toMatchObject({
        previousState: 'bruised',
        newState: 'healthy',
      });
    });

    test('should transition destroyed -> badly_damaged', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 0,
        maxHealth: 100,
        state: 'destroyed',
        turnsInState: 5,
      });

      // Heal from 0% to 10%
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: +10 },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('badly_damaged');

      // MODIFY_PART_HEALTH includes state info in health_changed event
      const healthEvents = getHealthChangedEvents();
      expect(healthEvents).toHaveLength(1);
      expect(healthEvents[0]).toMatchObject({
        previousState: 'destroyed',
        newState: 'badly_damaged',
      });
    });

    test('should transition from destroyed to healthy with full heal', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 0,
        maxHealth: 100,
        state: 'destroyed',
        turnsInState: 10,
      });

      // Full heal from 0% to 100%
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: +100 },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('healthy');
      expect(healthData.currentHealth).toBe(100);

      // MODIFY_PART_HEALTH includes state info in health_changed event
      const healthEvents = getHealthChangedEvents();
      expect(healthEvents).toHaveLength(1);
      expect(healthEvents[0]).toMatchObject({
        previousState: 'destroyed',
        newState: 'healthy',
      });
    });
  });

  describe('Event payload validation', () => {
    test('should include all required fields in part_health_changed event', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      });

      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -10 },
        executionContext
      );

      const healthEvents = getHealthChangedEvents();
      expect(healthEvents).toHaveLength(1);

      const event = healthEvents[0];
      // Verify all required fields
      expect(event).toHaveProperty('partEntityId', PART_ENTITY_ID);
      expect(event).toHaveProperty('ownerEntityId', OWNER_ENTITY_ID);
      expect(event).toHaveProperty('partType', 'arm');
      expect(event).toHaveProperty('previousHealth', 80);
      expect(event).toHaveProperty('newHealth', 70);
      expect(event).toHaveProperty('maxHealth', 100);
      expect(event).toHaveProperty('healthPercentage');
      expect(event.healthPercentage).toBe(70);
      expect(event).toHaveProperty('delta', -10);
      expect(event).toHaveProperty('timestamp');
      expect(typeof event.timestamp).toBe('number');
    });

    test('should include all required fields in part_state_changed event', async () => {
      // Part has health that indicates bruised state (70%) but is labeled healthy
      // UPDATE_PART_HEALTH_STATE will recalculate and dispatch state_changed
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 70,
        maxHealth: 100,
        state: 'healthy', // Wrong state, should be bruised
        turnsInState: 3,
      });

      // Trigger state recalculation via UPDATE_PART_HEALTH_STATE
      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      const stateEvents = getStateChangedEvents();
      expect(stateEvents).toHaveLength(1);

      const event = stateEvents[0];
      // Verify all required fields
      expect(event).toHaveProperty('partEntityId', PART_ENTITY_ID);
      expect(event).toHaveProperty('ownerEntityId', OWNER_ENTITY_ID);
      expect(event).toHaveProperty('partType', 'arm');
      expect(event).toHaveProperty('previousState', 'healthy');
      expect(event).toHaveProperty('newState', 'bruised');
      expect(event).toHaveProperty('turnsInPreviousState', 3);
      expect(event).toHaveProperty('healthPercentage');
      expect(event.healthPercentage).toBe(70);
      expect(event).toHaveProperty('isDeterioration', true);
      expect(event).toHaveProperty('timestamp');
      expect(typeof event.timestamp).toBe('number');
    });

    test('should NOT dispatch state_changed when state unchanged', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 90,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      });

      // Small damage that doesn't cross threshold (90 -> 85, still healthy)
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -5 },
        executionContext
      );

      // Verify health_changed WAS dispatched
      const healthEvents = getHealthChangedEvents();
      expect(healthEvents).toHaveLength(1);

      // Verify state_changed was NOT dispatched
      const stateEvents = getStateChangedEvents();
      expect(stateEvents).toHaveLength(0);

      // Verify state is still healthy
      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('healthy');
    });
  });

  describe('Boundary precision', () => {
    test('health at 76% should be healthy', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 76,
        maxHealth: 100,
        state: 'bruised', // Start with wrong state
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('healthy');
    });

    test('health at 75% should be bruised', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 75,
        maxHealth: 100,
        state: 'healthy', // Start with wrong state
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('bruised');
    });

    test('health at 51% should be bruised', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 51,
        maxHealth: 100,
        state: 'wounded', // Start with wrong state
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('bruised');
    });

    test('health at 50% should be wounded', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 50,
        maxHealth: 100,
        state: 'bruised', // Start with wrong state
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('wounded');
    });

    test('health at 26% should be wounded', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 26,
        maxHealth: 100,
        state: 'badly_damaged', // Start with wrong state
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('wounded');
    });

    test('health at 25% should be badly_damaged', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 25,
        maxHealth: 100,
        state: 'wounded', // Start with wrong state
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('badly_damaged');
    });

    test('health at 1% should be badly_damaged', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 1,
        maxHealth: 100,
        state: 'destroyed', // Start with wrong state
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('badly_damaged');
    });

    test('health at 0% should be destroyed', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 0,
        maxHealth: 100,
        state: 'badly_damaged', // Start with wrong state
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('destroyed');
    });
  });

  describe('Error handling', () => {
    test('should handle operation on non-existent entity gracefully', async () => {
      // Don't create the entity
      await modifyHandler.execute(
        { part_entity_ref: 'nonexistent_entity', delta: -10 },
        executionContext
      );

      // Should log warning and not throw
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should handle operation on entity without part_health component gracefully', async () => {
      // Create entity without health component
      entityManager.addComponent(PART_ENTITY_ID, PART_COMPONENT, {
        subType: 'arm',
        ownerEntityId: OWNER_ENTITY_ID,
      });

      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -10 },
        executionContext
      );

      // Should log warning and not throw
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
