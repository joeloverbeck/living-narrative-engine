// src/bootstrapper/stages/auxiliary/initEngineUIManager.js

import { resolveAndInitialize } from '../../helpers.js';
import './typedefs.js';
/** @typedef {import('./typedefs.js').AuxHelperDeps} AuxHelperDeps */

/**
 * Resolves and initializes the EngineUIManager service.
 *
 * @param {AuxHelperDeps} deps - Contains DI container, logger, and token map.
 * @returns {{success: boolean, error?: Error}} Result of initialization.
 */
export function initEngineUIManager({ container, logger, tokens }) {
  return resolveAndInitialize(
    container,
    tokens.EngineUIManager,
    'initialize',
    logger
  );
}
