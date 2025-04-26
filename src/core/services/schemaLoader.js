// src/core/services/schemaLoader.js

/**
 * @fileoverview Defines the SchemaLoader class, responsible for loading
 * and compiling JSON schemas listed in the configuration using injected core services.
 */

// --- Import Interfaces (for JSDoc/Type Hinting) ---
/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Handles the loading, validation against meta-schemas (implicitly by ISchemaValidator),
 * and compilation of JSON schemas specified in the application's configuration.
 * It focuses solely on processing the schemas listed in the configuration's `schemaFiles`.
 */
class SchemaLoader {
    /** @private @type {IConfiguration} */
    #config;
    /** @private @type {IPathResolver} */
    #resolver;
    /** @private @type {IDataFetcher} */
    #fetcher;
    /** @private @type {ISchemaValidator} */
    #validator;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Constructs a SchemaLoader instance.
     *
     * @param {IConfiguration} configuration - Service to provide configuration values (schema paths, filenames).
     * @param {IPathResolver} pathResolver - Service to resolve abstract paths to fetchable paths.
     * @param {IDataFetcher} fetcher - Service to fetch raw schema data.
     * @param {ISchemaValidator} validator - Service to add and compile schemas.
     * @param {ILogger} logger - Service for logging messages.
     * @throws {Error} If any required dependency is not provided or invalid.
     */
    constructor(configuration, pathResolver, fetcher, validator, logger) {
        // Basic validation
        // --- MODIFIED LINE: Removed check for getManifestSchemaId ---
        // --- MODIFIED LINE: Updated error message ---
        if (!configuration || typeof configuration.getSchemaFiles !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'configuration' dependency (IConfiguration - requires getSchemaFiles).");
        }
        // --- NOTE: pathResolver needs resolveSchemaPath, fetcher needs fetch, validator needs addSchema/isSchemaLoaded ---
        // These checks correctly reflect the methods used within this class.
        if (!pathResolver || typeof pathResolver.resolveSchemaPath !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'pathResolver' dependency (IPathResolver - requires resolveSchemaPath).");
        }
        if (!fetcher || typeof fetcher.fetch !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'fetcher' dependency (IDataFetcher - requires fetch).");
        }
        if (!validator || typeof validator.addSchema !== 'function' || typeof validator.isSchemaLoaded !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'validator' dependency (ISchemaValidator - requires addSchema, isSchemaLoaded).");
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'logger' dependency (ILogger - requires info, error, debug).");
        }

        this.#config = configuration;
        this.#resolver = pathResolver;
        this.#fetcher = fetcher;
        this.#validator = validator;
        this.#logger = logger;

        // --- Changed log level from info to debug for instance creation ---
        this.#logger.debug('SchemaLoader: Instance created and services injected.');
    }

    /**
     * Loads and adds a single schema file to the validator if it's not already loaded.
     * Handles path resolution, data fetching, $id extraction/validation, and error logging.
     * @private
     *
     * @param {string} filename - The name of the schema file to process (e.g., 'common.schema.json').
     * @returns {Promise<boolean>} Resolves with `true` if the schema was newly added to the validator,
     * `false` if the schema was already loaded and skipped.
     * Rejects if an error occurs during fetching, validation, or adding the schema.
     * @throws {Error} If fetching fails, the schema is missing '$id', or adding to the validator fails.
     * The error will be logged and re-thrown.
     */
    async #loadAndAddSingleSchema(filename) {
        // --- Uses resolveSchemaPath from IPathResolver ---
        const path = this.#resolver.resolveSchemaPath(filename);
        let schemaId = null; // Keep track of ID for error reporting

        try {
            // --- Uses fetch from IDataFetcher ---
            const schemaData = await this.#fetcher.fetch(path);
            schemaId = schemaData?.$id; // Extract the schema ID

            // Validate that the schema has an ID
            if (!schemaId) {
                const errMsg = `Schema file ${filename} (at ${path}) is missing required '$id' property.`;
                this.#logger.error(`SchemaLoader: ${errMsg}`);
                throw new Error(errMsg);
            }

            // --- Uses isSchemaLoaded from ISchemaValidator ---
            if (!this.#validator.isSchemaLoaded(schemaId)) {
                // --- Uses addSchema from ISchemaValidator ---
                await this.#validator.addSchema(schemaData, schemaId);
                // Successfully added
                return true;
            } else {
                this.#logger.debug(`SchemaLoader: Schema '${schemaId}' from ${filename} already loaded. Skipping addition.`);
                // Skipped (successfully processed, but not added)
                return false;
            }

        } catch (error) {
            this.#logger.error(`SchemaLoader: Failed to load or process schema ${filename} (ID: ${schemaId || 'unknown'}, Path: ${path})`, error);
            throw error;
        }
    }

    /**
     * Loads and compiles all JSON schemas listed in the configuration's `schemaFiles`
     * using the injected services (PathResolver, DataFetcher, SchemaValidator).
     * It delegates the processing of each file to the #loadAndAddSingleSchema helper method.
     *
     * @returns {Promise<void>} Resolves when all configured schemas are successfully processed
     * (either loaded and added or skipped if already present), rejects if a critical error
     * occurs during fetching or adding any schema listed in the configuration.
     * @throws {Error} If processing fails for any schema during the main processing loop.
     */
    async loadAndCompileAllSchemas() {
        // --- Uses getSchemaFiles from IConfiguration ---
        const schemaFiles = this.#config.getSchemaFiles();

        if (!schemaFiles || schemaFiles.length === 0) {
            this.#logger.warn('SchemaLoader: No schema files listed in configuration. Skipping schema loading.');
            return; // Exit if no schemas are configured
        }

        this.#logger.info(`SchemaLoader: Processing ${schemaFiles.length} schemas listed in configuration...`);

        const schemaPromises = schemaFiles.map(filename => this.#loadAndAddSingleSchema(filename));

        try {
            const results = await Promise.all(schemaPromises);
            const loadedSchemaCount = results.filter(result => result === true).length;
            this.#logger.info(`SchemaLoader: Schema processing complete. Added ${loadedSchemaCount} new schemas to the validator (others may have been skipped).`);
        } catch (error) {
            this.#logger.error('SchemaLoader: One or more configured schemas failed to load or process. Aborting.', error);
            throw error;
        }
    }
}

export default SchemaLoader;