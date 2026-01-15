/**
 * @file ExpressionStatusService - Manages expression diagnostic status persistence
 * @description Communicates with llm-proxy-server to persist and retrieve diagnostic statuses
 * @see specs/problematic-expressions-panel.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  getStatusFillColor,
  STATUS_PRIORITY,
  NON_PROBLEMATIC_STATUSES,
} from '../statusTheme.js';

/**
 * @typedef {object} ExpressionStatusInfo
 * @property {string} id - Expression ID (e.g., 'emotions-attention:flow_absorption')
 * @property {string} filePath - Relative path to expression file from project root
 * @property {string|null} diagnosticStatus - Current status or null if not set
 * @property {number|null} triggerRate - Trigger rate as probability (0.0-1.0) or null if not set
 */

/**
 * @typedef {object} UpdateStatusResult
 * @property {boolean} success - Whether the update succeeded
 * @property {string} message - Human-readable result message
 * @property {string} [expressionId] - Expression ID on success
 * @property {string} [errorType] - Error classification on failure
 */

/**
 * @typedef {object} ScanStatusesResult
 * @property {boolean} success - Whether the scan succeeded
 * @property {ExpressionStatusInfo[]} [expressions] - Expression statuses on success
 * @property {string} [errorType] - Error classification on failure
 * @property {string} [message] - Human-readable error message on failure
 */

/**
 * @typedef {object} HealthCheckResult
 * @property {boolean} success - Whether the health check succeeded
 * @property {string} [errorType] - Error classification on failure
 * @property {string} [message] - Human-readable error message on failure
 */

const ERROR_TYPES = Object.freeze({
  CONNECTION_REFUSED: 'connection_refused',
  CORS_BLOCKED: 'cors_blocked',
  TIMEOUT: 'timeout',
  SERVER_ERROR: 'server_error',
  VALIDATION_ERROR: 'validation_error',
  UNKNOWN: 'unknown',
});

const HEALTH_CHECK_TIMEOUT_MS = 2000;
const HEALTH_CHECK_CACHE_TTL_MS = 60000;

/**
 * Statuses that have calculated trigger rates from Monte Carlo simulation.
 * These are statuses where we have a meaningful probability value.
 * @type {Readonly<Set<string>>}
 */
const STATUSES_WITH_TRIGGER_RATES = Object.freeze(
  new Set(['extremely_rare', 'rare', 'uncommon', 'normal', 'frequent'])
);

/**
 * Service for managing expression diagnostic status persistence.
 * Communicates with llm-proxy-server for file I/O operations.
 */
class ExpressionStatusService {
  /** @type {object} */
  #logger;

  /** @type {string} */
  #baseUrl;

  /** @type {{ timestamp: number, result: HealthCheckResult } | null} */
  #healthCheckCache;

  /**
   * @param {object} deps
   * @param {object} deps.logger - ILogger instance
   * @param {string} [deps.baseUrl] - LLM proxy server base URL
   */
  constructor({ logger, baseUrl = 'http://localhost:3001' }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    this.#baseUrl = baseUrl;
    this.#healthCheckCache = null;
    this.#logger.debug('ExpressionStatusService: Instance created', { baseUrl });
  }

