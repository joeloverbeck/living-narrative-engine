/**
 * @file Factory responsible for building action formatting error payloads.
 */

import { ERROR_PHASES } from '../../../errors/actionErrorTypes.js';

/**
 * @typedef {import('../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */
/**
 * @typedef {import('../../../../actions/errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder
 */

/**
 * @typedef {object} ErrorFactoryDeps
 * @property {ActionErrorContextBuilder} errorContextBuilder - Builder used to construct error payloads.
 */

/**
 * @typedef {object} ErrorFactoryContext
 * @property {unknown} errorOrResult - Either an Error-like value or a formatter result containing an error.
 * @property {ActionDefinition} actionDef - The action definition that failed to format.
 * @property {string} actorId - Identifier of the actor executing the action pipeline.
 * @property {import('../../../tracing/traceContext.js').TraceContext|import('../../../tracing/structuredTrace.js').StructuredTrace|import('../../../tracing/actionAwareStructuredTrace.js').default|undefined} [trace] - Optional trace context.
 * @property {string|null} [targetId] - Explicitly resolved target identifier.
 * @property {string|null} [fallbackTargetId] - Fallback target identifier if the error payload lacks a target.
 */

/**
 * @class ActionFormattingErrorFactory
 * @description Centralised helper that mirrors {@link ActionFormattingStage}'s error handling behaviour.
 */
export class ActionFormattingErrorFactory {
  #errorContextBuilder;

  /**
   * @param {ErrorFactoryDeps} deps - Factory dependencies.
   */
  constructor({ errorContextBuilder }) {
    this.#errorContextBuilder = errorContextBuilder;
  }

  /**
   * Creates an error payload consistent with the ActionFormattingStage implementation.
   *
   * @param {ErrorFactoryContext} context - Error creation context.
   * @returns {unknown} Error context built by {@link ActionErrorContextBuilder}.
   */
  create(context) {
    const {
      errorOrResult,
      actionDef,
      actorId,
      trace,
      targetId = null,
      fallbackTargetId = null,
    } = context;

    let error = errorOrResult;
    let formatDetails;

    if (
      errorOrResult &&
      typeof errorOrResult === 'object' &&
      'error' in errorOrResult
    ) {
      const resultWithError =
        /** @type {{error: unknown, details?: unknown}} */ (errorOrResult);
      error = resultWithError.error;
      formatDetails = resultWithError.details;
    }

    const extractedTargetId =
      targetId ??
      (error && typeof error === 'object'
        ? // @ts-expect-error - runtime inspection of optional properties
          (error?.target?.entityId ?? error?.entityId ?? null)
        : null) ??
      fallbackTargetId ??
      null;

    const additionalContext = {
      stage: 'action_formatting',
    };

    if (typeof formatDetails !== 'undefined') {
      additionalContext.formatDetails = formatDetails;
    } else if (error instanceof Error) {
      additionalContext.thrown = true;
    }

    return this.#errorContextBuilder.buildErrorContext({
      error,
      actionDef,
      actorId,
      phase: ERROR_PHASES.VALIDATION,
      trace,
      targetId: extractedTargetId,
      additionalContext,
    });
  }
}

export default ActionFormattingErrorFactory;
