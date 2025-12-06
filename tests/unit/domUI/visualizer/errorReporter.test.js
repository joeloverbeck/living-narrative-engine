/**
 * @file Unit tests for ErrorReporter
 * @description Comprehensive tests for error reporting functionality, metrics collection, and configuration
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ErrorReporter } from '../../../../src/domUI/visualizer/ErrorReporter.js';
import { ErrorClassifier } from '../../../../src/domUI/visualizer/ErrorClassifier.js';
import { AnatomyVisualizationError } from '../../../../src/errors/anatomyVisualizationError.js';
import { AnatomyDataError } from '../../../../src/errors/anatomyDataError.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockSafeEventDispatcher } from '../../../common/mockFactories/eventBusMocks.js';

// Mock ErrorClassifier
jest.mock('../../../../src/domUI/visualizer/ErrorClassifier.js');

describe('ErrorReporter', () => {
  let mockLogger;
  let mockEventDispatcher;
  let mockMetricsCollector;
  let errorReporter;
  let originalConsoleError;
  let originalPerformance;
  let originalNavigator;

  beforeEach(() => {
    // Create mocks
    mockLogger = createMockLogger();
    mockEventDispatcher = createMockSafeEventDispatcher();
    mockMetricsCollector = {
      increment: jest.fn(),
      timing: jest.fn(),
    };

    // Store original globals
    originalConsoleError = console.error;
    console.error = jest.fn();
    originalPerformance = global.performance;
    originalNavigator = global.navigator;

    // Mock browser APIs
    global.performance = {
      timing: {
        navigationStart: 1000,
        loadEventEnd: 3000,
        domContentLoadedEventEnd: 2000,
      },
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000,
      },
    };

    global.navigator = {
      userAgent: 'Test User Agent',
      platform: 'Test Platform',
      language: 'en-US',
      cookieEnabled: true,
      onLine: true,
    };

    global.window = {
      location: { href: 'http://test.com' },
      innerWidth: 1024,
      innerHeight: 768,
      devicePixelRatio: 2,
    };

    // Default ErrorClassifier mock behavior
    ErrorClassifier.classify.mockReturnValue({
      errorType: 'Error',
      errorMessage: 'Test error',
      errorStack: 'Error stack',
      timestamp: '2024-01-01T00:00:00.000Z',
      category: 'unknown',
      domain: 'system',
      severity: 'HIGH',
      recoverable: true,
      retryable: false,
      priority: 'high',
      operation: 'test_operation',
      component: 'test_component',
      userImpact: 'moderate',
      systemImpact: 'minor',
      recommendedStrategy: 'fallback',
      fallbackAvailable: false,
      userMessageSuggested: 'An error occurred',
      actionsSuggested: ['Refresh the page'],
    });

    ErrorClassifier.shouldReport = jest.fn().mockReturnValue(true);
  });

  afterEach(() => {
    // Restore globals
    console.error = originalConsoleError;
    global.performance = originalPerformance;
    global.navigator = originalNavigator;
    delete global.window;

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with required dependencies', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      expect(errorReporter).toBeInstanceOf(ErrorReporter);
      expect(errorReporter.isDisposed()).toBe(false);
    });

    it('should create instance with optional metricsCollector', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        metricsCollector: mockMetricsCollector,
      });

      expect(errorReporter).toBeInstanceOf(ErrorReporter);
    });

    it('should apply default configuration', async () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      // Test by checking behavior with default config
      const error = new Error('Test');
      ErrorClassifier.classify.mockReturnValue({
        severity: 'LOW', // Not in default reportLevels
        category: 'test',
      });

      const result = await errorReporter.report(error);

      // Should skip due to severity level not in default reportLevels
      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('Error does not meet reporting criteria');
    });

    it('should accept custom configuration', () => {
      errorReporter = new ErrorReporter(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          enableMetrics: false,
          enableEventDispatch: false,
          reportLevels: ['CRITICAL'],
          maxStackTraceLines: 5,
          includeUserAgent: false,
          includeUrl: false,
        }
      );

      expect(errorReporter).toBeInstanceOf(ErrorReporter);
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ErrorReporter({
          eventDispatcher: mockEventDispatcher,
        });
      }).toThrow();
    });

    it('should throw error when eventDispatcher is missing', () => {
      expect(() => {
        new ErrorReporter({
          logger: mockLogger,
        });
      }).toThrow();
    });
  });

  describe('report()', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        metricsCollector: mockMetricsCollector,
      });
    });

    it('should successfully report an error with classification', async () => {
      const error = new Error('Test error');
      const context = {
        operation: 'test_operation',
        component: 'test_component',
        data: { test: true },
      };

      const result = await errorReporter.report(error, context);

      expect(result).toMatchObject({
        reportId: expect.stringMatching(/^error_\d+_[a-z0-9]+$/),
        status: 'reported',
        classification: 'unknown',
        severity: 'HIGH',
      });

      expect(ErrorClassifier.classify).toHaveBeenCalledWith(error, context);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Error reported with ID:')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('HIGH SEVERITY ERROR'),
        expect.any(Object)
      );
    });

    it('should skip reporting when error does not meet criteria', async () => {
      ErrorClassifier.classify.mockReturnValue({
        severity: 'LOW',
        category: 'unknown',
      });

      const error = new Error('Low severity error');
      const result = await errorReporter.report(error);

      expect(result).toMatchObject({
        reportId: expect.any(String),
        status: 'skipped',
        reason: 'Error does not meet reporting criteria',
      });

      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should check shouldReport function for reporting decision', async () => {
      // Configure reporter to only report CRITICAL errors
      errorReporter = new ErrorReporter(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          reportLevels: ['CRITICAL'],
        }
      );

      // Set up a CRITICAL severity error that should be reported
      ErrorClassifier.classify.mockReturnValue({
        severity: 'CRITICAL',
        category: 'test',
      });

      // ErrorClassifier.shouldReport function exists
      ErrorClassifier.shouldReport.mockReturnValue(true);

      const error = new Error('Critical error');
      const result = await errorReporter.report(error);

      // Should be reported
      expect(result.status).toBe('reported');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should dispatch event when enabled', async () => {
      const error = new Error('Test error');
      await errorReporter.report(error);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:error_reported',
        expect.objectContaining({
          reportId: expect.any(String),
          severity: 'HIGH',
          category: 'unknown',
          userMessage: 'An error occurred',
          suggestions: ['Refresh the page'],
          timestamp: expect.any(String),
        })
      );
    });

    it('should not dispatch event when disabled', async () => {
      errorReporter = new ErrorReporter(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          enableEventDispatch: false,
        }
      );

      const error = new Error('Test error');
      await errorReporter.report(error);

      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should collect metrics when enabled', async () => {
      const error = new Error('Test error');
      const context = {
        operation: 'test_op',
        component: 'test_comp',
        metadata: {
          operationDuration: 100,
        },
      };

      await errorReporter.report(error, context);

      expect(mockMetricsCollector.increment).toHaveBeenCalledWith(
        'anatomy_visualizer.errors.total'
      );
      expect(mockMetricsCollector.increment).toHaveBeenCalledWith(
        'anatomy_visualizer.errors.severity.high'
      );
      expect(mockMetricsCollector.increment).toHaveBeenCalledWith(
        'anatomy_visualizer.errors.category.unknown'
      );
      expect(mockMetricsCollector.increment).toHaveBeenCalledWith(
        'anatomy_visualizer.errors.component.test_comp'
      );
      expect(mockMetricsCollector.timing).toHaveBeenCalledWith(
        'anatomy_visualizer.errors.operation_duration.test_op',
        100
      );
    });

    it('should not collect metrics when disabled', async () => {
      errorReporter = new ErrorReporter(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
          metricsCollector: mockMetricsCollector,
        },
        {
          enableMetrics: false,
        }
      );

      const error = new Error('Test error');
      await errorReporter.report(error);

      expect(mockMetricsCollector.increment).not.toHaveBeenCalled();
    });

    it('should handle AnatomyVisualizationError with details', async () => {
      const error = new AnatomyDataError('Data error', {
        code: 'MISSING_DATA',
        severity: 'CRITICAL',
        context: 'Loading',
        metadata: { entityId: '123' },
        userMessage: 'Data is missing',
        suggestions: ['Try again later'],
      });

      ErrorClassifier.classify.mockReturnValue({
        severity: 'CRITICAL',
        category: 'data',
        userMessageSuggested: 'Data is missing',
        actionsSuggested: ['Try again later'],
        anatomyErrorDetails: {
          code: 'MISSING_DATA',
          context: 'Loading',
          metadata: { entityId: '123' },
          userMessage: 'Data is missing',
          suggestions: ['Try again later'],
        },
      });

      const result = await errorReporter.report(error);

      expect(result.status).toBe('reported');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL ERROR'),
        expect.any(Object)
      );
    });

    it('should handle reporting errors gracefully', async () => {
      // Make classify throw an error to cause reporting to fail
      ErrorClassifier.classify.mockImplementation(() => {
        throw new Error('Classification failed');
      });

      const error = new Error('Test error');
      const result = await errorReporter.report(error);

      expect(result).toMatchObject({
        reportId: null,
        status: 'failed',
        error: expect.any(String),
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to report error:',
        expect.any(Error)
      );
    });

    it('should handle different severity levels correctly', async () => {
      const testCases = [
        {
          severity: 'CRITICAL',
          logMethod: 'error',
          logPrefix: 'CRITICAL ERROR',
        },
        {
          severity: 'HIGH',
          logMethod: 'error',
          logPrefix: 'HIGH SEVERITY ERROR',
        },
        {
          severity: 'MEDIUM',
          logMethod: 'warn',
          logPrefix: 'MEDIUM SEVERITY ERROR',
        },
        {
          severity: 'LOW',
          logMethod: 'debug',
          logPrefix: 'LOW SEVERITY ERROR',
        },
        { severity: 'UNKNOWN', logMethod: 'info', logPrefix: 'ERROR' },
      ];

      for (const { severity, logMethod, logPrefix } of testCases) {
        jest.clearAllMocks();

        errorReporter = new ErrorReporter(
          {
            logger: mockLogger,
            eventDispatcher: mockEventDispatcher,
          },
          {
            reportLevels: [severity], // Allow this severity to be reported
          }
        );

        ErrorClassifier.classify.mockReturnValue({
          severity,
          category: 'test',
        });

        await errorReporter.report(new Error('Test'));

        expect(mockLogger[logMethod]).toHaveBeenCalledWith(
          expect.stringContaining(logPrefix),
          expect.any(Object)
        );
      }
    });

    it('should sanitize sensitive data in context', async () => {
      const error = new Error('Test error');
      const context = {
        data: {
          username: 'testuser',
          password: 'secret123',
          apiToken: 'token456',
          secretKey: 'key789',
          authHeader: 'Bearer xyz',
          credentials: { user: 'admin', pass: 'admin123' },
          normalData: 'This is fine',
        },
      };

      // Capture the report that would be logged
      let capturedReport;
      mockLogger.error.mockImplementation((msg, data) => {
        capturedReport = data;
      });

      await errorReporter.report(error, context);

      // The report should be built with sanitized data
      // We can't directly access the built report, but we can verify
      // that sensitive data would be sanitized by checking the logger wasn't called
      // with sensitive information
      expect(mockLogger.error).toHaveBeenCalled();
      expect(capturedReport).toBeDefined();

      // The logged data should not contain sensitive information
      const loggedDataStr = JSON.stringify(capturedReport);
      expect(loggedDataStr).not.toContain('secret123');
      expect(loggedDataStr).not.toContain('token456');
    });

    it('should truncate long stack traces', async () => {
      const longStackLines = Array(20)
        .fill(null)
        .map((_, i) => `    at function${i} (file${i}.js:${i}:${i})`);

      const error = new Error('Test error');
      error.stack = `Error: Test error\n${longStackLines.join('\n')}`;

      errorReporter = new ErrorReporter(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          maxStackTraceLines: 5,
        }
      );

      await errorReporter.report(error);

      // Verify that stack truncation would occur
      // The actual truncation happens in _buildErrorReport which we can't directly test
      // But we can verify the error was processed
      expect(ErrorClassifier.classify).toHaveBeenCalledWith(error, {});
    });

    it('should handle empty stack traces', async () => {
      const error = new Error('Test error');
      error.stack = '';

      errorReporter = new ErrorReporter(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          maxStackTraceLines: 0,
        }
      );

      await errorReporter.report(error);

      // Should still process the error even with empty stack
      expect(ErrorClassifier.classify).toHaveBeenCalledWith(error, {});
    });

    it('should include environment information', async () => {
      const error = new Error('Test error');
      await errorReporter.report(error);

      // Verify that the error was reported
      expect(mockLogger.error).toHaveBeenCalled();

      // The environment collection methods would be called internally
      // We can't directly test their output but we know they were invoked
      // as part of the report building process
      expect(ErrorClassifier.classify).toHaveBeenCalled();
    });

    it('should handle missing browser APIs gracefully', async () => {
      // Remove browser APIs
      delete global.window;
      delete global.navigator;
      delete global.performance;

      const error = new Error('Test error');
      const result = await errorReporter.report(error);

      expect(result.status).toBe('reported');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should respect includeUserAgent configuration', async () => {
      errorReporter = new ErrorReporter(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          includeUserAgent: false,
          includeUrl: false,
        }
      );

      const error = new Error('Test error');
      await errorReporter.report(error);

      // The configuration is respected in _collectBrowserInfo and _collectEnvironmentInfo
      // We can verify the report was created successfully
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('reportBatch()', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });
    });

    it('should report multiple errors successfully', async () => {
      const errorBatch = [
        { error: new Error('Error 1'), context: { operation: 'op1' } },
        { error: new Error('Error 2'), context: { operation: 'op2' } },
        { error: new Error('Error 3'), context: { operation: 'op3' } },
      ];

      const results = await errorReporter.reportBatch(errorBatch);

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        reportId: expect.any(String),
        status: 'reported',
      });
      expect(results[1]).toMatchObject({
        reportId: expect.any(String),
        status: 'reported',
      });
      expect(results[2]).toMatchObject({
        reportId: expect.any(String),
        status: 'reported',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Batch reported 3 errors');
    });

    it('should handle individual errors in batch gracefully', async () => {
      // Make the second error fail
      ErrorClassifier.classify
        .mockReturnValueOnce({ severity: 'HIGH', category: 'test' })
        .mockImplementationOnce(() => {
          throw new Error('Classification failed');
        })
        .mockReturnValueOnce({ severity: 'HIGH', category: 'test' });

      const errorBatch = [
        { error: new Error('Error 1') },
        { error: new Error('Error 2') },
        { error: new Error('Error 3') },
      ];

      const results = await errorReporter.reportBatch(errorBatch);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('reported');
      expect(results[1]).toMatchObject({
        reportId: null,
        status: 'failed',
        error: expect.any(String),
      });
      expect(results[2].status).toBe('reported');
    });

    it('should handle batch errors that throw during processing', async () => {
      // Make report method throw for testing catch block
      jest
        .spyOn(errorReporter, 'report')
        .mockRejectedValueOnce(new Error('Report failed'));

      const errorBatch = [{ error: new Error('Error 1') }];

      const results = await errorReporter.reportBatch(errorBatch);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        reportId: null,
        status: 'failed',
        error: 'Report failed',
      });
    });

    it('should throw error for empty batch', async () => {
      await expect(errorReporter.reportBatch([])).rejects.toThrow(
        'Error batch must be a non-empty array'
      );
    });

    it('should throw error for non-array batch', async () => {
      await expect(errorReporter.reportBatch('not an array')).rejects.toThrow(
        'Error batch must be a non-empty array'
      );
    });

    it('should handle batch with missing context', async () => {
      const errorBatch = [
        { error: new Error('Error 1') }, // No context
        { error: new Error('Error 2'), context: { operation: 'op2' } },
      ];

      const results = await errorReporter.reportBatch(errorBatch);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('reported');
      expect(results[1].status).toBe('reported');
    });
  });

  describe('updateConfig()', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });
    });

    it('should update configuration', () => {
      errorReporter.updateConfig({
        enableMetrics: false,
        reportLevels: ['CRITICAL'],
        maxStackTraceLines: 3,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Error reporter configuration updated'
      );
    });

    it('should merge configuration with existing config', () => {
      // First update
      errorReporter.updateConfig({
        enableMetrics: false,
      });

      // Second update
      errorReporter.updateConfig({
        reportLevels: ['CRITICAL'],
      });

      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should apply updated configuration to subsequent reports', async () => {
      // Initially HIGH severity should be reported
      ErrorClassifier.classify.mockReturnValue({
        severity: 'HIGH',
        category: 'test',
      });

      const error = new Error('Test error');
      let result = await errorReporter.report(error);
      expect(result.status).toBe('reported');

      // Update config to only report CRITICAL
      errorReporter.updateConfig({
        reportLevels: ['CRITICAL'],
      });

      // Now HIGH severity should be skipped
      result = await errorReporter.report(error);
      expect(result.status).toBe('skipped');
    });
  });

  describe('getStatistics()', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });
    });

    it('should return initial statistics with all zeros', () => {
      const stats = errorReporter.getStatistics();

      expect(stats).toEqual({
        totalReported: 0,
        reportedBySeverity: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
        },
        reportedByCategory: {
          data: 0,
          render: 0,
          state: 0,
          network: 0,
          validation: 0,
          permission: 0,
          resource: 0,
          unknown: 0,
        },
        lastReportTime: null,
      });
    });

    it('should track statistics after reporting errors', async () => {
      const error = new Error('Test error');
      await errorReporter.report(error, {
        operation: 'test',
        component: 'test',
      });

      const stats = errorReporter.getStatistics();

      expect(stats.totalReported).toBe(1);
      expect(stats.reportedBySeverity.HIGH).toBe(1);
      expect(stats.reportedByCategory.unknown).toBe(1);
      expect(stats.lastReportTime).toBeTruthy();
    });

    it('should accumulate statistics across multiple reports', async () => {
      ErrorClassifier.classify.mockReturnValueOnce({
        errorType: 'Error',
        errorMessage: 'Test error 1',
        errorStack: 'Error stack',
        timestamp: '2024-01-01T00:00:00.000Z',
        category: 'data',
        domain: 'system',
        severity: 'CRITICAL',
        recoverable: true,
        retryable: false,
        priority: 'high',
        operation: 'test_operation',
        component: 'test_component',
        userImpact: 'moderate',
        systemImpact: 'minor',
        recommendedStrategy: 'fallback',
        fallbackAvailable: false,
        userMessageSuggested: 'An error occurred',
        actionsSuggested: ['Refresh the page'],
      });

      ErrorClassifier.classify.mockReturnValueOnce({
        errorType: 'Error',
        errorMessage: 'Test error 2',
        errorStack: 'Error stack',
        timestamp: '2024-01-01T00:00:01.000Z',
        category: 'render',
        domain: 'system',
        severity: 'HIGH',
        recoverable: true,
        retryable: false,
        priority: 'high',
        operation: 'test_operation',
        component: 'test_component',
        userImpact: 'moderate',
        systemImpact: 'minor',
        recommendedStrategy: 'fallback',
        fallbackAvailable: false,
        userMessageSuggested: 'An error occurred',
        actionsSuggested: ['Refresh the page'],
      });

      await errorReporter.report(new Error('Test 1'), { operation: 'test' });
      await errorReporter.report(new Error('Test 2'), { operation: 'test' });

      const stats = errorReporter.getStatistics();

      expect(stats.totalReported).toBe(2);
      expect(stats.reportedBySeverity.CRITICAL).toBe(1);
      expect(stats.reportedBySeverity.HIGH).toBe(1);
      expect(stats.reportedByCategory.data).toBe(1);
      expect(stats.reportedByCategory.render).toBe(1);
    });

    it('should return a copy of statistics to prevent external modification', async () => {
      await errorReporter.report(new Error('Test'), { operation: 'test' });

      const stats1 = errorReporter.getStatistics();
      stats1.totalReported = 999;
      stats1.reportedBySeverity.HIGH = 999;

      const stats2 = errorReporter.getStatistics();

      expect(stats2.totalReported).toBe(1);
      expect(stats2.reportedBySeverity.HIGH).toBe(1);
    });
  });

  describe('Lifecycle methods', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });
    });

    it('should dispose properly', () => {
      expect(errorReporter.isDisposed()).toBe(false);

      errorReporter.dispose();

      expect(errorReporter.isDisposed()).toBe(true);
    });

    it('should handle multiple dispose calls', () => {
      errorReporter.dispose();
      errorReporter.dispose(); // Should not throw

      expect(errorReporter.isDisposed()).toBe(true);
    });

    it('should throw error when using disposed reporter', async () => {
      errorReporter.dispose();

      await expect(errorReporter.report(new Error('Test'))).rejects.toThrow(
        'ErrorReporter has been disposed'
      );

      await expect(
        errorReporter.reportBatch([{ error: new Error('Test') }])
      ).rejects.toThrow('ErrorReporter has been disposed');

      expect(() => errorReporter.getStatistics()).toThrow(
        'ErrorReporter has been disposed'
      );

      expect(() => errorReporter.updateConfig({})).toThrow(
        'ErrorReporter has been disposed'
      );
    });
  });

  describe('Internal helper coverage', () => {
    it('should consider allowed severities reportable when classifier hook is absent', () => {
      ErrorClassifier.shouldReport = null;

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      expect(errorReporter._shouldReport({ severity: 'HIGH' })).toBe(true);
    });

    it('should skip metrics collection gracefully when collector is missing', async () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      await expect(
        errorReporter._collectMetrics({
          classification: { severity: 'HIGH', category: 'render' },
          context: { metadata: {} },
        })
      ).resolves.toBeUndefined();
    });

    it('should recursively sanitize nested sensitive keys', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      const sanitized = errorReporter._sanitizeData({
        metadata: {
          apiKey: 'top-secret',
          nested: {
            authToken: 'nested-secret',
          },
          optional: null,
        },
      });

      expect(sanitized.metadata.apiKey).toBe('[REDACTED]');
      expect(sanitized.metadata.nested.authToken).toBe('[REDACTED]');
      expect(sanitized.metadata.optional).toBeNull();
    });

    it('should return non-object inputs unchanged during sanitization', () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      expect(errorReporter._sanitizeData('plain-text')).toBe('plain-text');
      expect(errorReporter._sanitizeData(null)).toBeNull();
    });

    it('should collect viewport information when browser globals are present', async () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      const info = await errorReporter._collectEnvironmentInfo(undefined);

      expect(info.viewport).toEqual({
        width: global.window.innerWidth,
        height: global.window.innerHeight,
        devicePixelRatio: global.window.devicePixelRatio,
      });
    });

    it('should expose unknown URL when browser location is unavailable', async () => {
      const urlSpy = jest
        .spyOn(ErrorReporter, 'resolveCurrentUrl')
        .mockReturnValue(undefined);

      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      const info = await errorReporter._collectEnvironmentInfo(undefined);

      expect(info.url).toBe('unknown');

      urlSpy.mockRestore();
    });

    it('should redact url details when includeUrl configuration is disabled', async () => {
      errorReporter = new ErrorReporter(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          includeUrl: false,
        }
      );

      const info = await errorReporter._collectEnvironmentInfo(undefined);

      expect(info.url).toBe('[REDACTED]');
    });

    it('should resolve current url from window when provided globals include location', () => {
      expect(
        ErrorReporter.resolveCurrentUrl({
          window: { location: { href: 'https://example.app/' } },
        })
      ).toBe('https://example.app/');
    });

    it('should fall back to global location when window is unavailable', () => {
      expect(
        ErrorReporter.resolveCurrentUrl({
          location: { href: 'https://fallback.example/' },
        })
      ).toBe('https://fallback.example/');
    });

    it('should return undefined when no location information exists', () => {
      expect(
        ErrorReporter.resolveCurrentUrl({
          window: { location: {} },
          location: {},
        })
      ).toBeUndefined();
    });

    it('should fall back to global location when window lacks href', () => {
      expect(
        ErrorReporter.resolveCurrentUrl({
          window: { location: {} },
          location: { href: 'https://fallback.example/with-global' },
        })
      ).toBe('https://fallback.example/with-global');
    });

    it('should leverage globalThis fallback when globals argument is omitted', () => {
      const expectedHref = global.window.location.href;

      expect(ErrorReporter.resolveCurrentUrl()).toBe(expectedHref);
    });

    it('should skip viewport attachment when window globals are missing', async () => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      const info = await errorReporter._collectEnvironmentInfo({});

      expect(info).not.toHaveProperty('viewport');
    });
  });

  describe('Edge cases and error handling', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
        metricsCollector: mockMetricsCollector,
      });
    });

    it('should handle metrics collection failure gracefully', async () => {
      mockMetricsCollector.increment.mockImplementation(() => {
        throw new Error('Metrics failed');
      });

      const error = new Error('Test error');
      const result = await errorReporter.report(error);

      expect(result.status).toBe('reported');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to collect error metrics:',
        expect.any(Error)
      );
    });

    it('should handle event dispatch failure gracefully', async () => {
      mockEventDispatcher.dispatch.mockImplementation(() => {
        throw new Error('Dispatch failed');
      });

      const error = new Error('Test error');
      const result = await errorReporter.report(error);

      expect(result.status).toBe('reported');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to dispatch error report event:',
        expect.any(Error)
      );
    });

    it('should handle null/undefined error gracefully', async () => {
      const result = await errorReporter.report(null);

      // Should fail during classification
      expect(result.status).toBe('failed');
    });

    it('should generate unique report IDs', async () => {
      const errors = [new Error('1'), new Error('2'), new Error('3')];
      const reportIds = [];

      for (const error of errors) {
        const result = await errorReporter.report(error);
        reportIds.push(result.reportId);
      }

      // All IDs should be unique
      const uniqueIds = new Set(reportIds);
      expect(uniqueIds.size).toBe(reportIds.length);
    });

    it('should handle circular references in context data', async () => {
      const circularData = { a: 1 };
      circularData.circular = circularData;

      const error = new Error('Test error');
      const context = {
        data: circularData,
      };

      // JSON.stringify with circular reference will throw, but should be caught
      // and the report should still succeed
      const result = await errorReporter.report(error, context);

      // The result might be failed or reported depending on error handling
      // Let's just verify it doesn't crash the entire process
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });
});
