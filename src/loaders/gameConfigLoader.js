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
import { validateAgainstSchema } from '../utils/schemaValidation.js';

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

    this.#logger.debug('GameConfigLoader: Instance created.');
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
    let configPath = '';
    let parsedConfig = null;

    try {
      // 1. Locate Config Path
      configPath = this.#pathResolver.resolveGameConfigPath();
      const configFilename = this.#configuration.getGameConfigFilename(); // Get filename for logging
      this.#logger.debug(
        `GameConfigLoader: Attempting to load game config '${configFilename}' from ${configPath}...`
      );

      // 2. Fetch Config Content
      try {
        // --- MODIFIED TO EXPECT OBJECT DIRECTLY ---
        parsedConfig = await this.#dataFetcher.fetch(configPath);
        this.#logger.debug(
          `GameConfigLoader: Raw content fetched successfully from ${configPath}.`
        );
        // --- END MODIFICATION ---
      } catch (fetchError) {
        // AC: File Not Found / Fetch Error Handling
        this.#logger.error(
          `FATAL: Game configuration file '${configFilename}' not found or could not be fetched at ${configPath}. Details: ${fetchError.message}`,
          fetchError
        );
        // Re-throw the original error or a new summarizing one
        throw new Error(
          `Failed to fetch game configuration '${configFilename}' from ${configPath}: ${fetchError.message}`
        );
      }

      // --- REMOVED RAW CONTENT CHECK AND JSON PARSE ---
      // Assuming fetcher now returns parsed JSON or throws on invalid JSON

      // 4. Schema Validation
      const schemaId = this.#configuration.getContentTypeSchemaId('game');
      if (!schemaId) {
        this.#logger.error(
          "FATAL: Schema ID for 'game' configuration type not found in IConfiguration."
        );
        throw new Error(
          "Schema ID for 'game' configuration type not configured."
        );
      }
      this.#logger.debug(
        `GameConfigLoader: Using schema ID '${schemaId}' for validation.`
      );

      validateAgainstSchema(
        this.#schemaValidator,
        schemaId,
        parsedConfig,
        this.#logger,
        {
          validationDebugMessage: `GameConfigLoader: Validating parsed config against schema '${schemaId}'...`,
          notLoadedMessage: `FATAL: Game config schema ('${schemaId}') is not loaded in the validator. Ensure SchemaLoader ran first and '${this.#configuration.getGameConfigFilename()}.schema.json' is configured.`,
          notLoadedLogLevel: 'error',
          notLoadedThrowMessage: `Required game config schema ('${schemaId}') not loaded.`,
          noValidatorMessage: `FATAL: Could not retrieve validator function for game config schema '${schemaId}'. Schema might be invalid or compilation failed.`,
          noValidatorThrowMessage: `Validator function unavailable for game config schema '${schemaId}'.`,
          failureMessage: (errors) => {
            const formattedErrors = formatAjvErrors(errors);
            return `FATAL: Game configuration file '${configFilename}' failed schema validation. Path: ${configPath}. Schema ID: '${schemaId}'. Errors: ${formattedErrors}`;
          },
          failureThrowMessage: `Game configuration validation failed for '${configFilename}'.`,
          appendErrorDetails: false,
        }
      );

      // 5. Validation Success - Check 'mods' array
      this.#logger.debug(
        `GameConfigLoader: Game config '${configFilename}' validation successful against schema '${schemaId}'.`
      );

      // Final check for 'mods' array existence and type after successful validation
      if (!parsedConfig || !Array.isArray(parsedConfig.mods)) {
        this.#logger.error(
          `FATAL: Validated game config '${configFilename}' is missing the required 'mods' array property or has incorrect type. Path: ${configPath}.`
        );
        throw new Error(
          `Validated game config '${configFilename}' is missing the required 'mods' array.`
        );
      }
      // Ensure all elements in mods are strings (basic check, schema should enforce this more strictly)
      if (!parsedConfig.mods.every((mod) => typeof mod === 'string')) {
        this.#logger.error(
          `FATAL: Validated game config '${configFilename}' 'mods' array contains non-string elements. Path: ${configPath}.`
        );
        throw new Error(
          `Validated game config '${configFilename}' 'mods' array contains non-string elements.`
        );
      }

      // --- START: MODLOADER-XXX IMPLEMENTATION ---
      // Ensure CORE_MOD_ID mod is always first in the list
      if (!parsedConfig.mods.length || parsedConfig.mods[0] !== CORE_MOD_ID) {
        if (parsedConfig.mods.includes(CORE_MOD_ID)) {
          // If Core exists but not first, remove it and prepend
          parsedConfig.mods = parsedConfig.mods.filter(
            (modId) => modId !== CORE_MOD_ID
          );
          parsedConfig.mods.unshift(CORE_MOD_ID);
          this.#logger.debug(
            `GameConfigLoader: CORE_MOD_ID mod found but was not first; moved to the beginning of the load order.`
          );
        } else {
          // If Core is missing entirely, prepend it
          parsedConfig.mods.unshift(CORE_MOD_ID);
          this.#logger.debug(
            `GameConfigLoader: Auto-injected CORE_MOD_ID mod at the beginning of the load order.`
          );
        }
      } else {
        this.#logger.debug(
          `GameConfigLoader: CORE_MOD_ID mod already present at the beginning of the load order.`
        );
      }
      // --- END: MODLOADER-XXX IMPLEMENTATION ---

      this.#logger.debug(
        `GameConfigLoader: Successfully loaded and validated ${parsedConfig.mods.length} mod IDs from game config. Final order: [${parsedConfig.mods.join(', ')}]`
      );
      return parsedConfig.mods; // Return the validated (and potentially modified) mods array
    } catch (error) {
      // AC: Halting - Ensure any error caught up to this point propagates
      // Log a general fatal error message if it wasn't caught by more specific handlers above
      if (
        !error.message.startsWith('Failed to fetch') &&
        !error.message.startsWith('Failed to parse') &&
        !error.message.startsWith('Game configuration validation failed')
      ) {
        // Avoid redundant logging if already logged by specific handlers
        this.#logger.error(
          `FATAL: An unexpected error occurred during game config loading process for path ${configPath || 'unknown'}. Error: ${error.message}`,
          error
        );
      }
      // Re-throw the caught error to halt the process
      throw error;
    }
  }
}

export default GameConfigLoader;
