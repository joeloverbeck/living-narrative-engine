/**
 * @file ExpressionStatusService - Manages expression diagnostic status persistence
 * @description Communicates with llm-proxy-server to persist and retrieve diagnostic statuses
 * @see specs/problematic-expressions-panel.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} ExpressionStatusInfo
 * @property {string} id - Expression ID (e.g., 'emotions-attention:flow_absorption')
 * @property {string} filePath - Relative path to expression file from project root
 * @property {string|null} diagnosticStatus - Current status or null if not set
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
 * Priority levels for diagnostic statuses (lower = higher priority)
 * Used to sort problematic expressions for display
 * @type {Record<string, number>}
 */
const STATUS_PRIORITY = Object.freeze({
  impossible: 0,
  unknown: 1,
  extremely_rare: 2,
  rare: 3,
  normal: 4,
  frequent: 5,
});

/**
 * Statuses that should NOT be displayed in the problematic expressions panel
 * @type {Set<string>}
 */
const NON_PROBLEMATIC_STATUSES = new Set(['normal', 'frequent']);

/**
 * Status display colors for UI rendering
 * @type {Record<string, string>}
 */
const STATUS_COLORS = Object.freeze({
  unknown: '#6c757d', // gray
  impossible: '#dc3545', // red
  extremely_rare: '#fd7e14', // orange
  rare: '#ffc107', // yellow
  normal: '#28a745', // green
  frequent: '#17a2b8', // blue
});

const ERROR_TYPES = Object.freeze({
  CONNECTION_REFUSED: 'connection_refused',
  CORS_BLOCKED: 'cors_blocked',
  TIMEOUT: 'timeout',
  SERVER_ERROR: 'server_error',
  VALIDATION_ERROR: 'validation_error',
  UNKNOWN: 'unknown',
});

/**
 * Service for managing expression diagnostic status persistence.
 * Communicates with llm-proxy-server for file I/O operations.
 */
class ExpressionStatusService {
  /** @type {object} */
  #logger;

  /** @type {string} */
  #baseUrl;

  /**
   * @param {Object} deps
   * @param {object} deps.logger - ILogger instance
   * @param {string} [deps.baseUrl='http://localhost:3001'] - LLM proxy server base URL
   */
  constructor({ logger, baseUrl = 'http://localhost:3001' }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    this.#baseUrl = baseUrl;
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

  /**
   * Update the diagnostic status for an expression file
   * @param {string} filePath - Relative path to expression file
   * @param {string} status - New diagnostic status value
   * @returns {Promise<UpdateStatusResult>}
   */
  async updateStatus(filePath, status) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.#baseUrl}/api/expressions/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath, status }),
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
   * @returns {Promise<ScanStatusesResult>}
   */
  async scanAllStatuses() {
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
   * @param {ExpressionStatusInfo[]} expressions - All expression status info
   * @param {number} [maxCount=10] - Maximum number to return
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
   * @param {string|null} status - Diagnostic status
   * @returns {string} - CSS color value
   */
  getStatusColor(status) {
    return STATUS_COLORS[status] || STATUS_COLORS.unknown;
  }

  /**
   * Get priority value for a status
   * @param {string|null} status - Diagnostic status
   * @returns {number} - Priority (lower = higher priority)
   */
  getStatusPriority(status) {
    return STATUS_PRIORITY[status || 'unknown'] ?? 999;
  }

  /**
   * Check if a status is considered problematic
   * @param {string|null} status - Diagnostic status
   * @returns {boolean}
   */
  isProblematicStatus(status) {
    return !NON_PROBLEMATIC_STATUSES.has(status || 'unknown');
  }
}

export default ExpressionStatusService;
