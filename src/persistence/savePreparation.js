// src/persistence/savePreparation.js

import { cloneValidatedState } from '../utils/saveStateUtils.js';
import { createPersistenceSuccess } from '../utils/persistenceResultUtils.js';
import { wrapPersistenceOperation } from '../utils/persistenceErrorUtils.js';

/**
 * Deep clones and augments the provided game state for saving.
 *
 * @param {string} saveName - Name of the save slot.
 * @param {import('../interfaces/ISaveLoadService.js').SaveGameStructure} gameState - Original game state object.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for error reporting.
 * @returns {import('./persistenceTypes.js').PersistenceResult<import('../interfaces/ISaveLoadService.js').SaveGameStructure>}
 *   Result containing the cloned object or error.
 */
export function cloneAndPrepareState(saveName, gameState, logger) {
  const cloneResult = cloneValidatedState(gameState, logger);
  if (!cloneResult.success || !cloneResult.data) {
    return { success: false, error: cloneResult.error };
  }

  /** @type {import('../interfaces/ISaveLoadService.js').SaveGameStructure} */
  const cloned = cloneResult.data;
  cloned.metadata = { ...(cloned.metadata || {}), saveName };
  cloned.integrityChecks = { ...(cloned.integrityChecks || {}) };
  return createPersistenceSuccess(cloned);
}

/**
 * Prepares and serializes game state data for saving.
 *
 * @param {string} saveName - Name of the save slot.
 * @param {import('../interfaces/ISaveLoadService.js').SaveGameStructure} gameStateObject - Raw game state object.
 * @param {import('./gameStateSerializer.js').default} serializer - Serializer instance.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for error reporting.
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
    const { compressedData } = await serializer.compressPreparedState(
      cloneResult.data
    );
    return { success: true, data: compressedData };
  });
}

export default prepareState;
