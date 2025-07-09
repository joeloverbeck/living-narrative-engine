// src/utils/saveStateUtils.js

import { safeDeepClone } from './cloneUtils.js';
import { PersistenceErrorCodes } from '../persistence/persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from './persistenceResultUtils.js';

/**
 * Minimal representation of a save state object.
 *
 * @typedef {object} SaveState
 * @property {object} gameState - The game state payload.
 */

/**
 * Deep clones and validates a game save object.
 *
 * @description Uses {@link safeDeepClone} and verifies the object contains
 * a valid `gameState` property.
 * @param {object} obj - Raw save state object to clone.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for
 *   error reporting.
 * @returns {import('../persistence/persistenceTypes.js').PersistenceResult<SaveState>}
 *   Clone result with validation outcome.
 */
export function cloneValidatedState(obj, logger) {
  const cloneResult = safeDeepClone(obj, logger);
  if (!cloneResult.success || !cloneResult.data) {
    const fallback = {
      code: PersistenceErrorCodes.UNEXPECTED_ERROR,
      message: 'Unknown cloning failure',
    };
    const err = cloneResult.error ?? fallback;
    return createPersistenceFailure(err.code, err.message);
  }

  /** @type {SaveState} */
  const cloned = cloneResult.data;
  if (!cloned.gameState || typeof cloned.gameState !== 'object') {
    logger.error('Invalid or missing gameState property in save object.');
    return createPersistenceFailure(
      PersistenceErrorCodes.INVALID_GAME_STATE,
      'Invalid gameState for checksum calculation.'
    );
  }

  return createPersistenceSuccess(cloned);
}
