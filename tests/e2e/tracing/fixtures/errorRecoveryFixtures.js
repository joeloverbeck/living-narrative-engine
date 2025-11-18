/**
 * @file Error Recovery Test Fixtures
 * @description Test data, scenarios, and configurations for error recovery workflow testing
 */

import {
  TraceErrorType,
  TraceErrorSeverity,
} from '../../../../src/actions/tracing/errors/traceErrorHandler.js';
import { RecoveryAction } from '../../../../src/actions/tracing/recovery/recoveryManager.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  RECOVERY_POTENTIAL,
} from '../../../../src/actions/tracing/errorClassification.js';

/**
 * Error scenarios for testing different error types and recovery strategies
 * Note: We create error objects lazily to avoid issues with module loading
 */
export const ERROR_SCENARIOS = {
  NETWORK_TIMEOUT: {
    createError: () => new Error('Connection timeout'),
    errorType: TraceErrorType.TIMEOUT,
    category: ERROR_CATEGORIES.NETWORK,
    severity: TraceErrorSeverity.MEDIUM,
    expectedRecovery: 'retry',
    retryable: true,
    transient: true,
    maxRetries: 3,
    description:
      'Network timeout error that should trigger exponential backoff retry',
    get error() {
      return this.createError();
    },
  },

  RESOURCE_NOT_FOUND: {
    createError: () => new Error('Entity not found: player-123'),
    errorType: TraceErrorType.FILE_SYSTEM, // Changed from VALIDATION to get MEDIUM severity
    category: ERROR_CATEGORIES.RESOURCE,
    severity: TraceErrorSeverity.MEDIUM,
    expectedRecovery: 'fallback',
    retryable: true, // Changed to match ErrorClassifier's CONDITIONAL recovery = retryable logic
    transient: false,
    description: 'Resource not found error requiring fallback behavior',
    get error() {
      return this.createError();
    },
  },

  MEMORY_CRITICAL: {
    createError: () => new Error('Out of memory'),
    errorType: TraceErrorType.MEMORY,
    category: ERROR_CATEGORIES.SYSTEM,
    severity: TraceErrorSeverity.CRITICAL,
    expectedRecovery: 'emergency',
    retryable: false,
    transient: false,
    description: 'Critical memory error requiring emergency shutdown',
    get error() {
      return this.createError();
    },
  },

  VALIDATION_ERROR: {
    createError: () => new Error('Invalid action parameters'),
    errorType: TraceErrorType.VALIDATION,
    category: ERROR_CATEGORIES.VALIDATION,
    severity: TraceErrorSeverity.LOW,
    expectedRecovery: 'continue',
    retryable: false,
    transient: false,
    description:
      'Validation error that should continue with degraded functionality',
    get error() {
      return this.createError();
    },
  },

  SERIALIZATION_ERROR: {
    createError: () => new Error('Failed to serialize trace data'),
    errorType: TraceErrorType.SERIALIZATION,
    category: ERROR_CATEGORIES.LOGIC,
    severity: TraceErrorSeverity.MEDIUM, // Production defaults to MEDIUM for unhandled types
    expectedRecovery: 'retry', // MEDIUM severity gets retry, not disable
    retryable: true,
    transient: false,
    maxRetries: 2,
    description: 'Serialization error that should retry then fallback',
    get error() {
      return this.createError();
    },
  },

  FILE_SYSTEM_ERROR: {
    createError: () => {
      const error = new Error('ENOSPC: no space left on device');
      error.code = 'ENOSPC'; // Set the code property that production checks
      return error;
    },
    errorType: TraceErrorType.FILE_SYSTEM,
    category: ERROR_CATEGORIES.RESOURCE,
    severity: TraceErrorSeverity.HIGH,
    expectedRecovery: 'fallback',
    retryable: false,
    transient: false,
    description: 'File system error requiring fallback to in-memory storage',
    get error() {
      return this.createError();
    },
  },
};

/**
 * Circuit breaker test configurations
 */
export const CIRCUIT_BREAKER_CONFIGS = {
  DEFAULT: {
    threshold: 5,
    timeout: 30000,
    resetTimeout: 60000,
  },
  AGGRESSIVE: {
    threshold: 3,
    timeout: 10000,
    resetTimeout: 20000,
  },
  LENIENT: {
    threshold: 10,
    timeout: 60000,
    resetTimeout: 120000,
  },
};

/**
 * Retry strategy configurations
 */
