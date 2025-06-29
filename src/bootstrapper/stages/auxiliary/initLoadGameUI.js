// src/bootstrapper/stages/auxiliary/initLoadGameUI.js

import { resolveAndInitialize } from '../../../utils/bootstrapperHelpers.js';
import GameEngineLoadAdapter from '../../../adapters/GameEngineLoadAdapter.js';
import './typedefs.js';

/**
 * Resolves LoadGameUI and calls its init method with the GameEngine instance.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initLoadGameUI({ container, gameEngine, logger, tokens }) {
  const adapter = new GameEngineLoadAdapter(gameEngine);
  return resolveAndInitialize(
    container,
    tokens.LoadGameUI,
    'init',
    logger,
    adapter
  );
}
