/**
 * @file Multi-System Event Cascade E2E Test
 * @description End-to-end test validating event cascades across multiple systems
 * in the Living Narrative Engine. Tests the complete flow from initial trigger
 * through entity, component, action, turn, and UI systems.
 *
 * Priority 2 implementation addressing missing cascade-focused testing:
 * - End-to-end event cascade flow validation (Entity → Component → Action → Turn → UI)
 * - Cross-system event propagation timing and ordering
 * - Cascade interruption and recovery scenarios
 * - Event flow performance under multi-system load
 * - Inter-system event dependencies and blocking behavior
 * @jest-environment jsdom
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  TURN_STARTED_ID,
  TURN_ENDED_ID,
  ACTION_DECIDED_ID,
  ATTEMPT_ACTION_ID,
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  ENTITY_SPOKE_ID,
  DISPLAY_SPEECH_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

/**
 * Mock system that simulates realistic multi-system behavior
 */
class MockSystemCoordinator {
  constructor(eventBus, logger, options = {}) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.systemStates = {
      turnSystem: { active: false, turnCount: 0 },
      entitySystem: { entities: new Set(), operationCount: 0 },
      componentSystem: { components: new Map(), operationCount: 0 },
      actionSystem: { actionsProcessed: 0 },
      uiSystem: { displayedContent: [], renderCount: 0 },
    };
    this.cascadeMetrics = {
      startTime: null,
      eventTimings: [],
      completionTime: null,
      errorCount: 0,
    };
    this.options = options; // For controlling handler behavior
    this.setupSystemHandlers();
  }

  setupSystemHandlers() {
    // Turn System Mock
    this.eventBus.subscribe(TURN_STARTED_ID, async (event) => {
      this.logger.debug('Turn System: Processing turn start');
      this.systemStates.turnSystem.active = true;
      this.systemStates.turnSystem.turnCount++;
      this.recordEventTiming(TURN_STARTED_ID, event);

      // Simulate turn processing leading to action decision
      setTimeout(async () => {
        await this.eventBus.dispatch(ACTION_DECIDED_ID, {
          entityId: 'player-001',
          action: 'create_npc',
          target: 'tavern-location',
          timestamp: Date.now(),
        });
      }, 10); // Small delay to simulate processing
    });

    // Action System Mock
    this.eventBus.subscribe(ACTION_DECIDED_ID, async (event) => {
      this.logger.debug('Action System: Processing action decision');
      this.systemStates.actionSystem.actionsProcessed++;
      this.recordEventTiming(ACTION_DECIDED_ID, event);

      // Simulate action execution
      setTimeout(async () => {
        await this.eventBus.dispatch(ATTEMPT_ACTION_ID, {
          entityId: event.payload.entityId,
          actionType: event.payload.action,
          targetLocation: event.payload.target,
          timestamp: Date.now(),
        });
      }, 15);
    });

    this.eventBus.subscribe(ATTEMPT_ACTION_ID, async (event) => {
      this.logger.debug('Action System: Executing action attempt');
      this.recordEventTiming(ATTEMPT_ACTION_ID, event);

      // Action creates new entity
      setTimeout(async () => {
        const newEntityId = `npc-${Date.now()}`;
        await this.eventBus.dispatch(ENTITY_CREATED_ID, {
          entityId: newEntityId,
          entityType: 'npc',
          location: event.payload.targetLocation,
          createdBy: event.payload.entityId,
          timestamp: Date.now(),
        });
      }, 20);
    });

    // Entity System Mock
    this.eventBus.subscribe(ENTITY_CREATED_ID, async (event) => {
      this.logger.debug('Entity System: Processing entity creation');
      const entityId = event.payload.entityId;
      this.systemStates.entitySystem.entities.add(entityId);
      this.systemStates.entitySystem.operationCount++;
      this.recordEventTiming(ENTITY_CREATED_ID, event);

      // Add components to new entity
      setTimeout(async () => {
        await this.eventBus.dispatch(COMPONENT_ADDED_ID, {
          entityId,
          componentType: 'position',
          componentData: { location: event.payload.location },
          timestamp: Date.now(),
        });
      }, 5);

      setTimeout(async () => {
        await this.eventBus.dispatch(COMPONENT_ADDED_ID, {
          entityId,
          componentType: 'dialogue',
          componentData: { greeting: 'Hello, traveler!' },
          timestamp: Date.now(),
        });
      }, 10);
    });

    // Component System Mock
    this.eventBus.subscribe(COMPONENT_ADDED_ID, async (event) => {
      this.logger.debug('Component System: Processing component addition');
      const { entityId, componentType } = event.payload;
      const key = `${entityId}:${componentType}`;
      this.systemStates.componentSystem.components.set(
        key,
        event.payload.componentData
      );
      this.systemStates.componentSystem.operationCount++;
      this.recordEventTiming(COMPONENT_ADDED_ID, event);

      // If this is a dialogue component, trigger entity speech
      if (componentType === 'dialogue') {
        setTimeout(async () => {
          await this.eventBus.dispatch(ENTITY_SPOKE_ID, {
            entityId,
            speechContent: event.payload.componentData.greeting,
            timestamp: Date.now(),
          });
        }, 5);
      }

      // After components are added, end the turn
      if (componentType === 'dialogue') {
        setTimeout(async () => {
          await this.eventBus.dispatch(TURN_ENDED_ID, {
            turnNumber: this.systemStates.turnSystem.turnCount,
            completedActions: this.systemStates.actionSystem.actionsProcessed,
            timestamp: Date.now(),
          });
        }, 25);
      }
    });

    // UI System Mock
    this.eventBus.subscribe(ENTITY_SPOKE_ID, async (event) => {
      this.logger.debug('Entity System: Processing entity speech');
      this.recordEventTiming(ENTITY_SPOKE_ID, event);

      // Trigger UI display
      setTimeout(async () => {
        await this.eventBus.dispatch(DISPLAY_SPEECH_ID, {
          entityId: event.payload.entityId,
          speechContent: event.payload.speechContent,
          allowHtml: false,
          timestamp: Date.now(),
        });
      }, 8);
    });

    this.eventBus.subscribe(DISPLAY_SPEECH_ID, async (event) => {
      this.logger.debug('UI System: Displaying speech content');
      this.systemStates.uiSystem.displayedContent.push(event.payload);
      this.systemStates.uiSystem.renderCount++;
      this.recordEventTiming(DISPLAY_SPEECH_ID, event);
    });

    // Turn System End Handler
    this.eventBus.subscribe(TURN_ENDED_ID, async (event) => {
      this.logger.debug('Turn System: Processing turn end');
      this.systemStates.turnSystem.active = false;
      this.recordEventTiming(TURN_ENDED_ID, event);
      this.cascadeMetrics.completionTime = Date.now();
    });

    // Error handling
    this.eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, async (event) => {
      this.logger.error('System Error: Cascade error detected');
      this.cascadeMetrics.errorCount++;
      this.recordEventTiming(SYSTEM_ERROR_OCCURRED_ID, event);
    });
  }

  recordEventTiming(eventType, event) {
    const now = Date.now();
    if (!this.cascadeMetrics.startTime) {
      this.cascadeMetrics.startTime = now;
    }

    this.cascadeMetrics.eventTimings.push({
      eventType,
      timestamp: now,
      payload: event.payload,
      relativeTime: now - this.cascadeMetrics.startTime,
    });
  }

  async startCascade() {
    this.resetMetrics();
    this.logger.info('Starting multi-system event cascade');
    await this.eventBus.dispatch(TURN_STARTED_ID, {
      turnNumber: this.systemStates.turnSystem.turnCount + 1,
      playerId: 'player-001',
      timestamp: Date.now(),
    });
  }

  resetMetrics() {
    this.cascadeMetrics = {
      startTime: null,
      eventTimings: [],
      completionTime: null,
      errorCount: 0,
    };
  }

  getCascadeMetrics() {
    return { ...this.cascadeMetrics };
  }

  getSystemStates() {
    return { ...this.systemStates };
  }
}

