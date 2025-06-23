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
   * @param {string} message - Error message describing the lookup failure.
   */
  constructor(message) {
    super(message);
    this.name = 'ServiceLookupError';
  }
}

/**
 * Safely obtains a service from the turn context.
 *
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @param {ITurnContext} turnCtx - Current turn context.
 * @param {string} contextMethod - Method name on ITurnContext used to retrieve the service.
 * @param {string} serviceLabel - Label for logging when retrieval fails.
 * @param {string} actorIdForLog - Actor ID for logging context.
 * @returns {Promise<*>} The requested service instance.
 * @throws {ServiceLookupError} When the service cannot be retrieved.
 */
export async function getServiceFromContext(
  state,
  turnCtx,
  contextMethod,
  serviceLabel,
  actorIdForLog
) {
  const logger = getLogger(turnCtx, state._handler);
  const dispatcher = getSafeEventDispatcher(turnCtx, state._handler);

  if (!turnCtx || typeof turnCtx.getLogger !== 'function') {
    const errorMsg = `${state.getStateName()}: Invalid turnCtx in _getServiceFromContext for ${serviceLabel}, actor ${actorIdForLog}.`;
    if (dispatcher) {
      safeDispatchError(
        dispatcher,
        errorMsg,
        {
          actorId: actorIdForLog,
          service: serviceLabel,
          method: contextMethod,
        },
        logger
      );
    }
    logger.error(errorMsg);

    if (state._isProcessing) {
      finishProcessing(state);
    }
    throw new ServiceLookupError(errorMsg);
  }
  try {
    if (typeof turnCtx[contextMethod] !== 'function') {
      throw new Error(
        `Method turnCtx.${contextMethod}() does not exist or is not a function.`
      );
    }
    const service = turnCtx[contextMethod]();
    if (!service) {
      throw new Error(
        `Method turnCtx.${contextMethod}() returned null or undefined.`
      );
    }
    return service;
  } catch (error) {
    const errorMsg = `${state.getStateName()}: Failed to retrieve ${serviceLabel} for actor ${actorIdForLog}. Error: ${error.message}`;
    logger.error(errorMsg, error);
    if (dispatcher) {
      safeDispatchError(
        dispatcher,
        errorMsg,
        {
          actorId: actorIdForLog,
          service: serviceLabel,
          method: contextMethod,
          error: error.message,
          stack: error.stack,
        },
        logger
      );
    }
    const serviceError = new Error(errorMsg);
    const exceptionHandler = new ProcessingExceptionHandler(state);
    await exceptionHandler.handle(turnCtx, serviceError, actorIdForLog);
    throw new ServiceLookupError(errorMsg);
  }
}

export default getServiceFromContext;
