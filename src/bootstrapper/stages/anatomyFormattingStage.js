// src/bootstrapper/stages/anatomyFormattingStage.js

import { stageSuccess, stageFailure } from '../../utils/bootstrapperHelpers.js';

/**
 * @typedef {import('../../dependencyInjection/appContainer.js').default} AppContainer
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../dependencyInjection/tokens.js').tokens} TokensObject
 */

/**
 * Bootstrap Stage: Initializes the AnatomyFormattingService after mods are loaded.
 * This service is essential for the anatomy visualizer to function properly.
 *
 * @async
 * @param {AppContainer} container - The configured AppContainer instance.
 * @param {ILogger} logger - The logger instance.
 * @param {TokensObject} tokens - The DI tokens object.
 * @returns {Promise<import('../../types/stageResult.js').StageResult>} Result object indicating success or failure.
 */
export async function initializeAnatomyFormattingStage(
  container,
  logger,
  tokens
) {
  const stageName = 'Anatomy Formatting Service Initialization';
  logger.info(`Bootstrap Stage: Starting ${stageName}...`);

  try {
    // Resolve the AnatomyFormattingService
    const anatomyFormattingService = container.resolve(
      tokens.AnatomyFormattingService
    );

    if (!anatomyFormattingService) {
      throw new Error(
        'AnatomyFormattingService resolved to an invalid object.'
      );
    }

    // Initialize the service
    logger.debug('Initializing AnatomyFormattingService...');
    await anatomyFormattingService.initialize();

    logger.info(`Bootstrap Stage: ${stageName} completed successfully.`);
    return stageSuccess({ anatomyFormattingService });
  } catch (error) {
    const errorMsg = `Failed to initialize AnatomyFormattingService: ${error.message}`;
    logger.error(`Bootstrap Stage: ${stageName} failed. ${errorMsg}`, error);
    return stageFailure(stageName, errorMsg, error);
  }
}
