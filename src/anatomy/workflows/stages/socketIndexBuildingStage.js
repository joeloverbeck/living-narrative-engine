/**
 * @file Stage for building socket index before clothing instantiation
 */

/**
 * Builds socket index for the character to enable O(1) socket lookups
 * This must happen BEFORE clothing instantiation to prevent timing issues
 * during concurrent character generation
 *
 * @param {object} context - Generation context
 * @param {string} context.ownerId - Owner entity ID
 * @param {object} dependencies - Required services
 * @param {import('../../../interfaces/IAnatomySocketIndex.js').IAnatomySocketIndex} dependencies.socketIndex - Socket index service (optional)
 * @param {import('../../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger
 * @returns {Promise<void>}
 */
export async function executeSocketIndexBuilding(context, dependencies) {
  const { ownerId } = context;
  const { socketIndex, logger } = dependencies;

  // Socket index is optional - only build if available
  // This handles scenarios where socket index isn't injected (e.g., anatomy-visualizer.html)
  if (!socketIndex) {
    logger.info(
      `SocketIndexBuildingStage: Skipping - socket index not available for entity '${ownerId}'`
    );
    return;
  }

  logger.info(
    `SocketIndexBuildingStage: Building socket index for entity '${ownerId}'`
  );

  // Build the socket index explicitly to ensure it's ready before clothing instantiation
  // This prevents race conditions where multiple characters try to instantiate clothing
  // while the index is still building (lazy initialization)
  await socketIndex.buildIndex(ownerId);

  logger.info(
    `SocketIndexBuildingStage: Completed socket index building for entity '${ownerId}'`
  );
}
