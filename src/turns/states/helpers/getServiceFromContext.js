/**
 * @file Helper to safely retrieve services from ITurnContext implementations.
 */

/**
 * @typedef {import('../../types/stateTypes.js').ProcessingCommandStateLike} ProcessingCommandStateLike
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */

import { handleProcessingException } from './handleProcessingException.js';

/**
 * Safely obtains a service from the turn context.
 *
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @param {ITurnContext} turnCtx - Current turn context.
 * @param {string} methodName - Method name on ITurnContext used to retrieve the service.
 * @param {string} serviceNameForLog - Label for logging when retrieval fails.
 * @param {string} actorIdForLog - Actor ID for logging context.
 * @returns {Promise<*>} The requested service instance or `null` if unavailable.
 */
export async function getServiceFromContext(
  state,
  turnCtx,
  methodName,
  serviceNameForLog,
  actorIdForLog
) {
  if (!turnCtx || typeof turnCtx.getLogger !== 'function') {
    console.error(
      `${state.getStateName()}: Invalid turnCtx in _getServiceFromContext for ${serviceNameForLog}, actor ${actorIdForLog}.`
    );
    if (state._isProcessing) {
      state._isProcessing = false;
    }
    return null;
  }
  const logger = turnCtx.getLogger();
  try {
    if (typeof turnCtx[methodName] !== 'function') {
      throw new Error(
        `Method turnCtx.${methodName}() does not exist or is not a function.`
      );
    }
    const service = turnCtx[methodName]();
    if (!service) {
      throw new Error(
        `Method turnCtx.${methodName}() returned null or undefined.`
      );
    }
    return service;
  } catch (error) {
    const errorMsg = `${state.getStateName()}: Failed to retrieve ${serviceNameForLog} for actor ${actorIdForLog}. Error: ${error.message}`;
    logger.error(errorMsg, error);
    const serviceError = new Error(errorMsg);
    await handleProcessingException(
      state,
      turnCtx,
      serviceError,
      actorIdForLog
    );
    return null;
  }
}

export default getServiceFromContext;
