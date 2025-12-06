/**
 * @file Integration tests for pipeline performance tracking (ACTTRA-018)
 * Tests end-to-end performance tracking across pipeline stages
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
import PipelinePerformanceAnalyzer from '../../../../src/actions/tracing/pipelinePerformanceAnalyzer.js';
import { ComponentFilteringStage } from '../../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { createTestBed } from '../../../common/testBed.js';

describe('Pipeline Performance Tracking Integration (ACTTRA-018)', () => {
  let testBed;
  let trace;
  let performanceMonitor;
  let analyzer;
  let mockLogger;
  let mockFilter;
  let mockTrace;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create mock structured trace for PerformanceMonitor
    mockTrace = {
      getSpans: jest.fn(() => []),
      getActiveSpan: jest.fn(() => null),
    };

    // Create performance monitor
    performanceMonitor = new PerformanceMonitor(mockTrace, {
      slowOperationMs: 100,
      criticalOperationMs: 500,
    });

    // Create filter that allows all traces with component data inclusion
    mockFilter = new ActionTraceFilter({
      enabledActions: ['*'],
      verbosityLevel: 'detailed',
      inclusionConfig: {
        componentData: true,
        prerequisites: true,
        targets: true,
      },
      logger: mockLogger,
    });

    // Create trace with performance monitoring enabled
    trace = new ActionAwareStructuredTrace({
      actionTraceFilter: mockFilter,
      actorId: 'test-actor',
      context: { testContext: 'integration' },
      logger: mockLogger,
      traceConfig: { enablePerformanceTracking: true },
      performanceMonitor: performanceMonitor,
    });

    // Create performance analyzer
    analyzer = new PipelinePerformanceAnalyzer({
      performanceMonitor: performanceMonitor,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('End-to-End Performance Tracking', () => {
    it('should capture performance data across multiple pipeline stages', async () => {
      // Arrange
      const actionId = 'core:test-action';
      const stages = [
        'component_filtering',
        'prerequisite_evaluation',
        'multi_target_resolution',
      ];

      // Mock performance.now() for predictable timing
      const originalPerformanceNow = performance.now;
      let performanceCounter = 1000;
      performance.now = jest.fn(() => (performanceCounter += 50)); // 50ms between stages

      // Act - simulate pipeline stages capturing performance data
      for (const stage of stages) {
        trace.captureActionData(stage, actionId, {
          stage: stage,
          passed: true,
          itemsProcessed: 5,
        });
      }

      // Assert
      const tracedActions = trace.getTracedActions();
      expect(tracedActions.size).toBe(1);

      const actionTrace = tracedActions.get(actionId);
      expect(actionTrace).toBeDefined();
      expect(Object.keys(actionTrace.stages)).toHaveLength(3);

      // Verify performance data is captured for each stage
      for (const stage of stages) {
        expect(actionTrace.stages[stage].data._performance).toBeDefined();
        expect(actionTrace.stages[stage].data._performance.stage).toBe(stage);
        expect(actionTrace.stages[stage].data._performance.captureTime).toEqual(
          expect.any(Number)
        );
      }

      // Restore original performance.now
      performance.now = originalPerformanceNow;
    });

    it('should calculate stage durations correctly from captured data', async () => {
      // Arrange
      const actionId = 'core:multi-stage-action';

      // Mock performance.now() with specific timing for each stage capture
      const originalPerformanceNow = performance.now;
      let stageCounter = 0;
      const stageTimes = [1000, 1100, 1350]; // Times for each stage
      performance.now = jest.fn(() => {
        // Return the time for the current stage
        if (stageCounter < stageTimes.length) {
          return stageTimes[stageCounter];
        }
        return 2000; // Default for any extra calls
      });

      // Act
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });
      stageCounter++; // Move to next stage time
      trace.captureActionData('prerequisite_evaluation', actionId, {
        passed: true,
      });
      stageCounter++; // Move to next stage time
      trace.captureActionData('multi_target_resolution', actionId, {
        resolved: true,
      });

      const stagePerformance = trace.calculateStagePerformance(actionId);

      // Assert
      expect(stagePerformance).toBeDefined();
      expect(stagePerformance.component_filtering.duration).toBe(0); // First stage
      expect(stagePerformance.prerequisite_evaluation.duration).toBe(100); // 1100 - 1000
      expect(stagePerformance.multi_target_resolution.duration).toBe(250); // 1350 - 1100

      // Restore original performance.now
      performance.now = originalPerformanceNow;
    });

    it('should generate comprehensive performance analysis', async () => {
      // Arrange
      const actions = ['core:action1', 'core:action2'];
      const stages = ['component_filtering', 'prerequisite_evaluation'];

      // Mock performance.now() for consistent timing
      const originalPerformanceNow = performance.now;
      // Map each action-stage combination to a specific time
      const timeMap = {
        'core:action1-component_filtering': 1000,
        'core:action1-prerequisite_evaluation': 1100,
        'core:action2-component_filtering': 1200,
        'core:action2-prerequisite_evaluation': 1300,
      };
      let currentKey = '';
      performance.now = jest.fn(() => {
        const time = timeMap[currentKey];
        return time || 2000;
      });

      // Act - simulate multiple actions through pipeline
      for (const actionId of actions) {
        for (const stage of stages) {
          currentKey = `${actionId}-${stage}`;
          trace.captureActionData(stage, actionId, {
            stage: stage,
            passed: true,
          });
        }
      }

      // Analyze performance
      const analysis = analyzer.analyzeTracePerformance(trace);

      // Assert
      expect(analysis.actions).toHaveProperty('core:action1');
      expect(analysis.actions).toHaveProperty('core:action2');

      expect(analysis.stages.component_filtering).toEqual({
        count: 2,
        totalDuration: 0, // Both are first stages (0 duration each)
        avgDuration: 0,
        maxDuration: 0,
        violations: 0, // Under 100ms threshold
      });

      expect(analysis.stages.prerequisite_evaluation).toEqual({
        count: 2,
        totalDuration: 200, // 100ms each (1100-1000, 1300-1200)
        avgDuration: 100,
        maxDuration: 100,
        violations: 0, // At 200ms threshold
      });

      expect(analysis.bottlenecks).toHaveLength(0);
      expect(analysis.totalDuration).toBe(200); // 0 + 200

      // Restore original performance.now
      performance.now = originalPerformanceNow;
    });

    it('should identify performance bottlenecks and generate recommendations', async () => {
      // Arrange
      const actionId = 'core:slow-action';

      // Mock performance.now() to simulate slow stages
      const originalPerformanceNow = performance.now;
      let stageIndex = 0;
      const stageTimes = [1000, 1200, 1800]; // Times that create violations
      performance.now = jest.fn(() => {
        if (stageIndex < stageTimes.length) {
          return stageTimes[stageIndex];
        }
        return 2000;
      });

      // Act
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });
      stageIndex++;
      trace.captureActionData('prerequisite_evaluation', actionId, {
        passed: true,
      });
      stageIndex++;
      trace.captureActionData('multi_target_resolution', actionId, {
        resolved: true,
      });

      const analysis = analyzer.analyzeTracePerformance(trace);

      // Assert
      expect(analysis.bottlenecks).toHaveLength(1);
      expect(analysis.bottlenecks[0]).toEqual({
        stage: 'multi_target_resolution',
        avgDuration: 600,
        violations: 1,
        threshold: 500,
      });

      expect(analysis.recommendations).toContainEqual({
        priority: 'high',
        stage: 'multi_target_resolution',
        message:
          'Optimize multi_target_resolution - averaging 600.00ms (threshold: 500ms)',
      });

      // Restore original performance.now
      performance.now = originalPerformanceNow;
    });

    it('should generate performance report with metrics recording', async () => {
      // Arrange
      const actionId = 'core:test-action';

      // Mock performance.now() for consistent timing
      const originalPerformanceNow = performance.now;
      let stageIndex = 0;
      const stageTimes = [1000, 1075]; // 75ms duration for second stage
      performance.now = jest.fn(() => {
        if (stageIndex < stageTimes.length) {
          return stageTimes[stageIndex];
        }
        return 2000;
      });

      // Spy on performance monitor
      const recordMetricSpy = jest
        .spyOn(performanceMonitor, 'recordMetric')
        .mockImplementation(() => {});

      // Act
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });
      stageIndex++;
      trace.captureActionData('prerequisite_evaluation', actionId, {
        passed: true,
      });

      const report = analyzer.generatePerformanceReport(trace);

      // Assert
      expect(report.summary).toEqual({
        totalActions: 1,
        totalDuration: 75,
        stageCount: 2,
        bottleneckCount: 0,
        averageDurationPerAction: 75,
      });

      expect(report.stages).toHaveProperty('component_filtering');
      expect(report.stages).toHaveProperty('prerequisite_evaluation');
      expect(report.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );

      // Verify metrics were recorded
      expect(recordMetricSpy).toHaveBeenCalledWith(
        'pipeline.stage.component_filtering.avg_duration',
        expect.any(Number)
      );
      expect(recordMetricSpy).toHaveBeenCalledWith(
        'pipeline.total_duration',
        75
      );

      // Cleanup
      recordMetricSpy.mockRestore();
      performance.now = originalPerformanceNow;
    });
  });

  describe('Performance Monitor Integration', () => {
    it('should use performance monitor for threshold checking', async () => {
      // Arrange
      const checkThresholdSpy = jest
        .spyOn(performanceMonitor, 'checkThreshold')
        .mockImplementation(() => {});

      const actionId = 'core:slow-action';

      // Mock performance.now() to simulate violation
      const originalPerformanceNow = performance.now;
      let stageIndex = 0;
      const stageTimes = [1000, 1350]; // 350ms - over 200ms threshold for prerequisite_evaluation
      performance.now = jest.fn(() => {
        if (stageIndex < stageTimes.length) {
          return stageTimes[stageIndex];
        }
        return 2000;
      });

      // Act
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });
      stageIndex++;
      trace.captureActionData('prerequisite_evaluation', actionId, {
        passed: true,
      });

      analyzer.analyzeTracePerformance(trace);

      // Assert
      expect(checkThresholdSpy).toHaveBeenCalledWith(
        'stage_prerequisite_evaluation',
        350,
        200
      );

      // Cleanup
      checkThresholdSpy.mockRestore();
      performance.now = originalPerformanceNow;
    });

    it('should track operations in performance monitor during capture', async () => {
      // Arrange
      const originalPerformanceNow = performance.now;
      const mockTime = 1234.56;
      performance.now = jest.fn(() => mockTime);

      const trackOperationSpy = jest
        .spyOn(performanceMonitor, 'trackOperation')
        .mockImplementation(() => {});

      const actionId = 'core:test-action';

      // Act
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });

      // Assert
      expect(trackOperationSpy).toHaveBeenCalledWith(
        'stage_component_filtering',
        mockTime
      );

      // Cleanup
      trackOperationSpy.mockRestore();
      performance.now = originalPerformanceNow;
    });
  });

  describe('Threshold management and recommendations', () => {
    it('should expose defaults, apply updates, and validate threshold input', () => {
      const currentThresholds = analyzer.getStageThresholds();
      expect(currentThresholds.pipeline_total).toBe(1000);
      expect(currentThresholds.component_filtering).toBe(100);

      analyzer.updateStageThresholds({
        component_filtering: 75,
        pipeline_total: 1500,
      });

      const updatedThresholds = analyzer.getStageThresholds();
      expect(updatedThresholds.component_filtering).toBe(75);
      expect(updatedThresholds.pipeline_total).toBe(1500);

      expect(() => analyzer.updateStageThresholds(null)).toThrow(
        'Invalid thresholds provided'
      );
      expect(() =>
        analyzer.updateStageThresholds({ pipeline_total: -25 })
      ).toThrow(
        'Invalid threshold for stage pipeline_total: must be a non-negative number'
      );
    });

    it('should surface layered recommendations when multiple thresholds are breached', () => {
      const actionId = 'core:threshold-stress';
      const stageOrder = [
        'component_filtering',
        'prerequisite_evaluation',
        'multi_target_resolution',
        'target_resolution',
      ];

      const thresholdError = new Error('threshold monitor offline');
      const checkThresholdSpy = jest
        .spyOn(performanceMonitor, 'checkThreshold')
        .mockImplementation(() => {
          throw thresholdError;
        });

      const recordMetricSpy = jest
        .spyOn(performanceMonitor, 'recordMetric')
        .mockImplementation(() => {});

      for (const stage of stageOrder) {
        trace.captureActionData(stage, actionId, { passed: true });
      }

      const tracedActions = trace.getTracedActions();
      const actionTrace = tracedActions.get(actionId);
      const stageTimesByStage = {
        component_filtering: 1000,
        prerequisite_evaluation: 1250,
        multi_target_resolution: 1800,
        target_resolution: 2200,
      };
      const baseTimestamp = Date.now();
      for (const [index, stage] of stageOrder.entries()) {
        const stageEntry = actionTrace.stages[stage];
        stageEntry.data._performance.captureTime = stageTimesByStage[stage];
        stageEntry.data._performance.timestamp = baseTimestamp + index;
        stageEntry.timestamp = baseTimestamp + index;
      }

      const report = analyzer.generatePerformanceReport(trace);

      expect(checkThresholdSpy).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Performance monitor threshold check failed: threshold monitor offline'
        )
      );

      expect(report.bottlenecks).toHaveLength(3);
      expect(report.bottlenecks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            stage: 'multi_target_resolution',
            violations: 1,
          }),
        ])
      );

      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          {
            priority: 'high',
            stage: 'multi_target_resolution',
            message:
              'Optimize multi_target_resolution - averaging 550.00ms (threshold: 500ms)',
          },
          {
            priority: 'medium',
            message:
              'Total pipeline duration (1200.00ms) exceeds threshold (1000ms)',
          },
          {
            priority: 'medium',
            message:
              '3 stages show elevated durations - consider detailed profiling',
          },
        ])
      );

      expect(recordMetricSpy).toHaveBeenCalledWith(
        'pipeline.stage.multi_target_resolution.violations',
        1
      );

      checkThresholdSpy.mockRestore();
      recordMetricSpy.mockRestore();
    });
  });

  describe('Metric recording resilience', () => {
    it('should skip recording when performance monitor lacks support', () => {
      const actionId = 'core:metric-skip';
      const originalPerformanceNow = performance.now;
      let timestamp = 1000;
      performance.now = jest.fn(() => (timestamp += 60));

      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });
      trace.captureActionData('prerequisite_evaluation', actionId, {
        evaluated: true,
      });

      performanceMonitor.recordMetric = undefined;

      expect(() => analyzer.generatePerformanceReport(trace)).not.toThrow();

      performance.now = originalPerformanceNow;
    });

    it('should log and continue when metric recording fails', () => {
      const actionId = 'core:metric-failure';
      const originalPerformanceNow = performance.now;
      let timestamp = 2000;
      performance.now = jest.fn(() => (timestamp += 40));

      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });
      trace.captureActionData('prerequisite_evaluation', actionId, {
        evaluated: true,
      });

      const recordMetricSpy = jest
        .spyOn(performanceMonitor, 'recordMetric')
        .mockImplementation(() => {
          throw new Error('metric store unreachable');
        });

      expect(() => analyzer.generatePerformanceReport(trace)).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to record metrics in performance monitor: metric store unreachable'
        )
      );

      recordMetricSpy.mockRestore();
      performance.now = originalPerformanceNow;
    });
  });

  describe('Invalid trace handling', () => {
    it('should reject traces that lack required APIs', () => {
      expect(() => analyzer.analyzeTracePerformance(null)).toThrow(
        'Invalid trace provided - must have getTracedActions method'
      );
    });
  });
  describe('Error Handling and Resilience', () => {
    it('should continue working when performance monitor fails', async () => {
      // Arrange
      const failingMonitor = new PerformanceMonitor(mockTrace);
      jest.spyOn(failingMonitor, 'trackOperation').mockImplementation(() => {
        throw new Error('Monitor failed');
      });

      const resilientTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: mockLogger,
        traceConfig: { enablePerformanceTracking: true },
        performanceMonitor: failingMonitor,
      });

      const actionId = 'core:resilient-action';

      // Act & Assert - should not throw
      expect(() => {
        resilientTrace.captureActionData('component_filtering', actionId, {
          passed: true,
        });
      }).not.toThrow();

      // Should still capture performance data
      const tracedActions = resilientTrace.getTracedActions();
      const actionTrace = tracedActions.get(actionId);
      expect(
        actionTrace.stages.component_filtering.data._performance
      ).toBeDefined();
    });

    it('should handle analyzer failures gracefully', async () => {
      // Arrange
      const actionId = 'core:test-action';
      trace.captureActionData('component_filtering', actionId, {
        passed: true,
      });

      // Create analyzer with failing performance monitor
      const failingMonitor = new PerformanceMonitor(mockTrace);
      jest.spyOn(failingMonitor, 'checkThreshold').mockImplementation(() => {
        throw new Error('Threshold check failed');
      });

      const resilientAnalyzer = new PipelinePerformanceAnalyzer({
        performanceMonitor: failingMonitor,
        logger: mockLogger,
      });

      // Act & Assert - should not throw
      expect(() => {
        resilientAnalyzer.analyzeTracePerformance(trace);
      }).not.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should not affect existing trace functionality', async () => {
      // Arrange
      const actionId = 'core:legacy-action';
      const legacyData = {
        actorComponents: ['core:position'],
        requiredComponents: ['core:position'],
        passed: true,
      };

      // Act
      trace.captureActionData('component_filtering', actionId, legacyData);

      // Assert - legacy functionality should work
      const tracedActions = trace.getTracedActions();
      expect(tracedActions.size).toBe(1);

      const actionTrace = tracedActions.get(actionId);
      expect(actionTrace.actionId).toBe(actionId);
      expect(actionTrace.actorId).toBe('test-actor');
      expect(
        actionTrace.stages.component_filtering.data.actorComponents
      ).toEqual(['core:position']);
      expect(actionTrace.stages.component_filtering.data.passed).toBe(true);

      // Performance data should be added without affecting legacy data
      expect(
        actionTrace.stages.component_filtering.data._performance
      ).toBeDefined();
    });

    it('should work with traces that do not support performance features', () => {
      // Arrange - create basic trace without performance support
      const basicTrace = {
        getTracedActions: jest.fn(
          () =>
            new Map([
              [
                'core:basic-action',
                { actionId: 'core:basic-action', stages: {} },
              ],
            ])
        ),
        // No calculateStagePerformance method
      };

      // Act
      const analysis = analyzer.analyzeTracePerformance(basicTrace);

      // Assert
      expect(analysis.actions).toEqual({});
      expect(analysis.stages).toEqual({});
      expect(analysis.recommendations).toContainEqual({
        priority: 'low',
        message:
          'Upgrade to ActionAwareStructuredTrace for detailed performance analysis',
      });
    });
  });
});
