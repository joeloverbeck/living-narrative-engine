/**
 * @file Error categories for ScopeDSL system automatic classification
 * @description Defines error categories used by ScopeDslErrorHandler to automatically
 * classify errors based on message patterns and context analysis.
 *
 * These categories provide a standardized way to group errors by their nature
 * and facilitate appropriate error handling strategies across the ScopeDSL system.
 */

/**
 * Error categories for automatic classification in ScopeDSL system
 *
 * These categories are used by ScopeDslErrorHandler to automatically
 * classify errors based on message patterns and context.
 *
 * @readonly
 * @enum {string}
 */
export const ErrorCategories = Object.freeze({
  /** Context is missing or undefined - occurs when required context data is not available */
  MISSING_CONTEXT: 'missing_context',

  /** Data format is invalid or malformed - occurs when input data doesn't match expected format */
  INVALID_DATA: 'invalid_data',

  /** Resolution operation failed - occurs when scope resolution cannot complete successfully */
  RESOLUTION_FAILURE: 'resolution_failure',

  /** Circular dependency detected - occurs when scope references create a cycle */
  CYCLE_DETECTED: 'cycle_detected',

  /** Maximum resolution depth exceeded - occurs when nested resolution goes too deep */
  DEPTH_EXCEEDED: 'depth_exceeded',

  /** Parse or syntax error - occurs when scope expression syntax is invalid */
  PARSE_ERROR: 'parse_error',

  /** Configuration or settings error - occurs when system configuration is invalid */
  CONFIGURATION: 'configuration',

  /** Unclassified or unknown error - fallback category for errors that don't match other patterns */
  UNKNOWN: 'unknown',
});
