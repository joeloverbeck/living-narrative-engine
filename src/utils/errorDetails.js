// src/utils/errorDetails.js

/**
 * @file Utility for creating standardized error details objects.
 */

/**
 * Creates standardized error detail information for system error dispatching.
 *
 * @description Generates an object containing the raw error message,
 * a timestamp, and a stack trace. A custom stack trace can be supplied
 * for cases where the standard `Error().stack` is insufficient.
 * @param {string} message - The raw internal error message.
 * @param {string} [stackOverride] - Optional stack trace to attach.
 * @returns {{raw: string, timestamp: string, stack: string}} Structured error details.
 */
export function createErrorDetails(message, stackOverride = new Error().stack) {
  return {
    raw: message,
    timestamp: new Date().toISOString(),
    stack: stackOverride,
  };
}

// --- FILE END ---
