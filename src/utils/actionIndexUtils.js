// src/utils/actionIndexUtils.js
import { safeDispatchError } from './safeDispatchErrorUtils.js';

/**
 * Validates that a chosen action index is an integer within the
 * bounds of the available actions.
 *
 * @param {number} chosenIndex
 * @param {number} actionsLength
 * @param {string} providerName
 * @param {string} actorId
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher
 * @param {import('../interfaces/coreServices.js').ILogger} logger
 * @param {object} [debugData]
 * @throws {Error} If the index is invalid or out of range.
 */
export function assertValidActionIndex(
  chosenIndex,
  actionsLength,
  providerName,
  actorId,
  dispatcher,
  logger,
  debugData = {}
) {
  if (!Number.isInteger(chosenIndex)) {
    safeDispatchError(
      dispatcher,
      `${providerName}: Did not receive a valid integer 'chosenIndex' for actor ${actorId}.`,
      debugData
    );
    throw new Error('Could not resolve the chosen action to a valid index.');
  }

  if (chosenIndex < 1 || chosenIndex > actionsLength) {
    safeDispatchError(
      dispatcher,
      `${providerName}: invalid chosenIndex (${chosenIndex}) for actor ${actorId}.`,
      { ...debugData, actionsCount: actionsLength }
    );
    throw new Error('Player chose an index that does not exist for this turn.');
  }
}
