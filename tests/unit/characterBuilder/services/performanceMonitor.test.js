import { PerformanceMonitor } from '../../../../src/characterBuilder/services/performanceMonitor.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';

describe('PerformanceMonitor service', () => {
  let logger;
  let eventBus;
  let performanceRef;

  beforeEach(() => {
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
});
