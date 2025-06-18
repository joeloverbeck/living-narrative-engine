// src/bootstrapper/stages/auxiliary/initEngineUIManager.js

import { resolveAndInitialize } from '../../helpers.js';
import './typedefs.js';

/**
 * Resolves and initializes the EngineUIManager service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initEngineUIManager({ container, logger, tokens }) {
  return resolveAndInitialize(
    container,
    tokens.EngineUIManager,
    'initialize',
    logger
  );
}
