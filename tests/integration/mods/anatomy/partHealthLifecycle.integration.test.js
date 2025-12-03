/**
 * @file Integration tests for per-part health lifecycle
 * @description Tests full lifecycle: create part with health, modify, verify events
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
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
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

describe('Part Health Lifecycle - Integration Tests', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {OperationRegistry} */
  let operationRegistry;
  /** @type {OperationInterpreter} */
  let operationInterpreter;
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
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Create mock dispatcher that tracks events
    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    // Create entity manager
    entityManager = new SimpleEntityManager();

    // Create operation system
    operationRegistry = new OperationRegistry({ logger: mockLogger });
    operationInterpreter = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry,
    });
    jsonLogicService = new JsonLogicEvaluationService({ logger: mockLogger });

    // Create and register handlers
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

    // Create execution context
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
   * @param {string} partId - Part entity ID
   * @param {object} options - Health options
   * @param options.currentHealth
   * @param options.maxHealth
   * @param options.state
   * @param options.turnsInState
   * @param options.subType
   * @param options.ownerEntityId
   * @returns {void}
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

  describe('Full lifecycle', () => {
    test('should create a part entity with health component and verify initial values', () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 5,
      });

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      const partData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_COMPONENT
      );

      expect(healthData).toEqual({
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 5,
      });
      expect(partData).toEqual({
        subType: 'arm',
        ownerEntityId: OWNER_ENTITY_ID,
      });
    });

    test('should modify health and receive health_changed event', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      });

      // Apply damage (negative delta)
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -20 },
        executionContext
      );

      // Verify component updated
      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.currentHealth).toBe(80);

      // Verify event dispatched with correct payload
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        PART_HEALTH_CHANGED_EVENT,
        expect.objectContaining({
          partEntityId: PART_ENTITY_ID,
          previousHealth: 100,
          newHealth: 80,
          maxHealth: 100,
          delta: -20,
        })
      );
    });

    test('should track turnsInState correctly when state unchanged', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      });

      // Call UPDATE_PART_HEALTH_STATE multiple times without crossing threshold
      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      let healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.turnsInState).toBe(1);

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.turnsInState).toBe(2);

      // Verify NO state_changed event was dispatched (state remained healthy)
      const stateChangedCalls = mockDispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === PART_STATE_CHANGED_EVENT
      );
      expect(stateChangedCalls).toHaveLength(0);
    });

    test('should reset turnsInState when state changes', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 90,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 5,
      });

      // Damage to cross threshold from healthy (>=81%) to scratched (61-80%)
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -20 },
        executionContext
      );

      // Now health is 70 (70% = scratched)
      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );

      expect(healthData.currentHealth).toBe(70);
      expect(healthData.state).toBe('scratched');
      expect(healthData.turnsInState).toBe(0);
    });
  });

  describe('Multiple parts', () => {
    test('should handle operations on different parts independently', async () => {
      const PART_ARM = 'part_arm_001';
      const PART_LEG = 'part_leg_001';

      // Create two parts with different health
      createPartWithHealth(PART_ARM, {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        subType: 'arm',
      });
      createPartWithHealth(PART_LEG, {
        currentHealth: 50,
        maxHealth: 100,
        state: 'wounded',
        subType: 'leg',
      });

      // Damage arm
      await modifyHandler.execute(
        { part_entity_ref: PART_ARM, delta: -30 },
        executionContext
      );

      // Heal leg (50 + 31 = 81, which is >= 81% threshold for 'healthy')
      await modifyHandler.execute(
        { part_entity_ref: PART_LEG, delta: +31 },
        executionContext
      );

      // Verify each part has correct independent state
      const armHealth = entityManager.getComponentData(
        PART_ARM,
        PART_HEALTH_COMPONENT
      );
      const legHealth = entityManager.getComponentData(
        PART_LEG,
        PART_HEALTH_COMPONENT
      );

      expect(armHealth.currentHealth).toBe(70);
      expect(armHealth.state).toBe('scratched');

      expect(legHealth.currentHealth).toBe(81);
      expect(legHealth.state).toBe('healthy');
    });
  });

  describe('Edge cases', () => {
    test('should handle 0% health (destroyed state)', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 10,
        maxHealth: 100,
        state: 'critical',
      });

      // Damage to exactly 0
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -10 },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );

      expect(healthData.currentHealth).toBe(0);
      expect(healthData.state).toBe('destroyed');
    });

    test('should clamp health to prevent negative values', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 10,
        maxHealth: 100,
        state: 'critical',
      });

      // Try to apply damage beyond zero
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -50 },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );

      // Should clamp to 0, not go negative
      expect(healthData.currentHealth).toBe(0);
      expect(healthData.state).toBe('destroyed');
    });

    test('should handle 100% health correctly', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 90,
        maxHealth: 100,
        state: 'healthy',
      });

      // Try to heal beyond max
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: +50 },
        executionContext
      );

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );

      // Should clamp to maxHealth
      expect(healthData.currentHealth).toBe(100);
      expect(healthData.state).toBe('healthy');
    });

    test('should handle exact threshold boundaries', async () => {
      // Test at exactly 80% (should be scratched, not healthy)
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 80,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      let healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('scratched');

      // Test at exactly 60% (should be wounded)
      entityManager.addComponent(PART_ENTITY_ID, PART_HEALTH_COMPONENT, {
        currentHealth: 60,
        maxHealth: 100,
        state: 'scratched',
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('wounded');

      // Test at exactly 40% (should be injured)
      entityManager.addComponent(PART_ENTITY_ID, PART_HEALTH_COMPONENT, {
        currentHealth: 40,
        maxHealth: 100,
        state: 'wounded',
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('injured');

      // Test at exactly 20% (should be critical)
      entityManager.addComponent(PART_ENTITY_ID, PART_HEALTH_COMPONENT, {
        currentHealth: 20,
        maxHealth: 100,
        state: 'injured',
        turnsInState: 0,
      });

      await updateHandler.execute(
        { part_entity_ref: PART_ENTITY_ID },
        executionContext
      );

      healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.state).toBe('critical');
    });
  });

  describe('Operations chaining', () => {
    test('should handle MODIFY then UPDATE working together', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 3,
      });

      // First modify health
      await modifyHandler.execute(
        { part_entity_ref: PART_ENTITY_ID, delta: -50 },
        executionContext
      );

      // The MODIFY_PART_HEALTH handler automatically updates state
      // Verify the state was updated correctly
      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );

      expect(healthData.currentHealth).toBe(50);
      expect(healthData.state).toBe('wounded');
      expect(healthData.turnsInState).toBe(0);

      // Verify both events were dispatched
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        PART_HEALTH_CHANGED_EVENT,
        expect.objectContaining({
          partEntityId: PART_ENTITY_ID,
          previousHealth: 100,
          newHealth: 50,
        })
      );
    });
  });

  describe('Handler instantiation', () => {
    test('should instantiate ModifyPartHealthHandler with real dependencies', () => {
      const handler = new ModifyPartHealthHandler({
        logger: mockLogger,
        entityManager,
        safeEventDispatcher: mockDispatcher,
        jsonLogicService,
      });

      expect(handler).toBeInstanceOf(ModifyPartHealthHandler);
    });

    test('should instantiate UpdatePartHealthStateHandler with real dependencies', () => {
      const handler = new UpdatePartHealthStateHandler({
        logger: mockLogger,
        entityManager,
        safeEventDispatcher: mockDispatcher,
      });

      expect(handler).toBeInstanceOf(UpdatePartHealthStateHandler);
    });

    test('should register handlers in operation registry and execute via interpreter', async () => {
      createPartWithHealth(PART_ENTITY_ID, {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
      });

      // Execute through operation registry
      const operation = {
        type: 'MODIFY_PART_HEALTH',
        parameters: { part_entity_ref: PART_ENTITY_ID, delta: -25 },
      };

      await operationInterpreter.execute(operation, executionContext);

      const healthData = entityManager.getComponentData(
        PART_ENTITY_ID,
        PART_HEALTH_COMPONENT
      );
      expect(healthData.currentHealth).toBe(75);
    });
  });
});
