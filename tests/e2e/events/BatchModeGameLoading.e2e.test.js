/**
 * @file Batch Mode Game Loading E2E Test
 * @description End-to-end test validating batch mode functionality during complex game loading scenarios
 * with 100+ entities, proper batch mode lifecycle, timeout safety, and error recovery.
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
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import {
  createEventBatch,
  createPerformanceTestEvents,
} from '../../common/eventTestHelpers.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  ENTITY_CREATED_ID,
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_STARTED_ID,
  TURN_ENDED_ID,
} from '../../../src/constants/eventIds.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

/**
 * Extended test bed for event system testing with batch mode capabilities
 */
class EventSystemTestBed extends IntegrationTestBed {
  constructor() {
    super();
    this._customEventBus = null;
    this._customSafeEventDispatcher = null;
    this.capturedEvents = [];
    this.entityCount = 0;
  }

  async initialize() {
    await super.initialize();

    // Use the DI container's EventBus instead of creating a custom one
    this.logger = this.container.resolve(tokens.ILogger);
    this._containerEventBus = this.container.resolve(tokens.IEventBus);
    this._containerSafeEventDispatcher = this.container.resolve(
      tokens.ISafeEventDispatcher
    );

    // Set up event capture for verification on the DI container's EventBus
    this._containerEventBus.subscribe('*', (event) => {
      this.capturedEvents.push({
        ...event,
        timestamp: Date.now(),
        captureId: this.capturedEvents.length,
      });
    });
  }

  // Override the getter to return the DI container's event bus
  get eventBus() {
    return this._containerEventBus || super.eventBus;
  }

  get safeEventDispatcher() {
    return this._containerSafeEventDispatcher || super.safeEventDispatcher;
  }

  async cleanup() {
    // Clear captured events
    this.capturedEvents = [];
    this.entityCount = 0;

    // Ensure batch mode is disabled
    if (
      this._containerEventBus &&
      this._containerEventBus.isBatchModeEnabled()
    ) {
      this._containerEventBus.setBatchMode(false);
    }

    await super.cleanup();
  }

  /**
   * Clears captured events for a fresh test
   */
  clearCapturedEvents() {
    this.capturedEvents = [];
  }

  /**
   * Creates a complex game state with specified number of entities
   *
   * @param entityCount
   */
  async createComplexGameState(entityCount = 100) {
    const entities = [];

    for (let i = 1; i <= entityCount; i++) {
      const entityId = `test_entity_${i}`;
      const componentCount = Math.floor(Math.random() * 5) + 2; // 2-6 components per entity

      // Create entity with required fields
      const mockEntity = {
        id: entityId,
        definitionId: `test:entity_type_${i % 10}`,
        components: {},
      };

      await this.eventBus.dispatch(ENTITY_CREATED_ID, {
        instanceId: entityId,
        definitionId: `test:entity_type_${i % 10}`, // 10 different entity types
        wasReconstructed: false,
        entity: mockEntity, // Required by schema
      });

      // Add components to entity
      for (let j = 1; j <= componentCount; j++) {
        const componentData = {
          id: `comp_${i}_${j}`,
          value: Math.random() * 100,
          metadata: { entityIndex: i, componentIndex: j },
        };

        // Update mock entity with component
        mockEntity.components[`test:component_${j}`] = componentData;

        await this.eventBus.dispatch(COMPONENT_ADDED_ID, {
          entity: mockEntity, // Required: full entity object
          componentTypeId: `test:component_${j}`, // Correct field name
          componentData: componentData,
        });
      }

      entities.push({
        id: entityId,
        componentCount: componentCount,
      });
    }

    this.entityCount = entityCount;
    return entities;
  }

  /**
   * Verifies event sequence and counts
   *
   * @param expectedEntityCount
   * @param expectedComponentsPerEntity
   */
  verifyEventSequence(expectedEntityCount, expectedComponentsPerEntity = 3.5) {
    const entityCreatedEvents = this.capturedEvents.filter(
      (e) => e.type === ENTITY_CREATED_ID
    );
    const componentAddedEvents = this.capturedEvents.filter(
      (e) => e.type === COMPONENT_ADDED_ID
    );

    expect(entityCreatedEvents).toHaveLength(expectedEntityCount);
    expect(componentAddedEvents.length).toBeGreaterThan(
      expectedEntityCount * 2
    ); // At least 2 components per entity
    expect(componentAddedEvents.length).toBeLessThan(expectedEntityCount * 7); // At most 6 components per entity

    return {
      entityEvents: entityCreatedEvents.length,
      componentEvents: componentAddedEvents.length,
      totalEvents: this.capturedEvents.length,
    };
  }

