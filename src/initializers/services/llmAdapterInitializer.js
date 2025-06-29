// src/initializers/services/llmAdapterInitializer.js

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../llms/services/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader */

/**
 * @description Handles initialization of an LLM adapter by validating the
 * adapter and its configuration loader, then invoking the adapter's init
 * method.
 */
class LlmAdapterInitializer {
  /**
   * Attempts to initialize the given LLM adapter.
   *
   * @async
   * @param {import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter & {
   *   init?: Function,
   *   isInitialized?: Function,
   *   isOperational?: Function,
   * }} adapter - The adapter instance to initialize.
   * @param {LlmConfigLoader} configLoader - Loader for adapter configuration.
   * @param {ILogger} logger - Logger for debug and error output.
   * @returns {Promise<boolean>} True if the adapter was initialized and is
   *   operational, otherwise false.
   */
  async initialize(adapter, configLoader, logger) {
    logger?.debug(
      'LlmAdapterInitializer: Attempting to initialize ConfigurableLLMAdapter...'
    );

    if (!this.#adapterExists(adapter, logger)) return false;
    if (!this.#adapterHasInit(adapter, logger)) return false;

    const initStatus = this.#isAdapterInitialized(adapter, logger);
    if (typeof initStatus === 'boolean') {
      return initStatus;
    }

    return this.#loadLlmConfigs(adapter, configLoader, logger);
  }

  /**
   * Validates presence of the adapter.
   *
   * @private
   * @param {*} adapter - The adapter instance.
   * @param {ILogger} logger - Logger for error output.
   * @returns {boolean} Whether the adapter exists.
   */
  #adapterExists(adapter, logger) {
    if (!adapter) {
      logger?.error(
        'InitializationService: No ILLMAdapter provided. Skipping initialization.'
      );
      return false;
    }
    return true;
  }

  /**
   * Ensures the adapter exposes an init method.
   *
   * @private
   * @param {*} adapter - The adapter instance.
   * @param {ILogger} logger - Logger for error output.
   * @returns {boolean} Whether the adapter has a valid init method.
   */
  #adapterHasInit(adapter, logger) {
    if (typeof adapter?.init !== 'function') {
      logger?.error(
        'InitializationService: ILLMAdapter missing required init() method.'
      );
      return false;
    }
    return true;
  }

  /**
   * Checks if the adapter is already initialized and operational.
   *
   * @private
   * @param {*} adapter - The adapter instance.
   * @param {ILogger} logger - Logger for debug and warning output.
   * @returns {boolean|undefined} True if initialized (and operational), false if
   *   initialized but not operational, otherwise undefined.
   */
  #isAdapterInitialized(adapter, logger) {
    if (
      typeof adapter.isInitialized === 'function' &&
      adapter.isInitialized()
    ) {
      if (typeof adapter.isOperational === 'function') {
        if (!adapter.isOperational()) {
          logger?.warn(
            'InitializationService: ConfigurableLLMAdapter already initialized but not operational.'
          );
          return false;
        }
        logger?.debug(
          'InitializationService: ConfigurableLLMAdapter already initialized. Skipping.'
        );
        return true;
      }

      logger?.debug(
        'InitializationService: ConfigurableLLMAdapter already initialized (no operational check available).'
      );
      return true;
    }

    return undefined;
  }

  /**
   * Loads LLM configuration and invokes the adapter's init method.
   *
   * @private
   * @async
   * @param {*} adapter - The adapter instance.
   * @param {LlmConfigLoader} configLoader - Configuration loader.
   * @param {ILogger} logger - Logger for debug and error output.
   * @returns {Promise<boolean>} True if initialization succeeded and adapter is
   *   operational, otherwise false.
   */
  async #loadLlmConfigs(adapter, configLoader, logger) {
    if (!configLoader || typeof configLoader.loadConfigs !== 'function') {
      logger?.error(
        'InitializationService: LlmConfigLoader missing or invalid. Cannot initialize adapter.'
      );
      return false;
    }

    logger?.debug(
      'InitializationService: LlmConfigLoader resolved from container for adapter initialization.'
    );

    try {
      await adapter.init({ llmConfigLoader: configLoader });

      if (typeof adapter.isOperational === 'function') {
        if (adapter.isOperational()) {
          logger?.debug(
            'InitializationService: ConfigurableLLMAdapter initialized successfully and is operational.'
          );
          return true;
        }

        logger?.warn(
          'InitializationService: ConfigurableLLMAdapter.init() completed but the adapter is not operational. Check adapter-specific logs (e.g., LlmConfigLoader errors).'
        );
        return false;
      }

      logger?.debug(
        'InitializationService: ConfigurableLLMAdapter initialized (no operational check available).'
      );
      return true;
    } catch (adapterInitError) {
      logger?.error(
        `InitializationService: CRITICAL error during ConfigurableLLMAdapter.init(): ${adapterInitError.message}`,
        {
          errorName: adapterInitError.name,
          errorStack: adapterInitError.stack,
          errorObj: adapterInitError,
        }
      );
      return false;
    }
  }
}

export default LlmAdapterInitializer;
