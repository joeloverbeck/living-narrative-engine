/**
 * @file Unit tests for PipelinePerformanceAnalyzer (ACTTRA-018)
 * Tests performance analysis and reporting capabilities
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import PipelinePerformanceAnalyzer from '../../../../src/actions/tracing/pipelinePerformanceAnalyzer.js';
import { createTestBed } from '../../../common/testBed.js';

describe('PipelinePerformanceAnalyzer (ACTTRA-018)', () => {
  let testBed;
  let analyzer;
  let mockPerformanceMonitor;
  let mockLogger;
  let mockTrace;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create mock performance monitor
    mockPerformanceMonitor = {
      getRealtimeMetrics: jest.fn(() => ({
        activeSpans: 0,
        completedSpans: 0,
        totalOperations: 0,
        errorCount: 0,
        currentDuration: 0,
      })),
      checkThreshold: jest.fn(),
      recordMetric: jest.fn(),
    };

    // Create mock trace with performance data
    mockTrace = {
      getTracedActions: jest.fn(
        () =>
          new Map([
            ['core:action1', { actionId: 'core:action1', stages: {} }],
            ['core:action2', { actionId: 'core:action2', stages: {} }],
          ])
      ),
      calculateStagePerformance: jest.fn(),
    };

    analyzer = new PipelinePerformanceAnalyzer({
      performanceMonitor: mockPerformanceMonitor,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with default thresholds', () => {
      // Act
      const thresholds = analyzer.getStageThresholds();

      // Assert
      expect(thresholds).toEqual({
        component_filtering: 100,
        prerequisite_evaluation: 200,
        multi_target_resolution: 500,
        action_formatting: 150,
        target_resolution: 300,
        pipeline_total: 1000,
      });
    });

    it('should accept custom thresholds', () => {
      // Arrange
      const customThresholds = {
        component_filtering: 50,
        prerequisite_evaluation: 150,
        pipeline_total: 800,
      };

      // Act
      const customAnalyzer = new PipelinePerformanceAnalyzer({
        performanceMonitor: mockPerformanceMonitor,
        logger: mockLogger,
        stageThresholds: customThresholds,
      });

      // Assert
      const thresholds = customAnalyzer.getStageThresholds();
      expect(thresholds.component_filtering).toBe(50);
      expect(thresholds.prerequisite_evaluation).toBe(150);
      expect(thresholds.pipeline_total).toBe(800);
      expect(thresholds.multi_target_resolution).toBe(500); // Default preserved
    });

    it('should validate required dependencies', () => {
      // Arrange & Act & Assert
      expect(() => {
        new PipelinePerformanceAnalyzer({
          performanceMonitor: null,
          logger: mockLogger,
        });
      }).toThrow();

      expect(() => {
        new PipelinePerformanceAnalyzer({
          performanceMonitor: mockPerformanceMonitor,
          logger: null,
        });
      }).toThrow();
    });
  });

  describe('Performance Analysis', () => {
    it('should analyze trace performance correctly', () => {
      // Arrange
      const mockStagePerformance1 = {
        component_filtering: {
          startTime: 1000,
          endTime: 1050,
          duration: 50,
          timestamp: Date.now(),
        },
        prerequisite_evaluation: {
          startTime: 1050,
          endTime: 1150,
          duration: 100,
          timestamp: Date.now(),
        },
      };
      const mockStagePerformance2 = {
        component_filtering: {
          startTime: 2000,
          endTime: 2080,
          duration: 80,
          timestamp: Date.now(),
        },
        prerequisite_evaluation: {
          startTime: 2080,
          endTime: 2300,
          duration: 220,
          timestamp: Date.now(),
        },
      };

      mockTrace.calculateStagePerformance
        .mockReturnValueOnce(mockStagePerformance1)
        .mockReturnValueOnce(mockStagePerformance2);

      // Act
      const analysis = analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(analysis).toBeDefined();
      expect(analysis.actions).toEqual({
        'core:action1': mockStagePerformance1,
        'core:action2': mockStagePerformance2,
      });

      // Check stage aggregation
      expect(analysis.stages.component_filtering).toEqual({
        count: 2,
        totalDuration: 130, // 50 + 80
        avgDuration: 65,
        maxDuration: 80,
        violations: 0, // Both under 100ms threshold
      });

      expect(analysis.stages.prerequisite_evaluation).toEqual({
        count: 2,
        totalDuration: 320, // 100 + 220
        avgDuration: 160,
        maxDuration: 220,
        violations: 1, // One over 200ms threshold (220ms)
      });

      expect(analysis.totalDuration).toBe(450); // 130 + 320
    });

    it('should identify bottlenecks correctly', () => {
      // Arrange
      const slowStagePerformance = {
        component_filtering: { duration: 150, timestamp: Date.now() }, // Over 100ms threshold
        prerequisite_evaluation: { duration: 250, timestamp: Date.now() }, // Over 200ms threshold
      };

      mockTrace.calculateStagePerformance.mockReturnValue(slowStagePerformance);

      // Act
      const analysis = analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(analysis.bottlenecks).toHaveLength(2);
      expect(analysis.bottlenecks[0]).toEqual({
        stage: 'prerequisite_evaluation',
        avgDuration: 250,
        violations: 2,
        threshold: 200,
      });
      expect(analysis.bottlenecks[1]).toEqual({
        stage: 'component_filtering',
        avgDuration: 150,
        violations: 2,
        threshold: 100,
      });
    });

    it('should generate performance recommendations', () => {
      // Arrange
      const slowStagePerformance = {
        component_filtering: { duration: 150, timestamp: Date.now() },
        prerequisite_evaluation: { duration: 250, timestamp: Date.now() },
        multi_target_resolution: { duration: 400, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(slowStagePerformance);

      // Act
      const analysis = analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(analysis.recommendations).toContainEqual({
        priority: 'high',
        stage: 'prerequisite_evaluation',
        message:
          'Optimize prerequisite_evaluation - averaging 250.00ms (threshold: 200ms)',
      });

      expect(analysis.recommendations).toContainEqual({
        priority: 'medium',
        message:
          '3 stages show elevated durations - consider detailed profiling',
      });
    });

    it('should handle traces without calculateStagePerformance method', () => {
      // Arrange
      const basicTrace = {
        getTracedActions: jest.fn(() => new Map()),
      };

      // Act
      const analysis = analyzer.analyzeTracePerformance(basicTrace);

      // Assert
      expect(analysis.actions).toEqual({});
      expect(analysis.stages).toEqual({});
      expect(analysis.totalDuration).toBe(0);
      expect(analysis.recommendations).toContainEqual({
        priority: 'low',
        message:
          'Upgrade to ActionAwareStructuredTrace for detailed performance analysis',
      });
    });

    it('should handle invalid trace inputs', () => {
      // Act & Assert
      expect(() => {
        analyzer.analyzeTracePerformance(null);
      }).toThrow('Invalid trace provided - must have getTracedActions method');

      expect(() => {
        analyzer.analyzeTracePerformance({});
      }).toThrow('Invalid trace provided - must have getTracedActions method');
    });

    it('should handle stage performance calculation errors gracefully', () => {
      // Arrange
      mockTrace.calculateStagePerformance.mockImplementation(() => {
        throw new Error('Calculation failed');
      });

      // Act
      const analysis = analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(analysis.actions).toEqual({});
      expect(analysis.stages).toEqual({});
      expect(analysis.totalDuration).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Performance Reporting', () => {
    it('should generate comprehensive performance reports', () => {
      // Arrange
      const mockStagePerformance = {
        component_filtering: { duration: 75, timestamp: Date.now() },
        prerequisite_evaluation: { duration: 150, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(mockStagePerformance);

      // Act
      const report = analyzer.generatePerformanceReport(mockTrace);

      // Assert
      expect(report.summary).toEqual({
        totalActions: 2,
        totalDuration: 450, // 2 actions * (75 + 150)
        stageCount: 2,
        bottleneckCount: 0,
        averageDurationPerAction: 225,
      });

      expect(report.stages).toBeDefined();
      expect(report.bottlenecks).toEqual([]);
      expect(report.recommendations).toEqual([]);
      expect(report.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should record metrics in performance monitor', () => {
      // Arrange
      const mockStagePerformance = {
        component_filtering: { duration: 75, timestamp: Date.now() },
        prerequisite_evaluation: { duration: 150, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(mockStagePerformance);

      // Act
      analyzer.generatePerformanceReport(mockTrace);

      // Assert
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'pipeline.stage.component_filtering.avg_duration',
        75
      );
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'pipeline.stage.component_filtering.max_duration',
        75
      );
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'pipeline.total_duration',
        450 // 2 actions * (75 + 150)
      );
    });

    it('should record violation metrics when stages exceed thresholds', () => {
      // Arrange
      const violatingPerformance = {
        component_filtering: { duration: 150, timestamp: Date.now() }, // Above 100ms threshold
        prerequisite_evaluation: { duration: 50, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(violatingPerformance);

      // Act
      analyzer.generatePerformanceReport(mockTrace);

      // Assert
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'pipeline.stage.component_filtering.violations',
        2
      );
    });

    it('should handle performance monitor recording errors gracefully', () => {
      // Arrange
      mockPerformanceMonitor.recordMetric.mockImplementation(() => {
        throw new Error('Recording failed');
      });

      const mockStagePerformance = {
        component_filtering: { duration: 75, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(mockStagePerformance);

      // Act & Assert
      expect(() => {
        analyzer.generatePerformanceReport(mockTrace);
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to record metrics in performance monitor'
        )
      );
    });

    it('should work with performance monitors that do not support recording', () => {
      // Arrange
      const limitedMonitor = {
        getRealtimeMetrics: jest.fn(() => ({})),
        checkThreshold: jest.fn(),
        // No recordMetric method
      };

      const limitedAnalyzer = new PipelinePerformanceAnalyzer({
        performanceMonitor: limitedMonitor,
        logger: mockLogger,
      });

      const mockStagePerformance = {
        component_filtering: { duration: 75, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(mockStagePerformance);

      // Act & Assert
      expect(() => {
        limitedAnalyzer.generatePerformanceReport(mockTrace);
      }).not.toThrow();
    });
  });

  describe('Threshold Management', () => {
    it('should update stage thresholds correctly', () => {
      // Arrange
      const newThresholds = {
        component_filtering: 75,
        prerequisite_evaluation: 175,
      };

      // Act
      analyzer.updateStageThresholds(newThresholds);

      // Assert
      const thresholds = analyzer.getStageThresholds();
      expect(thresholds.component_filtering).toBe(75);
      expect(thresholds.prerequisite_evaluation).toBe(175);
      expect(thresholds.multi_target_resolution).toBe(500); // Unchanged
    });

    it('should validate threshold values', () => {
      // Act & Assert
      expect(() => {
        analyzer.updateStageThresholds({ component_filtering: -1 });
      }).toThrow(
        'Invalid threshold for stage component_filtering: must be a non-negative number'
      );

      expect(() => {
        analyzer.updateStageThresholds({ component_filtering: 'invalid' });
      }).toThrow(
        'Invalid threshold for stage component_filtering: must be a non-negative number'
      );

      expect(() => {
        analyzer.updateStageThresholds(null);
      }).toThrow('Invalid thresholds provided');
    });

    it('should use performance monitor for threshold checking', () => {
      // Arrange
      const violatingStagePerformance = {
        component_filtering: { duration: 150, timestamp: Date.now() }, // Over 100ms threshold
      };

      mockTrace.calculateStagePerformance.mockReturnValue(
        violatingStagePerformance
      );

      // Act
      analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(mockPerformanceMonitor.checkThreshold).toHaveBeenCalledWith(
        'stage_component_filtering',
        150,
        100
      );
    });

    it('should skip threshold checks when monitor lacks support', () => {
      // Arrange
      delete mockPerformanceMonitor.checkThreshold;
      const violatingStagePerformance = {
        component_filtering: { duration: 150, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(
        violatingStagePerformance
      );

      // Act
      const analysis = analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(analysis.stages.component_filtering.violations).toBe(2);
    });

    it('should handle performance monitor threshold checking errors', () => {
      // Arrange
      mockPerformanceMonitor.checkThreshold.mockImplementation(() => {
        throw new Error('Threshold check failed');
      });

      const violatingStagePerformance = {
        component_filtering: { duration: 150, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(
        violatingStagePerformance
      );

      // Act & Assert
      expect(() => {
        analyzer.analyzeTracePerformance(mockTrace);
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Performance monitor threshold check failed')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty trace data', () => {
      // Arrange
      mockTrace.getTracedActions.mockReturnValue(new Map());

      // Act
      const analysis = analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(analysis.actions).toEqual({});
      expect(analysis.stages).toEqual({});
      expect(analysis.totalDuration).toBe(0);
      expect(analysis.bottlenecks).toEqual([]);
      expect(analysis.recommendations).toEqual([]);
    });

    it('should handle actions with no stage performance data', () => {
      // Arrange
      mockTrace.calculateStagePerformance.mockReturnValue(null);

      // Act
      const analysis = analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(analysis.actions).toEqual({});
      expect(analysis.stages).toEqual({});
      expect(analysis.totalDuration).toBe(0);
    });

    it('should handle stages with zero duration', () => {
      // Arrange
      const zeroStagePerformance = {
        component_filtering: { duration: 0, timestamp: Date.now() },
        prerequisite_evaluation: { duration: 0, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(zeroStagePerformance);

      // Act
      const analysis = analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(analysis.stages.component_filtering.avgDuration).toBe(0);
      expect(analysis.stages.component_filtering.violations).toBe(0);
      expect(analysis.totalDuration).toBe(0);
    });

    it('should handle missing duration in stage performance', () => {
      // Arrange
      const incompleteStagePerformance = {
        component_filtering: { timestamp: Date.now() }, // No duration
        prerequisite_evaluation: { duration: 100, timestamp: Date.now() },
      };

      mockTrace.calculateStagePerformance.mockReturnValue(
        incompleteStagePerformance
      );

      // Act
      const analysis = analyzer.analyzeTracePerformance(mockTrace);

      // Assert
      expect(analysis.stages.component_filtering.avgDuration).toBe(0);
      expect(analysis.stages.prerequisite_evaluation.avgDuration).toBe(100);
      expect(analysis.totalDuration).toBe(200);
    });
  });
});
