/**
 * @file Integration tests for ErrorReporter analytics, thresholds, and batching behavior
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ErrorReporter from '../../../src/errors/ErrorReporter.js';
import BaseError from '../../../src/errors/baseError.js';
import EventBus from '../../../src/events/eventBus.js';
import errorHandlingConfig from '../../../src/config/errorHandling.config.js';
import { createTestBed } from '../../common/testBed.js';

/**
 * Wraps the production EventBus so it can accept both (name, payload) and full event objects.
 */
class EventBusCompatibilityWrapper {
  constructor(logger) {
    this.eventBus = new EventBus({ logger });
  }

  subscribe(eventName, listener) {
    return this.eventBus.subscribe(eventName, listener);
  }

  async dispatch(eventOrName, payload) {
    if (typeof eventOrName === 'string') {
      return this.eventBus.dispatch(eventOrName, payload);
    }

    if (eventOrName && typeof eventOrName.type === 'string') {
      return this.eventBus.dispatch(eventOrName.type, eventOrName.payload);
    }

    throw new Error('Invalid event object passed to EventBusCompatibilityWrapper.dispatch');
  }
}

describe('ErrorReporter integration coverage', () => {
  let testBed;
  let logger;
  let eventBus;
  let reporter;
  let activeReporters;
  let originalSampling;

  beforeAll(() => {
    originalSampling = JSON.parse(JSON.stringify(errorHandlingConfig.reporting.sampling));
  });

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();
    eventBus = new EventBusCompatibilityWrapper(logger);
    eventBus.eventBus.setBatchMode(true, {
      maxRecursionDepth: 500,
      maxGlobalRecursion: 2000,
      context: 'error-reporter-integration-tests'
    });
    activeReporters = [];
  });

  afterEach(async () => {
    errorHandlingConfig.reporting.sampling = JSON.parse(JSON.stringify(originalSampling));

    for (const currentReporter of activeReporters) {
      await currentReporter.flush();
      currentReporter.destroy();
    }
    activeReporters = [];

    if (eventBus?.eventBus?.isBatchModeEnabled()) {
      eventBus.eventBus.setBatchMode(false);
    }

    jest.restoreAllMocks();
  });

  /**
   *
   * @param overrides
   */
  function createReporter(overrides = {}) {
    reporter = new ErrorReporter({
      logger,
      eventBus,
      endpoint: 'http://internal-errors.local',
      batchSize: 25,
      flushInterval: 60_000,
      enabled: true,
      ...overrides
    });
    activeReporters.push(reporter);
    return reporter;
  }

  it('applies sampling while still processing prioritized bus events', async () => {
    errorHandlingConfig.reporting.sampling = {
      enabled: true,
      rate: 0,
      alwaysReport: ['critical']
    };

    const samplingReporter = createReporter({ batchSize: 10 });

    samplingReporter.report(new Error('transient spike'), { module: 'integration' });

    expect(logger.debug).toHaveBeenCalledWith('Error sampled out', {
      errorType: 'Error',
      severity: undefined
    });

    class CriticalTestError extends BaseError {
      constructor(message) {
        super(message, 'CRITICAL_TEST');
      }
      getSeverity() {
        return 'critical';
      }
      isRecoverable() {
        return true;
      }
    }

    const capturedAlerts = [];
    eventBus.subscribe('ERROR_ALERT', event => {
      capturedAlerts.push(event.payload);
    });

    await eventBus.dispatch('SYSTEM_ERROR_OCCURRED', {
      error: new CriticalTestError('system failure'),
      context: { subsystem: 'systems' }
    });

    await eventBus.dispatch('ERROR_OCCURRED', {
      error: new CriticalTestError('workflow failure'),
      context: { subsystem: 'workflows' }
    });

    const analytics = samplingReporter.getAnalytics();
    expect(analytics.totalReported).toBe(2);
    expect(analytics.errorsBySeverity.critical).toBe(2);
    expect(capturedAlerts).toHaveLength(0);

    await samplingReporter.flush();
  });

  it('flushes batches, requeues on failures, and generates analytics-driven insights', async () => {
    errorHandlingConfig.reporting.sampling = {
      enabled: false,
      rate: 1,
      alwaysReport: []
    };

    const insightsReporter = createReporter({ batchSize: 80, flushInterval: 120_000 });
    const alertEvents = [];
    eventBus.subscribe('ERROR_ALERT', event => {
      alertEvents.push(event.payload);
    });

    class RepeatedInfoError extends BaseError {
      constructor(id) {
        super(`Info error ${id}`, 'INFO_REPEAT', { id });
      }
      getSeverity() {
        return 'info';
      }
      isRecoverable() {
        return true;
      }
    }

    class CriticalSpikeError extends BaseError {
      constructor(id) {
        super(`Critical error ${id}`, 'CRITICAL_SPIKE', { id });
      }
      getSeverity() {
        return 'critical';
      }
      isRecoverable() {
        return false;
      }
    }

    for (let i = 0; i < 55; i++) {
      insightsReporter.report(new RepeatedInfoError(i));
    }

    for (let i = 0; i < 10; i++) {
      insightsReporter.report(new CriticalSpikeError(i));
    }

    await new Promise(resolve => setImmediate(resolve));

    const analyticsBeforeFlush = insightsReporter.getAnalytics();
    expect(analyticsBeforeFlush.totalReported).toBe(65);
    expect(analyticsBeforeFlush.errorsByType.RepeatedInfoError).toBe(55);
    expect(analyticsBeforeFlush.errorsBySeverity.info).toBe(55);
    expect(analyticsBeforeFlush.errorsBySeverity.critical).toBe(10);

    const failureRandom = jest.spyOn(Math, 'random').mockImplementation(() => 0);
    await insightsReporter.flush();
    expect(logger.error).toHaveBeenCalledWith('Failed to send error batch', {
      error: 'Network error',
      batchSize: 65
    });

    failureRandom.mockImplementation(() => 0.9);
    await insightsReporter.flush();
    expect(logger.debug).toHaveBeenCalledWith('Flushed 65 error reports');

    const report = insightsReporter.generateErrorReport();
    expect(report.summary.totalErrors).toBe(65);
    expect(report.summary.topErrors[0]).toEqual(
      expect.objectContaining({ type: 'RepeatedInfoError', count: 55 })
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('critical errors') }),
        expect.objectContaining({ message: expect.stringContaining('Investigate root cause') }),
        expect.objectContaining({ message: expect.stringContaining('Error rate increasing') })
      ])
    );

    const trends = insightsReporter.getErrorTrends(2);
    expect(trends.length).toBeGreaterThanOrEqual(20);

    const topErrors = insightsReporter.getTopErrors(2);
    expect(topErrors[0].type).toBe('RepeatedInfoError');

    const analyticsAfterFlush = insightsReporter.getAnalytics();
    expect(analyticsAfterFlush.totalReported).toBe(65);

    expect(alertEvents.some(alert => alert.severity === 'critical')).toBe(true);
    expect(alertEvents.some(alert => alert.message.startsWith('High error rate'))).toBe(true);
    expect(alertEvents.some(alert => alert.message.startsWith('Repeated error'))).toBe(true);
  });
});
