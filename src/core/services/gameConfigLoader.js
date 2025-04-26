// src/core/services/gameConfigLoader.js

// --- Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../../../data/schemas/game.schema.json')} GameConfig */

/**
 * Service responsible for locating, fetching, and parsing the game configuration file (e.g., game.json).
 */
class GameConfigLoader {
    /** @private @type {IConfiguration} */
    #configuration;
    /** @private @type {IPathResolver} */
    #pathResolver;
    /** @private @type {IDataFetcher} */
    #dataFetcher;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates a new GameConfigLoader instance.
     * @param {object} dependencies
     * @param {IConfiguration} dependencies.configuration - Configuration service.
     * @param {IPathResolver} dependencies.pathResolver - Path resolution service.
     * @param {IDataFetcher} dependencies.dataFetcher - Data fetching service.
     * @param {ILogger} dependencies.logger - Logging service.
     * @throws {Error} If any required dependency is not provided or invalid.
     */
    constructor({configuration, pathResolver, dataFetcher, logger}) {
        // AC: Dependency Validation
        if (!configuration || typeof configuration.getGameConfigFilename !== 'function') {
            throw new Error('GameConfigLoader requires a valid IConfiguration instance with getGameConfigFilename.');
        }
        if (!pathResolver || typeof pathResolver.resolveGameConfigPath !== 'function') {
            throw new Error('GameConfigLoader requires a valid IPathResolver instance with resolveGameConfigPath.');
        }
        if (!dataFetcher || typeof dataFetcher.fetch !== 'function') {
            throw new Error('GameConfigLoader requires a valid IDataFetcher instance with fetch.');
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error('GameConfigLoader requires a valid ILogger instance.');
        }

        this.#configuration = configuration;
        this.#pathResolver = pathResolver;
        this.#dataFetcher = dataFetcher;
        this.#logger = logger;

        this.#logger.info('GameConfigLoader: Instance created.');
    }

    /**
     * Loads and parses the game configuration file (e.g., game.json).
     * Uses IPathResolver to find the file, IDataFetcher to get its content,
     * and parses the content as JSON.
     *
     * @returns {Promise<GameConfig | null>} A promise that resolves with the parsed game configuration object,
     * or null if loading or parsing fails.
     * @public
     * @async
     */
    async loadConfig() {
        let configPath = '';
        try {
            // AC: Use IPathResolver to determine the full path
            configPath = this.#pathResolver.resolveGameConfigPath();
            this.#logger.info(`GameConfigLoader: Attempting to load game config from ${configPath}...`);

            // AC: Use IDataFetcher.fetch to retrieve raw content
            // Assuming fetch returns a string for JSON files
            const rawContent = await this.#dataFetcher.fetch(configPath);

            if (typeof rawContent !== 'string' || rawContent.trim() === '') {
                this.#logger.error(`GameConfigLoader: Fetched content from ${configPath} is not a valid non-empty string.`);
                return null;
            }

            // AC: Parse fetched content as JSON
            const parsedConfig = JSON.parse(rawContent);

            this.#logger.info(`GameConfigLoader: Successfully loaded and parsed game config from ${configPath}.`);
            // AC: Return parsed JavaScript object
            return parsedConfig;

        } catch (error) {
            // AC: Appropriate informational logs & Handle fetch/parse errors
            this.#logger.error(`GameConfigLoader: Failed to load or parse game config from ${configPath}. Error: ${error.message}`, error);
            // AC: Return null on failure (as decided from implementation notes)
            return null;
        }
    }
}

export default GameConfigLoader;