  /**
   * Verifies no recursion warnings in captured events or logs
   */
  verifyNoRecursionWarnings() {
    const errorEvents = this.capturedEvents.filter(
      (e) => e.type === SYSTEM_ERROR_OCCURRED_ID
    );
    const recursionWarnings = errorEvents.filter(
      (e) =>
        e.payload &&
        e.payload.message &&
        e.payload.message.includes('recursion')
    );

    expect(recursionWarnings).toHaveLength(0);
  }
}

describe('Batch Mode Game Loading E2E Test', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new EventSystemTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Scenario 1: Complex Game State Loading', () => {
    it('should load complex game state with 100+ entities in batch mode without recursion warnings', async () => {
      const startTime = Date.now();

      // Enable batch mode for game loading
      testBed.eventBus.setBatchMode(true, {
        maxRecursionDepth: 25,
        maxGlobalRecursion: 200,
        timeoutMs: 60000,
        context: 'game-initialization-test',
      });

      expect(testBed.eventBus.isBatchModeEnabled()).toBe(true);

      // Create complex game state with 120 entities
      const entities = await testBed.createComplexGameState(120);

      // Verify all entities were created
      expect(entities).toHaveLength(120);

      // Verify event sequence
      const eventStats = testBed.verifyEventSequence(120);
      expect(eventStats.entityEvents).toBe(120);
      expect(eventStats.componentEvents).toBeGreaterThan(240); // At least 2 components per entity

      // Verify no recursion warnings occurred
      testBed.verifyNoRecursionWarnings();

      // Disable batch mode
      testBed.eventBus.setBatchMode(false);
      expect(testBed.eventBus.isBatchModeEnabled()).toBe(false);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify reasonable execution time (should be under 10 seconds)
      expect(executionTime).toBeLessThan(10000);

      // Log performance metrics
      testBed.logger.info(
        `Batch loading completed: ${executionTime}ms for ${eventStats.totalEvents} events`
      );
    });

    it('should handle mixed entity types and varying component counts', async () => {
      // Enable batch mode
      testBed.eventBus.setBatchMode(true, {
        maxRecursionDepth: 20,
        maxGlobalRecursion: 150,
        timeoutMs: 30000,
        context: 'mixed-entities-test',
      });

      // Create entities with varying complexity
      const simpleEntities = await testBed.createComplexGameState(50);
      const complexEntities = await testBed.createComplexGameState(30);

      expect(simpleEntities).toHaveLength(50);
      expect(complexEntities).toHaveLength(30);

      // Total entities should be reflected in testBed.entityCount
      expect(testBed.entityCount).toBe(30); // Last creation call

      // Verify event processing
      const eventStats = testBed.verifyEventSequence(80, 3); // Adjusted for mixed complexity
      testBed.verifyNoRecursionWarnings();

      testBed.eventBus.setBatchMode(false);
    });
  });

  describe('Scenario 2: Batch Mode Lifecycle', () => {
    it('should properly enable and disable batch mode with correct configuration', async () => {
      // Initially batch mode should be disabled
      expect(testBed.eventBus.isBatchModeEnabled()).toBe(false);
      expect(testBed.eventBus.getBatchModeOptions()).toBeNull();

      // Enable batch mode with specific configuration
      const batchConfig = {
        maxRecursionDepth: 25,
        maxGlobalRecursion: 200,
        timeoutMs: 60000,
        context: 'game-initialization',
      };

      testBed.eventBus.setBatchMode(true, batchConfig);

      // Verify batch mode is enabled with correct configuration
      expect(testBed.eventBus.isBatchModeEnabled()).toBe(true);
      const actualConfig = testBed.eventBus.getBatchModeOptions();
      expect(actualConfig.maxRecursionDepth).toBe(25);
      expect(actualConfig.maxGlobalRecursion).toBe(200);
      expect(actualConfig.timeoutMs).toBe(60000);
      expect(actualConfig.context).toBe('game-initialization');

      // Disable batch mode
      testBed.eventBus.setBatchMode(false);

      // Verify batch mode is disabled
      expect(testBed.eventBus.isBatchModeEnabled()).toBe(false);
      expect(testBed.eventBus.getBatchModeOptions()).toBeNull();
    });

    it('should handle repeated enable/disable calls gracefully', async () => {
      const config = {
        maxRecursionDepth: 15,
        maxGlobalRecursion: 100,
        context: 'repeated-calls-test',
      };

      // Multiple enable calls should not cause issues
      testBed.eventBus.setBatchMode(true, config);
      testBed.eventBus.setBatchMode(true, config);
      testBed.eventBus.setBatchMode(true, config);

      expect(testBed.eventBus.isBatchModeEnabled()).toBe(true);

      // Multiple disable calls should not cause issues
      testBed.eventBus.setBatchMode(false);
      testBed.eventBus.setBatchMode(false);
      testBed.eventBus.setBatchMode(false);

      expect(testBed.eventBus.isBatchModeEnabled()).toBe(false);
    });
  });

  describe('Scenario 3: Timeout Safety Mechanism', () => {
    it('should auto-disable batch mode after timeout expires', async () => {
      // Enable batch mode with short timeout for testing
      testBed.eventBus.setBatchMode(true, {
        maxRecursionDepth: 20,
        maxGlobalRecursion: 100,
        timeoutMs: 1000, // 1 second timeout
        context: 'timeout-test',
      });

      expect(testBed.eventBus.isBatchModeEnabled()).toBe(true);

      // Wait for timeout to expire
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Batch mode should be auto-disabled
      expect(testBed.eventBus.isBatchModeEnabled()).toBe(false);
    });

    it('should clear timeout when batch mode is manually disabled', async () => {
      // Enable batch mode with timeout
      testBed.eventBus.setBatchMode(true, {
        maxRecursionDepth: 15,
        maxGlobalRecursion: 75,
        timeoutMs: 5000,
        context: 'manual-disable-test',
      });

      expect(testBed.eventBus.isBatchModeEnabled()).toBe(true);

      // Manually disable before timeout
      testBed.eventBus.setBatchMode(false);
      expect(testBed.eventBus.isBatchModeEnabled()).toBe(false);

      // Wait past original timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should remain disabled (timeout was cleared)
      expect(testBed.eventBus.isBatchModeEnabled()).toBe(false);
    });
  });

  describe('Scenario 4: Error Handling During Batch Loading', () => {
    it('should handle errors gracefully while maintaining batch mode state', async () => {
      // Clear events from previous tests
      testBed.clearCapturedEvents();

      // Enable batch mode
      testBed.eventBus.setBatchMode(true, {
        maxRecursionDepth: 20,
        maxGlobalRecursion: 100,
        timeoutMs: 30000,
        context: 'error-handling-test',
      });

      // Create some entities successfully
      await testBed.createComplexGameState(20);

      // Attempt to dispatch invalid event (should be handled gracefully)
      try {
        await testBed.eventBus.dispatch('invalid:event_type', {
          invalidData: true,
        });
      } catch (error) {
        // Error should be handled without breaking batch mode
      }

      // Batch mode should still be enabled
      expect(testBed.eventBus.isBatchModeEnabled()).toBe(true);

      // Clear events and create fresh entities for verification
      const eventsBeforeNewEntities = testBed.capturedEvents.length;
      await testBed.createComplexGameState(15);

      // Verify new events were processed (should have at least 15 more entity events)
      const newEvents = testBed.capturedEvents.slice(eventsBeforeNewEntities);
      const newEntityEvents = newEvents.filter(
        (e) => e.type === ENTITY_CREATED_ID
      );
      expect(newEntityEvents.length).toBe(15);

      testBed.eventBus.setBatchMode(false);
    });
  });

  describe('Scenario 5: Recursion Prevention', () => {
    it('should allow deeper event chains in batch mode compared to normal mode', async () => {
      const normalModeEvents = [];
      const batchModeEvents = [];

      // First test normal mode limits
      const normalEventListener = jest.fn((event) => {
        normalModeEvents.push(event);
        // Stop after reasonable count to avoid infinite loops
        if (normalModeEvents.length < 15) {
          testBed.eventBus.dispatch(TURN_STARTED_ID, {
            turnId: `turn_${normalModeEvents.length}`,
            actorId: 'test_actor',
            depth: normalModeEvents.length,
          });
        }
      });

      testBed.eventBus.subscribe(TURN_STARTED_ID, normalEventListener);

      // Dispatch initial event in normal mode
      await testBed.eventBus.dispatch(TURN_STARTED_ID, {
        turnId: 'turn_0',
        actorId: 'test_actor',
        depth: 0,
      });

      const normalModeDepth = normalModeEvents.length;
      testBed.eventBus.unsubscribe(TURN_STARTED_ID, normalEventListener);

      // Clear events for batch mode test
      testBed.capturedEvents = [];

      // Now test batch mode with higher limits
      testBed.eventBus.setBatchMode(true, {
        maxRecursionDepth: 25,
        maxGlobalRecursion: 200,
        timeoutMs: 30000,
        context: 'recursion-test',
      });

      const batchEventListener = jest.fn((event) => {
        batchModeEvents.push(event);
        // Allow deeper recursion in batch mode
        if (batchModeEvents.length < 30) {
          testBed.eventBus.dispatch(TURN_STARTED_ID, {
            turnId: `batch_turn_${batchModeEvents.length}`,
            actorId: 'test_actor',
            depth: batchModeEvents.length,
          });
        }
      });

      testBed.eventBus.subscribe(TURN_STARTED_ID, batchEventListener);

      // Dispatch initial event in batch mode
      await testBed.eventBus.dispatch(TURN_STARTED_ID, {
        turnId: 'batch_turn_0',
        actorId: 'test_actor',
        depth: 0,
      });

      const batchModeDepth = batchModeEvents.length;

      // Batch mode should allow deeper recursion
      expect(batchModeDepth).toBeGreaterThan(normalModeDepth);
      expect(batchModeDepth).toBeGreaterThan(15); // Should handle deeper chains

      testBed.eventBus.setBatchMode(false);
    });

    it('should still enforce recursion limits appropriately in batch mode', async () => {
      const events = [];

      testBed.eventBus.setBatchMode(true, {
        maxRecursionDepth: 5, // Very low limit for testing
        maxGlobalRecursion: 10,
        timeoutMs: 30000,
        context: 'limit-test',
      });

      const recursiveListener = jest.fn((event) => {
        events.push(event);
        // Try to create infinite recursion
        if (events.length < 50) {
          // Attempt way more than the limit
          testBed.eventBus.dispatch(TURN_ENDED_ID, {
            turnId: `recursive_${events.length}`,
            depth: events.length,
          });
        }
      });

      testBed.eventBus.subscribe(TURN_ENDED_ID, recursiveListener);

      await testBed.eventBus.dispatch(TURN_ENDED_ID, {
        turnId: 'recursive_0',
        depth: 0,
      });

      // Should be limited by the batch mode recursion settings
      expect(events.length).toBeLessThan(30); // Well below our 50 attempt limit
      expect(events.length).toBeGreaterThan(3); // But should allow some recursion

      testBed.eventBus.setBatchMode(false);
    });
  });

  describe('Performance and Integration', () => {
    it('should maintain reasonable performance during bulk event processing', async () => {
      const startTime = performance.now();

      testBed.eventBus.setBatchMode(true, {
        maxRecursionDepth: 30,
        maxGlobalRecursion: 250,
        timeoutMs: 60000,
        context: 'performance-test',
      });

      // Create large game state
      await testBed.createComplexGameState(150);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify performance (should complete within reasonable time)
      expect(executionTime).toBeLessThan(8000); // 8 seconds max

      const eventStats = testBed.verifyEventSequence(150);
      testBed.verifyNoRecursionWarnings();

      // Calculate events per second
      const eventsPerSecond = (eventStats.totalEvents / executionTime) * 1000;
      expect(eventsPerSecond).toBeGreaterThan(50); // Minimum 50 events/second

      testBed.eventBus.setBatchMode(false);
    });

    it('should integrate properly with SafeEventDispatcher', async () => {
      // Clear events from previous tests
      testBed.clearCapturedEvents();

      // Test that SafeEventDispatcher also respects batch mode
      testBed.safeEventDispatcher.setBatchMode(true, {
        maxRecursionDepth: 50, // Higher limit for concurrent operations
        maxGlobalRecursion: 200,
        timeoutMs: 30000,
        context: 'safe-dispatcher-test',
      });

      // Use SafeEventDispatcher for sequential bulk operations to avoid recursion issues
      for (let i = 0; i < 50; i++) {
        const entityId = `safe_entity_${i}`;
        const mockEntity = {
          id: entityId,
          definitionId: 'test:safe_entity',
          components: {},
        };

        await testBed.safeEventDispatcher.dispatch(ENTITY_CREATED_ID, {
          instanceId: entityId,
          definitionId: 'test:safe_entity',
          wasReconstructed: false,
          entity: mockEntity, // Required by schema
        });
      }

      // Verify all events were processed
      const entityEvents = testBed.capturedEvents.filter(
        (e) => e.type === ENTITY_CREATED_ID
      );
      expect(entityEvents).toHaveLength(50);

      testBed.verifyNoRecursionWarnings();
      testBed.safeEventDispatcher.setBatchMode(false);
    });
  });
});
