import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import MemoryReporter from '../../../src/entities/monitoring/MemoryReporter.js';
import MemoryMonitor from '../../../src/entities/monitoring/MemoryMonitor.js';
import MemoryAnalyzer from '../../../src/entities/monitoring/MemoryAnalyzer.js';
import MemoryProfiler from '../../../src/entities/monitoring/MemoryProfiler.js';
import MemoryPressureManager from '../../../src/entities/monitoring/MemoryPressureManager.js';
import EventBus from '../../../src/events/eventBus.js';
import * as environmentUtils from '../../../src/utils/environmentUtils.js';

const MB = 1024 * 1024;

const advanceTimers = async (ms) => {
  if (typeof jest.advanceTimersByTimeAsync === 'function') {
    await jest.advanceTimersByTimeAsync(ms);
  } else {
    jest.advanceTimersByTime(ms);
  }
};

const createTestLogger = () => {
  const logs = [];
  return {
    logs,
    info: (...args) => logs.push({ level: 'info', args }),
    error: (...args) => logs.push({ level: 'error', args }),
    warn: (...args) => logs.push({ level: 'warn', args }),
    debug: (...args) => logs.push({ level: 'debug', args }),
  };
};

describe('MemoryReporter integration with live monitoring stack', () => {
  let logger;
  let eventBus;
  let monitor;
  let analyzer;
  let profiler;
  let pressureManager;
  let reporter;
  let gcSpy;
  let getUsageSpy;
  let getUsageBytesSpy;
  let capturedStrategyEvents;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    logger = createTestLogger();
    eventBus = new EventBus({ logger });

    // Adapt dispatch to support the object signature used by monitoring services
    const originalDispatch = eventBus.dispatch.bind(eventBus);
    eventBus.dispatch = (eventOrName, payload) => {
      if (eventOrName && typeof eventOrName === 'object' && eventOrName.type) {
        return originalDispatch(eventOrName.type, eventOrName.payload ?? {});
      }
      return originalDispatch(eventOrName, payload);
    };

    capturedStrategyEvents = [];
    eventBus.subscribe('MEMORY_STRATEGY_COMPLETED', (event) => {
      capturedStrategyEvents.push(event);
    });

    const samples = [
      {
        heapUsed: 200 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 10 * MB,
      },
      {
        heapUsed: 240 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 10 * MB,
      },
      {
        heapUsed: 288 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 10 * MB,
      },
      {
        heapUsed: 336 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 12 * MB,
      },
      {
        heapUsed: 352 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 12 * MB,
      },
      {
        heapUsed: 368 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 14 * MB,
      },
      {
        heapUsed: 380 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 14 * MB,
      },
      {
        heapUsed: 384 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 14 * MB,
      },
      {
        heapUsed: 388 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 14 * MB,
      },
      {
        heapUsed: 392 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 14 * MB,
      },
      {
        heapUsed: 396 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 14 * MB,
      },
      {
        heapUsed: 398 * MB,
        heapTotal: 400 * MB,
        heapLimit: 400 * MB,
        external: 14 * MB,
      },
    ];

    let sampleIndex = 0;
    let currentSample = samples[0];

    getUsageSpy = jest
      .spyOn(environmentUtils, 'getMemoryUsage')
      .mockImplementation(() => {
        currentSample = samples[Math.min(sampleIndex, samples.length - 1)];
        sampleIndex += 1;
        return { ...currentSample };
      });

    getUsageBytesSpy = jest
      .spyOn(environmentUtils, 'getMemoryUsageBytes')
      .mockImplementation(() => currentSample.heapUsed);

    gcSpy = jest
      .spyOn(environmentUtils, 'triggerGarbageCollection')
      .mockImplementation(() => true);

    monitor = new MemoryMonitor({
      logger,
      eventBus,
      samplingInterval: 1000,
      maxHistorySize: 32,
      leakDetectionConfig: {
        windowSize: 4,
        checkInterval: 1000,
        enabled: true,
      },
    });

    analyzer = new MemoryAnalyzer({ logger }, { minSamplesForAnalysis: 4 });
    profiler = new MemoryProfiler(
      { logger },
      { trackPeakMemory: false, snapshotInterval: 50 }
    );

    pressureManager = new MemoryPressureManager(
      { logger, eventBus, monitor },
      {
        automaticManagement: true,
        minTimeBetweenManagement: 0,
        aggressiveGC: true,
      }
    );

    pressureManager.enableAutomaticManagement(true);

    monitor.start();

    // Allow the monitor to collect samples and trigger leak detection
    for (let step = 0; step < 7; step += 1) {
      await advanceTimers(1000);
    }

    // Additional time to ensure leak detection interval fires
    await advanceTimers(1000);

    // Simulate profiling activity to feed MemoryProfiler with real data
    const runProfiledOperation = async (id, label, duration = 200) => {
      profiler.startProfiling(id, label);
      await advanceTimers(duration);
      profiler.endProfiling(id);
    };

    await runProfiledOperation('report-cycle-1', 'Report cycle');
    await runProfiledOperation('report-cycle-2', 'Report cycle');
    await runProfiledOperation('cleanup-1', 'Cleanup task');
    await runProfiledOperation('cleanup-2', 'Cleanup task');

    reporter = new MemoryReporter(
      {
        logger,
        monitor,
        analyzer,
        profiler,
        pressureManager,
      },
      {
        maxReportHistory: 5,
        includeRecommendations: true,
        verbosity: 'detailed',
      }
    );
  });

  afterEach(() => {
    reporter?.stopAutoReporting();
    pressureManager?.destroy();
    monitor?.stop();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('produces a critical report from coordinated monitoring services', () => {
    const leakAnalysis = monitor.detectMemoryLeak();
    expect(leakAnalysis.detected).toBe(true);
    expect(leakAnalysis.trend).toBe('growing');

    const report = reporter.generateReport({ verbosity: 'detailed' });

    expect(report.summary.status).toBe('critical');
    expect(report.pressure.level).toBe('critical');
    expect(report.trends.trend).toBe('growing');
    expect(report.patterns.length).toBeGreaterThan(0);
    expect(report.hotspots.length).toBeGreaterThan(0);

    const categories = report.recommendations.map((rec) => rec.category);
    expect(categories).toEqual(expect.arrayContaining(['leak', 'pressure']));

    expect(gcSpy).toHaveBeenCalled();
    expect(capturedStrategyEvents.length).toBeGreaterThan(0);

    const managementHistory = pressureManager.getManagementHistory();
    expect(managementHistory.length).toBeGreaterThan(0);

    const history = reporter.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].summary.status).toBe('critical');
    expect(getUsageSpy).toHaveBeenCalled();
    expect(getUsageBytesSpy).toHaveBeenCalled();
  });

  it('supports exporting reports and auto-report lifecycle management', async () => {
    const pressureLevelSpy = jest.spyOn(
      pressureManager,
      'getCurrentPressureLevel'
    );
    pressureLevelSpy.mockReturnValueOnce('normal');
    pressureLevelSpy.mockReturnValueOnce('warning');

    jest.spyOn(monitor, 'getCurrentUsage').mockReturnValueOnce(null);

    const leakSpy = jest.spyOn(monitor, 'detectMemoryLeak');
    leakSpy.mockReturnValueOnce({
      detected: false,
      growthRate: 0,
      confidence: 'low',
      trend: 'stable',
    });
    leakSpy.mockReturnValueOnce({
      detected: false,
      growthRate: 0,
      confidence: 'medium',
      trend: 'stable',
    });

    const trendSpy = jest.spyOn(analyzer, 'analyzeTrend');
    trendSpy.mockReturnValueOnce({
      trend: 'stable',
      slope: 0,
      confidence: 0.2,
    });
    trendSpy.mockReturnValueOnce({
      trend: 'growing',
      slope: 15,
      confidence: 0.92,
    });

    const patternSpy = jest.spyOn(analyzer, 'detectPatterns');
    patternSpy.mockReturnValueOnce([]);
    patternSpy.mockReturnValueOnce([
      { type: 'exponential', description: 'Rapid growth' },
      {
        type: 'sawtooth',
        description: 'Large GC cycles',
        characteristics: { amplitude: 150 * MB },
      },
    ]);

    const nullUsageReport = reporter.generateReport({
      verbosity: 'minimal',
      includeRecommendations: true,
    });

    expect(nullUsageReport.currentState).toEqual({ available: false });
    expect(nullUsageReport.summary.status).toBe('healthy');

    const warningReport = reporter.generateReport({
      verbosity: 'minimal',
      includeRecommendations: true,
    });

    expect(warningReport.summary.status).toBe('warning');
    expect(
      warningReport.recommendations.some((rec) => rec.category === 'pattern')
    ).toBe(true);
    expect(
      warningReport.recommendations.some((rec) => rec.category === 'pressure')
    ).toBe(true);

    const jsonExport = reporter.exportReport(warningReport, 'json');
    expect(JSON.parse(jsonExport).summary.status).toBe('warning');

    const textExport = reporter.exportReport(warningReport, 'text');
    expect(textExport).toContain('RECOMMENDATIONS:');

    const markdownExport = reporter.exportReport(warningReport, 'markdown');
    expect(markdownExport).toContain('## Recommendations');

    const htmlExport = reporter.exportReport(warningReport, 'html');
    expect(htmlExport).toContain('<!DOCTYPE html>');

    expect(() => reporter.exportReport(warningReport, 'csv')).toThrow(
      'Unsupported format'
    );

    const autoJson = reporter.exportReport(undefined, 'json');
    expect(typeof autoJson).toBe('string');

    expect(reporter.getHistory()).toHaveLength(3);
    expect(reporter.getHistory(1)).toHaveLength(1);

    reporter.clearHistory();
    expect(reporter.getHistory()).toHaveLength(0);

    reporter.destroy();

    const autoReporter = new MemoryReporter(
      {
        logger,
        monitor,
        analyzer,
        profiler,
        pressureManager,
      },
      {
        autoReportInterval: 500,
        includeRecommendations: false,
        maxReportHistory: 2,
        verbosity: 'minimal',
      }
    );

    reporter = autoReporter;

    await advanceTimers(500);
    await advanceTimers(500);
    await advanceTimers(500);

    const autoHistory = autoReporter.getHistory();
    expect(autoHistory.length).toBeLessThanOrEqual(2);

    const warnLogs = logger.logs.filter(
      (entry) =>
        entry.level === 'warn' && String(entry.args[0]).includes('Auto-report')
    );
    expect(warnLogs.length).toBeGreaterThan(0);

    autoReporter.stopAutoReporting();
    const sizeAfterStop = autoReporter.getHistory().length;
    await advanceTimers(1000);
    expect(autoReporter.getHistory().length).toBe(sizeAfterStop);

    autoReporter.destroy();
  });
});
