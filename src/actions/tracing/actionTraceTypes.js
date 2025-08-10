/**
 * @file Type definitions and constants for action tracing
 */

/**
 * @typedef {object} ExecutionPhase
 * @property {string} phase - Phase name
 * @property {number} timestamp - Phase timestamp
 * @property {string} description - Phase description
 * @property {*} [metadata] - Additional phase metadata
 */

/**
 * @typedef {object} DispatchResult
 * @property {boolean} success - Whether dispatch succeeded
 * @property {number} timestamp - Result timestamp
 * @property {object} [metadata] - Additional metadata
 */

/**
 * @typedef {object} ErrorInfo
 * @property {string} message - Error message
 * @property {string} type - Error type/class name
 * @property {string} stack - Stack trace
 * @property {number} timestamp - Error timestamp
 * @property {string} [code] - Error code if available
 * @property {*} [cause] - Error cause if available
 */

/**
 * Execution phase constants
 */
export const EXECUTION_PHASES = {
  DISPATCH_START: 'dispatch_start',
  PAYLOAD_CAPTURED: 'payload_captured',
  DISPATCH_COMPLETED: 'dispatch_completed',
  ERROR_CAPTURED: 'error_captured',
};

/**
 * Execution status constants
 */
export const EXECUTION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SUCCESS: 'success',
  FAILED: 'failed',
  ERROR: 'error',
};

/**
 * Trace format version
 */
export const TRACE_FORMAT_VERSION = '1.0';

/**
 * Maximum payload size for capture (bytes)
 */
export const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

/**
 * Fields to redact from payloads
 */
export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'credential',
  'auth',
  'authorization',
];