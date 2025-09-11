// src/utils/safeDispatchErrorUtils.js

/**
 * @file Utility to safely dispatch a standardized error event using an
 * ISafeEventDispatcher.
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../actions/errors/actionErrorTypes.js').ActionErrorContext} ActionErrorContext */

import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * Maps arbitrary details object to schema-compliant fields.
 * Only includes properties that are allowed by the core:system_error_occurred schema.
 * This function ensures that any extra properties are serialized into the 'raw' field
 * to maintain schema compliance while preserving all debug information.
 * 
 * @param {object} details - Arbitrary details object
 * @returns {object} Schema-compliant details object
 */
function mapDetailsToSchema(details) {
  const allowedProperties = ['statusCode', 'url', 'raw', 'stack', 'timestamp', 'scopeName'];
  const mappedDetails = {};
  
  // Copy allowed properties directly
  for (const prop of allowedProperties) {
    if (details[prop] !== undefined) {
      mappedDetails[prop] = details[prop];
    }
  }
  
  // If there are any non-allowed properties, serialize them to the 'raw' field
  const extraProperties = {};
  let hasExtraProperties = false;
  
  for (const prop of Object.keys(details)) {
    if (!allowedProperties.includes(prop)) {
      extraProperties[prop] = details[prop];
      hasExtraProperties = true;
    }
  }
  
  if (hasExtraProperties) {
    // If raw field already exists, merge with extra properties
    const existingRaw = mappedDetails.raw;
    const combinedRaw = {
      ...(existingRaw ? { existing: existingRaw } : {}),
      extra: extraProperties
    };
    mappedDetails.raw = JSON.stringify(combinedRaw, null, 2);
  }
  
  return mappedDetails;
}

/**
 * Error thrown when `safeDispatchError` receives an invalid dispatcher.
 */
export class InvalidDispatcherError extends Error {
  /**
   * Creates a new InvalidDispatcherError instance.
   * 
   * @param {string} message - The error message.
   * @param {object} [details] - Optional diagnostic details.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'InvalidDispatcherError';
    this.details = details;
  }
}

/**
 * Sends a `core:system_error_occurred` event with a consistent payload structure.
 * The dispatcher is validated before dispatching.
 *
 * Can accept either traditional message/details or an ActionErrorContext object.
 *
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string|ActionErrorContext} messageOrContext - Human readable error message or ActionErrorContext.
 * @param {object} [details] - Additional structured details for debugging (ignored if first param is ActionErrorContext).
 * @param {ILogger} [logger] - Optional logger for error logging. When omitted, a
 * console-based fallback is used.
 * @throws {InvalidDispatcherError} If the dispatcher is missing or invalid.
 * @returns {void}
 * @example
 * safeDispatchError(safeEventDispatcher, 'Invalid action', { id: 'bad-action' });
 * // or
 * safeDispatchError(safeEventDispatcher, actionErrorContext);
 */
export function safeDispatchError(
  dispatcher,
  messageOrContext,
  details = {},
  logger
) {
  const log = ensureValidLogger(logger, 'safeDispatchError');
  const hasDispatch = dispatcher && typeof dispatcher.dispatch === 'function';
  if (!hasDispatch) {
    const errorMsg =
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'.";
    log.error(errorMsg);
    throw new InvalidDispatcherError(errorMsg, {
      functionName: 'safeDispatchError',
    });
  }

  let message;
  let eventDetails;

  // Check if we received an ActionErrorContext
  if (
    typeof messageOrContext === 'object' &&
    messageOrContext.actionId &&
    messageOrContext.error
  ) {
    // It's an ActionErrorContext - map to schema-compliant fields
    const errorContext = messageOrContext;
    message =
      errorContext.error.message || 'An error occurred in the action system';
    
    // Create schema-compliant details by mapping ActionErrorContext to allowed fields
    eventDetails = {
      // Serialize all ActionErrorContext data to the 'raw' field (allowed by schema)
      raw: JSON.stringify({
        actionId: errorContext.actionId,
        targetId: errorContext.targetId,
        phase: errorContext.phase,
        actionDefinition: errorContext.actionDefinition,
        actorSnapshot: errorContext.actorSnapshot,
        evaluationTrace: errorContext.evaluationTrace,
        suggestedFixes: errorContext.suggestedFixes,
        environmentContext: errorContext.environmentContext
      }, null, 2),
      // Map error stack if available
      stack: errorContext.error.stack || undefined,
      // Map timestamp if available (must be ISO 8601 format)
      timestamp: errorContext.timestamp 
        ? new Date(errorContext.timestamp).toISOString()
        : undefined
    };
    
    // Remove undefined properties to keep payload clean
    Object.keys(eventDetails).forEach(key => {
      if (eventDetails[key] === undefined) {
        delete eventDetails[key];
      }
    });
  } else {
    // Traditional string message - validate that details conform to schema
    message = messageOrContext;
    eventDetails = mapDetailsToSchema(details || {});
  }

  dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
    message,
    details: eventDetails,
  });
}

/**
 * Dispatches a validation error and returns a standardized result object.
 * This function creates a consistent error response format while ensuring
 * the event payload conforms to the schema requirements.
 * 
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string} message - Human readable error message.
 * @param {object} [details] - Additional structured details for debugging.
 * @param {ILogger} [logger] - Optional logger for error logging. When omitted, a
 * console-based fallback is used.
 * @returns {{ ok: false, error: string, details?: object }} Result object for validation failures.
 */
export function dispatchValidationError(dispatcher, message, details, logger) {
  safeDispatchError(dispatcher, message, details, logger);
  return details !== undefined
    ? { ok: false, error: message, details }
    : { ok: false, error: message };
}

// --- FILE END ---