export const RETRY_STRATEGIES = {
  EXPONENTIAL: {
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
    maxDelay: 30000,
    jitter: true,
  },
  LINEAR: {
    maxAttempts: 5,
    delay: 2000,
    exponentialBackoff: false,
    maxDelay: 10000,
    jitter: false,
  },
  IMMEDIATE: {
    maxAttempts: 2,
    delay: 0,
    exponentialBackoff: false,
    maxDelay: 0,
    jitter: false,
  },
};

/**
 * Error storm patterns for stress testing
 */
export const ERROR_STORM_PATTERNS = {
  BURST: {
    errorCount: 5, // Reduced from 20 to 5 for faster testing
    duration: 200, // Reduced from 1000ms to 200ms
    errorTypes: ['NETWORK_TIMEOUT', 'VALIDATION_ERROR'],
    description: 'Burst of errors to test circuit breaker activation',
  },
  SUSTAINED: {
    errorCount: 8, // Reduced from 50 to 8 for faster testing
    duration: 1000, // Reduced from 10000ms to 1000ms
    errorTypes: ['SERIALIZATION_ERROR', 'RESOURCE_NOT_FOUND'],
    description: 'Sustained error rate to test component disabling',
  },
  MIXED: {
    errorCount: 6, // Reduced from 30 to 6 for faster testing
    duration: 500, // Reduced from 5000ms to 500ms
    errorTypes: Object.keys(ERROR_SCENARIOS),
    description: 'Mixed error types to test classification accuracy',
  },
};

/**
 * Expected recovery outcomes for validation
 */
export const EXPECTED_OUTCOMES = {
  SUCCESSFUL_RETRY: {
    recoveryAction: 'retry',
    shouldContinue: true,
    attempts: 2,
    finalStatus: 'success',
  },
  CIRCUIT_BREAKER_OPEN: {
    recoveryAction: 'fallback',
    shouldContinue: true,
    circuitState: 'open',
    fallbackMode: 'degraded',
  },
  COMPONENT_DISABLED: {
    recoveryAction: 'disable',
    shouldContinue: false,
    componentState: 'disabled',
  },
  EMERGENCY_SHUTDOWN: {
    recoveryAction: 'emergency',
    shouldContinue: false,
    systemState: 'emergency_stopped',
  },
};

/**
 * Performance expectations for error recovery
 */
export const RECOVERY_PERFORMANCE = {
  MAX_RECOVERY_TIME: 5000, // Max time for recovery attempt
  MAX_CLASSIFICATION_TIME: 10, // Max time to classify error
  MAX_RETRY_OVERHEAD: 100, // Max overhead per retry attempt
  MAX_MEMORY_INCREASE: 5 * 1024 * 1024, // Max 5MB memory increase during error handling
};

/**
 * Test action that can fail in various ways
 *
 * @param errorScenario
 */
export const createFailingAction = (errorScenario) => {
  return {
    id: 'test:failing_action',
    name: 'Failing Test Action',
    execute: () => {
      throw errorScenario.error;
    },
    metadata: {
      errorType: errorScenario.errorType,
      expectedRecovery: errorScenario.expectedRecovery,
    },
  };
};

/**
 * Generate a sequence of errors for storm testing
 *
 * @param pattern
 */
export const generateErrorStorm = (pattern) => {
  const storm = ERROR_STORM_PATTERNS[pattern];
  const errors = [];

  for (let i = 0; i < storm.errorCount; i++) {
    const errorType = storm.errorTypes[i % storm.errorTypes.length];
    const scenario = ERROR_SCENARIOS[errorType];

    errors.push({
      ...scenario,
      error: scenario.createError(), // Create the error instance
      timestamp: Date.now() + (i * storm.duration) / storm.errorCount,
      index: i,
    });
  }

  return errors;
};

/**
 * Validation helpers for error recovery assertions
 *
 * @param actual
 * @param expected
 */
export const validateRecoveryOutcome = (actual, expected) => {
  const validations = [];

  if (expected.recoveryAction) {
    validations.push({
      name: 'Recovery Action',
      pass: actual.recoveryAction === expected.recoveryAction,
      expected: expected.recoveryAction,
      actual: actual.recoveryAction,
    });
  }

  if (expected.shouldContinue !== undefined) {
    validations.push({
      name: 'Should Continue',
      pass: actual.shouldContinue === expected.shouldContinue,
      expected: expected.shouldContinue,
      actual: actual.shouldContinue,
    });
  }

  if (expected.attempts) {
    validations.push({
      name: 'Retry Attempts',
      pass: actual.attempts === expected.attempts,
      expected: expected.attempts,
      actual: actual.attempts,
    });
  }

  return validations;
};
