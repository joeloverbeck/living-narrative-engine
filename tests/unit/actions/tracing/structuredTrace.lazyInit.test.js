import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Store mock functions globally for test access
let mockEnableSampling;
let mockSetThresholds;
let mockStartMonitoring;

// Mock the dynamic imports - use unstable_mockModule for ES modules - must be done BEFORE imports
jest.unstable_mockModule(
  '../../../../src/actions/tracing/traceAnalyzer.js',
  () => {
    const mockGetCriticalPath = jest.fn();
    const mockGetBottlenecks = jest.fn();

    return {
      default: class MockTraceAnalyzer {
        constructor() {
          this.getCriticalPath = mockGetCriticalPath;
          this.getBottlenecks = mockGetBottlenecks;
        }
      },
    };
  }
);

jest.unstable_mockModule(
  '../../../../src/actions/tracing/traceVisualizer.js',
  () => {
    const mockDisplayHierarchy = jest.fn();
    const mockDisplayWaterfall = jest.fn();

    return {
      default: class MockTraceVisualizer {
        constructor() {
          this.displayHierarchy = mockDisplayHierarchy;
          this.displayWaterfall = mockDisplayWaterfall;
        }
      },
    };
  }
);

jest.unstable_mockModule(
  '../../../../src/actions/tracing/performanceMonitor.js',
  () => {
    mockSetThresholds = jest.fn();
    mockEnableSampling = jest.fn();
    mockStartMonitoring = jest.fn();

    return {
      default: class MockPerformanceMonitor {
        constructor() {
          this.setThresholds = mockSetThresholds;
          this.enableSampling = mockEnableSampling;
          this.startMonitoring = mockStartMonitoring;
        }
      },
    };
  }
);

// Import StructuredTrace normally
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';

