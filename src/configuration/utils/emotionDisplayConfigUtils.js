/**
 * @file emotionDisplayConfigUtils.js - Utilities for loading and applying emotion display configuration
 */

import { EmotionDisplayConfigLoader } from '../emotionDisplayConfigLoader.js';

const DEFAULT_EMOTION_DISPLAY_CONFIG = {
  maxEmotionalStates: 7,
  maxSexualStates: 5,
};

/**
 * Loads the emotion display configuration and stores it in the container for later use.
 *
 * @param {AppContainer} container - The DI container
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - The logger instance
 * @param {object} tokens - The DI tokens object
 * @param {string} [configPrefix] - The prefix for log messages
 * @returns {Promise<void>} Resolves once configuration is loaded
 */
export async function loadAndApplyEmotionDisplayConfig(
  container,
  logger,
  tokens,
  configPrefix = 'ContainerConfig'
) {
  try {
    const configLoader = new EmotionDisplayConfigLoader({
      logger,
      safeEventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
    });

    logger.debug(
      `[${configPrefix}] Starting asynchronous load of emotion display configuration...`
    );

    const configResult = await configLoader.loadConfig();

    if (configResult && typeof configResult === 'object') {
      container.register(tokens.IEmotionDisplayConfiguration, configResult);
      logger.debug(
        `[${configPrefix}] Emotion display configuration loaded successfully.`
      );
    } else {
      logger.warn(
        `[${configPrefix}] Emotion display configuration missing or invalid. Using defaults.`
      );
      container.register(
        tokens.IEmotionDisplayConfiguration,
        DEFAULT_EMOTION_DISPLAY_CONFIG
      );
    }
  } catch (err) {
    logger.error(
      `[${configPrefix}] Unexpected error while loading emotion display configuration: ${err.message}. Using defaults.`,
      err
    );
    container.register(
      tokens.IEmotionDisplayConfiguration,
      DEFAULT_EMOTION_DISPLAY_CONFIG
    );
  }
}
