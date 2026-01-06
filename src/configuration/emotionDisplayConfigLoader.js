import { fetchWithRetry } from '../utils/index.js';
import { isNonBlankString } from '../utils/textUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} EmotionDisplayConfiguration
 * @property {number} maxEmotionalStates
 * @property {number} maxSexualStates
 */

export class EmotionDisplayConfigLoader {
  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * @private
   * @type {string}
   */
  #defaultConfigPath = 'config/emotion-display-config.json';

  /**
   * @private
   * @type {number}
   */
  #defaultMaxRetries = 2;

  /**
   * @private
   * @type {number}
   */
  #defaultBaseDelayMs = 300;

  /**
   * @private
   * @type {number}
   */
  #defaultMaxDelayMs = 1000;

  /** @type {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #safeEventDispatcher;

  /**
   * @param {object} [dependencies]
   * @param {ILogger} [dependencies.logger]
   * @param {string} [dependencies.configPath]
   * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dependencies.safeEventDispatcher
   */
  constructor(dependencies = {}) {
    this.#logger = dependencies.logger || console;

    if (
      !dependencies.safeEventDispatcher ||
      typeof dependencies.safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'EmotionDisplayConfigLoader requires a valid ISafeEventDispatcher instance.'
      );
    }
    this.#safeEventDispatcher = dependencies.safeEventDispatcher;

    if (
      dependencies.configPath &&
      typeof dependencies.configPath === 'string'
    ) {
      this.#defaultConfigPath = dependencies.configPath;
    }
  }

  /**
   * @async
   * @param {string} [filePath]
   * @returns {Promise<EmotionDisplayConfiguration>}
   */
  async loadConfig(filePath) {
    const path = isNonBlankString(filePath)
      ? filePath.trim()
      : this.#defaultConfigPath;
    const defaults = {
      maxEmotionalStates: 7,
      maxSexualStates: 5,
    };
    const logWarn = (msg, ...args) =>
      this.#logger.warn
        ? this.#logger.warn(msg, ...args)
        : console.warn(msg, ...args);

    try {
      const parsedResponse = await fetchWithRetry(
        path,
        { method: 'GET', headers: { Accept: 'application/json' } },
        this.#defaultMaxRetries,
        this.#defaultBaseDelayMs,
        this.#defaultMaxDelayMs,
        this.#safeEventDispatcher,
        this.#logger
      );

      if (typeof parsedResponse !== 'object' || parsedResponse === null) {
        logWarn(
          `[EmotionDisplayConfigLoader] Configuration file from ${path} is malformed (not an object). Falling back to defaults.`
        );
        return defaults;
      }

      const resolved = {
        maxEmotionalStates: resolvePositiveInt(
          parsedResponse.maxEmotionalStates,
          defaults.maxEmotionalStates,
          'maxEmotionalStates',
          path,
          logWarn
        ),
        maxSexualStates: resolvePositiveInt(
          parsedResponse.maxSexualStates,
          defaults.maxSexualStates,
          'maxSexualStates',
          path,
          logWarn
        ),
      };

      return resolved;
    } catch (error) {
      logWarn(
        `[EmotionDisplayConfigLoader] Failed to load configuration from ${path}. Using defaults. Error: ${error.message}`
      );
      return defaults;
    }
  }
}

function resolvePositiveInt(value, defaultValue, fieldName, path, logWarn) {
  if (value === undefined) {
    return defaultValue;
  }

  if (!Number.isInteger(value) || value <= 0) {
    logWarn(
      `[EmotionDisplayConfigLoader] '${fieldName}' in ${path} must be a positive integer. Using default ${defaultValue}.`
    );
    return defaultValue;
  }

  return value;
}

export default EmotionDisplayConfigLoader;