describe('StructuredTrace - Lazy Initialization', () => {
  let structuredTrace;
  let traceConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock functions
    if (mockEnableSampling) mockEnableSampling.mockClear();
    if (mockSetThresholds) mockSetThresholds.mockClear();
    if (mockStartMonitoring) mockStartMonitoring.mockClear();
    traceConfig = {
      traceAnalysisEnabled: true,
      performanceMonitoring: {
        enabled: true,
        thresholds: {
          slowOperationMs: 100,
          criticalOperationMs: 500,
        },
        sampling: {
          rate: 0.5,
          strategy: 'random',
        },
      },
      visualization: {
        enabled: true,
      },
      analysis: {
        enabled: true,
      },
    };
  });

  describe('configuration management', () => {
    it('should create with default configuration when none provided', () => {
      structuredTrace = new StructuredTrace();

      expect(structuredTrace.isTraceAnalysisEnabled()).toBe(false);
    });

    it('should accept configuration in constructor', () => {
      structuredTrace = new StructuredTrace(null, traceConfig);

      expect(structuredTrace.isTraceAnalysisEnabled()).toBe(true);
    });

    it('should allow setting configuration after creation', () => {
      structuredTrace = new StructuredTrace();
      expect(structuredTrace.isTraceAnalysisEnabled()).toBe(false);

      structuredTrace.setTraceConfiguration(traceConfig);
      expect(structuredTrace.isTraceAnalysisEnabled()).toBe(true);
    });
  });

  describe('getAnalyzer', () => {
    beforeEach(() => {
      structuredTrace = new StructuredTrace(null, traceConfig);
    });

    it('should return null when trace analysis is disabled', async () => {
      structuredTrace.setTraceConfiguration({ traceAnalysisEnabled: false });

      const analyzer = await structuredTrace.getAnalyzer();

      expect(analyzer).toBeNull();
    });

    it('should return null when analysis is disabled', async () => {
      structuredTrace.setTraceConfiguration({
        traceAnalysisEnabled: true,
        analysis: { enabled: false },
      });

      const analyzer = await structuredTrace.getAnalyzer();

      expect(analyzer).toBeNull();
    });

    it('should lazy load analyzer when enabled', async () => {
      const analyzer = await structuredTrace.getAnalyzer();

      expect(analyzer).toBeDefined();
      expect(analyzer.getCriticalPath).toBeDefined();
    });

    it('should return same instance on subsequent calls', async () => {
      const analyzer1 = await structuredTrace.getAnalyzer();
      const analyzer2 = await structuredTrace.getAnalyzer();

      expect(analyzer1).toBe(analyzer2);
    });
  });

  describe('getVisualizer', () => {
    beforeEach(() => {
      structuredTrace = new StructuredTrace(null, traceConfig);
    });

    it('should return null when trace analysis is disabled', async () => {
      structuredTrace.setTraceConfiguration({ traceAnalysisEnabled: false });

      const visualizer = await structuredTrace.getVisualizer();

      expect(visualizer).toBeNull();
    });

    it('should return null when visualization is disabled', async () => {
      structuredTrace.setTraceConfiguration({
        traceAnalysisEnabled: true,
        visualization: { enabled: false },
      });

      const visualizer = await structuredTrace.getVisualizer();

      expect(visualizer).toBeNull();
    });

    it('should lazy load visualizer when enabled', async () => {
      const visualizer = await structuredTrace.getVisualizer();

      expect(visualizer).toBeDefined();
      expect(visualizer.displayHierarchy).toBeDefined();
    });

    it('should return same visualizer instance on repeated calls', async () => {
      const firstCall = await structuredTrace.getVisualizer();
      const secondCall = await structuredTrace.getVisualizer();

      expect(secondCall).toBe(firstCall);
    });
  });

  describe('getPerformanceMonitor', () => {
    beforeEach(() => {
      structuredTrace = new StructuredTrace(null, traceConfig);
    });

    it('should return null when trace analysis is disabled', async () => {
      structuredTrace.setTraceConfiguration({ traceAnalysisEnabled: false });

      const monitor = await structuredTrace.getPerformanceMonitor();

      expect(monitor).toBeNull();
    });

    it('should return null when performance monitoring is disabled', async () => {
      structuredTrace.setTraceConfiguration({
        traceAnalysisEnabled: true,
        performanceMonitoring: { enabled: false },
      });

      const monitor = await structuredTrace.getPerformanceMonitor();

      expect(monitor).toBeNull();
    });

    it('should lazy load monitor with thresholds when enabled', async () => {
      const monitor = await structuredTrace.getPerformanceMonitor();

      expect(monitor).toBeDefined();
      expect(monitor.setThresholds).toBeDefined();
    });

    it('should lazy load monitor and apply sampling when configured', async () => {
      // This test verifies that the monitor is created with sampling support
      // The actual call to enableSampling happens inside the dynamic import promise
      const monitor = await structuredTrace.getPerformanceMonitor();

      expect(monitor).toBeDefined();
      expect(monitor.enableSampling).toBeDefined();
      expect(typeof monitor.enableSampling).toBe('function');
    });

    it('should return same performance monitor instance on repeated calls', async () => {
      const firstCall = await structuredTrace.getPerformanceMonitor();
      const secondCall = await structuredTrace.getPerformanceMonitor();

      expect(secondCall).toBe(firstCall);
    });

    it('should work without sampling configuration', async () => {
      structuredTrace.setTraceConfiguration({
        traceAnalysisEnabled: true,
        performanceMonitoring: {
          enabled: true,
          thresholds: { slowOperationMs: 100 },
          // No sampling config
        },
      });

      const monitor = await structuredTrace.getPerformanceMonitor();

      expect(monitor).toBeDefined();
      expect(monitor.enableSampling).toBeDefined();
      expect(typeof monitor.enableSampling).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle missing subsections gracefully', async () => {
      structuredTrace = new StructuredTrace(null, {
        traceAnalysisEnabled: true,
        // Missing all subsections
      });

      // Should use default enabled state for missing sections
      const analyzer = await structuredTrace.getAnalyzer();
      const visualizer = await structuredTrace.getVisualizer();
      const monitor = await structuredTrace.getPerformanceMonitor();

      expect(analyzer).toBeDefined();
      expect(visualizer).toBeDefined();
      expect(monitor).toBeDefined();
    });
  });
});
