import { PerformanceMonitor } from '../../../../src/characterBuilder/services/performanceMonitor.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';

describe('PerformanceMonitor service', () => {
  let logger;
  let eventBus;
  let performanceRef;

  beforeEach(() => {
    jest.restoreAllMocks();
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };
    eventBus = {
      dispatch: jest.fn(),
    };
    performanceRef = {
      now: jest.fn(),
      mark: jest.fn(),
      measure: jest.fn(),
      clearMarks: jest.fn(),
      clearMeasures: jest.fn(),
    };
  });

  it('records marks and returns measurement metadata', () => {
    performanceRef.now.mockReturnValueOnce(10).mockReturnValueOnce(50).mockReturnValue(75);
    const monitor = new PerformanceMonitor({
      logger,
      eventBus,
      performanceRef,
      contextName: 'TestController',
    });

    monitor.mark('start');
    monitor.mark('end');
    const measurement = monitor.measure('render', 'start', 'end');

    expect(measurement).toMatchObject({
      duration: 40,
      startMark: 'start',
      endMark: 'end',
    });
    expect(measurement.timestamp).toBe(75);
    expect(Array.isArray(measurement.tags)).toBe(true);
    expect(eventBus.dispatch).not.toHaveBeenCalled();
    expect(monitor.getMeasurements().get('render')).toMatchObject({
      duration: 40,
    });
  });

  it('auto-creates end marks and emits threshold warnings', () => {
    performanceRef.now
      .mockReturnValueOnce(0) // start mark
      .mockReturnValueOnce(200) // auto end mark
      .mockReturnValue(250); // measurement timestamp

    const monitor = new PerformanceMonitor({
      logger,
      eventBus,
      performanceRef,
      threshold: 50,
      contextName: 'SpeechPatternsGeneratorController',
    });

    monitor.mark('heavy-start');
    const measurement = monitor.measure('heavy', 'heavy-start');

    expect(measurement.duration).toBe(200);
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING,
      expect.objectContaining({
        controller: 'SpeechPatternsGeneratorController',
        measurement: 'heavy',
        duration: 200,
        threshold: 50,
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'SpeechPatternsGeneratorController: Performance threshold exceeded for heavy',
      expect.objectContaining({ measurement: 'heavy' })
    );
  });

  it('warns when marks are missing and returns null', () => {
    const monitor = new PerformanceMonitor({
      logger,
      eventBus,
      performanceRef,
    });

    const result = monitor.measure('missing', 'not-found');
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Performance marks not found for measurement: missing',
      expect.objectContaining({ hasStartMark: false, hasEndMark: false })
    );
  });

  it('clears data by prefix and entirely', () => {
    performanceRef.now.mockReturnValue(5);
    const monitor = new PerformanceMonitor({
      logger,
      eventBus,
      performanceRef,
    });

    monitor.mark('test-start');
    monitor.mark('other-start');
    monitor.mark('test-end');
    monitor.measure('test-measure', 'test-start', 'test-end');
    monitor.measure('other-measure', 'other-start', 'test-end');

    expect(monitor.getMeasurements().size).toBe(2);

    monitor.clearData('test');
    expect(performanceRef.clearMarks).toHaveBeenCalledWith('test-start');
    expect(performanceRef.clearMeasures).toHaveBeenCalledWith('test-measure');
    expect(monitor.getMeasurements().has('test-measure')).toBe(false);
    expect(monitor.getMeasurements().has('other-measure')).toBe(true);

    monitor.clearData();
    expect(logger.debug).toHaveBeenLastCalledWith('Cleared performance data', {
      prefix: null,
    });
    expect(monitor.getMeasurements().size).toBe(0);
    expect(performanceRef.clearMarks).toHaveBeenCalledWith();
    expect(performanceRef.clearMeasures).toHaveBeenCalledWith();
  });

  it('handles dispatch failures gracefully', () => {
    performanceRef.now
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(200)
      .mockReturnValue(220);
    eventBus.dispatch.mockImplementation(() => {
      throw new Error('dispatch failed');
    });

    const monitor = new PerformanceMonitor({
      logger,
      eventBus,
      performanceRef,
      threshold: 50,
    });

    monitor.mark('start');
    const result = monitor.measure('unstable', 'start');
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenLastCalledWith(
      'Failed to measure performance: unstable',
      expect.any(Error)
    );
  });

  it('returns null and warns when mark name is missing', () => {
    const monitor = new PerformanceMonitor({
      logger,
      eventBus,
      performanceRef,
    });

    const timestamp = monitor.mark('');
    expect(timestamp).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('PerformanceMonitor: mark name is required');
  });

  it('logs mark failures and returns null when native mark throws', () => {
    const nativeError = new Error('mark failure');
    performanceRef.now.mockReturnValue(15);
    performanceRef.mark.mockImplementation(() => {
      throw nativeError;
    });

    const monitor = new PerformanceMonitor({ logger, eventBus, performanceRef });
    const result = monitor.mark('unstable-mark');

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to create performance mark: unstable-mark',
      nativeError
    );
  });

  it('logs debug fallback when native measure fails', () => {
    const nativeError = new Error('measure failure');
    performanceRef.now
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(30)
      .mockReturnValue(40);
    performanceRef.measure.mockImplementation(() => {
      throw nativeError;
    });

    const monitor = new PerformanceMonitor({
      logger,
      eventBus,
      performanceRef,
      threshold: 1000,
    });

    monitor.mark('alpha');
    monitor.mark('omega');
    const measurement = monitor.measure('render', 'alpha', 'omega');

    expect(measurement.duration).toBe(30);
    expect(logger.debug).toHaveBeenCalledWith(
      'PerformanceMonitor: native measure fallback used',
      expect.objectContaining({ measureName: 'render', error: nativeError })
    );
  });

  it('handles clear failures both by prefix and when clearing all data', () => {
    const clearMarksError = new Error('clearMarks');
    const clearMeasuresError = new Error('clearMeasures');
    performanceRef.now.mockReturnValue(5);
    performanceRef.clearMarks.mockImplementation(() => {
      throw clearMarksError;
    });
    performanceRef.clearMeasures.mockImplementation(() => {
      throw clearMeasuresError;
    });

    const monitor = new PerformanceMonitor({ logger, eventBus, performanceRef });
    monitor.mark('test-start');
    monitor.mark('test-end');
    monitor.measure('test-measure', 'test-start', 'test-end');

    expect(() => monitor.clearData('test')).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith(
      'PerformanceMonitor: clearMarks failed',
      expect.objectContaining({ markKey: 'test-start', error: clearMarksError })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'PerformanceMonitor: clearMeasures failed',
      expect.objectContaining({ measureKey: 'test-measure', error: clearMeasuresError })
    );

    expect(() => monitor.clearData()).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith('PerformanceMonitor: clear all failed', {
      error: clearMarksError,
    });
  });

  it('manages stats listeners and guards against listener errors', () => {
    performanceRef.now
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(20)
      .mockReturnValue(25);
    const monitor = new PerformanceMonitor({
      logger,
      eventBus,
      performanceRef,
      threshold: 1000,
    });

    const safeListener = jest.fn();
    const failingListener = jest.fn(() => {
      throw new Error('listener broke');
    });

    monitor.registerStatsListener(safeListener);
    monitor.registerStatsListener(failingListener);
    monitor.registerStatsListener(null);

    monitor.mark('task-start');
    monitor.mark('task-end');
    const measurement = monitor.measure('task', 'task-start', 'task-end');

    expect(safeListener).toHaveBeenCalledWith('task', measurement);
    expect(logger.warn).toHaveBeenCalledWith(
      'PerformanceMonitor: stats listener threw error',
      expect.any(Error)
    );

    monitor.unregisterStatsListener(safeListener);
    monitor.unregisterStatsListener(failingListener);

    expect(monitor.getMeasurements().get('task')).toBe(measurement);
  });

  it('falls back to Date.now when performanceRef.now is not available', () => {
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);
    const monitor = new PerformanceMonitor({
      logger,
      eventBus,
      performanceRef: {
        mark: jest.fn(),
      },
    });

    const timestamp = monitor.mark('fallback-start');
    expect(timestamp).toBe(12345);
    expect(dateSpy).toHaveBeenCalled();
  });

  describe('Aggregated Statistics', () => {
    it('returns null when no measurements exist', () => {
      const monitor = new PerformanceMonitor({
        logger,
        eventBus,
        performanceRef,
      });

      const stats = monitor.getAggregatedStats();
      expect(stats).toBeNull();
    });

    it('computes aggregated statistics correctly', () => {
      performanceRef.now
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(150)
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(250)
        .mockReturnValueOnce(400)
        .mockReturnValueOnce(450);

      const monitor = new PerformanceMonitor({
        logger,
        eventBus,
        performanceRef,
        threshold: 1000,
      });

      monitor.mark('task1-start');
      monitor.mark('task1-end');
      monitor.measure('task1', 'task1-start', 'task1-end');

      monitor.mark('task2-start');
      monitor.mark('task2-end');
      monitor.measure('task2', 'task2-start', 'task2-end');

      monitor.mark('task3-start');
      monitor.mark('task3-end');
      monitor.measure('task3', 'task3-start', 'task3-end');

      const stats = monitor.getAggregatedStats();

      expect(stats).toMatchObject({
        count: 3,
        total: 100 + 50 + 150, // 300ms total
        average: 100, // (100 + 50 + 150) / 3
        min: 50,
        max: 150,
      });

      expect(stats.measurements).toHaveLength(3);
      expect(stats.measurements[0].name).toBe('task1');
      expect(stats.measurements[0].duration).toBe(100);
      expect(stats.measurements[1].name).toBe('task2');
      expect(stats.measurements[1].duration).toBe(50);
      expect(stats.measurements[2].name).toBe('task3');
      expect(stats.measurements[2].duration).toBe(150);
    });

    it('emits aggregated summary to listeners', () => {
      performanceRef.now
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(250);

      const monitor = new PerformanceMonitor({
        logger,
        eventBus,
        performanceRef,
        threshold: 1000,
      });

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      monitor.registerStatsListener(listener1);
      monitor.registerStatsListener(listener2);

      monitor.mark('task1-start');
      monitor.mark('task1-end');
      monitor.measure('task1', 'task1-start', 'task1-end');

      monitor.mark('task2-start');
      monitor.mark('task2-end');
      monitor.measure('task2', 'task2-start', 'task2-end');

      const stats = monitor.emitAggregatedSummary();

      expect(stats).toMatchObject({
        count: 2,
        total: 150, // 50 + 100
        average: 75,
        min: 50,
        max: 100,
      });

      expect(listener1).toHaveBeenCalledWith('aggregated_summary', stats);
      expect(listener2).toHaveBeenCalledWith('aggregated_summary', stats);

      expect(logger.debug).toHaveBeenCalledWith(
        'Emitted aggregated performance summary',
        expect.objectContaining({
          count: 2,
          average: '75.00ms',
          min: '50.00ms',
          max: '100.00ms',
        })
      );
    });

    it('returns null and does not call listeners when no measurements exist', () => {
      const monitor = new PerformanceMonitor({
        logger,
        eventBus,
        performanceRef,
      });

      const listener = jest.fn();
      monitor.registerStatsListener(listener);

      const stats = monitor.emitAggregatedSummary();

      expect(stats).toBeNull();
      expect(listener).not.toHaveBeenCalled();
    });

    it('returns stats but does not call listeners when no listeners registered', () => {
      performanceRef.now
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(150);

      const monitor = new PerformanceMonitor({
        logger,
        eventBus,
        performanceRef,
        threshold: 1000,
      });

      monitor.mark('task-start');
      monitor.mark('task-end');
      monitor.measure('task', 'task-start', 'task-end');

      const stats = monitor.emitAggregatedSummary();

      expect(stats).toMatchObject({
        count: 1,
        total: 100,
        average: 100,
        min: 100,
        max: 100,
      });

      expect(logger.debug).not.toHaveBeenCalledWith(
        'Emitted aggregated performance summary',
        expect.any(Object)
      );
    });

    it('guards against listener errors when emitting summary', () => {
      performanceRef.now
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(100);

      const monitor = new PerformanceMonitor({
        logger,
        eventBus,
        performanceRef,
        threshold: 1000,
      });

      const safeListener = jest.fn();
      const failingListener = jest.fn(() => {
        throw new Error('aggregated summary listener broke');
      });

      monitor.registerStatsListener(safeListener);
      monitor.registerStatsListener(failingListener);

      monitor.mark('task-start');
      monitor.mark('task-end');
      monitor.measure('task', 'task-start', 'task-end');

      const stats = monitor.emitAggregatedSummary();

      expect(stats).toBeDefined();
      expect(safeListener).toHaveBeenCalledWith('aggregated_summary', stats);
      expect(logger.warn).toHaveBeenCalledWith(
        'PerformanceMonitor: aggregated summary listener threw error',
        expect.any(Error)
      );
    });
  });
});
