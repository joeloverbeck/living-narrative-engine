/**
 * @file Shared type definitions for the tracing system
 * @see span.js
 * @see structuredTrace.js
 */

/**
 * @typedef {'active' | 'success' | 'failure' | 'error'} SpanStatus
 * The status of a span's execution
 */

/**
 * @typedef {object} SpanAttributes
 * Custom attributes that can be attached to a span for additional context
 * @property {string} [stage] - The pipeline stage name
 * @property {string} [actionId] - The ID of an action being processed
 * @property {string} [actor] - The actor entity ID
 * @property {number} [actionCount] - Number of actions being processed
 * @property {string} [scope] - The scope being evaluated
 * @property {number} [candidateCount] - Number of candidate actions
 * @property {*} [*] - Any other custom attributes
 */

/**
 * @typedef {object} HierarchicalSpan
 * A span with its children in a hierarchical structure
 * @property {string} operation - The operation name
 * @property {number} duration - The duration in milliseconds
 * @property {SpanStatus} status - The final status of the span
 * @property {SpanAttributes} attributes - Custom attributes
 * @property {HierarchicalSpan[]} children - Child spans
 * @property {string} [error] - Error message if status is 'error'
 */

/**
 * @typedef {object} PerformanceOperation
 * Performance data for a single operation
 * @property {string} operation - The operation name
 * @property {number} duration - The duration in milliseconds
 * @property {number} [count] - Number of times this operation was executed
 */

/**
 * @typedef {object} PerformanceSummary
 * Summary of performance metrics from a trace
 * @property {number} totalDuration - Total duration of the root span
 * @property {number} operationCount - Total number of operations
 * @property {string[]} criticalPath - Operations on the critical (longest) path
 * @property {PerformanceOperation[]} slowestOperations - Operations sorted by duration
 * @property {number} errorCount - Number of failed operations
 * @property {Object.<string, number>} operationStats - Duration by operation type
 */

/**
 * @typedef {object} SpanOptions
 * Options for creating a new span
 * @property {SpanAttributes} [attributes] - Initial attributes for the span
 * @property {boolean} [autoEnd] - Whether to automatically end the span on error
 */

export default {};
