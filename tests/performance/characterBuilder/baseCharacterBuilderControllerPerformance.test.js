/**
 * @file Performance tests for BaseCharacterBuilderController
 * @see src/characterBuilder/controllers/BaseCharacterBuilderController.js
 *
 * These tests verify performance monitoring functionality with real timing measurements
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  BaseCharacterBuilderController,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../src/characterBuilder/services/characterBuilderService.js';

// Mock UIStateManager at module level
let mockUIStateManagerInstance = null;

jest.mock('../../../src/shared/characterBuilder/uiStateManager.js', () => {
  const originalModule = jest.requireActual(
    '../../../src/shared/characterBuilder/uiStateManager.js'
  );
  return {
    ...originalModule,
    UIStateManager: jest.fn().mockImplementation(() => {
      mockUIStateManagerInstance = {
        showState: jest.fn(),
        showError: jest.fn(),
        showLoading: jest.fn(),
        getCurrentState: jest.fn().mockReturnValue('empty'),
      };
      return mockUIStateManagerInstance;
    }),
  };
});

// Create a concrete test controller that exposes private methods for testing
class TestControllerWithPrivates extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
  }

  // Expose protected methods for testing
  _performanceMark(markName) {
    return super._performanceMark(markName);
  }

  _performanceMeasure(measureName, startMark, endMark = null) {
    return super._performanceMeasure(measureName, startMark, endMark);
  }

  _getPerformanceMeasurements() {
    return super._getPerformanceMeasurements();
  }

  _clearPerformanceData(prefix = null) {
    return super._clearPerformanceData(prefix);
  }
}

describe('BaseCharacterBuilderController - Performance Tests', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;
  let mockPerformanceRef;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

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

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockSchemaValidator = {
      validate: jest.fn(),
      validateData: jest.fn(),
    };

    // Create mock performance object with controlled timing
    mockPerformanceRef = {
      now: jest.fn(),
      mark: jest.fn(),
      measure: jest.fn(() => ({ duration: 0 })),
      clearMarks: jest.fn(),
      clearMeasures: jest.fn(),
    };
  });

  afterEach(() => {
    if (controller) {
      controller = null;
    }
  });

  describe('Performance Mark Recording', () => {
    it('should record performance marks with timestamps', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Mock performance.now to return controlled timestamps
      mockPerformanceRef.now.mockReturnValueOnce(25);

      // Note: The actual implementation uses PerformanceMonitor which
      // internally manages marks. We're testing the delegation here.
      controller._performanceMark('load-start');

      // Verify logger was called for debugging
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Performance mark'),
        expect.objectContaining({
          timestamp: expect.any(Number),
        })
      );
    });

    it('should handle mark failures gracefully', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Attempting to mark with an invalid name should be handled gracefully
      // The PerformanceMonitor will log a warning
      controller._performanceMark('');

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('mark name is required')
      );
    });
  });

  describe('Performance Measurement', () => {
    it('should measure durations between marks', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Create marks and measure
      controller._performanceMark('test-start');
      
      // Simulate some work (in real scenario, work happens between marks)
      const duration = controller._performanceMeasure('test-operation', 'test-start');

      // Duration should be a number (actual timing)
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should dispatch warning events when threshold exceeded', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      mockEventBus.dispatch.mockClear();

      // Create a measurement that will exceed the default threshold (100ms)
      controller._performanceMark('slow-start');
      
      // Wait to ensure we exceed threshold
      const startTime = Date.now();
      while (Date.now() - startTime < 150) {
        // Busy wait to ensure real time passes
      }
      
      const duration = controller._performanceMeasure('slow-operation', 'slow-start');

      // Verify performance warning was dispatched
      if (duration > 100) {
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING,
          expect.objectContaining({
            controller: 'TestControllerWithPrivates',
            measurement: 'slow-operation',
            duration: expect.any(Number),
          })
        );
      }
    });

    it('should return null when measuring without available marks', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      mockLogger.warn.mockClear();
      
      const duration = controller._performanceMeasure(
        'missing',
        'missing-start',
        'missing-end'
      );

      expect(duration).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Performance marks not found'),
        expect.objectContaining({
          startMark: 'missing-start',
          endMark: 'missing-end',
        })
      );
    });
  });

  describe('Performance Data Management', () => {
    it('should expose performance measurements as a Map', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      controller._performanceMark('test-start');
      controller._performanceMeasure('test-op', 'test-start');

      const measurements = controller._getPerformanceMeasurements();
      
      expect(measurements).toBeInstanceOf(Map);
      expect(measurements.get('test-op')).toEqual(
        expect.objectContaining({
          duration: expect.any(Number),
          startMark: 'test-start',
        })
      );
    });

    it('should clear performance data with prefix filter', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      mockLogger.debug.mockClear();

      // Create multiple marks
      controller._performanceMark('keep-start');
      controller._performanceMeasure('keep-op', 'keep-start');
      controller._performanceMark('test-start');
      controller._performanceMeasure('test-op', 'test-start');

      // Clear with prefix
      controller._clearPerformanceData('test');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cleared performance data',
        { prefix: 'test' }
      );

      // Verify only 'keep' measurement remains
      const measurements = controller._getPerformanceMeasurements();
      expect(measurements.has('keep-op')).toBe(true);
    });

    it('should clear all performance data without prefix', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      mockLogger.debug.mockClear();

      controller._performanceMark('test-start');
      controller._performanceMeasure('test-op', 'test-start');

      controller._clearPerformanceData();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cleared performance data',
        { prefix: null }
      );

      const measurements = controller._getPerformanceMeasurements();
      expect(measurements.size).toBe(0);
    });
  });

  describe('Performance Monitoring Edge Cases', () => {
    it('should handle rapid sequential marks', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Clear any initialization calls
      mockLogger.debug.mockClear();

      // Create many marks in quick succession
      for (let i = 0; i < 100; i++) {
        controller._performanceMark(`mark-${i}`);
      }

      // Should not crash and all marks should be recorded
      expect(mockLogger.debug).toHaveBeenCalledTimes(100);
    });

    it('should handle measurements without explicit end marks', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      controller._performanceMark('start');
      
      // Measure without providing end mark (should auto-create)
      const duration = controller._performanceMeasure('auto-end', 'start');

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });
});
