// src/bootstrapper/stages/auxiliary/initActorParticipationController.js

import { resolveAndInitialize } from '../../../utils/bootstrapperHelpers.js';
import './typedefs.js';
/** @typedef {import('./typedefs.js').AuxHelperDeps} AuxHelperDeps */

/**
 * Resolves and initializes the ActorParticipationController service.
 *
 * @param {AuxHelperDeps} deps - Contains DI container, logger, and token map.
 * @returns {{success: boolean, error?: Error}} Result of initialization.
 */
export async function initActorParticipationController({
  container,
  logger,
  tokens,
}) {
  return resolveAndInitialize(
    container,
    tokens.ActorParticipationController,
    'initialize',
    logger
  );
}
