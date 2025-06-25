/**
 * @file This module holds the logs for a trace of the action discovery process.
 * @see src/actions/tracing/traceContext.js
 */

/**
 * @typedef {'info' | 'success' | 'failure' | 'step' | 'error' | 'data'} LogEntryType
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

  /** @type {any | null} */
  result = null;

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
}
