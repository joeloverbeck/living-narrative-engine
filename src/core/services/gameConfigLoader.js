// src/core/services/gameConfigLoader.js

// --- Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */ // <<< ADDED
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */ // <<< ADDED

/** @typedef {import('../../../data/schemas/game.schema.json')} GameConfig */ // Assuming this type exists

/**
 * Service responsible for locating, fetching, validating, and parsing the game configuration file (e.g., game.json).
 * After validation, it returns the list of mod IDs.
 */
class GameConfigLoader {
    /** @private @type {IConfiguration} */
    #configuration;
    /** @private @type {IPathResolver} */
    #pathResolver;
    /** @private @type {IDataFetcher} */
    #dataFetcher;
    /** @private @type {ISchemaValidator} */ // <<< ADDED
    #schemaValidator;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates a new GameConfigLoader instance.
     * @param {object} dependencies
     * @param {IConfiguration} dependencies.configuration - Configuration service.
     * @param {IPathResolver} dependencies.pathResolver - Path resolution service.
     * @param {IDataFetcher} dependencies.dataFetcher - Data fetching service.
     * @param {ISchemaValidator} dependencies.schemaValidator - Schema validation service. // <<< ADDED
     * @param {ILogger} dependencies.logger - Logging service.
     * @throws {Error} If any required dependency is not provided or invalid.
     */
    constructor({configuration, pathResolver, dataFetcher, schemaValidator, logger}) { // <<< UPDATED dependencies
        // AC: Dependency Validation
        if (!configuration || typeof configuration.getGameConfigFilename !== 'function' || typeof configuration.getContentTypeSchemaId !== 'function') { // <<< Added getContentTypeSchemaId check
            throw new Error('GameConfigLoader requires a valid IConfiguration instance with getGameConfigFilename and getContentTypeSchemaId.');
        }
        if (!pathResolver || typeof pathResolver.resolveGameConfigPath !== 'function') {
            throw new Error('GameConfigLoader requires a valid IPathResolver instance with resolveGameConfigPath.');
        }
        if (!dataFetcher || typeof dataFetcher.fetch !== 'function') {
            throw new Error('GameConfigLoader requires a valid IDataFetcher instance with fetch.');
        }
        // AC: The GameConfigLoader constructor dependency list is updated to include ISchemaValidator, and it's validated/stored.
        if (!schemaValidator || typeof schemaValidator.isSchemaLoaded !== 'function' || typeof schemaValidator.getValidator !== 'function') { // <<< ADDED Validator Check
            throw new Error('GameConfigLoader requires a valid ISchemaValidator instance with isSchemaLoaded and getValidator.');
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') { // <<< Added debug check
            throw new Error('GameConfigLoader requires a valid ILogger instance.');
        }

        this.#configuration = configuration;
        this.#pathResolver = pathResolver;
        this.#dataFetcher = dataFetcher;
        this.#schemaValidator = schemaValidator; // <<< ADDED Assignment
        this.#logger = logger;

        this.#logger.info('GameConfigLoader: Instance created.');
    }

