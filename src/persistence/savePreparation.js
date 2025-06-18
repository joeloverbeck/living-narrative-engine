// src/persistence/savePreparation.js

import { cloneAndValidateSaveState } from '../utils/saveStateUtils.js';
import { createPersistenceSuccess } from '../utils/persistenceResultUtils.js';
import { wrapPersistenceOperation } from '../utils/persistenceErrorUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./gameStateSerializer.js').default} GameStateSerializer */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

/**
 * Deep clones and augments the provided game state for saving.
 *
 * @param {string} saveName - Name of the save slot.
 * @param {SaveGameStructure} obj - Original game state object.
 * @param {ILogger} logger - Logging service.
 * @returns {import('./persistenceTypes.js').PersistenceResult<SaveGameStructure>}
 *   Result containing the cloned object or error.
 */
export function cloneAndPrepareState(saveName, obj, logger) {
  const cloneResult = cloneAndValidateSaveState(obj, logger);
  if (!cloneResult.success || !cloneResult.data) {
    return { success: false, error: cloneResult.error };
  }

  /** @type {SaveGameStructure} */
  const cloned = cloneResult.data;
  cloned.metadata = { ...(cloned.metadata || {}), saveName };
  cloned.integrityChecks = { ...(cloned.integrityChecks || {}) };
  return createPersistenceSuccess(cloned);
}

/**
 * Prepares and serializes game state data for saving.
 *
 * @param {string} saveName - Name of the save slot.
 * @param {SaveGameStructure} gameStateObject - Raw game state object.
 * @param {GameStateSerializer} serializer - Serializer instance.
 * @param {ILogger} logger - Logging service.
 * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<Uint8Array>>}
 *   Result containing compressed data.
 */
export async function prepareState(
  saveName,
  gameStateObject,
  serializer,
  logger
) {
  const cloneResult = cloneAndPrepareState(saveName, gameStateObject, logger);
  if (!cloneResult.success || !cloneResult.data) {
    return { success: false, error: cloneResult.error };
  }

  return wrapPersistenceOperation(logger, async () => {
    const { compressedData } = await serializer.serializeAndCompress(
      cloneResult.data
    );
    return { success: true, data: compressedData };
  });
}

export default { cloneAndPrepareState, prepareState };
