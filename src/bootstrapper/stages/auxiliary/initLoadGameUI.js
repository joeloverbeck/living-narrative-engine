// src/bootstrapper/stages/auxiliary/initLoadGameUI.js

import { resolveAndInitialize } from '../../helpers.js';
import './typedefs.js';

/**
 * Resolves LoadGameUI and calls its init method with the GameEngine instance.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initLoadGameUI({ container, gameEngine, logger, tokens }) {
  return resolveAndInitialize(
    container,
    tokens.LoadGameUI,
    'init',
    logger,
    gameEngine
  );
}