    /**
     * Loads, parses, and validates the game configuration file (e.g., game.json).
     * If validation is successful, returns the array of mod IDs specified in the config.
     *
     * @returns {Promise<string[] | null>} A promise that resolves with the array of mod IDs if loading, parsing,
     * and validation succeed, or null if any step fails.
     * @public
     * @async
     */
    async loadConfig() {
        let configPath = '';
        try {
            // 1. Locate and Fetch Config
            configPath = this.#pathResolver.resolveGameConfigPath();
            this.#logger.info(`GameConfigLoader: Attempting to load game config from ${configPath}...`);
            const rawContent = await this.#dataFetcher.fetch(configPath);

            if (typeof rawContent !== 'string' || rawContent.trim() === '') {
                this.#logger.error(`GameConfigLoader: Fetched content from ${configPath} is not a valid non-empty string.`);
                return null;
            }

            // 2. Parse JSON
            // Type assertion for clarity, assuming GameConfig type matches the expected structure
            const parsedConfig = /** @type {GameConfig} */ (JSON.parse(rawContent));
            this.#logger.info(`GameConfigLoader: Successfully loaded and parsed game config from ${configPath}.`);

            // --- 3. Schema Validation ---

            // AC: The loadConfig method, after successfully parsing the JSON data, retrieves the schema ID for game.json
            const schemaId = this.#configuration.getContentTypeSchemaId('game'); // <<< Assumes 'game' is the type name for game.json
            if (!schemaId) {
                this.#logger.error("GameConfigLoader: CRITICAL - Schema ID for 'game' configuration type not found in IConfiguration.");
                throw new Error("Schema ID for 'game' configuration type not configured.");
            }
            this.#logger.debug(`GameConfigLoader: Using schema ID '${schemaId}' for validation.`);

            // AC: The method checks if the game.schema.json schema is loaded in the ISchemaValidator using isSchemaLoaded(schemaId).
            if (!this.#schemaValidator.isSchemaLoaded(schemaId)) {
                // AC: If not, it logs a critical error and throws, halting the process.
                this.#logger.error(`GameConfigLoader: CRITICAL - Game config schema ('${schemaId}') is not loaded in the validator. Ensure SchemaLoader ran first and 'game.schema.json' is configured.`);
                throw new Error(`Required game config schema ('${schemaId}') not loaded.`);
            }

            // AC: The method retrieves the validator function using ISchemaValidator.getValidator(schemaId).
            const validatorFn = this.#schemaValidator.getValidator(schemaId);
            if (!validatorFn) {
                // AC: If undefined, it logs a critical error and throws.
                this.#logger.error(`GameConfigLoader: CRITICAL - Could not retrieve validator function for game config schema '${schemaId}'. Schema might be invalid or compilation failed.`);
                throw new Error(`Validator function unavailable for game config schema '${schemaId}'.`);
            }

            // AC: The method calls the validator function with the parsed game.json data.
            this.#logger.debug(`GameConfigLoader: Validating parsed config against schema '${schemaId}'...`);
            const validationResult = validatorFn(parsedConfig);

            // AC: The method checks validationResult.isValid.
            if (validationResult.isValid) {
                // AC: If validation passes (isValid is true), the loadConfig method proceeds to return the validated data (specifically, the mods array from the data).
                this.#logger.info(`GameConfigLoader: Game config validation successful against schema '${schemaId}'.`);
                // Return only the 'mods' array as required
                if (!Array.isArray(parsedConfig.mods)) {
                    this.#logger.error(`GameConfigLoader: Validated game config is missing the 'mods' array property.`);
                    throw new Error("Validated game config is missing the 'mods' array.");
                }
                // Ensure all elements in mods are strings (basic check)
                if (!parsedConfig.mods.every(mod => typeof mod === 'string')) {
                    this.#logger.error(`GameConfigLoader: Validated game config 'mods' array contains non-string elements.`);
                    throw new Error("Validated game config 'mods' array contains non-string elements.");
                }
                return parsedConfig.mods; // <<< Return validated mods array
            } else {
                // AC: If validation fails (isValid is false), the method does not return the data yet... it can log the failure...
                const errorDetails = JSON.stringify(validationResult.errors, null, 2);
                this.#logger.error(`GameConfigLoader: Game config validation FAILED against schema '${schemaId}'. Errors:\n${errorDetails}`);
                // AC: ... (error handling is in the next ticket). For now, ... return null on failure.
                return null; // Return null on validation failure as per interpretation of "does not return the data yet"
            }

        } catch (error) {
            this.#logger.error(`GameConfigLoader: Failed to load, parse, or validate game config from ${configPath}. Error: ${error.message}`, error);
            return null; // Return null on any exception
        }
    }
}

export default GameConfigLoader;