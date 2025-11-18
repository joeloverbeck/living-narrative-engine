/**
 * @file Test utilities for error handling framework
 * @see tests/unit/errors/ for usage examples
 */

import { jest } from '@jest/globals';
import BaseError from '../../src/errors/baseError.js';
import { ErrorCodes } from '../../src/scopeDsl/constants/errorCodes.js';

/**
 * Create a mock error handler with common methods
 *
 * @returns {object} Mock error handler
 */
export function createMockErrorHandler() {
  return {
    handle: jest.fn().mockResolvedValue(null),
    registerRecoveryStrategy: jest.fn(),
    registerErrorTransform: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({
      totalErrors: 0,
      recoveredErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recoveryRate: 0
    })
  };
}

/**
 * Create a test error with configurable properties
 *
 * @param {string} type - Error type name
 * @param {boolean} recoverable - Whether error is recoverable
 * @param {string} severity - Error severity level
 * @returns {BaseError} Test error instance
 */
export function createTestError(type = 'TestError', recoverable = true, severity = 'warning') {
  class TestError extends BaseError {
    constructor(message, code = 'TEST_ERROR', context = {}) {
      super(message, code, context);
      this.name = type;
    }
    getSeverity() { return severity; }
    isRecoverable() { return recoverable; }
  }
  return new TestError('Test error message', 'TEST_ERROR', { test: true });
}

/**
 * Simulate a burst of errors for load testing
 *
 * @param {number} count - Number of errors to generate
 * @param {object} options - Configuration options
 * @returns {BaseError[]} Array of test errors
 */
export function simulateErrorBurst(count = 100, options = {}) {
  const {
    errorType = 'TestError',
    recoverable = true,
    severity = 'warning',
    withDelay = false
  } = options;

  const errors = [];
  for (let i = 0; i < count; i++) {
    const error = createTestError(`${errorType}_${i}`, recoverable, severity);
    error.addContext('burstIndex', i);
    error.addContext('burstTotal', count);
    if (withDelay) {
      error.addContext('timestamp', Date.now() + i * 10);
    }
    errors.push(error);
  }
  return errors;
}

/**
 * Create a mock recovery strategy manager
 *
 * @returns {object} Mock recovery strategy manager
 */
export function createMockRecoveryStrategyManager() {
  return {
    executeRecovery: jest.fn().mockResolvedValue({ success: true, result: 'recovered' }),
    registerStrategy: jest.fn(),
    isRetriable: jest.fn().mockReturnValue(true),
    getMetrics: jest.fn().mockReturnValue({
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      circuitBreakerTrips: 0
    })
  };
}

/**
 * Create a mock error reporter
 *
 * @returns {object} Mock error reporter
 */
export function createMockErrorReporter() {
  return {
    report: jest.fn().mockResolvedValue(true),
    batchReport: jest.fn().mockResolvedValue(true),
    flush: jest.fn().mockResolvedValue(true),
    getAnalytics: jest.fn().mockReturnValue({
      errorsByType: {},
      errorsBySeverity: {},
      errorsByHour: {},
      topErrors: []
    }),
    getTopErrors: jest.fn().mockReturnValue([]),
    checkAlertThresholds: jest.fn().mockReturnValue([])
  };
}

/**
 * Create a chain of errors with cause relationships
 *
 * @param {number} depth - Depth of error chain
 * @returns {BaseError} Root error with nested causes
 */
export function createErrorChain(depth = 3) {
  let currentError = null;

  for (let i = depth; i > 0; i--) {
    const error = new BaseError(
      `Error at level ${i}`,
      `ERROR_LEVEL_${i}`,
      { level: i }
    );

    if (currentError) {
      error.cause = currentError;
      error.addContext('hasCause', true);
    }

    currentError = error;
  }

  return currentError;
}

/**
 * Create various domain-specific errors for testing
 *
 * @returns {object} Map of domain errors
 */
