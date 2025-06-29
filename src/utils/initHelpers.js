// src/utils/initHelpers.js

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../actions/actionIndex.js').ActionIndex} ActionIndex */

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
