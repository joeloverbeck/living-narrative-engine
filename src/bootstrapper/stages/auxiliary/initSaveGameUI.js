// src/bootstrapper/stages/auxiliary/initSaveGameUI.js

import { resolveAndInitialize } from '../../helpers.js';
import './typedefs.js';

/**
 * Resolves SaveGameUI and calls its init method with the GameEngine instance.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initSaveGameUI({ container, gameEngine, logger, tokens }) {
  return resolveAndInitialize(
    container,
    tokens.SaveGameUI,
    'init',
    logger,
    gameEngine
  );
}
