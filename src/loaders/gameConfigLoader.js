// src/loaders/gameConfigLoader.js

// --- Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */ // <<< ADDED
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */ // <<< ADDED
/** @typedef {import('ajv').ErrorObject} AjvErrorObject */ // For formatting errors

/** @typedef {import('../../data/schemas/game.schema.json')} GameConfig */ // Assuming this type exists

import { CORE_MOD_ID } from '../constants/core';
import AbstractLoader from './abstractLoader.js';
import { formatAjvErrors } from '../utils/ajvUtils.js';
import { validateAgainstSchema } from '../utils/schemaValidationUtils.js';

/**
 * Service responsible for locating, fetching, validating, and parsing the game configuration file (e.g., game.json).
 * After validation, it ensures CORE_MOD_ID is the first mod and returns the list of mod IDs.
 */
class GameConfigLoader extends AbstractLoader {
  #configuration;
  #pathResolver;
  #dataFetcher;
  #schemaValidator;
  #logger;

  /**
   * Creates a new GameConfigLoader instance.
   *
   * @param {object} dependencies
   * @param {IConfiguration} dependencies.configuration - Configuration service.
   * @param {IPathResolver} dependencies.pathResolver - Path resolution service.
   * @param {IDataFetcher} dependencies.dataFetcher - Data fetching service.
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validation service.
   * @param {ILogger} dependencies.logger - Logging service.
   * @throws {Error} If any required dependency is not provided or invalid.
   */
  constructor({
    configuration,
    pathResolver,
    dataFetcher,
    schemaValidator,
    logger,
  }) {
    super(logger, [
      {
        dependency: configuration,
        name: 'IConfiguration',
        methods: ['getGameConfigFilename', 'getContentTypeSchemaId'],
      },
      {
        dependency: pathResolver,
        name: 'IPathResolver',
        methods: ['resolveGameConfigPath'],
      },
      {
        dependency: dataFetcher,
        name: 'IDataFetcher',
        methods: ['fetch'],
      },
      {
        dependency: schemaValidator,
        name: 'ISchemaValidator',
        methods: ['isSchemaLoaded', 'getValidator'],
      },
    ]);

    this.#configuration = configuration;
    this.#pathResolver = pathResolver;
    this.#dataFetcher = dataFetcher;
    this.#schemaValidator = schemaValidator;
    this.#logger = this._logger;
  }

