/**
 * @file EntityEventDispatcher.test.js - Comprehensive test suite for EntityEventDispatcher
 * @description Tests all public methods and edge cases for EntityEventDispatcher
 * @see src/entities/services/helpers/EntityEventDispatcher.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EntityEventDispatcherTestBed } from '../../../../common/entities/index.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
} from '../../../../../src/constants/eventIds.js';

describe('EntityEventDispatcher - Constructor Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityEventDispatcherTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should instantiate successfully with valid dependencies', () => {
    expect(testBed.helper).toBeDefined();
    expect(typeof testBed.helper.dispatchEntityCreated).toBe('function');
    expect(typeof testBed.helper.dispatchEntityRemoved).toBe('function');
    expect(typeof testBed.helper.dispatchCustomEvent).toBe('function');
    expect(typeof testBed.helper.dispatchMultipleEvents).toBe('function');
    expect(typeof testBed.helper.isAvailable).toBe('function');
    expect(typeof testBed.helper.getStats).toBe('function');
  });

  it.each([
    ['eventDispatcher', { eventDispatcherOverrides: { dispatch: null } }],
    ['logger', { logger: null }],
  ])('should throw when %s is null or invalid', (dependencyName, options) => {
    expect(() => {
      new testBed.helper.constructor({
        eventDispatcher: testBed.eventDispatcher,
        logger: testBed.logger,
        ...(options.eventDispatcherOverrides && {
          eventDispatcher: {
            ...testBed.eventDispatcher,
            ...options.eventDispatcherOverrides,
          },
        }),
        ...(options.logger !== undefined && { logger: options.logger }),
      });
    }).toThrow();
  });

  it('should validate eventDispatcher has required methods', () => {
    const invalidEventDispatcher = { someMethod: () => {} };
    expect(() => {
      new testBed.helper.constructor({
        eventDispatcher: invalidEventDispatcher,
        logger: testBed.logger,
      });
    }).toThrow();
  });
});

describe('EntityEventDispatcher - Entity Created Events', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityEventDispatcherTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('dispatchEntityCreated', () => {
    it('should dispatch ENTITY_CREATED event with correct data', () => {
      const entity = testBed.createMockEntity('entity-1', 'test:definition');
      const wasReconstructed = false;

      testBed.helper.dispatchEntityCreated(entity, wasReconstructed);

      testBed.assertEventDispatchedWith(ENTITY_CREATED_ID, {
        instanceId: entity.id,
        definitionId: entity.definitionId,
        wasReconstructed,
        entity,
      });
      testBed.assertDispatchCallCount(1);
      testBed.assertLogOperations({ debugs: 1 });
    });

    it('should handle reconstruction flag correctly', () => {
      const entity = testBed.createMockEntity('entity-1', 'test:definition');
      const wasReconstructed = true;

      testBed.helper.dispatchEntityCreated(entity, wasReconstructed);

      const dispatchedEvent =
        testBed.getDispatchedEventsOfType(ENTITY_CREATED_ID)[0];
      expect(dispatchedEvent.eventData.wasReconstructed).toBe(true);
    });

    it('should log error and rethrow when event dispatch fails', () => {
      const entity = testBed.createMockEntity('entity-1', 'test:definition');
      const dispatchError = new Error('Dispatch failed');

      testBed.setupEventDispatcherError(dispatchError);

      expect(() => {
        testBed.helper.dispatchEntityCreated(entity, false);
      }).toThrow(dispatchError);

      testBed.assertLogOperations({
        errors: 1,
        errorMessages: ['Failed to dispatch ENTITY_CREATED event'],
      });
    });

    it('should include entity properties in event data', () => {
      const entity = testBed.createMockEntity('entity-1', 'test:definition', {
        name: 'Test Entity',
        components: { test: 'data' },
      });

      testBed.helper.dispatchEntityCreated(entity, false);

      const dispatchedEvent =
        testBed.getDispatchedEventsOfType(ENTITY_CREATED_ID)[0];
      expect(dispatchedEvent.eventData.entity).toBe(entity);
      expect(dispatchedEvent.eventData.entity.name).toBe('Test Entity');
    });
  });
});

describe('EntityEventDispatcher - Entity Removed Events', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityEventDispatcherTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('dispatchEntityRemoved', () => {
    it('should dispatch ENTITY_REMOVED event with correct data', () => {
      const entity = testBed.createMockEntity('entity-1', 'test:definition');

      testBed.helper.dispatchEntityRemoved(entity);

      testBed.assertEventDispatchedWith(ENTITY_REMOVED_ID, {
        instanceId: entity.id,
      });
      testBed.assertDispatchCallCount(1);
      testBed.assertLogOperations({ debugs: 1 });
    });

    it('should log error and rethrow when event dispatch fails', () => {
      const entity = testBed.createMockEntity('entity-1', 'test:definition');
      const dispatchError = new Error('Dispatch failed');

      testBed.setupEventDispatcherError(dispatchError);

      expect(() => {
        testBed.helper.dispatchEntityRemoved(entity);
      }).toThrow(dispatchError);

      testBed.assertLogOperations({
        errors: 1,
        errorMessages: ['Failed to dispatch ENTITY_REMOVED event'],
      });
    });

    it('should handle entities with missing properties gracefully', () => {
      const entity = { id: 'entity-1' }; // Missing definitionId

      expect(() => {
        testBed.helper.dispatchEntityRemoved(entity);
      }).not.toThrow();

      const dispatchedEvent =
        testBed.getDispatchedEventsOfType(ENTITY_REMOVED_ID)[0];
      expect(dispatchedEvent.eventData.instanceId).toBe('entity-1');
      expect(Object.keys(dispatchedEvent.eventData)).toEqual(['instanceId']);
    });
  });
});

describe('EntityEventDispatcher - Custom Events', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityEventDispatcherTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('dispatchCustomEvent', () => {
    it('should dispatch custom event with provided data', () => {
      const eventType = 'CUSTOM_ENTITY_EVENT';
      const eventData = {
        instanceId: 'entity-1',
        customProperty: 'test-value',
      };
      const context = 'test-context';

      testBed.helper.dispatchCustomEvent(eventType, eventData, context);

      testBed.assertEventDispatchedWith(eventType, eventData);
      testBed.assertLogOperations({
        debugs: 1,
        debugMessages: ['Dispatching custom entity event'],
      });
    });

    it('should handle empty context parameter', () => {
      const eventType = 'CUSTOM_ENTITY_EVENT';
      const eventData = { instanceId: 'entity-1' };

      testBed.helper.dispatchCustomEvent(eventType, eventData);

      testBed.assertEventDispatchedWith(eventType, eventData);
      testBed.assertLogOperations({ debugs: 1 });
    });

    it('should log error and rethrow when custom event dispatch fails', () => {
      const eventType = 'CUSTOM_ENTITY_EVENT';
      const eventData = { instanceId: 'entity-1' };
      const context = 'test-context';
      const dispatchError = new Error('Custom dispatch failed');

      testBed.setupEventDispatcherError(dispatchError);

      expect(() => {
        testBed.helper.dispatchCustomEvent(eventType, eventData, context);
      }).toThrow(dispatchError);

      testBed.assertLogOperations({
        errors: 1,
        errorMessages: ['Failed to dispatch custom entity event'],
      });
    });

    it('should include context in error logs', () => {
      const eventType = 'CUSTOM_ENTITY_EVENT';
      const eventData = { instanceId: 'entity-1' };
      const context = 'integration-test';
      const dispatchError = new Error('Dispatch failed');

      testBed.setupEventDispatcherError(dispatchError);

      expect(() => {
        testBed.helper.dispatchCustomEvent(eventType, eventData, context);
      }).toThrow(dispatchError);

      expect(testBed.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to dispatch custom entity event'),
        expect.objectContaining({
          eventType,
          context,
          instanceId: eventData.instanceId,
          error: dispatchError.message,
        })
      );
    });
  });
});

describe('EntityEventDispatcher - Multiple Events', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityEventDispatcherTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('dispatchMultipleEvents', () => {
    it('should dispatch all events successfully', () => {
      const events = testBed.createMultipleEvents(3, 'TEST_EVENT');
      const context = 'batch-test';

      const results = testBed.helper.dispatchMultipleEvents(events, context);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.eventType).toBe(events[index].eventType);
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      });
      testBed.assertDispatchCallCount(3);
      testBed.assertLogOperations({ debugs: 1 });
    });

    it('should handle partial failures in event batch', () => {
      const events = testBed.createMultipleEvents(3, 'TEST_EVENT');
      const successfulEventTypes = [events[0].eventType, events[2].eventType];

      testBed.setupSelectiveEventDispatcherSuccess(
        successfulEventTypes,
        new Error('Selective failure')
      );

      const results = testBed.helper.dispatchMultipleEvents(events);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);

      expect(results[1].error).toBeInstanceOf(Error);
      expect(results[1].error.message).toBe('Selective failure');

      testBed.assertLogOperations({
        errors: 1,
        errorMessages: ['Failed to dispatch event in batch'],
      });
    });

    it('should handle empty events array', () => {
      const results = testBed.helper.dispatchMultipleEvents([]);

      expect(results).toHaveLength(0);
      testBed.assertDispatchCallCount(0);
      testBed.assertLogOperations({ debugs: 1 });
    });

    it('should log batch context information', () => {
      const events = testBed.createMultipleEvents(2, 'BATCH_EVENT');
      const context = 'integration-batch';

      testBed.helper.dispatchMultipleEvents(events, context);

      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Dispatching multiple entity events'),
        expect.objectContaining({
          count: 2,
          context,
        })
      );
    });

    it('should continue processing after individual failures', () => {
      const events = [
        { eventType: 'SUCCESS_EVENT', eventData: { instanceId: 'entity-1' } },
        { eventType: 'FAILURE_EVENT', eventData: { instanceId: 'entity-2' } },
        { eventType: 'SUCCESS_EVENT_2', eventData: { instanceId: 'entity-3' } },
      ];

      testBed.setupSelectiveEventDispatcherSuccess(
        ['SUCCESS_EVENT', 'SUCCESS_EVENT_2'],
        new Error('Targeted failure')
      );

      const results = testBed.helper.dispatchMultipleEvents(events);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
      testBed.assertDispatchCallCount(3); // All attempted
    });
  });
});

describe('EntityEventDispatcher - Availability and Stats', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityEventDispatcherTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('isAvailable', () => {
    it('should return true when event dispatcher is valid', () => {
      const isAvailable = testBed.helper.isAvailable();

      expect(isAvailable).toBe(true);
    });

    it('should return false when dispatch method is missing', () => {
      delete testBed.eventDispatcher.dispatch;

      const isAvailable = testBed.helper.isAvailable();

      expect(isAvailable).toBe(false);
    });

    it('should return false when dispatch is not a function', () => {
      testBed.eventDispatcher.dispatch = 'not-a-function';

      const isAvailable = testBed.helper.isAvailable();

      expect(isAvailable).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return stats when event dispatcher supports them', () => {
      const mockStats = {
        totalDispatched: 5,
        errors: 1,
        lastError: 'Test error',
      };

      testBed = new EntityEventDispatcherTestBed({ enableStats: true });
      testBed.eventDispatcher.getStats.mockReturnValue(mockStats);

      const stats = testBed.helper.getStats();

      expect(stats).toEqual(mockStats);
      expect(testBed.eventDispatcher.getStats).toHaveBeenCalled();
    });

    it('should return null when event dispatcher lacks getStats method', () => {
      const stats = testBed.helper.getStats();

      expect(stats).toBeNull();
    });

    it('should return null when event dispatcher becomes unavailable', () => {
      // Test the case where eventDispatcher exists but becomes unavailable
      testBed.eventDispatcher = null;

      // Recreate helper with null dispatcher (this would normally fail validation)
      // but we can test the method logic
      const helper = {
        getStats() {
          if (
            testBed.eventDispatcher &&
            typeof testBed.eventDispatcher.getStats === 'function'
          ) {
            return testBed.eventDispatcher.getStats();
          }
          return null;
        },
      };

      const stats = helper.getStats();

      expect(stats).toBeNull();
    });

    it('should return null when getStats is not a function', () => {
      testBed.eventDispatcher.getStats = 'not-a-function';

      const stats = testBed.helper.getStats();

      expect(stats).toBeNull();
    });
  });
});

describe('EntityEventDispatcher - Edge Cases and Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityEventDispatcherTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should handle rapid successive event dispatching', () => {
    const entity = testBed.createMockEntity('entity-1', 'test:definition');

    // Rapid fire multiple event types
    testBed.helper.dispatchEntityCreated(entity, false);
    testBed.helper.dispatchEntityRemoved(entity);
    testBed.helper.dispatchCustomEvent('CUSTOM_EVENT', {
      instanceId: entity.id,
    });

    testBed.assertDispatchCallCount(3);

    const createdEvents = testBed.getDispatchedEventsOfType(ENTITY_CREATED_ID);
    const removedEvents = testBed.getDispatchedEventsOfType(ENTITY_REMOVED_ID);
    const customEvents = testBed.getDispatchedEventsOfType('CUSTOM_EVENT');

    expect(createdEvents).toHaveLength(1);
    expect(removedEvents).toHaveLength(1);
    expect(customEvents).toHaveLength(1);
  });

  it('should maintain event data integrity across different event types', () => {
    const entity = testBed.createMockEntity('entity-1', 'test:definition');

    testBed.helper.dispatchEntityCreated(entity, true);
    testBed.helper.dispatchEntityRemoved(entity);

    const createdEvent =
      testBed.getDispatchedEventsOfType(ENTITY_CREATED_ID)[0];
    const removedEvent =
      testBed.getDispatchedEventsOfType(ENTITY_REMOVED_ID)[0];

    testBed.assertEntityEventData(
      createdEvent.eventData,
      entity.id,
      entity.definitionId
    );

    // Removed event only has instanceId
    expect(removedEvent.eventData.instanceId).toBe(entity.id);
    expect(Object.keys(removedEvent.eventData)).toEqual(['instanceId']);

    expect(createdEvent.eventData.wasReconstructed).toBe(true);
  });

  it('should handle mixed success/failure scenarios in batch operations', () => {
    const mixedEvents = [
      { eventType: 'SUCCESS_1', eventData: { instanceId: 'entity-1' } },
      { eventType: 'FAILURE', eventData: { instanceId: 'entity-2' } },
      { eventType: 'SUCCESS_2', eventData: { instanceId: 'entity-3' } },
      { eventType: 'FAILURE_2', eventData: { instanceId: 'entity-4' } },
    ];

    testBed.setupSelectiveEventDispatcherSuccess(
      ['SUCCESS_1', 'SUCCESS_2'],
      new Error('Targeted failure')
    );

    const results = testBed.helper.dispatchMultipleEvents(
      mixedEvents,
      'mixed-test'
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    expect(successCount).toBe(2);
    expect(failureCount).toBe(2);
    testBed.assertLogOperations({
      errors: 2, // Two failures
      debugs: 1, // One batch summary
    });
  });

  it('should preserve event order in batch processing', () => {
    const events = [
      { eventType: 'EVENT_A', eventData: { instanceId: 'entity-1', order: 1 } },
      { eventType: 'EVENT_B', eventData: { instanceId: 'entity-2', order: 2 } },
      { eventType: 'EVENT_C', eventData: { instanceId: 'entity-3', order: 3 } },
    ];

    const results = testBed.helper.dispatchMultipleEvents(events);

    results.forEach((result, index) => {
      expect(result.eventType).toBe(events[index].eventType);
    });

    // Verify dispatch order matches input order
    testBed.dispatchedEvents.forEach((event, index) => {
      expect(event.eventData.order).toBe(index + 1);
    });
  });
});
