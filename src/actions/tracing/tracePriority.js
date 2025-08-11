/**
 * @file Priority levels and utilities for trace queue processing
 * @see traceQueueProcessor.js
 */

/**
 * Priority levels for trace processing
 * Higher numeric values indicate higher priority
 */
export const TracePriority = {
  /** Critical system errors, crashes - highest priority */
  CRITICAL: 3,
  /** User-facing errors, important failures */
  HIGH: 2,
  /** Regular traces, normal operation */
  NORMAL: 1,
  /** Debug information, verbose logs - lowest priority */
  LOW: 0,
};

/**
 * Priority level names for display and logging
 */
export const PRIORITY_NAMES = {
  [TracePriority.CRITICAL]: 'CRITICAL',
  [TracePriority.HIGH]: 'HIGH', 
  [TracePriority.NORMAL]: 'NORMAL',
  [TracePriority.LOW]: 'LOW',
};

/**
 * Default priority for traces when not specified
 */
export const DEFAULT_PRIORITY = TracePriority.NORMAL;

/**
 * Validate priority level
 *
 * @param {number} priority - Priority to validate
 * @returns {boolean} True if valid priority level
 */
export function isValidPriority(priority) {
  return Object.values(TracePriority).includes(priority);
}

/**
 * Normalize priority to valid level
 *
 * @param {number} priority - Priority to normalize
 * @returns {number} Valid priority level
 */
export function normalizePriority(priority) {
  if (isValidPriority(priority)) {
    return priority;
  }
  
  // Clamp to valid range
  if (priority > TracePriority.CRITICAL) {
    return TracePriority.CRITICAL;
  }
  if (priority < TracePriority.LOW) {
    return TracePriority.LOW;
  }
  
  // Round to nearest valid priority
  return Math.round(priority);
}

/**
 * Get priority name for display
 *
 * @param {number} priority - Priority level
 * @returns {string} Priority name
 */
export function getPriorityName(priority) {
  const normalized = normalizePriority(priority);
  return PRIORITY_NAMES[normalized] || 'UNKNOWN';
}

/**
 * Determine priority from trace characteristics
 *
 * @param {object} trace - Trace object to analyze
 * @returns {number} Suggested priority level
 */
export function inferPriority(trace) {
  if (!trace) {
    return TracePriority.LOW;
  }
  
  // Critical priority for errors
  if (trace.hasError || (trace.execution && trace.execution.error)) {
    return TracePriority.CRITICAL;
  }
  
  // High priority for system or user-facing actions
  const actionId = trace.actionId || '';
  if (actionId.includes('system:') || actionId.includes('user:')) {
    return TracePriority.HIGH;
  }
  
  // Low priority for debug traces
  if (actionId.includes('debug:') || actionId.includes('trace:')) {
    return TracePriority.LOW;
  }
  
  // Default to normal priority
  return TracePriority.NORMAL;
}

/**
 * Compare priorities for sorting (higher priority first)
 *
 * @param {number} priorityA - First priority
 * @param {number} priorityB - Second priority
 * @returns {number} Comparison result (-1, 0, 1)
 */
export function comparePriorities(priorityA, priorityB) {
  const normalizedA = normalizePriority(priorityA);
  const normalizedB = normalizePriority(priorityB);
  
  // Higher priority comes first (descending order)
  return normalizedB - normalizedA;
}

/**
 * Get all priority levels in processing order (highest to lowest)
 *
 * @returns {number[]} Priority levels in processing order
 */
export function getPriorityLevels() {
  return [
    TracePriority.CRITICAL,
    TracePriority.HIGH,
    TracePriority.NORMAL,
    TracePriority.LOW,
  ];
}