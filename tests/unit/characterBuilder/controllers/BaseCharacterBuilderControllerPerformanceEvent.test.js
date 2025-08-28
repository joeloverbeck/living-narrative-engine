/**
 * @file Test for BaseCharacterBuilderController performance event dispatch issue
 * @description Reproduces the runtime error with CHARACTER_BUILDER_PERFORMANCE_WARNING event
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BaseCharacterBuilderController } from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';

describe('BaseCharacterBuilderController - Performance Event Dispatch', () => {
  let controller;
  let mockEventBus;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockSchemaValidator;

  beforeEach(() => {
    // Create mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Create mock character builder service
    mockCharacterBuilderService = {
      initialize: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    // Create mock schema validator
    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
    };

    // Create test controller instance
    class TestController extends BaseCharacterBuilderController {
      _cacheElements() {
        // Test implementation
      }

      _setupEventListeners() {
        // Test implementation
      }

      // Expose protected method for testing
      testPerformanceMeasure(measureName, startMark, endMark) {
        return this._performanceMeasure(measureName, startMark, endMark);
      }
    }

    controller = new TestController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
    });
  });

  it('should reproduce the [object Object] error when dispatching performance warning', () => {
    // First, create the performance marks
    controller._performanceMark('startMark');
    controller._performanceMark('endMark');

    // Mock performance.now() to simulate time passing
    const originalNow = performance.now;
    let mockTime = 0;
    performance.now = jest.fn(() => {
      // Return increasing time for each call
      return (mockTime += 100);
    });

    // Create marks with time difference > 100ms
    controller._performanceMark('testStart');
    mockTime = 150; // Advance time
    controller._performanceMark('testEnd');

    // Execute performance measure that will trigger the warning
    const duration = controller.testPerformanceMeasure(
      'testMeasure',
      'testStart',
      'testEnd'
    );

    // Verify the method returned the duration
    expect(duration).toBe(150);

    // Check that dispatch was called
    expect(mockEventBus.dispatch).toHaveBeenCalled();

    // Get the dispatch call arguments
    const dispatchCall = mockEventBus.dispatch.mock.calls[0];

    // After the fix, dispatch should be called with two separate arguments
    expect(dispatchCall.length).toBe(2);

    // First argument should be the event type string
    expect(dispatchCall[0]).toBe(
      CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING
    );

    // Second argument should be the payload object
    expect(dispatchCall[1]).toEqual({
      controller: 'TestController',
      measurement: 'testMeasure',
      duration: 150,
      threshold: 100,
    });

    // Restore original performance.now
    performance.now = originalNow;
  });

  it('should correctly handle performance measurements under threshold', () => {
    // Mock performance.now() to simulate time passing
    const originalNow = performance.now;
    let mockTime = 0;
    performance.now = jest.fn(() => {
      // Return increasing time for each call
      return (mockTime += 25);
    });

    // Create marks with time difference < 100ms
    controller._performanceMark('testStart');
    mockTime = 50; // Advance time only 50ms
    controller._performanceMark('testEnd');

    // Execute performance measure that won't trigger the warning
    const duration = controller.testPerformanceMeasure(
      'testMeasure',
      'testStart',
      'testEnd'
    );

    // Verify the method returned the duration
    expect(duration).toBe(50);

    // Check that dispatch was NOT called (duration under threshold)
    expect(mockEventBus.dispatch).not.toHaveBeenCalled();

    // Restore original performance.now
    performance.now = originalNow;
  });

  it('should handle performance API errors gracefully', () => {
    // Don't create any marks to simulate missing marks error

    // Execute performance measure without marks
    const duration = controller.testPerformanceMeasure(
      'testMeasure',
      'startMark',
      'endMark'
    );

    // Should return null on error
    expect(duration).toBeNull();

    // Should log warning about missing marks
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Performance marks not found for measurement: testMeasure',
      expect.objectContaining({
        startMark: 'startMark',
        endMark: 'endMark',
        hasStartMark: false,
        hasEndMark: false,
      })
    );

    // Should not dispatch any events
    expect(mockEventBus.dispatch).not.toHaveBeenCalled();
  });
});
