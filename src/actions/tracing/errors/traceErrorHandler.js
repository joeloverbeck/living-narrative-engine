/**
 * @file Base error handler for action tracing system
 * @see ../recovery/recoveryManager.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';

/**
 * Error classification types for tracing system
 */
export const TraceErrorType = {
  CONFIGURATION: 'configuration',
  FILE_SYSTEM: 'file_system',
  VALIDATION: 'validation',
  SERIALIZATION: 'serialization',
  NETWORK: 'network',
  MEMORY: 'memory',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown',
};

/**
 * Error severity levels
 */
export const TraceErrorSeverity = {
  LOW: 'low', // Non-critical, log and continue
  MEDIUM: 'medium', // May impact functionality, attempt recovery
  HIGH: 'high', // Significant impact, disable component
  CRITICAL: 'critical', // System-wide impact, emergency shutdown
};

/**
 * Base error handler for action tracing components
 */
export class TraceErrorHandler {
  #logger;
  #errorMetrics;
  #recoveryManager;
  #errorHistory;
  #config;

  constructor({ logger, errorMetrics, recoveryManager, config }) {
    ensureValidLogger(logger);
    validateDependency(errorMetrics, 'IErrorMetrics', logger, {
      requiredMethods: ['recordError', 'getMetrics', 'getErrorRate'],
    });
    validateDependency(recoveryManager, 'IRecoveryManager', logger, {
      requiredMethods: [
        'attemptRecovery',
        'registerFallbackMode',
        'isCircuitOpen',
      ],
    });

    this.#logger = logger;
    this.#errorMetrics = errorMetrics;
    this.#recoveryManager = recoveryManager;
    this.#config = config || {};
    this.#errorHistory = new Map();
  }

  /**
   * Handle an error with appropriate classification and recovery
   *
   * @param {Error} error - The error that occurred
   * @param {object} context - Context information about where the error occurred
   * @param {TraceErrorType} errorType - Classification of the error type
   * @returns {Promise<object>} Recovery result and recommendations
   */
  async handleError(error, context, errorType = TraceErrorType.UNKNOWN) {
    const errorId = this.#generateErrorId();
    const severity = this.#classifyErrorSeverity(error, context, errorType);

    const errorInfo = {
      id: errorId,
      timestamp: new Date().toISOString(),
      error: this.#sanitizeError(error),
      context: this.#sanitizeContext(context),
      type: errorType,
      severity,
      stack: this.#extractSafeStackTrace(error),
    };

    // Record error in history for pattern analysis
    this.#recordError(errorInfo);

    // Log error with appropriate level
    this.#logError(errorInfo);

    // Update error metrics
    this.#errorMetrics.recordError(errorType, severity);

    // Attempt recovery based on error type and severity
    const recoveryResult = await this.#attemptRecovery(errorInfo);

    return {
      errorId,
      handled: true,
      severity,
      recoveryAction: recoveryResult.action,
      shouldContinue: recoveryResult.shouldContinue,
      fallbackMode: recoveryResult.fallbackMode,
    };
  }

