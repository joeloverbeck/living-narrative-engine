import { describe, it, expect, afterEach, jest } from '@jest/globals';
import MemoryReporter from '../../../../src/entities/monitoring/MemoryReporter.js';

const MB = 1024 * 1024;

const createDependencies = (overrides = {}) => {
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const monitor = {
    getCurrentUsage: jest.fn().mockReturnValue(null),
    getHistory: jest.fn().mockReturnValue([]),
    detectMemoryLeak: jest.fn().mockReturnValue({ detected: false }),
  };

  const analyzer = {
    analyzeTrend: jest.fn().mockReturnValue(null),
    detectPatterns: jest.fn().mockReturnValue([]),
    generateReport: jest.fn().mockReturnValue({}),
  };

  const profiler = {
    findMemoryHotspots: jest.fn().mockReturnValue([]),
    generateReport: jest.fn().mockReturnValue({}),
  };

  const pressureManager = {
    getCurrentPressureLevel: jest.fn().mockReturnValue('healthy'),
    getStatistics: jest.fn().mockReturnValue({}),
  };

  return {
    logger,
    monitor,
    analyzer,
    profiler,
    pressureManager,
    ...overrides,
  };
};

describe('MemoryReporter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('aggregates monitoring data into a detailed report with sorted recommendations', () => {
    const currentUsage = {
      heapUsed: 320 * MB,
      heapTotal: 512 * MB,
      heapLimit: 768 * MB,
      external: 10 * MB,
      usagePercent: 0.625,
      timestamp: 1_700_000_000_000,
    };

    const leakDetection = { detected: true, estimatedTimeToOOM: 12.5 };
    const trend = { trend: 'growing', slope: 14.75, confidence: 0.92 };
    const patterns = [
      { type: 'exponential', description: 'Rapidly accelerating usage' },
      {
        type: 'sawtooth',
        description: 'Large GC cycles',
        characteristics: { amplitude: 150 * MB },
      },
    ];
    const hotspots = Array.from({ length: 6 }, (_, index) => ({
      operation: `operation-${index + 1}`,
      averageMemoryIncrease: (index + 1) * 42 * MB,
    }));
    const profilerReport = { sections: 3 };
    const pressureStats = { samples: 9 };

    const dependencies = createDependencies({
      monitor: {
        getCurrentUsage: jest.fn().mockReturnValue(currentUsage),
        getHistory: jest.fn().mockReturnValue(new Array(5).fill({ value: 1 })),
        detectMemoryLeak: jest.fn().mockReturnValue(leakDetection),
      },
      analyzer: {
        analyzeTrend: jest.fn().mockReturnValue(trend),
        detectPatterns: jest.fn().mockReturnValue(patterns),
        generateReport: jest.fn().mockReturnValue({ confidence: 0.92 }),
      },
      profiler: {
        findMemoryHotspots: jest.fn().mockReturnValue(hotspots),
        generateReport: jest.fn().mockReturnValue(profilerReport),
      },
      pressureManager: {
        getCurrentPressureLevel: jest.fn().mockReturnValue('critical'),
        getStatistics: jest.fn().mockReturnValue(pressureStats),
      },
    });

    const reporter = new MemoryReporter(dependencies, {
      includeRecommendations: true,
      maxReportHistory: 5,
    });

    const report = reporter.generateReport({ verbosity: 'detailed' });

    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      'MemoryReporter: Generating memory report',
      { includeRecommendations: true, verbosity: 'detailed' }
    );
    expect(report.summary).toMatchObject({
      heapUsed: currentUsage.heapUsed,
      pressureLevel: 'critical',
      leakDetected: true,
      status: 'critical',
    });
    expect(report.currentState.memory.heapLimit).toBe(currentUsage.heapLimit);
    expect(report.trends).toBe(trend);
    expect(report.patterns).toBe(patterns);
    expect(report.hotspots).toEqual(hotspots);
    expect(report.profiling).toBe(profilerReport);
    expect(report.pressure.statistics).toBe(pressureStats);

    const priorities = report.recommendations.map((rec) => rec.priority);
    expect(priorities).toEqual([
      'critical',
      'critical',
      'critical',
      'high',
      'high',
      'medium',
    ]);

    const history = reporter.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].summary.status).toBe('critical');
    expect(dependencies.logger.info).toHaveBeenCalledWith(
      'MemoryReporter: Memory report generated',
      expect.objectContaining({ pressureLevel: 'critical' })
    );
  });

  it('supports minimal verbosity and skipping recommendations', () => {
    const hotspots = Array.from({ length: 6 }, (_, index) => ({
      operation: `query-${index}`,
      averageMemoryIncrease: (index + 1) * 10 * MB,
    }));

    const dependencies = createDependencies({
      monitor: {
        getCurrentUsage: jest.fn().mockReturnValue(null),
        getHistory: jest.fn().mockReturnValue([]),
        detectMemoryLeak: jest.fn().mockReturnValue({ detected: false }),
      },
      profiler: {
        findMemoryHotspots: jest.fn().mockReturnValue(hotspots),
        generateReport: jest.fn().mockReturnValue({}),
      },
      pressureManager: {
        getCurrentPressureLevel: jest.fn().mockReturnValue('warning'),
        getStatistics: jest.fn().mockReturnValue({ samples: 3 }),
      },
    });

    const reporter = new MemoryReporter(dependencies, {
      includeRecommendations: true,
      maxReportHistory: 3,
    });

    const report = reporter.generateReport({
      includeRecommendations: false,
      verbosity: 'minimal',
    });

    expect(report.summary.status).toBe('warning');
    expect(report.currentState).toEqual({ available: false });
    expect(report.hotspots).toHaveLength(5);
    expect(report.pressure.statistics).toBeNull();
    expect(report.recommendations).toBeNull();

    reporter.stopAutoReporting();
    expect(dependencies.logger.info).not.toHaveBeenCalledWith(
      'MemoryReporter: Auto-reporting stopped'
    );
  });

  it('exports reports to multiple formats and rejects unsupported types', () => {
    const dependencies = createDependencies();
    const reporter = new MemoryReporter(dependencies);

    const sampleReport = {
      summary: {
        status: 'warning',
        heapUsed: 256 * MB,
        heapTotal: 512 * MB,
        usagePercent: 0.5,
        pressureLevel: 'warning',
        leakDetected: false,
      },
      currentState: { memory: { heapUsed: 256 * MB } },
      trends: { trend: 'stable', slope: 0, confidence: 0.5 },
      patterns: [
        {
          type: 'note',
          description: 'All clear',
          characteristics: { amplitude: 0 },
        },
      ],
      leaks: { detected: false },
      hotspots: [{ operation: 'allocate', averageMemoryIncrease: 4 * MB }],
      profiling: null,
      pressure: { level: 'warning', statistics: { samples: 1 } },
      recommendations: [
        {
          priority: 'high',
          category: 'trend',
          message: 'Monitor growth',
          action: 'monitor',
        },
      ],
      metadata: {
        timestamp: 1_650_000_000_000,
        verbosity: 'normal',
        historyLength: 0,
      },
    };

    const json = reporter.exportReport(sampleReport, 'JSON');
    expect(JSON.parse(json).summary.status).toBe('warning');

    const text = reporter.exportReport(sampleReport, 'text');
    expect(text).toContain('=== MEMORY REPORT ===');

    const markdown = reporter.exportReport(sampleReport, 'MarkDown');
    expect(markdown).toContain('## Summary');

    const html = reporter.exportReport(sampleReport, 'html');
    expect(html).toContain('<html>');

    const generated = reporter.exportReport(undefined, 'json');
    expect(typeof generated).toBe('string');
    expect(JSON.parse(generated).summary).toBeDefined();

    expect(() => reporter.exportReport(sampleReport, 'xml')).toThrow(
      'Unsupported format: xml'
    );
  });

  it('supports auto-reporting intervals and cleans up timers', () => {
    jest.useFakeTimers();

    const dependencies = createDependencies();
    const reporter = new MemoryReporter(dependencies, {
      autoReportInterval: 25,
    });

    const generateSpy = jest
      .spyOn(reporter, 'generateReport')
      .mockReturnValue({ summary: { status: 'critical' } });

    jest.advanceTimersByTime(25);

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'MemoryReporter: Auto-report: Critical memory status',
      expect.objectContaining({ status: 'critical' })
    );

    reporter.stopAutoReporting();
    jest.advanceTimersByTime(25);
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(dependencies.logger.info).toHaveBeenCalledWith(
      'MemoryReporter: Auto-reporting stopped'
    );

    reporter.destroy();
    expect(dependencies.logger.info.mock.calls).toEqual(
      expect.arrayContaining([
        ['MemoryReporter: Report history cleared'],
        ['MemoryReporter: MemoryReporter destroyed'],
      ])
    );

    jest.useRealTimers();
  });

  it('retains only the most recent history entries and clears them on request', () => {
    const dependencies = createDependencies({
      monitor: {
        getCurrentUsage: jest.fn().mockReturnValue({
          heapUsed: 128 * MB,
          heapTotal: 256 * MB,
          heapLimit: 512 * MB,
          external: 2 * MB,
          usagePercent: 0.5,
          timestamp: 0,
        }),
        getHistory: jest.fn().mockReturnValue([]),
        detectMemoryLeak: jest.fn().mockReturnValue({ detected: false }),
      },
    });

    const reporter = new MemoryReporter(dependencies, { maxReportHistory: 2 });

    const timestamps = [1_000, 2_000, 3_000];
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementationOnce(() => timestamps[0])
      .mockImplementationOnce(() => timestamps[1])
      .mockImplementationOnce(() => timestamps[2]);

    reporter.generateReport();
    reporter.generateReport();
    reporter.generateReport();

    const history = reporter.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].timestamp).toBe(timestamps[1]);
    expect(history[1].timestamp).toBe(timestamps[2]);
    expect(reporter.getHistory(1)[0].timestamp).toBe(timestamps[2]);

    reporter.clearHistory();
    expect(reporter.getHistory()).toHaveLength(0);
    expect(dependencies.logger.info.mock.calls).toEqual(
      expect.arrayContaining([['MemoryReporter: Report history cleared']])
    );

    reporter.destroy();
    nowSpy.mockRestore();
  });
});
