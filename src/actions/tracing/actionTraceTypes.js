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

/**
 * Queue processing constants
 */
export const QUEUE_CONSTANTS = {
  /** Default maximum queue size */
  DEFAULT_MAX_QUEUE_SIZE: 1000,
  /** Default batch size for processing */
  DEFAULT_BATCH_SIZE: 10,
  /** Maximum batch size allowed */
  MAX_BATCH_SIZE: 50,
  /** Default batch timeout in milliseconds */
  DEFAULT_BATCH_TIMEOUT: 1000,
  /** Maximum retry attempts for failed items */
  DEFAULT_MAX_RETRIES: 3,
  /** Base delay for exponential backoff (ms) */
  RETRY_BASE_DELAY: 100,
  /** Maximum retry delay (ms) */
  RETRY_MAX_DELAY: 5000,
  /** Circuit breaker threshold */
  CIRCUIT_BREAKER_THRESHOLD: 10,
  /** Memory threshold percentage (80%) */
  MEMORY_THRESHOLD: 0.8,
  /** Default memory limit (5MB) */
  DEFAULT_MEMORY_LIMIT: 5 * 1024 * 1024,
};

/**
 * Performance targets for queue processing
 */
export const PERFORMANCE_TARGETS = {
  /** Target throughput (traces per second) */
  THROUGHPUT: 500,
  /** Target latency for critical priority (ms) */
  CRITICAL_LATENCY: 50,
  /** Target batch efficiency percentage */
  BATCH_EFFICIENCY: 0.7,
  /** Maximum acceptable drop rate */
  MAX_DROP_RATE: 0.01,
};

/**
 * Event types for queue processing notifications
 */
export const QUEUE_EVENTS = {
  BACKPRESSURE: 'TRACE_QUEUE_BACKPRESSURE',
  CIRCUIT_BREAKER: 'TRACE_QUEUE_CIRCUIT_BREAKER',
  MEMORY_LIMIT: 'TRACE_QUEUE_MEMORY_LIMIT',
  BATCH_PROCESSED: 'TRACE_QUEUE_BATCH_PROCESSED',
  ITEM_DROPPED: 'TRACE_QUEUE_ITEM_DROPPED',
};
