/**
 * @file Unit tests for ActionAwareStructuredTrace performance features (ACTTRA-018)
 * Tests performance timing capture and analysis capabilities
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import PerformanceMonitor from '../../../../src/actions/tracing/performanceMonitor.js';
import { createTestBed } from '../../../common/testBed.js';

describe('ActionAwareStructuredTrace - Performance Features (ACTTRA-018)', () => {
  let testBed;
  let trace;
  let mockFilter;
  let mockPerformanceMonitor;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create mock filter that allows all traces with verbose level for performance tests
    mockFilter = {
      shouldTrace: jest.fn(() => true),
      isEnabled: jest.fn(() => true),
      getVerbosityLevel: jest.fn(() => 'verbose'),
      getInclusionConfig: jest.fn(() => ({
        componentData: true,
        prerequisites: true,
        targets: true,
      })),
    };

    // Create mock performance monitor
    mockPerformanceMonitor = {
      trackOperation: jest.fn(),
      checkThreshold: jest.fn(),
      recordMetric: jest.fn(),
      getRealtimeMetrics: jest.fn(() => ({
        activeSpans: 0,
        completedSpans: 0,
        totalOperations: 0,
        errorCount: 0,
        currentDuration: 0,
      })),
    };

    // Create trace with performance monitoring enabled
    trace = new ActionAwareStructuredTrace({
      actionTraceFilter: mockFilter,
      actorId: 'test-actor',
      context: { testContext: 'value' },
      logger: mockLogger,
      traceConfig: { enablePerformanceTracking: true },
      performanceMonitor: mockPerformanceMonitor,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Performance Timing Capture', () => {
    it('should capture performance timing data with action data', async () => {
      // Arrange
      const stage = 'component_filtering';
      const actionId = 'core:test-action';
      const data = { testData: 'value', passed: true };

      // Mock performance.now() to return predictable values
      const originalPerformanceNow = performance.now;
      let performanceCounter = 1000;
      performance.now = jest.fn(() => performanceCounter++);

      // Act
      trace.captureActionData(stage, actionId, data);

      // Assert
      const tracedActions = trace.getTracedActions();
      const actionTrace = tracedActions.get(actionId);

      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages[stage]).toBeDefined();
      expect(actionTrace.stages[stage].data._performance).toBeDefined();
      expect(actionTrace.stages[stage].data._performance).toEqual({
        captureTime: 1000,
        stage: stage,
        actionId: actionId,
        timestamp: expect.any(Number),
      });

      // Verify original data is preserved
      expect(actionTrace.stages[stage].data.testData).toBe('value');
      expect(actionTrace.stages[stage].data.passed).toBe(true);

      // Restore original performance.now
      performance.now = originalPerformanceNow;
    });

    it('should integrate with performance monitor when available', async () => {
      // Arrange
      const stage = 'prerequisite_evaluation';
      const actionId = 'core:test-action';
      const data = { passed: false };

      // Act
      trace.captureActionData(stage, actionId, data);

      // Assert
      expect(mockPerformanceMonitor.trackOperation).toHaveBeenCalledWith(
        'stage_prerequisite_evaluation',
        expect.any(Number)
      );
    });

    it('should handle performance monitor errors gracefully', async () => {
      // Arrange
      mockPerformanceMonitor.trackOperation = jest.fn(() => {
        throw new Error('Monitor error');
      });

      const stage = 'component_filtering';
      const actionId = 'core:test-action';
      const data = { passed: true };

      // Act & Assert - should not throw
      expect(() => {
        trace.captureActionData(stage, actionId, data);
      }).not.toThrow();

      // Should still capture the data
      const tracedActions = trace.getTracedActions();
      const actionTrace = tracedActions.get(actionId);
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages[stage].data._performance).toBeDefined();
    });

    it('should work without performance monitor', async () => {
      // Arrange - create trace without performance monitor
      const traceWithoutMonitor = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: mockLogger,
      });

      const stage = 'action_formatting';
      const actionId = 'core:test-action';
      const data = { formatted: true };

      // Act
      traceWithoutMonitor.captureActionData(stage, actionId, data);

      // Assert
      const tracedActions = traceWithoutMonitor.getTracedActions();
      const actionTrace = tracedActions.get(actionId);

      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages[stage].data._performance).toBeDefined();
      expect(actionTrace.stages[stage].data._performance.captureTime).toEqual(
        expect.any(Number)
      );
    });
  });

  describe('Stage Performance Calculation', () => {
    it('should calculate stage performance from captured timing data', async () => {
      // Arrange - mock performance.now() for consistent timing
      const originalPerformanceNow = performance.now;
      let performanceCounter = 1000;
      performance.now = jest.fn(() => (performanceCounter += 100)); // Increment by 100ms each call

      const actionId = 'core:test-action';

      // Capture data for multiple stages
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });
      trace.captureActionData('prerequisite_evaluation', actionId, {
        passed: true,
      });
      trace.captureActionData('multi_target_resolution', actionId, {
        resolved: true,
      });

      // Act
      const stagePerformance = trace.calculateStagePerformance(actionId);

      // Assert
      expect(stagePerformance).toBeDefined();
      expect(Object.keys(stagePerformance)).toHaveLength(3);

      // Check first stage (should have no duration from previous)
      expect(stagePerformance.component_filtering).toEqual({
        startTime: 1100,
        endTime: 1100,
        duration: 0,
        timestamp: expect.any(Number),
      });

      // Check second stage (should have duration from first)
      expect(stagePerformance.prerequisite_evaluation).toEqual({
        startTime: 1100,
        endTime: 1200,
        duration: 100,
        timestamp: expect.any(Number),
      });

      // Check third stage (should have duration from second)
      expect(stagePerformance.multi_target_resolution).toEqual({
        startTime: 1200,
        endTime: 1300,
        duration: 100,
        timestamp: expect.any(Number),
      });

      // Restore original performance.now
      performance.now = originalPerformanceNow;
    });

    it('should return null for non-existent actions', () => {
      // Act
      const stagePerformance = trace.calculateStagePerformance(
        'non-existent-action'
      );

      // Assert
      expect(stagePerformance).toBeNull();
    });

    it('should handle stages without performance data gracefully', async () => {
      // Arrange
      const actionId = 'core:test-action';

      // Manually add stage data without performance metadata
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });

      // Manually modify the traced data to remove performance data
      const tracedActions = trace.getTracedActions();
      const actionTrace = tracedActions.get(actionId);
      delete actionTrace.stages.component_filtering.data._performance;

      // Act
      const stagePerformance = trace.calculateStagePerformance(actionId);

      // Assert
      expect(stagePerformance).toEqual({}); // Should return empty object
    });

    it('should sort stages by timestamp for correct calculation', async () => {
      // Arrange - create stages with different timestamps
      const actionId = 'core:test-action';

      // Mock performance.now to return specific values
      const originalPerformanceNow = performance.now;
      performance.now = jest
        .fn()
        .mockReturnValueOnce(3000) // third stage first
        .mockReturnValueOnce(1000) // first stage second
        .mockReturnValueOnce(2000); // second stage third

      // Capture stages in non-chronological order
      trace.captureActionData('multi_target_resolution', actionId, {
        resolved: true,
      });
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });
      trace.captureActionData('prerequisite_evaluation', actionId, {
        passed: true,
      });

      // Manually set timestamps to ensure proper sorting
      const tracedActions = trace.getTracedActions();
      const actionTrace = tracedActions.get(actionId);
      actionTrace.stages.component_filtering.timestamp = 1000;
      actionTrace.stages.prerequisite_evaluation.timestamp = 2000;
      actionTrace.stages.multi_target_resolution.timestamp = 3000;

      // Act
      const stagePerformance = trace.calculateStagePerformance(actionId);

      // Assert
      expect(Object.keys(stagePerformance)).toEqual([
        'component_filtering',
        'prerequisite_evaluation',
        'multi_target_resolution',
      ]);

      // Restore original performance.now
      performance.now = originalPerformanceNow;
    });
  });

  describe('Constructor Performance Monitor Integration', () => {
    it('should initialize with performance monitor when configured', () => {
      // Arrange & Act
      const traceWithMonitor = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: mockLogger,
        traceConfig: { enablePerformanceTracking: true },
        performanceMonitor: mockPerformanceMonitor,
      });

      // Assert
      expect(traceWithMonitor.performanceMonitor).toBe(mockPerformanceMonitor);
    });

    it('should not initialize performance monitor when disabled in config', () => {
      // Arrange & Act
      const traceWithoutMonitor = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: mockLogger,
        traceConfig: { enablePerformanceTracking: false },
        performanceMonitor: mockPerformanceMonitor,
      });

      // Assert
      expect(traceWithoutMonitor.performanceMonitor).toBeUndefined();
    });

    it('should not initialize performance monitor when no config provided', () => {
      // Arrange & Act
      const traceWithoutConfig = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: mockLogger,
        performanceMonitor: mockPerformanceMonitor,
      });

      // Assert
      expect(traceWithoutConfig.performanceMonitor).toBeUndefined();
    });

    it('should not initialize performance monitor when monitor not provided', () => {
      // Arrange & Act
      const traceWithoutMonitor = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: mockLogger,
        traceConfig: { enablePerformanceTracking: true },
      });

      // Assert
      expect(traceWithoutMonitor.performanceMonitor).toBeUndefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should not affect existing captureActionData behavior', async () => {
      // Arrange
      const stage = 'component_filtering';
      const actionId = 'core:test-action';
      const data = {
        actorComponents: ['core:position'],
        requiredComponents: ['core:position'],
        passed: true,
      };

      // Act
      trace.captureActionData(stage, actionId, data);

      // Assert
      const tracedActions = trace.getTracedActions();
      const actionTrace = tracedActions.get(actionId);

      // Original functionality should work
      expect(actionTrace.actionId).toBe(actionId);
      expect(actionTrace.stages[stage].data.actorComponents).toEqual([
        'core:position',
      ]);
      expect(actionTrace.stages[stage].data.requiredComponents).toEqual([
        'core:position',
      ]);
      expect(actionTrace.stages[stage].data.passed).toBe(true);
      expect(actionTrace.stages[stage].timestamp).toEqual(expect.any(Number));
      expect(actionTrace.stages[stage].stageCompletedAt).toEqual(
        expect.any(Number)
      );
    });

    it('should not affect existing trace methods', () => {
      // Arrange
      const actionId = 'core:test-action';
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });

      // Act & Assert - existing methods should still work
      expect(trace.getTracedActions()).toBeInstanceOf(Map);
      expect(trace.getActionTrace(actionId)).toBeDefined();
      expect(trace.isActionTraced(actionId)).toBe(true);
      expect(trace.getTracingSummary()).toEqual({
        tracedActionCount: 1,
        totalStagesTracked: 1,
        sessionDuration: expect.any(Number),
        averageStagesPerAction: 1,
      });
      expect(trace.getActionTraceFilter()).toBe(mockFilter);
      expect(trace.getActorId()).toBe('test-actor');
    });

    it('should handle trace filtering correctly with performance data', async () => {
      // Arrange - mock filter to reject certain actions
      mockFilter.shouldTrace = jest.fn(
        (actionId) => actionId !== 'filtered-action'
      );

      const includedActionId = 'core:included-action';
      const excludedActionId = 'filtered-action';

      // Act
      trace.captureActionData('component_filtering', includedActionId, {
        passed: true,
      });
      trace.captureActionData('component_filtering', excludedActionId, {
        passed: true,
      });

      // Assert
      const tracedActions = trace.getTracedActions();
      expect(tracedActions.has(includedActionId)).toBe(true);
      expect(tracedActions.has(excludedActionId)).toBe(false);

      // Performance calculation should work for included action
      const stagePerformance =
        trace.calculateStagePerformance(includedActionId);
      expect(stagePerformance).toBeDefined();

      // Performance calculation should return null for excluded action
      const excludedPerformance =
        trace.calculateStagePerformance(excludedActionId);
      expect(excludedPerformance).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid inputs gracefully in calculateStagePerformance', () => {
      // Act & Assert - production code returns null for non-existent actions, doesn't validate inputs
      expect(trace.calculateStagePerformance('')).toBeNull();
      expect(trace.calculateStagePerformance(null)).toBeNull();
      expect(trace.calculateStagePerformance(undefined)).toBeNull();
    });

    it('should continue working when performance timing fails', async () => {
      // Arrange - mock performance.now to throw
      const originalPerformanceNow = performance.now;
      performance.now = jest.fn(() => {
        throw new Error('Performance API failed');
      });

      const stage = 'component_filtering';
      const actionId = 'core:test-action';
      const data = { passed: true };

      // Act & Assert - should not throw
      expect(() => {
        trace.captureActionData(stage, actionId, data);
      }).not.toThrow();

      // Production code catches all errors and logs them. Action trace is created but no stage data is captured when performance.now() fails
      const tracedActions = trace.getTracedActions();
      const actionTrace = tracedActions.get(actionId);
      expect(actionTrace).toBeDefined(); // Action trace is initialized before performance.now() call
      expect(Object.keys(actionTrace.stages)).toHaveLength(0); // But no stages are captured due to error

      // Restore original performance.now
      performance.now = originalPerformanceNow;
    });
  });
});
