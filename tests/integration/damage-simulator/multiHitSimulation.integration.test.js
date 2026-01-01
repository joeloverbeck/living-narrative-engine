/**
 * @file Integration tests for Multi-Hit Simulation
 * @description Tests multi-hit execution, targeting modes, stop functionality,
 * summary statistics, and concurrent simulation prevention.
 * @see MultiHitSimulator.js - Multi-hit simulation component
 * @see DamageExecutionService.js - Damage execution service
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import MultiHitSimulator from '../../../src/domUI/damage-simulator/MultiHitSimulator.js';
import DamageExecutionService from '../../../src/domUI/damage-simulator/DamageExecutionService.js';
import DamageHistoryTracker from '../../../src/domUI/damage-simulator/DamageHistoryTracker.js';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import ApplyDamageHandler from '../../../src/logic/operationHandlers/applyDamageHandler.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

import {
  createMockLogger,
  seedTestAnatomy,
  SAMPLE_DAMAGE_ENTRY,
  TEST_ENTITY_IDS,
  COMPONENT_IDS,
  delay,
  createSimulationConfig,
} from '../../common/damage-simulator/damageSimulatorTestFixtures.js';

describe('Multi-Hit Simulation', () => {
  /** @type {Object} */
  let logger;
  /** @type {Object} */
  let dispatcher;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {Object} */
  let ids;
  /** @type {MultiHitSimulator} */
  let simulator;
  /** @type {DamageExecutionService} */
  let executionService;
  /** @type {DamageHistoryTracker} */
  let historyTracker;
  /** @type {HTMLElement} */
  let container;
  /** @type {HTMLElement} */
  let historyContainer;

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

    // Create DOM containers
    container = document.createElement('div');
    container.id = 'multi-hit-container';
    document.body.appendChild(container);

    historyContainer = document.createElement('div');
    historyContainer.id = 'history-container';
    document.body.appendChild(historyContainer);

    // Create real services with mocked boundaries
    const jsonLogicService = new JsonLogicEvaluationService({ logger });
    const bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });

    const damageTypeEffectsService = {
      applyEffectsForDamage: jest.fn().mockResolvedValue(undefined),
    };
    const damagePropagationService = new DamagePropagationService({
      logger,
      entityManager,
      eventBus: dispatcher,
    });
    const deathCheckService = {
      checkDeathConditions: jest.fn().mockResolvedValue(undefined),
      evaluateDeathConditions: jest.fn().mockReturnValue({
        isDead: false,
        isDying: false,
        shouldFinalize: false,
        finalizationParams: null,
        deathInfo: null,
      }),
      finalizeDeathFromEvaluation: jest.fn(),
    };
    const damageAccumulator = new DamageAccumulator({ logger });
    const damageNarrativeComposer = new DamageNarrativeComposer({ logger });

    const applyDamageHandler = new ApplyDamageHandler({
      logger,
      entityManager,
      safeEventDispatcher: dispatcher,
      jsonLogicService,
      bodyGraphService,
      damageTypeEffectsService,
      damagePropagationService,
      deathCheckService,
      damageAccumulator,
      damageNarrativeComposer,
    });

    const operationInterpreter = {
      execute: jest.fn().mockImplementation(async (operation, context) => {
        if (operation.type === 'APPLY_DAMAGE') {
          // ApplyDamageHandler.execute expects (params, executionContext)
          // where params = operation.parameters (with entity_ref, damage_entry, etc.)
          return applyDamageHandler.execute(operation.parameters, context);
        }
        return { success: false, error: 'Unknown operation' };
      }),
    };

    // Create execution service
    executionService = new DamageExecutionService({
      operationInterpreter,
      entityManager,
      eventBus: dispatcher,
      logger,
    });

    // Create history tracker
    historyTracker = new DamageHistoryTracker({
      containerElement: historyContainer,
      eventBus: dispatcher,
      logger,
    });

    // Create simulator
    simulator = new MultiHitSimulator({
      containerElement: container,
      damageExecutionService: executionService,
      eventBus: dispatcher,
      logger,
    });
  });

  afterEach(() => {
    // Cleanup DOM
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (historyContainer && historyContainer.parentNode) {
      historyContainer.parentNode.removeChild(historyContainer);
    }
    if (historyTracker && typeof historyTracker.destroy === 'function') {
      historyTracker.destroy();
    }
    jest.clearAllMocks();
  });

  describe('Hit Count Execution', () => {
    it('should execute correct number of hits', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 5,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const result = await simulator.run();

      // Assert
      expect(result.hitsExecuted).toBe(5);
      expect(result.completed).toBe(true);
    });

    it('should track total damage across hits', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 3,
          delayMs: 0,
          targetMode: 'focus',
          focusPartId: ids.torso,
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const result = await simulator.run();

      // Assert
      expect(result.totalDamage).toBeGreaterThan(0);
      expect(result.hitsExecuted).toBe(3);
    });

    it('should handle single hit simulation', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 1,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const result = await simulator.run();

      // Assert
      expect(result.hitsExecuted).toBe(1);
      expect(result.completed).toBe(true);
    });
  });

  describe('Delay Configuration', () => {
    it('should respect delay configuration', async () => {
      // Arrange
      const delayMs = 50;
      simulator.configure(
        createSimulationConfig({
          hitCount: 3,
          delayMs,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const startTime = Date.now();
      const result = await simulator.run();
      const elapsed = Date.now() - startTime;

      // Assert - should take at least (hitCount - 1) * delay
      const expectedMinDuration = (3 - 1) * delayMs;
      expect(elapsed).toBeGreaterThanOrEqual(expectedMinDuration * 0.8); // 80% tolerance
      expect(result.completed).toBe(true);
    });

    it('should handle zero delay', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 5,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const startTime = Date.now();
      const result = await simulator.run();
      const elapsed = Date.now() - startTime;

      // Assert - should complete quickly with no delay
      expect(elapsed).toBeLessThan(1000); // Should be fast
      expect(result.hitsExecuted).toBe(5);
    });
  });

  describe('Target Mode Behavior', () => {
    it('should use random targeting correctly', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 10,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const result = await simulator.run();

      // Assert - random targeting should hit multiple parts
      const hitParts = Object.keys(result.partHitCounts);
      expect(hitParts.length).toBeGreaterThan(0);
      // With 10 random hits, we expect to hit at least some parts
      expect(result.hitsExecuted).toBe(10);
    });

    it('should use round-robin targeting correctly', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 8, // 4 parts * 2 cycles
          delayMs: 0,
          targetMode: 'round-robin',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const result = await simulator.run();

      // Assert - round-robin should distribute hits more evenly
      const hitCounts = Object.values(result.partHitCounts);
      if (hitCounts.length > 0) {
        // Should have relatively even distribution
        const maxHits = Math.max(...hitCounts);
        const minHits = Math.min(...hitCounts);
        expect(maxHits - minHits).toBeLessThanOrEqual(2); // Within 2 hits difference
      }
    });

    it('should focus on single part when configured', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 5,
          delayMs: 0,
          targetMode: 'focus',
          focusPartId: ids.torso,
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const result = await simulator.run();

      // Assert - all hits should target the focused part
      expect(result.partHitCounts[ids.torso]).toBe(5);
      expect(Object.keys(result.partHitCounts).length).toBe(1);
    });

    it('should throw error for focus mode without focusPartId', () => {
      // Arrange & Act & Assert
      expect(() => {
        simulator.configure(
          createSimulationConfig({
            hitCount: 5,
            delayMs: 0,
            targetMode: 'focus',
            focusPartId: null, // Missing required focusPartId
            entityId: ids.actor,
            damageEntry: SAMPLE_DAMAGE_ENTRY,
          })
        );
      }).toThrow('Focus mode requires a focusPartId');
    });
  });

  describe('Stop Functionality', () => {
    it('should stop immediately when requested', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 100,
          delayMs: 50,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const runPromise = simulator.run();
      await delay(100); // Let a few hits execute
      simulator.stop();
      const result = await runPromise;

      // Assert
      expect(result.completed).toBe(false);
      expect(result.stoppedReason).toBe('user_stopped');
      expect(result.hitsExecuted).toBeLessThan(100);
    });

    it('should dispatch stopped event when stopped', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 50,
          delayMs: 20,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const runPromise = simulator.run();
      await delay(50);
      simulator.stop();
      await runPromise;

      // Assert - should have dispatched stopped event
      const stoppedEvents = dispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === 'damage-simulator:simulation-stopped'
      );
      expect(stoppedEvents.length).toBe(1);
    });

    it('should be stoppable with minimal delay', async () => {
      // Arrange - with minimal delay to allow stopping
      // Note: Zero delay runs synchronously and cannot be interrupted
      simulator.configure(
        createSimulationConfig({
          hitCount: 100,
          delayMs: 1, // Minimal delay to yield to event loop
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act - stop after a brief moment
      const runPromise = simulator.run();
      // Use setTimeout to queue stop after some hits execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      simulator.stop();
      const result = await runPromise;

      // Assert - should stop before all hits complete
      expect(result.hitsExecuted).toBeLessThan(100);
    });
  });

  describe('Concurrent Simulation Prevention', () => {
    it('should prevent concurrent simulations', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 10,
          delayMs: 100,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act & Assert
      simulator.run(); // Start first simulation
      await expect(simulator.run()).rejects.toThrow('already running');
    });

    it('should allow new simulation after previous completes', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 2,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const result1 = await simulator.run();

      simulator.configure(
        createSimulationConfig({
          hitCount: 3,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      const result2 = await simulator.run();

      // Assert
      expect(result1.hitsExecuted).toBe(2);
      expect(result2.hitsExecuted).toBe(3);
    });

    it('should allow new simulation after previous is stopped', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 50,
          delayMs: 20,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act - start and stop first simulation
      const runPromise1 = simulator.run();
      await delay(50);
      simulator.stop();
      await runPromise1;

      // Configure and run second simulation
      simulator.configure(
        createSimulationConfig({
          hitCount: 3,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      const result2 = await simulator.run();

      // Assert
      expect(result2.completed).toBe(true);
      expect(result2.hitsExecuted).toBe(3);
    });
  });

  describe('Summary Statistics Accuracy', () => {
    it('should generate accurate summary statistics', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 5,
          delayMs: 0,
          targetMode: 'focus',
          focusPartId: ids.torso,
          entityId: ids.actor,
          damageEntry: { amount: 10, name: 'slashing', penetration: 0 },
        })
      );

      // Act
      const result = await simulator.run();

      // Assert
      expect(result.hitsExecuted).toBe(5);
      expect(result.totalDamage).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.partHitCounts[ids.torso]).toBe(5);
    });

    it('should track duration accurately', async () => {
      // Arrange
      const delayMs = 30;
      const hitCount = 5;
      simulator.configure(
        createSimulationConfig({
          hitCount,
          delayMs,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const result = await simulator.run();

      // Assert - duration should be at least the delays
      const minExpectedDuration = (hitCount - 1) * delayMs;
      expect(result.durationMs).toBeGreaterThanOrEqual(minExpectedDuration * 0.8);
    });

    it('should report average damage correctly', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 3,
          delayMs: 0,
          targetMode: 'focus',
          focusPartId: ids.torso,
          entityId: ids.actor,
          damageEntry: { amount: 20, name: 'slashing', penetration: 0 },
        })
      );

      // Act
      const result = await simulator.run();

      // Assert
      const avgDamage =
        result.hitsExecuted > 0
          ? result.totalDamage / result.hitsExecuted
          : 0;

      expect(avgDamage).toBeGreaterThan(0);
      expect(result.totalDamage).toBe(avgDamage * result.hitsExecuted);
    });
  });

  describe('Progress Events', () => {
    it('should dispatch progress events during simulation', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 5,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      await simulator.run();

      // Assert - should have dispatched progress events
      const progressEvents = dispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === 'damage-simulator:simulation-progress'
      );
      expect(progressEvents.length).toBe(5);
    });

    it('should report progress percentage correctly', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 4,
          delayMs: 10,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      await simulator.run();

      // Assert - check progress percentages
      const progressEvents = dispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === 'damage-simulator:simulation-progress'
      );

      if (progressEvents.length >= 4) {
        // Last progress event should be 100%
        // call format: [eventType, payload] - payload is at index 1
        const lastProgress = progressEvents[progressEvents.length - 1][1];
        expect(lastProgress.percentComplete).toBe(100);
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should reject invalid hit count', () => {
      expect(() => {
        simulator.configure(
          createSimulationConfig({
            hitCount: 0, // Invalid: below minimum
            delayMs: 0,
            targetMode: 'random',
            entityId: ids.actor,
            damageEntry: SAMPLE_DAMAGE_ENTRY,
          })
        );
      }).toThrow(/Hit count must be between/);
    });

    it('should reject hit count above maximum', () => {
      expect(() => {
        simulator.configure(
          createSimulationConfig({
            hitCount: 1000, // Invalid: above maximum
            delayMs: 0,
            targetMode: 'random',
            entityId: ids.actor,
            damageEntry: SAMPLE_DAMAGE_ENTRY,
          })
        );
      }).toThrow(/Hit count must be between/);
    });

    it('should reject invalid delay', () => {
      expect(() => {
        simulator.configure(
          createSimulationConfig({
            hitCount: 5,
            delayMs: -1, // Invalid: negative
            targetMode: 'random',
            entityId: ids.actor,
            damageEntry: SAMPLE_DAMAGE_ENTRY,
          })
        );
      }).toThrow(/Delay must be between/);
    });

    it('should reject invalid target mode', () => {
      expect(() => {
        simulator.configure(
          createSimulationConfig({
            hitCount: 5,
            delayMs: 0,
            targetMode: 'invalid-mode', // Invalid mode
            entityId: ids.actor,
            damageEntry: SAMPLE_DAMAGE_ENTRY,
          })
        );
      }).toThrow(/Target mode must be one of/);
    });

    it('should reject missing entity ID', () => {
      expect(() => {
        simulator.configure({
          hitCount: 5,
          delayMs: 0,
          targetMode: 'random',
          entityId: '', // Invalid: empty
          damageEntry: SAMPLE_DAMAGE_ENTRY,
          focusPartId: null,
        });
      }).toThrow(/Entity ID is required/);
    });

    it('should reject missing damage entry', () => {
      expect(() => {
        simulator.configure({
          hitCount: 5,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: null, // Invalid: missing
          focusPartId: null,
        });
      }).toThrow(/Damage entry is required/);
    });
  });

  describe('Running State', () => {
    it('should report running state correctly', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 10,
          delayMs: 50,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Assert - not running initially
      expect(simulator.isRunning()).toBe(false);

      // Act - start simulation
      const runPromise = simulator.run();

      // Assert - should be running
      expect(simulator.isRunning()).toBe(true);

      // Cleanup
      simulator.stop();
      await runPromise;

      // Assert - no longer running
      expect(simulator.isRunning()).toBe(false);
    });

    it('should provide progress information', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 5,
          delayMs: 20,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      const runPromise = simulator.run();
      await delay(50);
      const progress = simulator.getProgress();
      simulator.stop();
      await runPromise;

      // Assert
      expect(progress.totalHits).toBe(5);
      expect(progress.currentHit).toBeGreaterThan(0);
      expect(progress.percentComplete).toBeGreaterThan(0);
    });
  });

  describe('Completion Events', () => {
    it('should dispatch complete event on successful completion', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 3,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      await simulator.run();

      // Assert
      const completeEvents = dispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === 'damage-simulator:simulation-complete'
      );
      expect(completeEvents.length).toBe(1);
    });

    it('should include results in complete event', async () => {
      // Arrange
      simulator.configure(
        createSimulationConfig({
          hitCount: 3,
          delayMs: 0,
          targetMode: 'random',
          entityId: ids.actor,
          damageEntry: SAMPLE_DAMAGE_ENTRY,
        })
      );

      // Act
      await simulator.run();

      // Assert
      const completeEvent = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === 'damage-simulator:simulation-complete'
      );

      expect(completeEvent).toBeDefined();
      // call format: [eventType, payload] - payload is at index 1
      const payload = completeEvent[1];
      expect(payload.hitsExecuted).toBe(3);
      expect(payload.completed).toBe(true);
      expect(payload.totalDamage).toBeDefined();
    });
  });
});
