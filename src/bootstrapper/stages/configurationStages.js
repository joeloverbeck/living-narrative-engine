// src/bootstrapper/stages/configurationStages.js

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../types/stageResult.js').StageResult} StageResult */
import { stageSuccess, stageFailure } from '../../utils/bootstrapperHelpers.js';
import { initializeGlobalConfig } from '../../entities/utils/configUtils.js';

/**
 * Bootstrap Stage: Initializes the Global Configuration System.
 * This function initializes the global configuration provider that will be used
 * by the enhanced service factories throughout the application.
 *
 * @async
 * @param {ILogger} logger - The resolved ILogger instance.
 * @param {object} [userConfig] - Optional user configuration overrides.
 * @returns {Promise<StageResult>} Result object indicating success or failure.
 */
export async function initializeGlobalConfigStage(logger, userConfig = {}) {
  logger.debug('Bootstrap Stage: Initializing Global Configuration...');
  const currentPhase = 'Global Configuration Initialization';

  try {
    logger.debug(
      'Configuration Stage: Initializing global configuration provider...'
    );

    // Initialize the global configuration with the logger and any user config
    initializeGlobalConfig(logger, userConfig);

    logger.debug(
      'Configuration Stage: Global configuration provider initialized successfully.'
    );
    logger.debug(
      'Configuration Stage: Configuration system is now available for all services.'
    );

    // Log configuration summary if in debug mode
    logger.debug(
      'Configuration Stage: Configuration initialized with the following settings:',
      {
        hasUserConfig: Object.keys(userConfig).length > 0,
        userConfigKeys: Object.keys(userConfig),
      }
    );
  } catch (configError) {
    logger.error(
      'Configuration Stage: Fatal error during global configuration initialization.',
      configError
    );
    const errorMsg = `Fatal Error during global configuration initialization: ${configError.message}.`;
    return stageFailure(currentPhase, errorMsg, configError);
  }

  logger.debug(
    `Bootstrap Stage: Initializing Global Configuration... DONE. Configuration system available.`
  );
  return stageSuccess();
}
