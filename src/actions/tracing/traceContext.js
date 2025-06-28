/**
 * @file This module holds the logs for a trace of the action discovery process.
 * @see src/actions/tracing/traceContext.js
 */

export const TRACE_INFO = 'info';
export const TRACE_SUCCESS = 'success';
export const TRACE_FAILURE = 'failure';
export const TRACE_STEP = 'step';
export const TRACE_ERROR = 'error';
export const TRACE_DATA = 'data';

/**
 * @typedef {(
 *   typeof TRACE_INFO |
 *   typeof TRACE_SUCCESS |
 *   typeof TRACE_FAILURE |
 *   typeof TRACE_STEP |
 *   typeof TRACE_ERROR |
 *   typeof TRACE_DATA
 * )} LogEntryType
 * 'step' - A major stage in the process.
 * 'data' - Logs a significant data structure (e.g., context, AST).
 */

/**
 * @typedef {object} TraceLogEntry
 * @property {LogEntryType} type - The classification of the log entry.
 * @property {string} message - The human-readable log message.
 * @property {object} [data] - Optional structured data payload for inspection.
 * @property {string} source - The name of the service/function that generated the log.
 * @property {number} timestamp - The time the entry was created via Date.now().
 */

/**
 * @class TraceContext
 * @description A container passed through services to collect diagnostic information.
 */
export class TraceContext {
  /** @type {TraceLogEntry[]} */
  logs = [];

  /**
   * Adds a log entry to the trace.
   *
   * @param {LogEntryType} type The type of log entry.
   * @param {string} message The message contained in the log.
   * @param {string} source The source of the log entry.
   * @param {object} [data] Raw data associated with the log entry.
   */
  addLog(type, message, source, data = null) {
    const logEntry = {
      type,
      message,
      source,
      timestamp: Date.now(),
    };

    // Only add data field if it's not null/undefined
    if (data !== null && data !== undefined) {
      logEntry.data = data;
    }

    this.logs.push(logEntry);
  }

  /**
   * Convenience wrapper for logging an informational message.
   *
   * @param {string} msg The log message.
   * @param {string} src The source of the log entry.
   * @param {object} [data] Optional payload.
   */
  info(msg, src, data) {
    data === undefined
      ? this.addLog(TRACE_INFO, msg, src)
      : this.addLog(TRACE_INFO, msg, src, data);
  }

  /**
   * Convenience wrapper for logging a success event.
   *
   * @param {string} msg The log message.
   * @param {string} src The source of the log entry.
   * @param {object} [data] Optional payload.
   */
  success(msg, src, data) {
    data === undefined
      ? this.addLog(TRACE_SUCCESS, msg, src)
      : this.addLog(TRACE_SUCCESS, msg, src, data);
  }

  /**
   * Convenience wrapper for logging a failure event.
   *
   * @param {string} msg The log message.
   * @param {string} src The source of the log entry.
   * @param {object} [data] Optional payload.
   */
  failure(msg, src, data) {
    data === undefined
      ? this.addLog(TRACE_FAILURE, msg, src)
      : this.addLog(TRACE_FAILURE, msg, src, data);
  }

  /**
   * Convenience wrapper for logging a high-level step in a process.
   *
   * @param {string} msg The log message.
   * @param {string} src The source of the log entry.
   * @param {object} [data] Optional payload.
   */
  step(msg, src, data) {
    data === undefined
      ? this.addLog(TRACE_STEP, msg, src)
      : this.addLog(TRACE_STEP, msg, src, data);
  }

  /**
   * Convenience wrapper for logging an error event.
   *
   * @param {string} msg The log message.
   * @param {string} src The source of the log entry.
   * @param {object} [data] Optional payload.
   */
  error(msg, src, data) {
    data === undefined
      ? this.addLog(TRACE_ERROR, msg, src)
      : this.addLog(TRACE_ERROR, msg, src, data);
  }

  /**
   * Convenience wrapper for logging a data payload.
   *
   * @param {string} msg The log message.
   * @param {string} src The source of the log entry.
   * @param {object} [data] Optional payload.
   */
  data(msg, src, data) {
    data === undefined
      ? this.addLog(TRACE_DATA, msg, src)
      : this.addLog(TRACE_DATA, msg, src, data);
  }
}