export function createDomainErrors() {
  // Create ClothingServiceError equivalent
  class ClothingServiceError extends BaseError {
    constructor(message, serviceName, operation) {
      super(message, 'CLOTHING_SERVICE_ERROR', { serviceName, operation });
      this.serviceName = serviceName;
      this.operation = operation;
      this.name = 'ClothingServiceError';
    }
    getSeverity() { return 'error'; }
    isRecoverable() { return true; }
  }

  // Create AnatomyError equivalent
  class AnatomyError extends BaseError {
    constructor(message, bodyPart) {
      super(message, 'ANATOMY_ERROR', { bodyPart });
      this.bodyPart = bodyPart;
      this.name = 'AnatomyError';
    }
    getSeverity() { return 'warning'; }
    isRecoverable() { return true; }
  }

  // Create ValidationError equivalent
  class ValidationError extends BaseError {
    constructor(message, field, value) {
      super(message, 'VALIDATION_ERROR', { field, value });
      this.field = field;
      this.value = value;
      this.name = 'ValidationError';
    }
    getSeverity() { return 'error'; }
    isRecoverable() { return false; }
  }

  return {
    ClothingServiceError,
    AnatomyError,
    ValidationError,
    createClothingError: () => new ClothingServiceError('Service failed', 'test-service', 'fetch'),
    createAnatomyError: () => new AnatomyError('Invalid body part', 'test-part'),
    createValidationError: () => new ValidationError('Invalid field', 'test-field', 'bad-value')
  };
}

/**
 * Helper to verify error context
 *
 * @param {BaseError} error - Error to verify
 * @param {object} expectedContext - Expected context values
 */
export function verifyErrorContext(error, expectedContext) {
  for (const [key, value] of Object.entries(expectedContext)) {
    const actualValue = error.getContext(key);
    if (actualValue !== value) {
      throw new Error(`Context mismatch for key '${key}': expected '${value}', got '${actualValue}'`);
    }
  }
  return true;
}

/**
 * Create a mock monitoring coordinator
 *
 * @returns {object} Mock monitoring coordinator
 */
export function createMockMonitoringCoordinator() {
  const mockCircuitBreaker = {
    execute: jest.fn((fn) => fn()),
    getState: jest.fn().mockReturnValue('CLOSED'),
    getStats: jest.fn().mockReturnValue({
      failures: 0,
      successes: 0,
      trips: 0
    })
  };

  return {
    executeMonitored: jest.fn((name, fn) => fn()),
    getStats: jest.fn().mockReturnValue({
      performance: {},
      enabled: true
    }),
    getPerformanceMonitor: jest.fn().mockReturnValue({
      startTimer: jest.fn().mockReturnValue({ stop: jest.fn() }),
      getMetrics: jest.fn().mockReturnValue({})
    }),
    getCircuitBreaker: jest.fn().mockReturnValue(mockCircuitBreaker),
    incrementValidationPipelineHealth: jest.fn(),
    getValidationPipelineHealth: jest.fn().mockReturnValue(0)
  };
}

/**
 * Wait for async operations to complete
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after delay
 */
export function waitFor(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test error with specific error code
 *
 * @param {string} code - Error code from ErrorCodes
 * @param {object} context - Error context
 * @returns {BaseError} Error with specified code
 */
export function createErrorWithCode(code, context = {}) {
  return new BaseError(
    `Error with code ${code}`,
    code,
    context
  );
}

/**
 * Verify error metrics match expectations
 *
 * @param {object} actual - Actual metrics
 * @param {object} expected - Expected metrics
 * @returns {boolean} True if metrics match
 */
export function verifyMetrics(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (typeof value === 'object' && value !== null) {
      if (!verifyMetrics(actual[key], value)) {
        return false;
      }
    } else if (actual[key] !== value) {
      console.error(`Metric mismatch for '${key}': expected ${value}, got ${actual[key]}`);
      return false;
    }
  }
  return true;
}

export default {
  createMockErrorHandler,
  createTestError,
  simulateErrorBurst,
  createMockRecoveryStrategyManager,
  createMockErrorReporter,
  createErrorChain,
  createDomainErrors,
  verifyErrorContext,
  createMockMonitoringCoordinator,
  waitFor,
  createErrorWithCode,
  verifyMetrics
};
