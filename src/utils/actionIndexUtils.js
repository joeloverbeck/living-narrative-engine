// src/utils/actionIndexUtils.js
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { ActionIndexValidationError } from '../errors/actionIndexValidationError.js';

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
 * @returns {Promise<void>}
 */
export async function assertValidActionIndex(
  chosenIndex,
  actionsLength,
  providerName,
  actorId,
  dispatcher,
  logger,
  debugData = {}
) {
  if (!Number.isInteger(chosenIndex)) {
    await safeDispatchError(
      dispatcher,
      `${providerName}: Did not receive a valid integer 'chosenIndex' for actor ${actorId}.`,
      debugData,
      logger
    );
    throw new Error('Could not resolve the chosen action to a valid index.');
  }

  if (chosenIndex < 1 || chosenIndex > actionsLength) {
    const message = 'Player chose an index that does not exist for this turn.';

    // Extract LLM data from debugData.result (current structure)
    const llmData = debugData.result || {};

    // Create enhanced error with preserved LLM data
    const error = new ActionIndexValidationError(message, {
      index: chosenIndex,
      actionsLength,
      speech: llmData.speech,
      thoughts: llmData.thoughts,
      notes: llmData.notes,
    });

    // Existing error dispatch logic (unchanged)
    await safeDispatchError(
      dispatcher,
      `${providerName}: invalid chosenIndex (${chosenIndex}) for actor ${actorId}.`,
      { ...debugData, actionsCount: actionsLength },
      logger
    );

    throw error;
  }
}
