/**
 * @file Helper to safely retrieve services from ITurnContext implementations.
 */

/**
 * @typedef {import('../../../types/stateTypes.js').ProcessingCommandStateLike} ProcessingCommandStateLike
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */

import { ProcessingExceptionHandler } from './processingExceptionHandler.js';
import { safeDispatchError } from '../../../utils/safeDispatchErrorUtils.js';
import { getLogger, getSafeEventDispatcher } from './contextUtils.js';
import { finishProcessing } from './processingErrorUtils.js';

/**
 * @class ServiceLookupError
 * @augments Error
 * @description Error thrown when a service cannot be retrieved from the turn context.
 */
export class ServiceLookupError extends Error {
  /**
   * Creates a new ServiceLookupError instance.
   *
   * @param {string} message - Error message describing the lookup failure.
   * @param {{ cause?: Error }} [options] - Optional error details.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'ServiceLookupError';
  }
}

/**
 * @class ServiceLookupHelper
 * @description Encapsulates service lookup validation, logging and error handling.
 */
export class ServiceLookupHelper {
  /**
   * Creates the helper instance.
   *
   * @param {ProcessingCommandStateLike} state - Owning state instance.
   * @param {ProcessingExceptionHandler} [exceptionHandler] - Optional handler for errors.
   */
  constructor(state, exceptionHandler = state._exceptionHandler) {
    this._state = state;
    this._exceptionHandler =
      exceptionHandler || new ProcessingExceptionHandler(state);
  }

  /**
   * Validates that the turn context and specified method exist.
   *
   * @param {ITurnContext|null} turnCtx - Current turn context.
   * @param {string} contextMethod - Name of method expected on the context.
   * @returns {boolean} `true` when valid, otherwise `false`.
   */
  validateContextForService(turnCtx, contextMethod) {
    return Boolean(turnCtx) && typeof turnCtx[contextMethod] === 'function';
  }

  /**
   * Reports a failure when retrieving a service from the context.
   * Logs the error and dispatches a system event.
   *
   * @param {ITurnContext|null} turnCtx - Current turn context.
   * @param {string} contextMethod - Method name used for lookup.
   * @param {string} serviceLabel - Human readable service label.
   * @param {string} actorIdForLog - Actor ID for logging context.
   * @param {string} errorMsg - Message describing the failure.
   * @param {Error} [error] - Underlying error, if any.
   * @returns {Promise<void>} Resolves when reporting completes.
   */
  async logServiceLookupFailure(
    turnCtx,
    contextMethod,
    serviceLabel,
    actorIdForLog,
    errorMsg,
    error
  ) {
    const logger = getLogger(turnCtx, this._state._handler);
    const dispatcher = getSafeEventDispatcher(turnCtx, this._state._handler);

    if (error) {
      if (error.cause) {
        logger.error(errorMsg, error, error.cause);
      } else {
        logger.error(errorMsg, error);
      }
    } else {
      logger.error(errorMsg);
    }

    if (dispatcher) {
      safeDispatchError(
        dispatcher,
        errorMsg,
        {
          actorId: actorIdForLog,
          service: serviceLabel,
          method: contextMethod,
          error: error?.message,
          stack: error?.stack,
          cause: error?.cause?.message,
          causeStack: error?.cause?.stack,
        },
        logger
      );
    }
  }

  /**
   * Handles a lookup failure by invoking the exception handler or clearing processing.
   *
   * @param {ITurnContext|null} turnCtx - Current turn context.
   * @param {string} actorIdForLog - Actor ID for logging context.
   * @param {string} errorMsg - Message describing the failure.
   * @param {boolean} [invokeHandler] - Whether to invoke the exception handler.
   * @param {ProcessingExceptionHandler} [exceptionHandler] - Optional handler to use.
   * @returns {Promise<void>} Resolves when handling completes.
   */
  async handleServiceLookupFailure(
    turnCtx,
    actorIdForLog,
    errorMsg,
    invokeHandler = false,
    exceptionHandler = this._exceptionHandler
  ) {
    if (invokeHandler) {
      const handler =
        exceptionHandler || new ProcessingExceptionHandler(this._state);
      await handler.handle(turnCtx, new Error(errorMsg), actorIdForLog);
    } else if (this._state.isProcessing) {
      finishProcessing(this._state);
    }
  }

  /**
   * Safely obtains a service from the turn context.
   *
   * @param {ITurnContext|null} turnCtx - Current turn context.
   * @param {string} contextMethod - Method name on ITurnContext used to retrieve the service.
   * @param {string} serviceLabel - Label for logging when retrieval fails.
   * @param {string} actorIdForLog - Actor ID for logging context.
   * @param {ProcessingExceptionHandler} [exceptionHandler] - Handler for errors.
   * @returns {Promise<*>} The requested service instance.
   * @throws {ServiceLookupError} When the service cannot be retrieved.
   */
  async getServiceFromContext(
    turnCtx,
    contextMethod,
    serviceLabel,
    actorIdForLog,
    exceptionHandler = this._exceptionHandler
  ) {
    if (!this.validateContextForService(turnCtx, contextMethod)) {
      const errorMsg = `${this._state.getStateName()}: Invalid turnCtx in _getServiceFromContext for ${serviceLabel}, actor ${actorIdForLog}.`;
      await this.logServiceLookupFailure(
        turnCtx,
        contextMethod,
        serviceLabel,
        actorIdForLog,
        errorMsg
      );

      await this.handleServiceLookupFailure(turnCtx, actorIdForLog, errorMsg);
      throw new ServiceLookupError(errorMsg);
    }

    try {
      const service = turnCtx[contextMethod]();
      if (!service) {
        throw new Error(
          `Method turnCtx.${contextMethod}() returned null or undefined.`
        );
      }
      return service;
    } catch (error) {
      const serviceError =
        error instanceof Error ? error : new Error(String(error));
      const errorMsg = `${this._state.getStateName()}: Failed to retrieve ${serviceLabel} for actor ${actorIdForLog}. Error: ${serviceError.message}`;
      const lookupError = new ServiceLookupError(errorMsg, {
        cause: serviceError,
      });
      await this.logServiceLookupFailure(
        turnCtx,
        contextMethod,
        serviceLabel,
        actorIdForLog,
        errorMsg,
        lookupError
      );

      await this.handleServiceLookupFailure(
        turnCtx,
        actorIdForLog,
        errorMsg,
        true,
        exceptionHandler
      );
      throw lookupError;
    }
  }
}

export default ServiceLookupHelper;
