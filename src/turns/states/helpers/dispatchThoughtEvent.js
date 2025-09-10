/**
 * @file Helper for dispatching thought events.
 */

/**
 * @typedef {import('../../interfaces/ITurnStateHost.js').ITurnStateHost} BaseTurnHandler
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */
import { ENTITY_THOUGHT_ID } from '../../../constants/eventIds.js';
import { getSafeEventDispatcher } from './contextUtils.js';

/**
 * Dispatches the ENTITY_THOUGHT_ID event using a resolved SafeEventDispatcher.
 *
 * @param {ITurnContext|null} turnCtx - Current turn context.
 * @param {BaseTurnHandler} handler - Handler fallback for dispatcher resolution.
 * @param {string} actorId - ID of the thinking actor.
 * @param {object} payloadBase - Base payload from {@link buildThoughtPayload}.
 * @returns {Promise<void>} Resolves when dispatch completes or dispatcher is missing.
 */
export async function dispatchThoughtEvent(
  turnCtx,
  handler,
  actorId,
  payloadBase
) {
  const dispatcher = getSafeEventDispatcher(turnCtx, handler);
  if (dispatcher) {
    const payload = { entityId: actorId, ...payloadBase };
    await dispatcher.dispatch(ENTITY_THOUGHT_ID, payload);
  }
}

export default dispatchThoughtEvent;