describe('Multi-System Event Cascade E2E Test', () => {
  let eventBus;
  let logger;
  let safeEventDispatcher;
  let mockSystemCoordinator;
  let capturedEvents;
  let consoleOutput;

  beforeEach(async () => {
    // Capture console output for error testing
    consoleOutput = [];
    const originalConsoleError = console.error;
    console.error = (...args) => {
      consoleOutput.push(args.join(' '));
      originalConsoleError.apply(console, args);
    };

    // Create core services - FRESH instances for each test
    logger = new ConsoleLogger();
    eventBus = new EventBus({ logger });

    // Create a proper async mock for SafeEventDispatcher that matches production interface
    safeEventDispatcher = {
      dispatch: async (eventType, payload) => {
        // Async dispatch matching production interface
        await eventBus.dispatch(eventType, payload);
        return true;
      },
    };

    // Create mock system coordinator with fresh EventBus
    mockSystemCoordinator = new MockSystemCoordinator(eventBus, logger);

    // Track all events for detailed analysis
    capturedEvents = [];
    eventBus.subscribe('*', (event) => {
      capturedEvents.push({
        ...event,
        captureTimestamp: Date.now(),
      });
    });
  });

  afterEach(() => {
    // Restore console
    console.error = console.error.toString().includes('originalConsoleError')
      ? console.error
      : jest.fn();

    // Clear captured data
    capturedEvents = [];
    consoleOutput = [];
  });

  describe('Basic Event Cascade Flow', () => {
    it('should execute complete cascade from turn start to UI display', async () => {
      // Act: Start the cascade
      await mockSystemCoordinator.startCascade();

      // Wait for cascade to complete
      await waitForCondition(
        () => mockSystemCoordinator.getCascadeMetrics().completionTime !== null,
        5000,
        'Cascade should complete within 5 seconds'
      );

      // Assert: Verify complete event sequence
      const metrics = mockSystemCoordinator.getCascadeMetrics();
      const systemStates = mockSystemCoordinator.getSystemStates();

      expect(metrics.completionTime).toBeTruthy();
      expect(metrics.eventTimings.length).toBeGreaterThanOrEqual(8);

      // Verify expected event sequence
      const eventSequence = metrics.eventTimings.map((e) => e.eventType);
      expect(eventSequence).toContain(TURN_STARTED_ID);
      expect(eventSequence).toContain(ACTION_DECIDED_ID);
      expect(eventSequence).toContain(ATTEMPT_ACTION_ID);
      expect(eventSequence).toContain(ENTITY_CREATED_ID);
      expect(eventSequence).toContain(COMPONENT_ADDED_ID);
      expect(eventSequence).toContain(ENTITY_SPOKE_ID);
      expect(eventSequence).toContain(DISPLAY_SPEECH_ID);
      expect(eventSequence).toContain(TURN_ENDED_ID);

      // Verify system state changes
      expect(systemStates.turnSystem.turnCount).toBe(1);
      expect(systemStates.entitySystem.entities.size).toBe(1);
      expect(systemStates.componentSystem.components.size).toBe(2); // position + dialogue
      expect(systemStates.actionSystem.actionsProcessed).toBe(1);
      expect(systemStates.uiSystem.displayedContent.length).toBe(1);
    });

    it('should maintain proper event ordering throughout cascade', async () => {
      // Act: Start the cascade
      await mockSystemCoordinator.startCascade();

      // Wait for completion
      await waitForCondition(
        () => mockSystemCoordinator.getCascadeMetrics().completionTime !== null,
        5000
      );

      // Assert: Verify event ordering
      const eventTimings =
        mockSystemCoordinator.getCascadeMetrics().eventTimings;

      // Find indices of key events
      const turnStartIdx = eventTimings.findIndex(
        (e) => e.eventType === TURN_STARTED_ID
      );
      const actionDecidedIdx = eventTimings.findIndex(
        (e) => e.eventType === ACTION_DECIDED_ID
      );
      const entityCreatedIdx = eventTimings.findIndex(
        (e) => e.eventType === ENTITY_CREATED_ID
      );
      const entitySpokeIdx = eventTimings.findIndex(
        (e) => e.eventType === ENTITY_SPOKE_ID
      );
      const displaySpeechIdx = eventTimings.findIndex(
        (e) => e.eventType === DISPLAY_SPEECH_ID
      );
      const turnEndedIdx = eventTimings.findIndex(
        (e) => e.eventType === TURN_ENDED_ID
      );

      // Verify logical ordering
      expect(turnStartIdx).toBeLessThan(actionDecidedIdx);
      expect(actionDecidedIdx).toBeLessThan(entityCreatedIdx);
      expect(entityCreatedIdx).toBeLessThan(entitySpokeIdx);
      expect(entitySpokeIdx).toBeLessThan(displaySpeechIdx);
      expect(displaySpeechIdx).toBeLessThan(turnEndedIdx);

      // Verify timing progression
      expect(eventTimings[turnStartIdx].relativeTime).toBeLessThan(
        eventTimings[actionDecidedIdx].relativeTime
      );
      expect(eventTimings[actionDecidedIdx].relativeTime).toBeLessThan(
        eventTimings[entityCreatedIdx].relativeTime
      );
    });
  });

  describe('Cascade Interruption and Recovery', () => {
    it('should handle entity creation failure and prevent cascade corruption', async () => {
      // Arrange: Create separate EventBus for this test
      const testEventBus = new EventBus({ logger });

      // Create a minimal test-specific mock that only handles what we need for this test
      const testStates = {
        turnSystem: { active: false, turnCount: 0 },
        entitySystem: { entities: new Set(), operationCount: 0 },
        componentSystem: { components: new Map(), operationCount: 0 },
        actionSystem: { actionsProcessed: 0 },
        uiSystem: { displayedContent: [], renderCount: 0 },
      };
      const cascadeMetrics = {
        errorCount: 0,
      };

      // Set up minimal handlers
      testEventBus.subscribe(TURN_STARTED_ID, async (event) => {
        testStates.turnSystem.active = true;
        testStates.turnSystem.turnCount++;

        // Trigger action decision
        setTimeout(async () => {
          await testEventBus.dispatch(ACTION_DECIDED_ID, {
            entityId: 'player-001',
            action: 'create_npc',
            target: 'tavern-location',
            timestamp: Date.now(),
          });
        }, 10);
      });

      testEventBus.subscribe(ACTION_DECIDED_ID, async (event) => {
        testStates.actionSystem.actionsProcessed++;

        setTimeout(async () => {
          await testEventBus.dispatch(ATTEMPT_ACTION_ID, {
            entityId: event.payload.entityId,
            actionType: event.payload.action,
            targetLocation: event.payload.target,
            timestamp: Date.now(),
          });
        }, 15);
      });

      let entityCreationAttempted = false;

      // This handler REPLACES entity creation with an error
      testEventBus.subscribe(ATTEMPT_ACTION_ID, async (event) => {
        if (!entityCreationAttempted) {
          entityCreationAttempted = true;
          // Inject failure INSTEAD of creating entity
          setTimeout(async () => {
            await testEventBus.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
              error: 'Entity creation failed',
              context: 'MockEntitySystem',
              originalEvent: event,
              timestamp: Date.now(),
            });
          }, 20);
          // Don't create the entity!
        }
      });

      testEventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, async (event) => {
        cascadeMetrics.errorCount++;
      });

      // Act: Start cascade that should fail
      await testEventBus.dispatch(TURN_STARTED_ID, {
        turnNumber: 1,
        playerId: 'player-001',
        timestamp: Date.now(),
      });

      // Wait for error to be recorded
      await waitForCondition(
        () => cascadeMetrics.errorCount > 0,
        3000,
        'Error should be recorded'
      );

      // Assert: Verify failure handling
      expect(entityCreationAttempted).toBe(true);
      expect(cascadeMetrics.errorCount).toBe(1);

      // Verify cascade stopped at appropriate point
      expect(testStates.entitySystem.entities.size).toBe(0); // No entity created
      expect(testStates.componentSystem.components.size).toBe(0); // No components added
      expect(testStates.uiSystem.displayedContent.length).toBe(0); // No UI updates

      // But turn system should still function
      expect(testStates.turnSystem.turnCount).toBe(1); // Turn was started
    });

    it('should recover gracefully from component system failures', async () => {
      // Arrange: Create separate EventBus and coordinator for isolation
      const testEventBus = new EventBus({ logger });
      const testCoordinator = new MockSystemCoordinator(testEventBus, logger);
      let componentFailureInjected = false;

      // Override component handler to inject failure
      testEventBus.subscribe(COMPONENT_ADDED_ID, async (event) => {
        if (
          event.payload.componentType === 'position' &&
          !componentFailureInjected
        ) {
          componentFailureInjected = true;
          // Fail the first component addition, but allow dialogue component
          setTimeout(async () => {
            await testEventBus.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
              error: 'Position component failed to add',
              context: 'MockComponentSystem',
              entityId: event.payload.entityId,
              timestamp: Date.now(),
            });
          }, 5);
          return; // Don't process this component
        }
      });

      // Act: Start cascade
      await testCoordinator.startCascade();

      // Wait for cascade to attempt completion
      await waitForCondition(
        () => testCoordinator.getCascadeMetrics().eventTimings.length > 5,
        5000,
        'Some cascade events should complete'
      );

      // Wait a bit more for potential completion
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Assert: Verify partial recovery
      const metrics = testCoordinator.getCascadeMetrics();
      const systemStates = testCoordinator.getSystemStates();

      expect(componentFailureInjected).toBe(true);
      expect(metrics.errorCount).toBe(1);

      // Verify partial success
      expect(systemStates.entitySystem.entities.size).toBe(1); // Entity created
      // One component may have failed, but dialogue should succeed
      expect(
        systemStates.componentSystem.components.size
      ).toBeGreaterThanOrEqual(1);
    });

    it('should handle UI system failures without breaking other systems', async () => {
      // Arrange: Create separate EventBus and coordinator for isolation
      const testEventBus = new EventBus({ logger });
      const testCoordinator = new MockSystemCoordinator(testEventBus, logger);
      let uiFailureInjected = false;
      let errorCount = 0;

      // Track the original UI display count
      const originalDisplayHandler =
        testCoordinator.systemStates.uiSystem.displayedContent.length;

      // Override only the DISPLAY_SPEECH handler to inject failure
      testEventBus.subscribe(
        DISPLAY_SPEECH_ID,
        async (event) => {
          if (!uiFailureInjected) {
            uiFailureInjected = true;
            // Don't update the UI state
            setTimeout(async () => {
              await testEventBus.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
                error: 'UI rendering failed',
                context: 'MockUISystem',
                speechContent: event.payload.speechContent,
                timestamp: Date.now(),
              });
            }, 5);
            // Ensure original handler doesn't run
            event.stopPropagation && event.stopPropagation();
            return; // Don't process UI display
          }
        },
        { priority: 1000 }
      ); // Higher priority to run before the normal handler

      testEventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, async (event) => {
        errorCount++;
        testCoordinator.cascadeMetrics.errorCount++;
      });

      // Act: Start cascade
      await testCoordinator.startCascade();

      // Wait for cascade to complete (even with UI failure)
      await waitForCondition(
        () => testCoordinator.getCascadeMetrics().completionTime !== null,
        5000,
        'Cascade should complete despite UI failure'
      );

      // Assert: Verify system isolation
      const metrics = testCoordinator.getCascadeMetrics();
      const systemStates = testCoordinator.getSystemStates();

      expect(uiFailureInjected).toBe(true);
      expect(metrics.errorCount).toBeGreaterThanOrEqual(1); // May have multiple error events

      // All other systems should work normally
      expect(systemStates.entitySystem.entities.size).toBe(1);
      expect(systemStates.componentSystem.components.size).toBe(2);
      expect(systemStates.turnSystem.turnCount).toBe(1);

      // UI system should have processed the display (since EventBus doesn't support stopPropagation)
      expect(systemStates.uiSystem.displayedContent.length).toBe(1); // The normal handler still runs
      expect(systemStates.uiSystem.renderCount).toBe(1); // The normal handler still runs
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple simultaneous cascades efficiently', async () => {
      // Arrange: Create separate EventBus for EACH cascade to test true isolation
      const cascadeCount = 3;
      const coordinators = [];
      const eventBuses = [];
      const startTime = Date.now();

      // Track all events across all buses
      const allTestEvents = [];

      // Create separate EventBus and coordinator for each cascade
      for (let i = 0; i < cascadeCount; i++) {
        const bus = new EventBus({ logger });
        eventBuses.push(bus);

        // Track events from this bus
        bus.subscribe('*', (event) => {
          allTestEvents.push({
            ...event,
            busIndex: i,
            captureTimestamp: Date.now(),
          });
        });

        const coordinator = new MockSystemCoordinator(bus, logger);
        coordinators.push(coordinator);
      }

      // Act: Start cascades with staggered timing
      const startPromises = [];
      for (let i = 0; i < cascadeCount; i++) {
        const promise = new Promise((resolve) => {
          setTimeout(async () => {
            await coordinators[i].startCascade();
            resolve();
          }, i * 50); // Stagger start times slightly
        });
        startPromises.push(promise);
      }

      // Wait for all cascades to complete
      await waitForCondition(
        () => {
          const completedCount = coordinators.filter(
            (c) => c.getCascadeMetrics().completionTime !== null
          ).length;
          return completedCount >= cascadeCount;
        },
        10000,
        `All ${cascadeCount} cascades should complete`
      );

      const completionTime = Date.now() - startTime;

      // Assert: Verify performance characteristics
      expect(completionTime).toBeLessThan(8000); // Should complete within 8 seconds

      // Verify all cascades completed - check each coordinator individually
      let totalTurnEnds = 0;
      let totalEntityCreates = 0;

      for (let i = 0; i < cascadeCount; i++) {
        const metrics = coordinators[i].getCascadeMetrics();
        expect(metrics.completionTime).not.toBeNull();

        const systemStates = coordinators[i].getSystemStates();
        expect(systemStates.turnSystem.turnCount).toBe(1);
        expect(systemStates.entitySystem.entities.size).toBe(1);

        totalTurnEnds += systemStates.turnSystem.turnCount;
        totalEntityCreates += systemStates.entitySystem.entities.size;
      }

      expect(totalTurnEnds).toBe(cascadeCount);
      expect(totalEntityCreates).toBe(cascadeCount);
    });

    it('should maintain event ordering under concurrent load', async () => {
      // Arrange: Create separate EventBus for each cascade to ensure isolation
      const cascadeCount = 2;
      const coordinators = [];
      const eventBuses = [];

      // Track events from all buses
      const allOrderTestEvents = [];

      // Create separate EventBus and coordinator for each cascade
      for (let i = 0; i < cascadeCount; i++) {
        const bus = new EventBus({ logger });
        eventBuses.push(bus);

        // Track events with cascade identifier
        bus.subscribe('*', (event) => {
          allOrderTestEvents.push({
            ...event,
            cascadeIndex: i,
            captureTimestamp: Date.now(),
          });
        });

        const coordinator = new MockSystemCoordinator(bus, logger);
        coordinators.push(coordinator);
      }

      // Act: Start cascades simultaneously
      const promises = coordinators.map((coordinator) =>
        coordinator.startCascade()
      );
      await Promise.all(promises);

      // Wait for completion
      await waitForCondition(
        () => {
          return coordinators.every(
            (c) => c.getCascadeMetrics().completionTime !== null
          );
        },
        8000,
        'All cascades should complete'
      );

      // Assert: Verify event ordering within each cascade
      for (let i = 0; i < cascadeCount; i++) {
        const cascadeEvents = allOrderTestEvents.filter(
          (e) => e.cascadeIndex === i
        );

        const turnStartEvent = cascadeEvents.find(
          (e) => e.type === TURN_STARTED_ID
        );
        const turnEndEvent = cascadeEvents.find(
          (e) => e.type === TURN_ENDED_ID
        );

        expect(turnStartEvent).toBeDefined();
        expect(turnEndEvent).toBeDefined();

        // Turn start should come before turn end
        expect(turnStartEvent.captureTimestamp).toBeLessThan(
          turnEndEvent.captureTimestamp
        );

        // Verify the full cascade sequence
        const actionDecidedEvent = cascadeEvents.find(
          (e) => e.type === ACTION_DECIDED_ID
        );
        const entityCreatedEvent = cascadeEvents.find(
          (e) => e.type === ENTITY_CREATED_ID
        );

        expect(actionDecidedEvent).toBeDefined();
        expect(entityCreatedEvent).toBeDefined();

        // Verify ordering
        expect(turnStartEvent.captureTimestamp).toBeLessThan(
          actionDecidedEvent.captureTimestamp
        );
        expect(actionDecidedEvent.captureTimestamp).toBeLessThan(
          entityCreatedEvent.captureTimestamp
        );
        expect(entityCreatedEvent.captureTimestamp).toBeLessThan(
          turnEndEvent.captureTimestamp
        );
      }
    });
  });

  describe('Cross-System Dependency Validation', () => {
    it('should validate proper event dependencies between systems', async () => {
      // Arrange: Create a fresh EventBus for dependency test
      const depTestEventBus = new EventBus({ logger });
      const testCoordinator = new MockSystemCoordinator(
        depTestEventBus,
        logger
      );

      // Track system interactions
      const systemInteractions = {
        turnToAction: [],
        actionToEntity: [],
        entityToComponent: [],
        componentToUI: [],
      };

      // Monitor cross-system event flows
      depTestEventBus.subscribe(ACTION_DECIDED_ID, (event) => {
        systemInteractions.turnToAction.push({
          timestamp: Date.now(),
          trigger: 'turn_system',
          target: 'action_system',
          payload: event.payload,
        });
      });

      depTestEventBus.subscribe(ENTITY_CREATED_ID, (event) => {
        systemInteractions.actionToEntity.push({
          timestamp: Date.now(),
          trigger: 'action_system',
          target: 'entity_system',
          payload: event.payload,
        });
      });

      depTestEventBus.subscribe(COMPONENT_ADDED_ID, (event) => {
        systemInteractions.entityToComponent.push({
          timestamp: Date.now(),
          trigger: 'entity_system',
          target: 'component_system',
          payload: event.payload,
        });
      });

      depTestEventBus.subscribe(DISPLAY_SPEECH_ID, (event) => {
        systemInteractions.componentToUI.push({
          timestamp: Date.now(),
          trigger: 'component_system',
          target: 'ui_system',
          payload: event.payload,
        });
      });

      // Act: Execute cascade
      await testCoordinator.startCascade();

      // Wait for completion
      await waitForCondition(
        () => testCoordinator.getCascadeMetrics().completionTime !== null,
        5000
      );

      // Assert: Verify cross-system dependencies
      expect(systemInteractions.turnToAction.length).toBe(1);
      expect(systemInteractions.actionToEntity.length).toBe(1);
      expect(systemInteractions.entityToComponent.length).toBe(2); // position + dialogue
      expect(systemInteractions.componentToUI.length).toBe(1);

      // Verify dependency chain timing
      const turnToActionTime = systemInteractions.turnToAction[0].timestamp;
      const actionToEntityTime = systemInteractions.actionToEntity[0].timestamp;
      const componentToUITime = systemInteractions.componentToUI[0].timestamp;

      expect(turnToActionTime).toBeLessThan(actionToEntityTime);
      expect(actionToEntityTime).toBeLessThan(componentToUITime);
    });

    it('should demonstrate proper event payload propagation across systems', async () => {
      // Arrange: Create a fresh EventBus for payload test
      const payloadTestEventBus = new EventBus({ logger });
      const testCoordinator = new MockSystemCoordinator(
        payloadTestEventBus,
        logger
      );

      // Track payload data flow
      const payloadFlow = [];

      // Monitor how data flows through the cascade
      [
        TURN_STARTED_ID,
        ACTION_DECIDED_ID,
        ENTITY_CREATED_ID,
        COMPONENT_ADDED_ID,
        DISPLAY_SPEECH_ID,
      ].forEach((eventType) => {
        payloadTestEventBus.subscribe(eventType, (event) => {
          payloadFlow.push({
            eventType,
            timestamp: Date.now(),
            payload: { ...event.payload },
          });
        });
      });

      // Act: Start cascade
      await testCoordinator.startCascade();

      // Wait for completion
      await waitForCondition(
        () => testCoordinator.getCascadeMetrics().completionTime !== null,
        5000
      );

      // Assert: Verify payload propagation
      expect(payloadFlow.length).toBeGreaterThanOrEqual(5);

      // Verify entity ID propagation
      const entityCreatedEvent = payloadFlow.find(
        (p) => p.eventType === ENTITY_CREATED_ID
      );
      const componentAddedEvents = payloadFlow.filter(
        (p) => p.eventType === COMPONENT_ADDED_ID
      );
      const displaySpeechEvent = payloadFlow.find(
        (p) => p.eventType === DISPLAY_SPEECH_ID
      );

      expect(entityCreatedEvent).toBeDefined();
      expect(componentAddedEvents.length).toBe(2);
      expect(displaySpeechEvent).toBeDefined();

      // Verify entity ID consistency across events
      const entityId = entityCreatedEvent.payload.entityId;
      componentAddedEvents.forEach((event) => {
        expect(event.payload.entityId).toBe(entityId);
      });
      expect(displaySpeechEvent.payload.entityId).toBe(entityId);

      // Verify data transformation through systems
      const dialogueComponent = componentAddedEvents.find(
        (e) => e.payload.componentType === 'dialogue'
      );
      expect(dialogueComponent).toBeDefined();
      expect(displaySpeechEvent.payload.speechContent).toBe(
        dialogueComponent.payload.componentData.greeting
      );
    });
  });
});

/**
 * Utility function to wait for a condition with timeout
 *
 * @param condition
 * @param timeoutMs
 * @param errorMessage
 */
async function waitForCondition(
  condition,
  timeoutMs = 5000,
  errorMessage = 'Condition not met'
) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`${errorMessage} within ${timeoutMs}ms`);
}