  /**
   * Fetches and parses the game configuration file.
   *
   * @private
   * @returns {Promise<{path: string, filename: string, config: any}>}
   */
  async #fetchConfig() {
    const path = this.#pathResolver.resolveGameConfigPath();
    const filename = this.#configuration.getGameConfigFilename();
    this.#logger.debug(
      `GameConfigLoader: Attempting to load game config '${filename}' from ${path}...`
    );
    try {
      const config = await this.#dataFetcher.fetch(path);
      this.#logger.debug(
        `GameConfigLoader: Raw content fetched successfully from ${path}.`
      );
      return { path, filename, config };
    } catch (fetchError) {
      this.#logger.error(
        `FATAL: Game configuration file '${filename}' not found or could not be fetched at ${path}. Details: ${fetchError.message}`,
        fetchError
      );
      throw new Error(
        `Failed to fetch game configuration '${filename}' from ${path}: ${fetchError.message}`
      );
    }
  }

  /**
   * Validates the parsed configuration object and extracts the mods list.
   *
   * @private
   * @param {any} configData - Parsed configuration data.
   * @param {string} path - Source file path.
   * @param {string} filename - Source file name.
   * @returns {string[]} Array of mod IDs.
   */
  #validateConfig(configData, path, filename) {
    const schemaId = this.#configuration.getContentTypeSchemaId('game');
    if (!schemaId) {
      this.#logger.error(
        "FATAL: Schema ID for 'game' configuration type not found in IConfiguration."
      );
      throw new Error(
        'Schema ID for \u2018game\u2019 configuration type not configured.'
      );
    }
    this.#logger.debug(
      `GameConfigLoader: Using schema ID '${schemaId}' for validation.`
    );
    validateAgainstSchema(
      this.#schemaValidator,
      schemaId,
      configData,
      this.#logger,
      {
        validationDebugMessage: `GameConfigLoader: Validating parsed config against schema '${schemaId}'...`,
        notLoadedMessage: `FATAL: Game config schema ('${schemaId}') is not loaded in the validator. Ensure SchemaLoader ran first and '${filename}.schema.json' is configured.`,
        notLoadedLogLevel: 'error',
        notLoadedThrowMessage: `Required game config schema ('${schemaId}') not loaded.`,
        noValidatorMessage: `FATAL: Could not retrieve validator function for game config schema '${schemaId}'. Schema might be invalid or compilation failed.`,
        noValidatorThrowMessage: `Validator function unavailable for game config schema '${schemaId}'.`,
        failureMessage: (errors) => {
          const formattedErrors = formatAjvErrors(errors);
          return `FATAL: Game configuration file '${filename}' failed schema validation. Path: ${path}. Schema ID: '${schemaId}'. Errors: ${formattedErrors}`;
        },
        failureThrowMessage: `Game configuration validation failed for '${filename}'.`,
        appendErrorDetails: false,
      }
    );

    this.#logger.debug(
      `GameConfigLoader: Game config '${filename}' validation successful against schema '${schemaId}'.`
    );

    if (!configData || !Array.isArray(configData.mods)) {
      this.#logger.error(
        `FATAL: Validated game config '${filename}' is missing the required 'mods' array property or has incorrect type. Path: ${path}.`
      );
      throw new Error(
        `Validated game config '${filename}' is missing the required 'mods' array.`
      );
    }
    if (!configData.mods.every((m) => typeof m === 'string')) {
      this.#logger.error(
        `FATAL: Validated game config '${filename}' 'mods' array contains non-string elements. Path: ${path}.`
      );
      throw new Error(
        `Validated game config '${filename}' 'mods' array contains non-string elements.`
      );
    }
    return [...configData.mods];
  }

  /**
   * Ensures {@link CORE_MOD_ID} is first in the mods list.
   *
   * @private
   * @param {string[]} modList - Array of mod IDs.
   * @returns {string[]} Updated list with CORE_MOD_ID first.
   */
  #ensureCoreModFirst(modList) {
    if (!modList.length || modList[0] !== CORE_MOD_ID) {
      if (modList.includes(CORE_MOD_ID)) {
        modList = modList.filter((id) => id !== CORE_MOD_ID);
        modList.unshift(CORE_MOD_ID);
        this.#logger.debug(
          'GameConfigLoader: CORE_MOD_ID mod found but was not first; moved to the beginning of the load order.'
        );
      } else {
        modList.unshift(CORE_MOD_ID);
        this.#logger.debug(
          'GameConfigLoader: Auto-injected CORE_MOD_ID mod at the beginning of the load order.'
        );
      }
    } else {
      this.#logger.debug(
        'GameConfigLoader: CORE_MOD_ID mod already present at the beginning of the load order.'
      );
    }
    return modList;
  }

  // --- Testing Utilities ---

  /**
   * Exposes {@link GameConfigLoader.#fetchConfig} for tests.
   *
   * @public
   * @returns {Promise<{path: string, filename: string, config: any}>}
   */
  fetchConfigForTest() {
    return this.#fetchConfig();
  }

  /**
   * Exposes {@link GameConfigLoader.#validateConfig} for tests.
   *
   * @public
   * @param {any} data
   * @param {string} path
   * @param {string} filename
   * @returns {string[]}
   */
  validateConfigForTest(data, path, filename) {
    return this.#validateConfig(data, path, filename);
  }

  /**
   * Exposes {@link GameConfigLoader.#ensureCoreModFirst} for tests.
   *
   * @public
   * @param {string[]} mods
   * @returns {string[]}
   */
  ensureCoreModFirstForTest(mods) {
    return this.#ensureCoreModFirst([...mods]);
  }

  /**
   * Loads, parses, and validates the game configuration file (e.g., game.json).
   * If validation is successful, ensures CORE_MOD_ID is the first mod ID and returns the array of mod IDs.
   * Throws an error if any step fails (file not found, parse error, validation error),
   * halting the loading process.
   *
   * @returns {Promise<string[]>} A promise that resolves with the array of mod IDs (guaranteed to start with CORE_MOD_ID)
   * if loading, parsing, and validation succeed. The promise rejects if any step fails.
   * @public
   * @async
   * @throws {Error} If the dependencyInjection file cannot be found, parsed, or validated.
   */
  async loadConfig() {
    let loadedPath = '';
    try {
      const { path, filename, config } = await this.#fetchConfig();
      loadedPath = path;

      const mods = this.#validateConfig(config, path, filename);
      const finalMods = this.#ensureCoreModFirst(mods);

      this.#logger.debug(
        `GameConfigLoader: Successfully loaded and validated ${finalMods.length} mod IDs from game config. Final order: [${finalMods.join(', ')}]`
      );

      return finalMods;
    } catch (error) {
      if (
        !error.message.startsWith('Failed to fetch') &&
        !error.message.startsWith('Failed to parse') &&
        !error.message.startsWith('Game configuration validation failed')
      ) {
        this.#logger.error(
          `FATAL: An unexpected error occurred during game config loading process for path ${loadedPath || 'unknown'}. Error: ${error.message}`,
          error
        );
      }
      throw error;
    }
  }
}

export default GameConfigLoader;
