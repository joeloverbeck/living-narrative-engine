/**
 * @file Integration tests for Damage Simulator workflow scenarios
 * @description Tests complete workflows: entity loading, damage configuration,
 * execution, display refresh, and history tracking.
 * @see DamageSimulatorUI.js - Main UI controller
 * @see DamageExecutionService.js - Damage execution service
 * @see DamageHistoryTracker.js - History tracking component
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import DamageExecutionService from '../../../src/domUI/damage-simulator/DamageExecutionService.js';
import DamageHistoryTracker from '../../../src/domUI/damage-simulator/DamageHistoryTracker.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

import {
  createMockLogger,
  createMockDispatcher,
  seedTestAnatomy,
  SAMPLE_DAMAGE_ENTRY,
  TEST_ENTITY_IDS,
  COMPONENT_IDS,
} from '../../common/damage-simulator/damageSimulatorTestFixtures.js';

describe('Damage Simulator Workflow', () => {
  /** @type {object} */
  let logger;
  /** @type {object} */
  let dispatcher;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {object} */
  let ids;
  /** @type {DamageExecutionService} */
  let executionService;
  /** @type {DamageHistoryTracker} */
  let historyTracker;
  /** @type {HTMLElement} */
  let container;
  /** @type {object} */
  let operationInterpreter;

  beforeEach(async () => {
    logger = createMockLogger();

    // Create a dispatcher that actually invokes subscribed callbacks
    // This is needed because DamageExecutionService subscribes to events
    // and expects callbacks to be invoked when dispatch is called
    // NOTE: Must handle both dispatch(eventType, payload) AND dispatch({ type, payload })
    // formats since DamageResolutionService uses the two-argument format
    const subscriptions = new Map();
    dispatcher = {
      dispatch: jest.fn().mockImplementation((eventTypeOrEvent, payload) => {
        let eventType, eventObject;
        if (typeof eventTypeOrEvent === 'string') {
          // Format: dispatch(eventType, payload)
          eventType = eventTypeOrEvent;
          eventObject = { type: eventType, payload: payload || {} };
        } else {
          // Format: dispatch({ type, payload })
          eventObject = eventTypeOrEvent;
          eventType = eventObject.type;
        }
        const callbacks = subscriptions.get(eventType) || [];
        callbacks.forEach((cb) => cb(eventObject));
        return Promise.resolve(true);
      }),
      subscribe: jest.fn().mockImplementation((eventType, callback) => {
        if (!subscriptions.has(eventType)) {
          subscriptions.set(eventType, []);
        }
        subscriptions.get(eventType).push(callback);
        // Return unsubscribe function
        return () => {
          const callbacks = subscriptions.get(eventType) || [];
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        };
      }),
      unsubscribe: jest.fn(),
    };

    entityManager = new SimpleEntityManager();
    ids = await seedTestAnatomy(entityManager);

    // Create DOM container for history tracker
    container = document.createElement('div');
    container.id = 'damage-history-container';
    document.body.appendChild(container);

    // Create operation interpreter mock that simulates damage application
    // and dispatches the expected anatomy:damage_applied event
    operationInterpreter = {
      execute: jest.fn().mockImplementation(async (operation, context) => {
        if (operation.type === 'APPLY_DAMAGE') {
          const partId = operation.parameters.part_ref;
          const damageEntry = operation.parameters.damage_entry;

          // Simulate successful damage application by dispatching event
          dispatcher.dispatch({
            type: 'anatomy:damage_applied',
            payload: {
              partId: partId,
              partType: 'torso',
              amount: damageEntry.amount,
              damageType: damageEntry.name,
              severity: 'medium',
            },
          });

          // Also simulate updating the entity health
          if (partId) {
            const healthComponent = await entityManager.getComponent(
              partId,
              COMPONENT_IDS.PART_HEALTH
            );
            if (healthComponent) {
              const newHealth = Math.max(
                0,
                healthComponent.currentHealth - damageEntry.amount
              );
              await entityManager.addComponent(
                partId,
                COMPONENT_IDS.PART_HEALTH,
                {
                  currentHealth: newHealth,
                  maxHealth: healthComponent.maxHealth,
                }
              );
            }
          }

          return { success: true };
        }
        return { success: false, error: 'Unknown operation' };
      }),
    };

    // Create DamageExecutionService with mocked operation interpreter
    executionService = new DamageExecutionService({
      operationInterpreter,
      entityManager,
      eventBus: dispatcher,
      logger,
    });

    // Create history tracker
    historyTracker = new DamageHistoryTracker({
      containerElement: container,
      eventBus: dispatcher,
      logger,
    });
  });

  afterEach(() => {
    // Cleanup DOM
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (historyTracker && typeof historyTracker.destroy === 'function') {
      historyTracker.destroy();
    }
    jest.clearAllMocks();
  });

  describe('Entity Loading', () => {
    it('should have seeded entity with anatomy components', async () => {
      // Verify the entity was seeded correctly
      const hasBody = await entityManager.hasComponent(
        ids.actor,
        COMPONENT_IDS.BODY
      );
      const hasTorsoPart = await entityManager.hasComponent(
        ids.torso,
        COMPONENT_IDS.PART
      );
      const hasTorsoHealth = await entityManager.hasComponent(
        ids.torso,
        COMPONENT_IDS.PART_HEALTH
      );

      expect(hasBody).toBe(true);
      expect(hasTorsoPart).toBe(true);
      expect(hasTorsoHealth).toBe(true);
    });

    it('should have multiple body parts with health', async () => {
      const partsWithHealth = [ids.torso, ids.head, ids.leftArm, ids.rightArm];

      for (const partId of partsWithHealth) {
        const healthComponent = await entityManager.getComponent(
          partId,
          COMPONENT_IDS.PART_HEALTH
        );
        expect(healthComponent).toBeDefined();
        expect(healthComponent.currentHealth).toBeGreaterThan(0);
        expect(healthComponent.maxHealth).toBeGreaterThan(0);
      }
    });
  });

  describe('Damage Application Flow', () => {
    it('should apply damage to entity and dispatch execution events', async () => {
      // Act
      const result = await executionService.applyDamage({
        entityId: ids.actor,
        damageEntry: SAMPLE_DAMAGE_ENTRY,
        targetPartId: ids.torso,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(dispatcher.dispatch).toHaveBeenCalled();

      // Check that execution events were dispatched
      const dispatchCalls = dispatcher.dispatch.mock.calls;
      const executionEvents = dispatchCalls.filter(
        (call) =>
          call[0]?.type?.includes('damage-simulator:execution') ||
          call[0]?.type?.includes('anatomy:damage')
      );
      expect(executionEvents.length).toBeGreaterThan(0);
    });

    it('should reduce health after damage application', async () => {
      // Arrange
      const initialHealth = await entityManager.getComponent(
        ids.torso,
        COMPONENT_IDS.PART_HEALTH
      );
      const initialCurrent = initialHealth.currentHealth;

      // Act
      await executionService.applyDamage({
        entityId: ids.actor,
        damageEntry: SAMPLE_DAMAGE_ENTRY,
        targetPartId: ids.torso,
      });

      // Assert
      const updatedHealth = await entityManager.getComponent(
        ids.torso,
        COMPONENT_IDS.PART_HEALTH
      );
      expect(updatedHealth.currentHealth).toBeLessThan(initialCurrent);
    });

    it('should handle multiple damage applications', async () => {
      // Arrange
      const initialHealth = await entityManager.getComponent(
        ids.head,
        COMPONENT_IDS.PART_HEALTH
      );
      const initialCurrent = initialHealth.currentHealth;

      // Act - apply damage multiple times
      await executionService.applyDamage({
        entityId: ids.actor,
        damageEntry: SAMPLE_DAMAGE_ENTRY,
        targetPartId: ids.head,
      });
      await executionService.applyDamage({
        entityId: ids.actor,
        damageEntry: SAMPLE_DAMAGE_ENTRY,
        targetPartId: ids.head,
      });

      // Assert
      const updatedHealth = await entityManager.getComponent(
        ids.head,
        COMPONENT_IDS.PART_HEALTH
      );
      expect(updatedHealth.currentHealth).toBeLessThan(initialCurrent);
    });

    it('should capture results from damage applied events', async () => {
      // Act
      const result = await executionService.applyDamage({
        entityId: ids.actor,
        damageEntry: SAMPLE_DAMAGE_ENTRY,
        targetPartId: ids.torso,
      });

      // Assert - results should be captured from damage_applied events
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].damageDealt).toBe(SAMPLE_DAMAGE_ENTRY.amount);
    });
  });

  describe('History Tracking', () => {
    it('should record damage in history', async () => {
      // Arrange - clear initial state
      historyTracker.clearHistory();
      expect(historyTracker.getEntries().length).toBe(0);

      // Act - record an entry manually (simulating event)
      historyTracker.record({
        targetPartId: ids.torso,
        targetPartName: 'Torso',
        damageDealt: 15,
        damageType: 'slashing',
        severity: 'medium',
        success: true,
      });

      // Assert
      const entries = historyTracker.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].targetPartName).toBe('Torso');
      expect(entries[0].damageDealt).toBe(15);
    });

    it('should track statistics across multiple entries', async () => {
      // Arrange
      historyTracker.clearHistory();

      // Act - record multiple entries
      historyTracker.record({
        targetPartId: ids.torso,
        targetPartName: 'Torso',
        damageDealt: 10,
        damageType: 'slashing',
        severity: 'light',
        success: true,
      });
      historyTracker.record({
        targetPartId: ids.head,
        targetPartName: 'Head',
        damageDealt: 25,
        damageType: 'crushing',
        severity: 'serious',
        success: true,
      });
      historyTracker.record({
        targetPartId: ids.torso,
        targetPartName: 'Torso',
        damageDealt: 15,
        damageType: 'slashing',
        severity: 'medium',
        success: true,
      });

      // Assert - API uses hitCount not totalEntries
      const stats = historyTracker.getStatistics();
      expect(stats.hitCount).toBe(3);
      expect(stats.totalDamage).toBe(50); // 10 + 25 + 15
    });

    it('should clear history on entity change', () => {
      // Arrange - add some entries
      historyTracker.record({
        targetPartId: ids.torso,
        targetPartName: 'Torso',
        damageDealt: 10,
        damageType: 'slashing',
        severity: 'light',
        success: true,
      });
      expect(historyTracker.getEntries().length).toBe(1);

      // Act - clear history (simulating entity change)
      historyTracker.clearHistory();

      // Assert
      expect(historyTracker.getEntries().length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle operation execution errors gracefully', async () => {
      // Arrange - create interpreter that throws
      const failingInterpreter = {
        execute: jest.fn().mockRejectedValue(new Error('Test error')),
      };
      const failingService = new DamageExecutionService({
        operationInterpreter: failingInterpreter,
        entityManager,
        eventBus: dispatcher,
        logger,
      });

      // Act
      const result = await failingService.applyDamage({
        entityId: ids.actor,
        damageEntry: SAMPLE_DAMAGE_ENTRY,
        targetPartId: ids.torso,
      });

      // Assert - should not throw, should return error result
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should dispatch error events on failure', async () => {
      // Arrange - create interpreter that throws
      const failingInterpreter = {
        execute: jest.fn().mockRejectedValue(new Error('Test error')),
      };
      const failingService = new DamageExecutionService({
        operationInterpreter: failingInterpreter,
        entityManager,
        eventBus: dispatcher,
        logger,
      });

      // Act
      await failingService.applyDamage({
        entityId: ids.actor,
        damageEntry: SAMPLE_DAMAGE_ENTRY,
        targetPartId: ids.torso,
      });

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalled();
      // Error events should be dispatched
      const dispatchCalls = dispatcher.dispatch.mock.calls;
      const errorEvents = dispatchCalls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('error')
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should still dispatch started event even when execution fails', async () => {
      // Arrange - create interpreter that throws
      const failingInterpreter = {
        execute: jest.fn().mockRejectedValue(new Error('Test error')),
      };
      const failingService = new DamageExecutionService({
        operationInterpreter: failingInterpreter,
        entityManager,
        eventBus: dispatcher,
        logger,
      });

      // Act
      await failingService.applyDamage({
        entityId: ids.actor,
        damageEntry: SAMPLE_DAMAGE_ENTRY,
        targetPartId: ids.torso,
      });

      // Assert - should have started event
      const dispatchCalls = dispatcher.dispatch.mock.calls;
      const startedEvents = dispatchCalls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('started')
      );
      expect(startedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state across damage applications', async () => {
      // Arrange
      const partIds = [ids.torso, ids.head, ids.leftArm, ids.rightArm];
      const initialHealths = {};

      for (const partId of partIds) {
        const health = await entityManager.getComponent(
          partId,
          COMPONENT_IDS.PART_HEALTH
        );
        initialHealths[partId] = health.currentHealth;
      }

      // Act - apply damage to each part
      for (const partId of partIds) {
        await executionService.applyDamage({
          entityId: ids.actor,
          damageEntry: { amount: 5, name: 'slashing', penetration: 0 },
          targetPartId: partId,
        });
      }

      // Assert - all parts should have reduced health
      for (const partId of partIds) {
        const updatedHealth = await entityManager.getComponent(
          partId,
          COMPONENT_IDS.PART_HEALTH
        );
        expect(updatedHealth.currentHealth).toBeLessThan(initialHealths[partId]);
      }
    });

    it('should execute operations in sequence', async () => {
      // Arrange
      const operationOrder = [];
      const trackingInterpreter = {
        execute: jest.fn().mockImplementation(async (operation, context) => {
          operationOrder.push(operation.parameters.part_ref);
          dispatcher.dispatch({
            type: 'anatomy:damage_applied',
            payload: {
              partId: operation.parameters.part_ref,
              amount: 5,
              damageType: 'slashing',
              severity: 'light',
            },
          });
          return { success: true };
        }),
      };
      const trackingService = new DamageExecutionService({
        operationInterpreter: trackingInterpreter,
        entityManager,
        eventBus: dispatcher,
        logger,
      });

      // Act - apply damage to parts in specific order
      await trackingService.applyDamage({
        entityId: ids.actor,
        damageEntry: { amount: 5, name: 'slashing', penetration: 0 },
        targetPartId: ids.torso,
      });
      await trackingService.applyDamage({
        entityId: ids.actor,
        damageEntry: { amount: 5, name: 'slashing', penetration: 0 },
        targetPartId: ids.head,
      });
      await trackingService.applyDamage({
        entityId: ids.actor,
        damageEntry: { amount: 5, name: 'slashing', penetration: 0 },
        targetPartId: ids.leftArm,
      });

      // Assert - operations should have been executed in order
      expect(operationOrder).toEqual([ids.torso, ids.head, ids.leftArm]);
    });
  });
});