  #getCorsBlockedMessage() {
    return 'Server rejected request due to CORS policy. Check PROXY_ALLOWED_ORIGIN.';
  }

  #getConnectionRefusedMessage() {
    return `Cannot connect to server at ${this.#baseUrl}. Ensure the LLM proxy server is running.`;
  }

  #getTimeoutMessage(timeoutMs) {
    return `Request timed out after ${timeoutMs}ms. Server may be overloaded.`;
  }

  #classifyResponseError(response, data) {
    if (response?.type === 'opaque') {
      return {
        errorType: ERROR_TYPES.CORS_BLOCKED,
        message: this.#getCorsBlockedMessage(),
      };
    }

    const status = response?.status ?? 0;
    if (status >= 500) {
      return {
        errorType: ERROR_TYPES.SERVER_ERROR,
        message: `Server error: ${status}. Check server logs.`,
      };
    }

    if (status >= 400) {
      return {
        errorType: ERROR_TYPES.VALIDATION_ERROR,
        message: data?.message
          ? `Request validation failed: ${data.message}`
          : `Request validation failed with status ${status}.`,
      };
    }

    if (data?.error) {
      return {
        errorType: ERROR_TYPES.VALIDATION_ERROR,
        message: data?.message || 'Request validation failed.',
      };
    }

    return {
      errorType: ERROR_TYPES.UNKNOWN,
      message: data?.message || 'Unknown error',
    };
  }

  #classifyThrownError(error, timeoutMs) {
    if (error?.name === 'AbortError') {
      return {
        errorType: ERROR_TYPES.TIMEOUT,
        message: this.#getTimeoutMessage(timeoutMs),
      };
    }

    const message = typeof error?.message === 'string' ? error.message : '';
    if (message.toLowerCase().includes('cors')) {
      return {
        errorType: ERROR_TYPES.CORS_BLOCKED,
        message: this.#getCorsBlockedMessage(),
      };
    }

    if (error instanceof TypeError) {
      return {
        errorType: ERROR_TYPES.CONNECTION_REFUSED,
        message: this.#getConnectionRefusedMessage(),
      };
    }

    return {
      errorType: ERROR_TYPES.UNKNOWN,
      message: message ? `Unexpected error: ${message}` : 'Unexpected error',
    };
  }

  #getCachedHealthCheck() {
    if (!this.#healthCheckCache) {
      return null;
    }

    const ageMs = Date.now() - this.#healthCheckCache.timestamp;
    if (ageMs > HEALTH_CHECK_CACHE_TTL_MS) {
      this.#healthCheckCache = null;
      return null;
    }

    return this.#healthCheckCache.result;
  }

  #setHealthCheckCache(result) {
    this.#healthCheckCache = {
      timestamp: Date.now(),
      result,
    };
  }

  /**
   * Perform a cached health check against the proxy server.
   *
   * @returns {Promise<HealthCheckResult>}
   */
  async checkServerHealth() {
    const cached = this.#getCachedHealthCheck();
    if (cached) {
      return cached;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS
    );

    try {
      const response = await fetch(`${this.#baseUrl}/health/live`, {
        method: 'HEAD',
        signal: controller.signal,
      });

      if (response.type === 'opaque') {
        const result = {
          success: false,
          errorType: ERROR_TYPES.CORS_BLOCKED,
          message: this.#getCorsBlockedMessage(),
        };
        this.#setHealthCheckCache(result);
        return result;
      }

      if (!response.ok) {
        const { errorType, message } = this.#classifyResponseError(
          response,
          null
        );
        const result = {
          success: false,
          errorType,
          message,
        };
        this.#setHealthCheckCache(result);
        return result;
      }

      const result = { success: true };
      this.#setHealthCheckCache(result);
      return result;
    } catch (error) {
      const { errorType, message } = this.#classifyThrownError(
        error,
        HEALTH_CHECK_TIMEOUT_MS
      );
      const result = {
        success: false,
        errorType,
        message,
      };
      this.#setHealthCheckCache(result);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Update the diagnostic status for an expression file
   *
   * @param {string} filePath - Relative path to expression file
   * @param {string} status - New diagnostic status value
   * @param {number|null} [triggerRate=null] - Optional trigger rate (0.0-1.0)
   * @returns {Promise<UpdateStatusResult>}
   */
  async updateStatus(filePath, status, triggerRate = null) {
    const healthCheck = await this.checkServerHealth();
    if (!healthCheck.success) {
      this.#logger.warn('ExpressionStatusService: Health check failed', {
        errorType: healthCheck.errorType,
        message: healthCheck.message,
      });
      return {
        success: false,
        errorType: healthCheck.errorType,
        message: healthCheck.message,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.#baseUrl}/api/expressions/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath,
          status,
          ...(typeof triggerRate === 'number' && { triggerRate }),
        }),
        signal: controller.signal,
      });

      if (response.type === 'opaque') {
        const message = this.#getCorsBlockedMessage();
        this.#logger.error('ExpressionStatusService: Update blocked by CORS');
        return {
          success: false,
          errorType: ERROR_TYPES.CORS_BLOCKED,
          message,
        };
      }

      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (!response.ok || data?.error) {
        const { errorType, message } = this.#classifyResponseError(response, data);
        this.#logger.warn('ExpressionStatusService: Update failed', {
          filePath,
          status,
          errorType,
          message,
        });
        return {
          success: false,
          errorType,
          message,
        };
      }

      this.#logger.info('ExpressionStatusService: Status updated', {
        filePath,
        expressionId: data.expressionId,
        status,
      });

      return {
        success: true,
        message: data.message,
        expressionId: data.expressionId,
      };
    } catch (error) {
      const { errorType, message } = this.#classifyThrownError(error, 10000);
      this.#logger.error('ExpressionStatusService: Update failed', {
        filePath,
        errorType,
        error: error.message,
      });
      return {
        success: false,
        errorType,
        message,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Scan all expression files and return their diagnostic statuses
   *
   * @returns {Promise<ScanStatusesResult>}
   */
  async scanAllStatuses() {
    const healthCheck = await this.checkServerHealth();
    if (!healthCheck.success) {
      this.#logger.warn('ExpressionStatusService: Health check failed', {
        errorType: healthCheck.errorType,
        message: healthCheck.message,
      });
      return {
        success: false,
        errorType: healthCheck.errorType,
        message: healthCheck.message,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.#baseUrl}/api/expressions/scan-statuses`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (response.type === 'opaque') {
        const message = this.#getCorsBlockedMessage();
        this.#logger.error('ExpressionStatusService: Scan blocked by CORS');
        return {
          success: false,
          errorType: ERROR_TYPES.CORS_BLOCKED,
          message,
        };
      }

      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (!response.ok || data?.error) {
        const { errorType, message } = this.#classifyResponseError(response, data);
        this.#logger.warn('ExpressionStatusService: Scan failed', {
          errorType,
          message,
        });
        return {
          success: false,
          errorType,
          message,
        };
      }

      this.#logger.info('ExpressionStatusService: Scan completed', {
        count: data.expressions?.length || 0,
      });

      return {
        success: true,
        expressions: data.expressions || [],
      };
    } catch (error) {
      const { errorType, message } = this.#classifyThrownError(error, 30000);
      this.#logger.error('ExpressionStatusService: Scan failed', {
        errorType,
        error: error.message,
      });
      return {
        success: false,
        errorType,
        message,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get problematic expressions sorted by priority
   * Filters out NORMAL and FREQUENT statuses
   *
   * @param {ExpressionStatusInfo[]} expressions - All expression status info
   * @param {number} [maxCount] - Maximum number to return
   * @returns {ExpressionStatusInfo[]}
   */
  getProblematicExpressions(expressions, maxCount = 10) {
    // Filter out non-problematic statuses
    const problematic = expressions.filter((expr) => {
      const status = expr.diagnosticStatus || 'unknown';
      return !NON_PROBLEMATIC_STATUSES.has(status);
    });

    // Sort by priority (impossible first, then unknown, etc.)
    problematic.sort((a, b) => {
      const statusA = a.diagnosticStatus || 'unknown';
      const statusB = b.diagnosticStatus || 'unknown';
      const priorityA = STATUS_PRIORITY[statusA] ?? 999;
      const priorityB = STATUS_PRIORITY[statusB] ?? 999;
      return priorityA - priorityB;
    });

    return problematic.slice(0, maxCount);
  }

  /**
   * Get the display color for a diagnostic status
   *
   * @param {string|null} status - Diagnostic status
   * @returns {string} - CSS color value
   */
  getStatusColor(status) {
    return getStatusFillColor(status);
  }

  /**
   * Get priority value for a status
   *
   * @param {string|null} status - Diagnostic status
   * @returns {number} - Priority (lower = higher priority)
   */
  getStatusPriority(status) {
    return STATUS_PRIORITY[status || 'unknown'] ?? 999;
  }

  /**
   * Check if a status is considered problematic
   *
   * @param {string|null} status - Diagnostic status
   * @returns {boolean}
   */
  isProblematicStatus(status) {
    return !NON_PROBLEMATIC_STATUSES.has(status || 'unknown');
  }

  /**
   * Get expressions with calculable trigger rates, sorted by trigger rate ascending.
   * Filters to statuses that have meaningful trigger rates (extremely_rare, rare, uncommon, normal, frequent).
   *
   * @param {ExpressionStatusInfo[]} expressions - All expression status info
   * @param {number} [maxCount=10] - Maximum number to return
   * @returns {ExpressionStatusInfo[]} Expressions sorted by trigger rate (lowest first)
   */
  getLowTriggerRateExpressions(expressions, maxCount = 10) {
    // Filter to expressions that have:
    // 1. A status that has calculable trigger rates
    // 2. A numeric trigger rate value
    const withTriggerRates = expressions.filter((expr) => {
      const status = expr.diagnosticStatus || 'unknown';
      return (
        STATUSES_WITH_TRIGGER_RATES.has(status) &&
        typeof expr.triggerRate === 'number' &&
        !Number.isNaN(expr.triggerRate)
      );
    });

    // Sort by trigger rate ascending (lowest first)
    withTriggerRates.sort((a, b) => a.triggerRate - b.triggerRate);

    return withTriggerRates.slice(0, maxCount);
  }

  /**
   * Format a trigger rate as a percentage string with appropriate precision.
   *
   * Uses tiered precision to ensure small percentages remain meaningful:
   * - Exact zero: "0%"
   * - Very small (< 0.01%): "<0.01%"
   * - Small (0.01% - 0.1%): 2 decimal places (e.g., "0.04%")
   * - Normal (>= 0.1%): 1 decimal place (e.g., "12.5%")
   *
   * @param {number|null|undefined} triggerRate - Trigger rate as probability (0.0-1.0)
   * @returns {string} Formatted percentage or "N/A" for invalid values
   */
  formatTriggerRatePercent(triggerRate) {
    if (
      triggerRate === null ||
      triggerRate === undefined ||
      typeof triggerRate !== 'number' ||
      Number.isNaN(triggerRate)
    ) {
      return 'N/A';
    }

    const percentage = triggerRate * 100;

    // Exact zero
    if (percentage === 0) return '0%';

    // Very small values (< 0.01%) - show indicator
    if (percentage < 0.01) return '<0.01%';

    // Small values (0.01% - 0.1%) - show 2 decimal places for precision
    if (percentage < 0.1) return `${percentage.toFixed(2)}%`;

    // Normal values (>= 0.1%) - show 1 decimal place
    return `${percentage.toFixed(1)}%`;
  }

  /**
   * Check if a status has a calculable trigger rate
   *
   * @param {string|null} status - Diagnostic status
   * @returns {boolean}
   */
  hasCalculableTriggerRate(status) {
    return STATUSES_WITH_TRIGGER_RATES.has(status || 'unknown');
  }
}

export default ExpressionStatusService;