  /**
   * Check if component should be disabled due to error patterns
   *
   * @param {string} componentName - Name of the component to check
   * @returns {boolean} True if component should be disabled
   */
  shouldDisableComponent(componentName) {
    const history = this.#errorHistory.get(componentName) || [];
    const recentErrors = history.filter(
      (error) => Date.now() - new Date(error.timestamp).getTime() < 300000 // 5 minutes
    );

    // Disable if more than 5 errors in 5 minutes
    if (recentErrors.length > 5) {
      return true;
    }

    // Disable if any critical errors
    if (
      recentErrors.some(
        (error) => error.severity === TraceErrorSeverity.CRITICAL
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get error statistics for monitoring
   *
   * @returns {object} Error statistics by type and severity
   */
  getErrorStatistics() {
    const stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recentErrors: 0,
    };

    const fiveMinutesAgo = Date.now() - 300000;

    for (const [component, errors] of this.#errorHistory) {
      stats.totalErrors += errors.length;
      stats.recentErrors += errors.filter(
        (error) => new Date(error.timestamp).getTime() > fiveMinutesAgo
      ).length;

      for (const error of errors) {
        stats.errorsByType[error.type] =
          (stats.errorsByType[error.type] || 0) + 1;
        stats.errorsBySeverity[error.severity] =
          (stats.errorsBySeverity[error.severity] || 0) + 1;
      }
    }

    return stats;
  }

  #classifyErrorSeverity(error, context, errorType) {
    // Configuration errors are typically medium severity
    if (errorType === TraceErrorType.CONFIGURATION) {
      return TraceErrorSeverity.MEDIUM;
    }

    // File system errors can vary based on context
    if (errorType === TraceErrorType.FILE_SYSTEM) {
      if (error?.code === 'ENOSPC' || error?.code === 'EACCES') {
        return TraceErrorSeverity.HIGH;
      }
      return TraceErrorSeverity.MEDIUM;
    }

    // Memory errors are critical
    if (errorType === TraceErrorType.MEMORY) {
      return TraceErrorSeverity.CRITICAL;
    }

    // Validation errors are typically low severity
    if (errorType === TraceErrorType.VALIDATION) {
      return TraceErrorSeverity.LOW;
    }

    // Network and timeout errors are medium severity
    if (
      errorType === TraceErrorType.NETWORK ||
      errorType === TraceErrorType.TIMEOUT
    ) {
      return TraceErrorSeverity.MEDIUM;
    }

    // Default to medium severity for unknown errors
    return TraceErrorSeverity.MEDIUM;
  }

  #sanitizeError(error) {
    // Handle null/undefined errors
    if (!error) {
      return {
        name: 'UnknownError',
        message: 'No error information provided',
        code: undefined,
      };
    }

    return {
      name: error?.name || 'UnknownError',
      message: error?.message || 'No error message',
      code: error?.code,
      // Don't include full stack trace in logs to prevent information leakage
    };
  }

  #sanitizeContext(context) {
    const sanitized = { ...context };

    // Remove potentially sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.key;
    delete sanitized.apiKey;
    delete sanitized.secret;

    // Truncate large fields
    Object.keys(sanitized).forEach((key) => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
        sanitized[key] = sanitized[key].substring(0, 1000) + '...[truncated]';
      }
    });

    return sanitized;
  }

  #extractSafeStackTrace(error) {
    if (!error || !error.stack) return null;

    // Return only first few lines of stack trace to prevent log pollution
    return error.stack.split('\n').slice(0, 5).join('\n');
  }

  #recordError(errorInfo) {
    const componentName = errorInfo.context?.componentName || 'unknown';

    if (!this.#errorHistory.has(componentName)) {
      this.#errorHistory.set(componentName, []);
    }

    const errors = this.#errorHistory.get(componentName);
    errors.push(errorInfo);

    // Keep only last 50 errors per component (reduced from 100 to prevent memory issues)
    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }

    // Also enforce a global limit on total components to prevent memory leaks
    if (this.#errorHistory.size > 100) {
      // Remove the oldest component's errors
      const oldestComponent = this.#errorHistory.keys().next().value;
      this.#errorHistory.delete(oldestComponent);
    }
  }

  #logError(errorInfo) {
    const logMessage = `Tracing error [${errorInfo.id}]: ${errorInfo.error.message}`;
    const logContext = {
      errorId: errorInfo.id,
      type: errorInfo.type,
      severity: errorInfo.severity,
      component: errorInfo.context?.componentName,
      ...errorInfo.context, // Include all sanitized context fields
    };

    if (errorInfo.severity === TraceErrorSeverity.LOW) {
      this.#logger.warn(logMessage, logContext);
      return;
    }

    this.#logger.error(logMessage, logContext);
  }

  async #attemptRecovery(errorInfo) {
    return await this.#recoveryManager.attemptRecovery(errorInfo);
  }

  #generateErrorId() {
    return `trace-error-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
}
