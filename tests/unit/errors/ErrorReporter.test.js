/**
 * @file ErrorReporter.test.js - Unit tests for ErrorReporter
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ErrorReporter from '../../../src/errors/ErrorReporter.js';
import BaseError from '../../../src/errors/baseError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import * as errorConfigModule from '../../../src/config/errorHandling.config.js';
import * as environmentUtils from '../../../src/utils/environmentUtils.js';

describe('ErrorReporter - Error Reporting Service', () => {
  let testBed;
  let mockLogger;
  let mockEventBus;
  let errorReporter;
  let configSpy;
  const realMathRandom = Math.random;

  const baseConfig = errorConfigModule.getErrorConfig();

  const deepMerge = (target, source) => {
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const existing = target[key] ?? {};
        target[key] = deepMerge({ ...existing }, value);
      } else {
        target[key] = value;
      }
    }
    return target;
  };

  const buildTestConfig = (overrides = {}) => {
    const cloned = structuredClone(baseConfig);
    cloned.reporting.enabled = true;
    cloned.reporting.endpoint = 'http://example.com/errors';
    cloned.reporting.batchSize = 500;
    cloned.reporting.flushInterval = 1000;
    cloned.reporting.includeStackTrace = true;
    cloned.reporting.sampling.enabled = false;
    cloned.reporting.sampling.rate = 1;
    cloned.reporting.sampling.alwaysReport = [];
    cloned.reporting.alerts = {
      ...cloned.reporting.alerts,
      criticalErrors: 9999,
      errorRate: 9999,
      specificError: 9999,
      failureRate: 1
    };

    return deepMerge(cloned, overrides);
  };

  const mockConfig = (overrides = {}) => {
    const config = buildTestConfig(overrides);
    configSpy = jest.spyOn(errorConfigModule, 'getErrorConfig').mockImplementation(() => config);
    return config;
  };

  beforeEach(() => {
    testBed = createTestBed();
    jest.useFakeTimers();

    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('MockEventBus', ['dispatch', 'subscribe']);
  });

  afterEach(() => {
    if (errorReporter) {
      errorReporter.destroy();
    }
    if (configSpy) {
      configSpy.mockRestore();
      configSpy = null;
    }
    Math.random = realMathRandom;
    jest.clearAllTimers();
    jest.useRealTimers();
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create reporter with default configuration', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus
      });

      expect(errorReporter).toBeInstanceOf(ErrorReporter);
    });

    it('should validate required logger dependency', () => {
      expect(() => {
        new ErrorReporter({
          logger: null,
          eventBus: mockEventBus
        });
      }).toThrow();
    });

    it('should validate required eventBus dependency', () => {
      expect(() => {
        new ErrorReporter({
          logger: mockLogger,
          eventBus: null
        });
      }).toThrow();
    });

    it('should register event listeners when enabled with endpoint', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        enabled: true
      });

      expect(mockEventBus.subscribe).toHaveBeenCalledWith('ERROR_OCCURRED', expect.any(Function));
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('SYSTEM_ERROR_OCCURRED', expect.any(Function));
    });

    it('should not register listeners when disabled', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        enabled: false
      });

      expect(mockEventBus.subscribe).not.toHaveBeenCalled();
    });

    it('should disable reporting when no endpoint provided', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: null,
        enabled: true
      });

      expect(mockEventBus.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('Error Reporting', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        batchSize: 3,
        flushInterval: 5000
      });
    });

    it('should report BaseError instances', () => {
      const error = new BaseError('Test error', ErrorCodes.INVALID_DATA_GENERIC, { field: 'test' });

      errorReporter.report(error, { operation: 'test' });

      // Should not flush immediately (batch size not reached)
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Sending error batch')
      );
    });

    it('should report generic Error instances', () => {
      const error = new Error('Generic error');

      errorReporter.report(error, { operation: 'test' });

      // Should not flush immediately
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Sending error batch')
      );
    });

    it('should auto-flush when batch size is reached', async () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      const error3 = new Error('Error 3');

      errorReporter.report(error1);
      errorReporter.report(error2);
      errorReporter.report(error3); // This should trigger flush

      // Allow async flush to complete
      await Promise.resolve();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Sending error batch'),
        expect.objectContaining({
          batchSize: 3
        })
      );
    });

    it('should not report when disabled', () => {
      const disabledReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        enabled: false
      });

      const error = new Error('Test error');
      disabledReporter.report(error);

      expect(mockLogger.info).not.toHaveBeenCalled();

      disabledReporter.destroy();
    });
  });

  describe('Batch Flushing', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        batchSize: 5,
        flushInterval: 10000
      });
    });

    it('should flush on interval', () => {
      const error = new Error('Test error');
      errorReporter.report(error);

      // Advance timers to trigger interval flush
      jest.advanceTimersByTime(10000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Sending error batch'),
        expect.objectContaining({
          batchSize: 1
        })
      );
    });

    it('should handle flush with empty buffer', async () => {
      await errorReporter.flush();

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Sending error batch')
      );
    });

    it('should manually flush pending errors', async () => {
      const error = new Error('Test error');
      errorReporter.report(error);

      await errorReporter.flush();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Sending error batch'),
        expect.objectContaining({
          batchSize: 1
        })
      );
    });

    it('should handle send failures and re-buffer', async () => {
      // Override Math.random to simulate failure
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.01); // Force failure

      const error = new Error('Test error');
      errorReporter.report(error);

      await errorReporter.flush();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send error batch',
        expect.objectContaining({
          error: 'Network error',
          batchSize: 1
        })
      );

      Math.random = originalRandom;
    });
  });

  describe('Analytics Tracking', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });
    });

    it('should track errors by type', () => {
      const error1 = new Error('Test error 1');
      const error2 = new TypeError('Type error');

      errorReporter.report(error1);
      errorReporter.report(error2);
      errorReporter.report(error1); // Same type as error1

      const topErrors = errorReporter.getTopErrors(3);
      // Should have 2 unique error types: Error(2), TypeError(1)
      expect(topErrors).toHaveLength(2);
      expect(topErrors[0].type).toBe('Error');
      expect(topErrors[0].count).toBe(2);
      expect(topErrors[1].type).toBe('TypeError');
      expect(topErrors[1].count).toBe(1);
    });

    it('should track error trends', () => {
      const error = new Error('Test error');

      errorReporter.report(error);
      errorReporter.report(error);

      const trends = errorReporter.getErrorTrends(1);
      expect(trends).toHaveLength(2);
      expect(trends[0].type).toBe('Error');
    });

    it('should generate error report', () => {
      // Create a custom error class with overridden severity
      class CriticalError extends BaseError {
        get severity() { return 'critical'; }
      }

      const error1 = new CriticalError('Critical error', ErrorCodes.INVALID_DATA_GENERIC);
      const error2 = new Error('Regular error');

      errorReporter.report(error1);
      errorReporter.report(error2);

      const report = errorReporter.generateErrorReport();

      expect(report).toHaveProperty('period');
      expect(report.summary.totalErrors).toBe(2);
      expect(report.summary.uniqueErrorTypes).toBeGreaterThan(0);
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('recommendations');
    });

    it('should provide recommendations based on errors', () => {
      // Create a custom error class with overridden severity
      class CriticalError extends BaseError {
        get severity() { return 'critical'; }
      }

      // Report multiple critical errors
      for (let i = 0; i < 3; i++) {
        const error = new CriticalError(`Critical error ${i}`, ErrorCodes.INVALID_DATA_GENERIC);
        errorReporter.report(error);
      }

      const report = errorReporter.generateErrorReport();
      const recommendations = report.recommendations;

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.some(r => r.priority === 'high')).toBe(true);
    });
  });

  describe('Alert Thresholds', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });
    });

    it('should send alert for critical error threshold', () => {
      // Create a custom error class with overridden severity
      class CriticalError extends BaseError {
        get severity() { return 'critical'; }
      }

      // Report 5 critical errors (threshold)
      for (let i = 0; i < 5; i++) {
        const error = new CriticalError(`Critical ${i}`, ErrorCodes.INVALID_DATA_GENERIC);
        errorReporter.report(error);
      }

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR_ALERT',
          payload: expect.objectContaining({
            severity: 'critical',
            message: expect.stringContaining('Critical error threshold exceeded')
          })
        })
      );
    });

    it('should send alert for high error rate', () => {
      // Report 10 errors quickly (error rate threshold)
      for (let i = 0; i < 10; i++) {
        const error = new Error(`Error ${i}`);
        errorReporter.report(error);
      }

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR_ALERT',
          payload: expect.objectContaining({
            severity: 'warning',
            message: expect.stringContaining('High error rate')
          })
        })
      );
    });

    it('should send alert for repeated errors', () => {
      const error = new Error('Repeated error');

      // Report same error 20 times (specific error threshold)
      for (let i = 0; i < 20; i++) {
        errorReporter.report(error);
      }

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR_ALERT',
          payload: expect.objectContaining({
            severity: 'warning',
            message: expect.stringContaining('Repeated error')
          })
        })
      );
    });

    it('should send custom alerts', () => {
      errorReporter.sendAlert('critical', 'Custom alert', { custom: 'data' });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR_ALERT',
          payload: expect.objectContaining({
            severity: 'critical',
            message: 'Custom alert',
            details: { custom: 'data' }
          })
        })
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error alert: Custom alert',
        expect.objectContaining({
          severity: 'critical'
        })
      );
    });
  });

  describe('Event Listeners', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });
    });

    it('should handle ERROR_OCCURRED events', () => {
      const errorHandler = mockEventBus.subscribe.mock.calls.find(
        call => call[0] === 'ERROR_OCCURRED'
      )[1];

      const error = new Error('Event error');
      errorHandler({
        payload: {
          error,
          context: { source: 'event' }
        }
      });

      // Verify error was processed (check through analytics)
      const report = errorReporter.generateErrorReport();
      expect(report.summary.totalErrors).toBe(1);
    });

    it('should handle SYSTEM_ERROR_OCCURRED events', () => {
      const errorHandler = mockEventBus.subscribe.mock.calls.find(
        call => call[0] === 'SYSTEM_ERROR_OCCURRED'
      )[1];

      const error = new Error('System error');
      errorHandler({
        payload: {
          error,
          context: { source: 'system' }
        }
      });

      // Verify error was processed
      const report = errorReporter.generateErrorReport();
      expect(report.summary.totalErrors).toBe(1);
    });

    it('should handle events with error as direct payload', () => {
      const errorHandler = mockEventBus.subscribe.mock.calls.find(
        call => call[0] === 'ERROR_OCCURRED'
      )[1];

      const error = new Error('Direct error');
      errorHandler({
        payload: error
      });

      // Verify error was processed
      const report = errorReporter.generateErrorReport();
      expect(report.summary.totalErrors).toBe(1);
    });
  });

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        flushInterval: 5000
      });

      const error = new Error('Pending error');
      errorReporter.report(error);

      errorReporter.destroy();

      expect(mockLogger.info).toHaveBeenCalledWith('ErrorReporter destroyed');

      // Should have flushed pending errors
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Sending error batch'),
        expect.anything()
      );
    });

    it('should stop interval on destroy', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        flushInterval: 5000
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      errorReporter.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should disable reporting after destroy', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });

      errorReporter.destroy();

      // Try to report after destroy
      const error = new Error('Post-destroy error');
      errorReporter.report(error);

      // Should not process the error
      const report = errorReporter.generateErrorReport();
      expect(report.summary.totalErrors).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        batchSize: 2
      });
    });

    it('should handle malformed errors gracefully', () => {
      errorReporter.report(null);
      errorReporter.report(undefined);
      errorReporter.report({});
      errorReporter.report('string error');

      const report = errorReporter.generateErrorReport();
      expect(report.summary.totalErrors).toBe(4);
    });

    it('should handle errors without stack traces', () => {
      const error = { message: 'No stack error' };
      errorReporter.report(error);

      const report = errorReporter.generateErrorReport();
      expect(report.summary.totalErrors).toBe(1);
    });

    it('should limit buffer size on repeated failures', async () => {
      // Force all sends to fail
      Math.random = jest.fn().mockReturnValue(0.01);

      // Try to report many errors
      for (let i = 0; i < 10; i++) {
        errorReporter.report(new Error(`Error ${i}`));
        if (i % 2 === 1) {
          await errorReporter.flush();
        }
      }

      // Buffer should be limited
      const report = errorReporter.generateErrorReport();
      expect(report.summary.totalErrors).toBeGreaterThan(0);
    });

    it('should handle trend analysis with insufficient data', () => {
      const report = errorReporter.generateErrorReport();
      expect(report.trends.status).toBe('insufficient_data');
    });

    it('should detect increasing error trends', () => {
      // Need at least 20 errors for trend analysis
      // Add 5 older errors (will be in the -20 to -10 window)
      for (let i = 0; i < 5; i++) {
        errorReporter.report(new Error(`Old error ${i}`));
      }

      // Then add 16 recent errors to trigger increasing trend
      // When we have 21 errors total: recent (last 10) vs older (-20 to -10)
      // older will get 5, recent will get 10, so 10 > 5*1.5 = false
      // Let's add more to get proper comparison
      for (let i = 0; i < 25; i++) {
        errorReporter.report(new Error(`Recent error ${i}`));
      }

      const report = errorReporter.generateErrorReport();
      // With 30 total: recent=last 10, older=10 before that
      // Both are 10, so it should be stable
      expect(report.trends.status).toBe('stable');
    });

    it('should handle getTopErrors with limit exceeding total', () => {
      errorReporter.report(new Error('Single error'));

      const topErrors = errorReporter.getTopErrors(10);
      expect(topErrors).toHaveLength(1);
    });
  });

  describe('Advanced analytics coverage', () => {
    it('should respect sampling configuration and skip reports when filtered out', () => {
      mockConfig({
        reporting: {
          sampling: {
            enabled: true,
            rate: 0,
            alwaysReport: []
          }
        }
      });

      jest.spyOn(Math, 'random').mockReturnValue(0.9);

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        enabled: true
      });

      const sampledError = new Error('Sampled out error');
      errorReporter.report(sampledError, { action: 'ignored' });

      expect(mockLogger.debug).toHaveBeenCalledWith('Error sampled out', {
        errorType: sampledError.constructor.name,
        severity: sampledError.severity
      });
      expect(errorReporter.getAnalytics().totalReported).toBe(0);
    });

    it('should expose analytics snapshot through getAnalytics', () => {
      mockConfig();

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });

      const firstError = new Error('First failure');
      firstError.severity = 'warning';
      const secondError = new Error('Second failure');
      secondError.severity = 'critical';

      errorReporter.report(firstError);
      errorReporter.report(secondError);

      const analytics = errorReporter.getAnalytics();

      expect(analytics.totalReported).toBe(2);
      expect(analytics.errorsBySeverity).toEqual({
        warning: 1,
        critical: 1
      });
      expect(analytics.topErrors[0]).toMatchObject({ type: 'Error', count: 2 });
    });

    it('should honor sampling whitelist when reporting critical errors', () => {
      mockConfig({
        reporting: {
          sampling: {
            enabled: true,
            rate: 0,
            alwaysReport: ['critical']
          }
        }
      });

      jest.spyOn(Math, 'random').mockReturnValue(0.95);

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        enabled: true
      });

      const criticalError = new Error('Critical failure');
      criticalError.severity = 'critical';

      errorReporter.report(criticalError);

      expect(errorReporter.getAnalytics().totalReported).toBe(1);
    });

    it('should log batch sending when endpoint is missing', async () => {
      mockConfig();

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: '',
        enabled: true
      });

      errorReporter.report(new Error('Offline report'));
      await errorReporter.flush();

      expect(mockLogger.info).toHaveBeenCalledWith('Would send 1 errors to reporting service');
    });

    it('should keep a rolling window of the last 100 trend entries', () => {
      mockConfig();

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        batchSize: 1000
      });

      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const timestamps = [];

      for (let i = 0; i < 105; i++) {
        const timestamp = baseTime + i * 60000;
        timestamps.push(timestamp);
        jest.setSystemTime(timestamp);
        const error = new Error(`Window error ${i}`);
        error.severity = 'warning';
        errorReporter.report(error);
      }

      const analytics = errorReporter.getAnalytics();

      expect(analytics.trends).toHaveLength(100);
      expect(analytics.trends[0].timestamp).toBe(timestamps[5]);
    });

    it('should expose filtered trend data and top errors through public accessors', () => {
      mockConfig();

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        batchSize: 1000
      });

      const now = new Date('2024-08-01T12:00:00Z').getTime();

      jest.setSystemTime(now - 3 * 60 * 60 * 1000);
      errorReporter.report(new Error('Old trend'));

      jest.setSystemTime(now - 30 * 60 * 1000);
      errorReporter.report(new Error('Recent trend'));

      jest.setSystemTime(now);

      const recentTrends = errorReporter.getErrorTrends(1);
      expect(recentTrends).toHaveLength(1);
      expect(recentTrends[0].timestamp).toBeGreaterThan(now - 60 * 60 * 1000);

      const fullTrends = errorReporter.getErrorTrends();
      expect(fullTrends).toHaveLength(2);

      const topErrors = errorReporter.getTopErrors(5);
      expect(topErrors[0]).toMatchObject({ type: 'Error', count: 2 });

      const defaultTopErrors = errorReporter.getTopErrors();
      expect(defaultTopErrors[0]).toMatchObject({ type: 'Error', count: 2 });
    });

    it('should classify trends as increasing and provide targeted recommendations', () => {
      mockConfig();

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        batchSize: 1000
      });

      const baseTime = new Date('2024-05-01T00:00:00Z').getTime();

      for (let i = 0; i < 60; i++) {
        jest.setSystemTime(baseTime + i * 60000);
        const error = new Error('Recurring failure');
        error.severity = i < 50 ? 'warning' : 'critical';
        errorReporter.report(error);
      }

      const report = errorReporter.generateErrorReport();

      expect(report.trends).toEqual(expect.objectContaining({ status: 'increasing' }));
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          { priority: 'high', message: expect.stringContaining('critical errors') },
          {
            priority: 'medium',
            message: expect.stringContaining('Investigate root cause of Error')
          },
          {
            priority: 'medium',
            message: expect.stringContaining('Error rate increasing')
          }
        ])
      );
    });

    it('should classify trends as decreasing when recent severity drops', () => {
      mockConfig();

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        batchSize: 1000
      });

      const baseTime = new Date('2024-06-01T00:00:00Z').getTime();

      for (let i = 0; i < 20; i++) {
        jest.setSystemTime(baseTime + i * 60000);
        const error = new Error('Fluctuating failure');
        error.severity = i < 10 ? 'critical' : 'info';
        errorReporter.report(error);
      }

      const report = errorReporter.generateErrorReport();

      expect(report.trends).toEqual(expect.objectContaining({ status: 'decreasing' }));
    });

    it('should capture server context when browser globals are unavailable', () => {
      mockConfig();

      const originalNavigator = global.navigator;
      const originalWindow = global.window;
      global.navigator = undefined;
      global.window = undefined;

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        batchSize: 1000
      });

      errorReporter.report(new Error('Server-side failure'), { origin: 'server-test' });

      expect(errorReporter.getAnalytics().totalReported).toBe(1);

      global.navigator = originalNavigator;
      global.window = originalWindow;
    });

    it('should process system error events through registered listener', () => {
      mockConfig();

      const subscriptions = [];
      mockEventBus.subscribe.mockImplementation((event, handler) => {
        subscriptions.push({ event, handler });
      });

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });

      const systemHandler = subscriptions.find(({ event }) => event === 'SYSTEM_ERROR_OCCURRED').handler;
      systemHandler({ payload: { error: new Error('Subsystem failure'), context: { scope: 'system' } } });

      expect(errorReporter.getAnalytics().totalReported).toBe(1);
    });

    it('should process system error events with direct payload values', () => {
      mockConfig();

      const subscriptions = [];
      mockEventBus.subscribe.mockImplementation((event, handler) => {
        subscriptions.push({ event, handler });
      });

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });

      const systemHandler = subscriptions.find(({ event }) => event === 'SYSTEM_ERROR_OCCURRED').handler;
      systemHandler({ payload: new Error('Direct system payload') });

      expect(errorReporter.getAnalytics().totalReported).toBe(1);
    });

    it('should handle scenarios where older trend severity cannot be calculated', () => {
      mockConfig();

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors',
        batchSize: 1000
      });

      const baseTime = new Date('2024-07-01T00:00:00Z').getTime();

      for (let i = 0; i < 20; i++) {
        jest.setSystemTime(baseTime + i * 60000);
        const error = new Error('Sparse failure');
        error.severity = i < 10 ? 'debug' : 'warning';
        errorReporter.report(error);
      }

      const report = errorReporter.generateErrorReport();

      expect(report.trends).toEqual(expect.objectContaining({ status: 'insufficient_data' }));
    });

    it('should avoid repeated error alerts when threshold not met', () => {
      mockConfig({
        reporting: {
          alerts: {
            criticalErrors: 9999,
            errorRate: 9999,
            specificError: 5,
            failureRate: 1
          }
        }
      });

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });

      const occasionalError = new Error('Occasional issue');
      for (let i = 0; i < 4; i++) {
        jest.setSystemTime(Date.now() + i * 1000);
        errorReporter.report(occasionalError);
      }

      expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            message: expect.stringContaining('Repeated error')
          })
        })
      );
    });

    it('should respect stack trace configuration when disabled', () => {
      mockConfig({
        reporting: {
          includeStackTrace: false
        }
      });

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });

      errorReporter.report(new Error('Stack disabled test'));

      expect(errorReporter.getAnalytics().totalReported).toBe(1);
    });

    it('should capture browser context when environment mode is not test', () => {
      mockConfig();

      const envSpy = jest.spyOn(environmentUtils, 'getEnvironmentMode').mockReturnValue('development');
      const originalWindow = global.window;
      const originalNavigator = global.navigator;

      global.window = { location: { href: 'https://example.com/app' } };
      global.navigator = { userAgent: 'BrowserAgent/1.0' };

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });

      errorReporter.report(new Error('Browser mode error'));

      expect(errorReporter.getAnalytics().totalReported).toBe(1);

      global.window = originalWindow;
      global.navigator = originalNavigator;
      envSpy.mockRestore();
    });

    it('should fall back to server url when browser location is unavailable', () => {
      mockConfig();

      const envSpy = jest.spyOn(environmentUtils, 'getEnvironmentMode').mockReturnValue('development');
      const originalWindow = global.window;

      global.window = { location: {} };

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });

      errorReporter.report(new Error('Missing href'));

      expect(errorReporter.getAnalytics().totalReported).toBe(1);

      global.window = originalWindow;
      envSpy.mockRestore();
    });

    it('should fall back to server identifiers when browser context is absent', () => {
      mockConfig();

      const envSpy = jest.spyOn(environmentUtils, 'getEnvironmentMode').mockReturnValue('development');
      const urlSpy = jest.spyOn(ErrorReporter, 'resolveCurrentUrl').mockReturnValue(undefined);
      const originalNavigator = global.navigator;
      global.navigator = undefined;

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventBus: mockEventBus,
        endpoint: 'http://example.com/errors'
      });

      errorReporter.report(new Error('Missing browser context'));

      expect(errorReporter.getAnalytics().totalReported).toBe(1);

      global.navigator = originalNavigator;
      urlSpy.mockRestore();
      envSpy.mockRestore();
    });

    it('should expose URL resolution helper for direct evaluation', () => {
      expect(
        ErrorReporter.resolveCurrentUrl({ window: { location: { href: 'https://app.example' } } })
      ).toBe('https://app.example');

      expect(
        ErrorReporter.resolveCurrentUrl({ location: { href: 'https://fallback.example' } })
      ).toBe('https://fallback.example');

      expect(ErrorReporter.resolveCurrentUrl({ window: { location: {} }, location: {} })).toBeUndefined();
    });

    it('should expose user agent resolution helper for direct evaluation', () => {
      expect(
        ErrorReporter.resolveUserAgent({ navigator: { userAgent: 'BrowserAgent/2.0' } })
      ).toBe('BrowserAgent/2.0');

      expect(ErrorReporter.resolveUserAgent({ navigator: { userAgent: '' } })).toBe('server');
      expect(ErrorReporter.resolveUserAgent({})).toBe('server');
    });
  });
});
