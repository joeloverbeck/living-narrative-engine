/**
 * @file FormattingErrorHandler - Centralizes error handling for action formatting
 * @see LegacyStrategy.js - Primary consumer of this error handler
 * @see StatisticsCollector.js - Related formatting component
 */

/**
 * Centralized error handling strategy for action formatting operations.
 * Provides consistent error creation, logging, and reporting.
 */
class FormattingErrorHandler {
  #logger;
  #createErrorFn;

  /**
   * Creates a new formatting error handler.
   *
   * @param {object} logger - Logger instance with warn/error/debug methods
   * @param {(error: Error|object, actionDef: object, actorId: string, trace: object, resolvedTargetId: string, originalTargetId: string) => object} createErrorFn - Error factory function
   */
  constructor(logger, createErrorFn) {
    this.#logger = logger;
    this.#createErrorFn = createErrorFn;
  }

  /**
   * Handles formatting errors with consistent logging and error creation.
   *
   * @param {object} params - Error handling parameters
   * @param {Error | object} params.error - The error that occurred
   * @param {object} params.actionDef - Action definition being formatted
   * @param {string} params.actorId - Actor ID performing the action
   * @param {object} params.targetContext - Target context (if applicable)
   * @param {object} params.trace - Trace object (if applicable)
   * @param {object} params.context - Additional context for logging
   * @returns {object} Formatted error object
   */
  handleFormattingError({
    error,
    actionDef,
    actorId,
    targetContext,
    trace,
    context = {},
  }) {
    const targetId = this.#resolveTargetId(error, targetContext);

    this.#logger.warn(
      `Failed to format command for action '${actionDef.id}' with target '${targetId}'`,
      { error, actionDef, targetContext, ...context }
    );

    return this.#createErrorFn(
      error,
      actionDef,
      actorId,
      trace,
      targetId,
      targetContext?.entityId
    );
  }

  /**
   * Handles normalization errors with consistent error creation.
   *
   * @param {object} params - Error handling parameters
   * @param {object} params.error - The normalization error
   * @param {object} params.actionDef - Action definition being formatted
   * @param {string} params.actorId - Actor ID performing the action
   * @param {object} params.trace - Trace object (if applicable)
   * @returns {object} Formatted error object
   */
  handleNormalizationError({ error, actionDef, actorId, trace }) {
    this.#logger.warn(
      `Normalization failed for action '${actionDef.id}'`,
      { error, actionDef }
    );

    return this.#createErrorFn(error, actionDef, actorId, trace, undefined, undefined);
  }

  /**
   * Handles validation errors (e.g., missing targets).
   * Logs warning but does not create error object.
   *
   * @param {object} params - Validation error parameters
   * @param {string} params.message - Error message
   * @param {object} params.actionDef - Action definition
   * @param {object} params.context - Additional context
   */
  handleValidationError({ message, actionDef, context = {} }) {
    this.#logger.warn(
      `Validation failed for action '${actionDef.id}': ${message}`,
      { actionDef, ...context }
    );
  }

  /**
   * Handles unexpected exceptions during formatting.
   *
   * @param {object} params - Exception parameters
   * @param {Error} params.exception - The exception that occurred
   * @param {object} params.actionDef - Action definition
   * @param {string} params.actorId - Actor ID
   * @param {object} params.targetContext - Target context
   * @param {object} params.trace - Trace object
   * @param {string} params.operation - Operation being performed
   * @returns {object} Formatted error object
   */
  handleException({
    exception,
    actionDef,
    actorId,
    targetContext,
    trace,
    operation = 'formatting',
  }) {
    const targetId = this.#resolveTargetId(exception, targetContext);

    this.#logger.error(
      `Unexpected exception during ${operation} for action '${actionDef.id}' with target '${targetId}'`,
      { exception, actionDef, targetContext, operation }
    );

    return this.#createErrorFn(
      exception,
      actionDef,
      actorId,
      trace,
      targetId,
      targetContext?.entityId
    );
  }

  /**
   * Resolves target ID from error or context.
   *
   * @private
   * @param {Error | object} error - The error object
   * @param {object} targetContext - Target context
   * @returns {string} Resolved target ID or 'unknown'
   */
  #resolveTargetId(error, targetContext) {
    return (
      error?.target?.entityId ||
      error?.entityId ||
      targetContext?.entityId ||
      'unknown'
    );
  }
}

export default FormattingErrorHandler;
