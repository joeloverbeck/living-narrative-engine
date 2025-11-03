// src/bootstrapper/stages/auxiliary/initPerceptibleEventSenderController.js

import { resolveAndInitialize } from '../../../utils/bootstrapperHelpers.js';
import './typedefs.js';
/** @typedef {import('./typedefs.js').AuxHelperDeps} AuxHelperDeps */

/**
 * Resolves and initializes the PerceptibleEventSenderController service.
 *
 * @param {AuxHelperDeps} deps - Contains DI container, logger, and token map.
 * @returns {{success: boolean, error?: Error}} Result of initialization.
 */
export async function initPerceptibleEventSenderController({
  container,
  logger,
  tokens,
}) {
  return resolveAndInitialize(
    container,
    tokens.PerceptibleEventSenderController,
    'initialize',
    logger
  );
}
