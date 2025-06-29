/**
 * @file Helper for dispatching speech events.
 */

/**
 * @typedef {import('../../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */
import { ENTITY_SPOKE_ID } from '../../../constants/eventIds.js';
import { getSafeEventDispatcher } from './contextUtils.js';

/**
 * Dispatches the ENTITY_SPOKE_ID event using a resolved SafeEventDispatcher.
 *
 * @param {ITurnContext|null} turnCtx - Current turn context.
 * @param {BaseTurnHandler} handler - Handler fallback for dispatcher resolution.
 * @param {string} actorId - ID of the speaking actor.
 * @param {object} payloadBase - Base payload from {@link buildSpeechPayload}.
 * @returns {Promise<void>} Resolves when dispatch completes or dispatcher is missing.
 */
export async function dispatchSpeechEvent(
  turnCtx,
  handler,
  actorId,
  payloadBase
) {
  const dispatcher = getSafeEventDispatcher(turnCtx, handler);
  if (dispatcher) {
    const payload = { entityId: actorId, ...payloadBase };
    await dispatcher.dispatch(ENTITY_SPOKE_ID, payload);
  }
}

export default dispatchSpeechEvent;
