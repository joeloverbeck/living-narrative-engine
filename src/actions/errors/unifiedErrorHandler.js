/**
 * @file unifiedErrorHandler.js
 * @description Unified error handling utility for consistent error context creation across the application.
 * Provides standardized error handling patterns for different phases and contexts.
 */

import { ERROR_PHASES } from './actionErrorTypes.js';

/** @typedef {import('./actionErrorTypes.js').ActionErrorContext} ActionErrorContext */
/** @typedef {import('./actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */

/**
 * @class UnifiedErrorHandler
 * @description Provides standardized error handling methods for different error contexts and phases.
 * This class helps maintain consistency in error handling across the application.
 */
export class UnifiedErrorHandler {
  #actionErrorContextBuilder;
  #logger;

  /**
   * Creates an instance of UnifiedErrorHandler.
   *
   * @param {object} dependencies
   * @param {ActionErrorContextBuilder} dependencies.actionErrorContextBuilder - Builder for creating error contexts
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ actionErrorContextBuilder, logger }) {
    if (!actionErrorContextBuilder) {
      throw new Error('UnifiedErrorHandler requires actionErrorContextBuilder');
    }
    if (!logger) {
      throw new Error('UnifiedErrorHandler requires logger');
    }

    this.#actionErrorContextBuilder = actionErrorContextBuilder;
    this.#logger = logger;
  }

  /**
   * Creates a standardized error context with all necessary information.
   *
   * @param {object} params
   * @param {Error} params.error - The error that occurred
   * @param {string} params.phase - The phase where the error occurred (from ERROR_PHASES)
   * @param {ActionDefinition} params.actionDef - The action definition (if available)
   * @param {string} params.actorId - The actor ID
   * @param {string} [params.targetId] - The target ID (if applicable)
   * @param {TraceContext} [params.trace] - Trace context for debugging
   * @param {object} [params.additionalContext] - Any additional context information
   * @returns {ActionErrorContext} The complete error context
   */
  createContext({
    error,
    phase,
    actionDef,
    actorId,
    targetId = null,
    trace = null,
    additionalContext = {},
  }) {
    // Log the error with context
    this.#logger.error(`Error in ${phase} phase`, {
      error: error.message,
      stack: error.stack,
      actionId: actionDef?.id,
      actorId,
      targetId,
      phase,
      ...additionalContext,
    });

    // Build and return the error context
    return this.#actionErrorContextBuilder.buildErrorContext({
      error,
      actionDef: actionDef || { id: 'unknown', name: 'Unknown Action' },
      actorId,
      phase,
      trace,
      targetId,
      additionalContext,
    });
  }

  /**
   * Handles errors that occur during action discovery phase.
   *
   * @param {Error} error - The error that occurred
   * @param {object} context - Discovery context
   * @param {string} context.actorId - The actor ID
   * @param {ActionDefinition} [context.actionDef] - The action definition (if available)
   * @param {TraceContext} [context.trace] - Trace context
   * @param {object} [context.additionalContext] - Additional context
   * @returns {ActionErrorContext} The error context
   */
  handleDiscoveryError(
    error,
    { actorId, actionDef = null, trace = null, additionalContext = {} }
  ) {
    return this.createContext({
      error,
      phase: ERROR_PHASES.DISCOVERY,
      actionDef,
      actorId,
      trace,
      additionalContext: {
        stage: 'discovery',
        ...additionalContext,
      },
    });
  }

  /**
   * Handles errors that occur during command execution phase.
   *
   * @param {Error} error - The error that occurred
   * @param {object} context - Execution context
   * @param {string} context.actorId - The actor ID
   * @param {ActionDefinition} context.actionDef - The action definition
   * @param {string} [context.targetId] - The target ID (if applicable)
   * @param {TraceContext} [context.trace] - Trace context
   * @param {object} [context.additionalContext] - Additional context
   * @returns {ActionErrorContext} The error context
   */
  handleExecutionError(
    error,
    {
      actorId,
      actionDef,
      targetId = null,
      trace = null,
      additionalContext = {},
    }
  ) {
    return this.createContext({
      error,
      phase: ERROR_PHASES.EXECUTION,
      actionDef,
      actorId,
      targetId,
      trace,
      additionalContext: {
        stage: 'execution',
        ...additionalContext,
      },
    });
  }

  /**
   * Handles errors that occur during validation phase.
   *
   * @param {Error} error - The error that occurred
   * @param {object} context - Validation context
   * @param {string} context.actorId - The actor ID
   * @param {ActionDefinition} context.actionDef - The action definition
   * @param {string} [context.targetId] - The target ID (if applicable)
   * @param {TraceContext} [context.trace] - Trace context
   * @param {object} [context.additionalContext] - Additional context
   * @returns {ActionErrorContext} The error context
   */
  handleValidationError(
    error,
    {
      actorId,
      actionDef,
      targetId = null,
      trace = null,
      additionalContext = {},
    }
  ) {
    return this.createContext({
      error,
      phase: ERROR_PHASES.VALIDATION,
      actionDef,
      actorId,
      targetId,
      trace,
      additionalContext: {
        stage: 'validation',
        ...additionalContext,
      },
    });
  }

  /**
   * Handles errors that occur during command processing workflow.
   *
   * @param {Error} error - The error that occurred
   * @param {object} context - Processing context
   * @param {string} context.actorId - The actor ID
   * @param {string} context.stage - The processing stage (dispatch, interpretation, directive)
   * @param {ActionDefinition} [context.actionDef] - The action definition (if available)
   * @param {object} [context.additionalContext] - Additional context
   * @returns {ActionErrorContext} The error context
   */
  handleProcessingError(
    error,
    { actorId, stage, actionDef = null, additionalContext = {} }
  ) {
    return this.createContext({
      error,
      phase: ERROR_PHASES.EXECUTION,
      actionDef,
      actorId,
      additionalContext: {
        stage: `command_processing_${stage}`,
        ...additionalContext,
      },
    });
  }

  /**
   * Logs an error with context without creating a full error context.
   * Useful for non-critical errors or when full error context is not needed.
   *
   * @param {string} message - Error message
   * @param {Error} error - The error object
   * @param {object} [context] - Additional context
   */
  logError(message, error, context = {}) {
    this.#logger.error(message, {
      error: error.message,
      stack: error.stack,
      ...context,
    });
  }

  /**
   * Creates a simple error response for cases where full error context is not needed.
   *
   * @param {Error} error - The error that occurred
   * @param {string} userMessage - User-friendly error message
   * @returns {object} Simple error response
   */
  createSimpleErrorResponse(error, userMessage) {
    return {
      success: false,
      error: userMessage,
      details: error.message,
    };
  }
}

export default UnifiedErrorHandler;
