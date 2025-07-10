/**
 * @file EntityEventDispatcherTestBed - Test helper for EntityEventDispatcher tests
 * @description Provides centralized setup and utilities for testing EntityEventDispatcher
 */

import { jest } from '@jest/globals';
import EntityEventDispatcher from '../../../src/entities/services/helpers/EntityEventDispatcher.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../mockFactories/index.js';
import BaseTestBed from '../baseTestBed.js';

/**
 * TestBed for EntityEventDispatcher providing mocks and utilities
 */
export class EntityEventDispatcherTestBed extends BaseTestBed {
  /**
   * Creates a new EntityEventDispatcherTestBed instance.
   *
   * @param {object} [options] - Configuration options
   * @param {object} [options.eventDispatcherOverrides] - Event dispatcher method overrides
   * @param {boolean} [options.enableStats] - Enable event dispatcher statistics
   */
  constructor({ eventDispatcherOverrides = {}, enableStats = false } = {}) {
    super();

    // Create mock dependencies
    this.logger = createMockLogger();
    this.eventDispatcher = createMockSafeEventDispatcher();

    // Add stats if enabled
    if (enableStats) {
      this.eventDispatcher.getStats = jest.fn(() => ({
        totalDispatched: 0,
        errors: 0,
        lastError: null,
      }));
    }

    // Apply overrides
    Object.assign(this.eventDispatcher, eventDispatcherOverrides);

    // Create helper instance
    this.helper = new EntityEventDispatcher({
      eventDispatcher: this.eventDispatcher,
      logger: this.logger,
    });

    // Track dispatched events for testing
    this.dispatchedEvents = [];
    this.eventDispatcher.dispatch.mockImplementation((eventType, eventData) => {
      this.dispatchedEvents.push({ eventType, eventData });
      // Don't call original implementation to avoid stack overflow
    });
  }

  /**
   * Creates a mock entity for testing event dispatching.
   *
   * @param {string} id - Entity ID
   * @param {string} [definitionId] - Definition ID
   * @param {object} [additionalProps] - Additional entity properties
   * @returns {object} Mock entity
   */
  createMockEntity(id, definitionId = 'test:definition', additionalProps = {}) {
    return {
      id,
      definitionId,
      ...additionalProps,
    };
  }

  /**
   * Sets up the event dispatcher to throw an error on dispatch.
   *
   * @param {Error} [error] - Error to throw (defaults to generic error)
   */
  setupEventDispatcherError(error = new Error('Event dispatch failed')) {
    this.eventDispatcher.dispatch.mockImplementation((eventType, eventData) => {
      this.dispatchedEvents.push({ eventType, eventData });
      throw error;
    });
  }

  /**
   * Sets up the event dispatcher to succeed for specific event types.
   *
   * @param {string[]} successfulEventTypes - Event types that should succeed
   * @param {Error} [errorForOthers] - Error to throw for other event types
   */
  setupSelectiveEventDispatcherSuccess(
    successfulEventTypes,
    errorForOthers = new Error('Unsupported event type')
  ) {
    this.eventDispatcher.dispatch.mockImplementation((eventType, eventData) => {
      if (successfulEventTypes.includes(eventType)) {
        this.dispatchedEvents.push({ eventType, eventData });
        return;
      }
      throw errorForOthers;
    });
  }

  /**
   * Asserts that specific events were dispatched.
   *
   * @param {object[]} expectedEvents - Expected events
   * @param {string} expectedEvents[].eventType - Expected event type
   * @param {object} [expectedEvents[].eventData] - Expected event data (partial match)
   */
  assertEventsDispatched(expectedEvents) {
    expect(this.dispatchedEvents).toHaveLength(expectedEvents.length);

    expectedEvents.forEach((expected, index) => {
      const actual = this.dispatchedEvents[index];
      expect(actual.eventType).toBe(expected.eventType);

      if (expected.eventData) {
        expect(actual.eventData).toMatchObject(expected.eventData);
      }
    });
  }

  /**
   * Asserts that a specific event was dispatched with exact data.
   *
   * @param {string} eventType - Expected event type
   * @param {object} eventData - Expected event data
   */
  assertEventDispatchedWith(eventType, eventData) {
    expect(this.eventDispatcher.dispatch).toHaveBeenCalledWith(
      eventType,
      eventData
    );
  }

  /**
   * Asserts that the event dispatcher was called a specific number of times.
   *
   * @param {number} times - Expected number of dispatch calls
   */
  assertDispatchCallCount(times) {
    expect(this.eventDispatcher.dispatch).toHaveBeenCalledTimes(times);
  }

  /**
   * Asserts that specific log messages were generated.
   *
   * @param {object} expected - Expected log operations
   * @param {number} [expected.errors] - Expected number of error logs
   * @param {number} [expected.debugs] - Expected number of debug logs
   * @param {string[]} [expected.errorMessages] - Expected error message patterns
   * @param {string[]} [expected.debugMessages] - Expected debug message patterns
   */
  assertLogOperations({ errors, debugs, errorMessages, debugMessages } = {}) {
    if (errors !== undefined) {
      expect(this.logger.error).toHaveBeenCalledTimes(errors);
    }
    if (debugs !== undefined) {
      expect(this.logger.debug).toHaveBeenCalledTimes(debugs);
    }
    if (errorMessages) {
      errorMessages.forEach((pattern) => {
        expect(this.logger.error).toHaveBeenCalledWith(
          expect.stringContaining(pattern),
          expect.any(Object)
        );
      });
    }
    if (debugMessages) {
      debugMessages.forEach((pattern) => {
        expect(this.logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(pattern),
          expect.any(Object)
        );
      });
    }
  }

  /**
   * Creates test data for multiple events.
   *
   * @param {number} count - Number of events to create
   * @param {string} [baseType] - Base event type
   * @returns {Array<{eventType: string, eventData: object}>} Event array
   */
  createMultipleEvents(count, baseType = 'TEST_EVENT') {
    return Array.from({ length: count }, (_, i) => ({
      eventType: `${baseType}_${i}`,
      eventData: {
        instanceId: `entity_${i}`,
        definitionId: `def_${i}`,
        testData: `data_${i}`,
      },
    }));
  }

  /**
   * Asserts that event data contains required entity fields.
   *
   * @param {object} eventData - Event data to validate
   * @param {string} expectedInstanceId - Expected instance ID
   * @param {string} expectedDefinitionId - Expected definition ID
   */
  assertEntityEventData(eventData, expectedInstanceId, expectedDefinitionId) {
    expect(eventData).toMatchObject({
      instanceId: expectedInstanceId,
      definitionId: expectedDefinitionId,
    });
    expect(eventData.entity).toBeDefined();
  }

  /**
   * Gets all dispatched events of a specific type.
   *
   * @param {string} eventType - Event type to filter by
   * @returns {object[]} Filtered events
   */
  getDispatchedEventsOfType(eventType) {
    return this.dispatchedEvents.filter(
      (event) => event.eventType === eventType
    );
  }

  /**
   * Clears the dispatched events history.
   */
  clearDispatchedEvents() {
    this.dispatchedEvents = [];
  }

  /**
   * Cleanup method called after each test.
   */
  cleanup() {
    super.cleanup();
    this.clearDispatchedEvents();
    jest.clearAllMocks();
  }
}

export default EntityEventDispatcherTestBed;
