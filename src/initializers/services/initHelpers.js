// src/initializers/services/initHelpers.js

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../actions/actionIndex.js').ActionIndex} ActionIndex */

/**
 * Validates that a world name is a non-empty string.
 *
 * @param {string} worldName - Name of the world to validate.
 * @param {ILogger} logger - Logger for reporting validation errors.
 * @returns {void}
 * @throws {TypeError} If the world name is missing or blank.
 */
export function validateWorldName(worldName, logger) {
  const msg = 'InitializationService requires a valid non-empty worldName.';
  if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
    logger?.error(msg);
    throw new TypeError(msg);
  }
}

/**
 * Builds the ActionIndex from definitions provided by the repository.
 *
 * @param {ActionIndex} actionIndex - Index instance to populate.
 * @param {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} gameDataRepository - Repository supplying definitions.
 * @param {ILogger} logger - Logger for debug output.
 * @returns {void}
 * @throws {Error} If required dependencies are missing.
 */
export function buildActionIndex(actionIndex, gameDataRepository, logger) {
  if (
    !gameDataRepository ||
    typeof gameDataRepository.getAllActionDefinitions !== 'function'
  ) {
    throw new Error('buildActionIndex: invalid gameDataRepository dependency');
  }
  if (!actionIndex || typeof actionIndex.buildIndex !== 'function') {
    throw new Error('buildActionIndex: invalid actionIndex dependency');
  }

  logger?.debug('Building ActionIndex with loaded action definitions...');
  const defs = gameDataRepository.getAllActionDefinitions();
  actionIndex.buildIndex(defs);
  logger?.debug(`ActionIndex built with ${defs.length} action definitions.`);
}
