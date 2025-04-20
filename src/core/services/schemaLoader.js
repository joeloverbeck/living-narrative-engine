// src/core/services/schemaLoader.js

/**
 * @fileoverview Defines the SchemaLoader class, responsible for loading
 * and compiling JSON schemas using injected core services.
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
 * and compilation of JSON schemas required by the application.
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
        // AC: Constructor accepts IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, ILogger.
        if (!configuration || typeof configuration.getSchemaFiles !== 'function' || typeof configuration.getManifestSchemaId !== 'function' || typeof configuration.getContentTypeSchemaId !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'configuration' dependency (IConfiguration).");
        }
        if (!pathResolver || typeof pathResolver.resolveSchemaPath !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'pathResolver' dependency (IPathResolver).");
        }
        if (!fetcher || typeof fetcher.fetch !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'fetcher' dependency (IDataFetcher).");
        }
        if (!validator || typeof validator.addSchema !== 'function' || typeof validator.isSchemaLoaded !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'validator' dependency (ISchemaValidator).");
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error("SchemaLoader: Missing or invalid 'logger' dependency (ILogger).");
        }

        // AC: Constructor stores injected services internally.
        this.#config = configuration;
        this.#resolver = pathResolver;
        this.#fetcher = fetcher;
        this.#validator = validator;
        this.#logger = logger;

        this.#logger.info("SchemaLoader: Instance created and services injected.");
    }

    /**
     * Loads and compiles all JSON schemas listed in the configuration using the
     * injected services (PathResolver, DataFetcher, SchemaValidator).
     * Ensures essential schemas required for subsequent loading steps are available.
     * Skips reloading if essential schemas (like the manifest schema) are already present
     * in the validator.
     *
     * @returns {Promise<void>} Resolves when all schemas are successfully loaded and added
     * to the validator, rejects if a critical error occurs during loading or validation
     * of essential schemas.
     * @throws {Error} If fetching or schema compilation fails for any schema, or if
     * essential schemas are missing after the process.
     */
    async loadAndCompileAllSchemas() {
        // AC: Uses IConfiguration.getSchemaFiles to get the list of schema filenames.
        const schemaFiles = this.#config.getSchemaFiles();

        if (!schemaFiles || schemaFiles.length === 0) {
            this.#logger.warn("SchemaLoader: No schema files listed in configuration. Skipping schema loading.");
            return;
        }

        const manifestSchemaId = this.#config.getManifestSchemaId(); // Use manifest schema as a key indicator

        // Check if essential schemas seem loaded to avoid redundant work
        // AC: Checks if essential schemas (e.g., manifest) are already loaded using ISchemaValidator.isSchemaLoaded.
        // Note: This assumes if manifest schema is loaded, others likely are too from a previous run.
        // A more robust check could verify *all* essential schemas listed below.
        if (manifestSchemaId && this.#validator.isSchemaLoaded(manifestSchemaId)) {
            // AC: Skips loading if essential schemas are already present.
            this.#logger.info("SchemaLoader: Essential schemas appear to be already loaded in validator. Skipping reload.");
            return; // Assume schemas are loaded if the manifest one is present
        } else if (manifestSchemaId && !this.#validator.isSchemaLoaded(manifestSchemaId)) {
            this.#logger.info(`SchemaLoader: Validator missing essential schema '${manifestSchemaId}'. Proceeding with full schema load.`);
        } else if (!manifestSchemaId) {
            this.#logger.warn(`SchemaLoader: Manifest Schema ID not configured. Proceeding with schema load, but manifest validation might fail later.`);
        }


        this.#logger.info(`SchemaLoader: Loading ${schemaFiles.length} schemas listed in configuration...`);
        let loadedSchemaCount = 0;
        // AC: Iterates through the list of schema filenames.
        const schemaPromises = schemaFiles.map(async (filename) => {
            // AC: Uses IPathResolver.resolveSchemaPath for each filename.
            const path = this.#resolver.resolveSchemaPath(filename);
            let schemaId = null; // Define schemaId here for use in catch block
            try {
                // AC: Uses IDataFetcher.fetch to load the schema file content.
                const schemaData = await this.#fetcher.fetch(path);
                schemaId = schemaData?.$id; // AC: Extracts the '$id' property from the loaded schema data.

                if (!schemaId) {
                    // AC: Logs an error and throws if '$id' is missing.
                    this.#logger.error(`SchemaLoader: Schema file ${filename} (at ${path}) is missing required '$id' property.`);
                    throw new Error(`Schema file ${filename} (at ${path}) is missing required '$id' property.`);
                }

                // Add schema only if it's not already loaded in the validator instance
                // AC: Checks if the schema is already loaded using validator.isSchemaLoaded before adding.
                if (!this.#validator.isSchemaLoaded(schemaId)) {
                    // AC: Uses ISchemaValidator.addSchema to add the schema data and ID.
                    await this.#validator.addSchema(schemaData, schemaId);
                    // this.#logger.debug(`SchemaLoader: Added schema '${schemaId}' from ${filename}.`); // Optional: More verbose logging
                    loadedSchemaCount++;
                } else {
                    this.#logger.debug(`SchemaLoader: Schema '${schemaId}' from ${filename} already loaded. Skipping addition.`); // Optional
                }

            } catch (error) {
                // AC: Logs errors during fetch or adding schema via validator.addSchema.
                this.#logger.error(`SchemaLoader: Failed to load or process schema ${filename} (ID: ${schemaId || 'unknown'}, Path: ${path})`, error);
                // Rethrow to ensure Promise.all rejects if any schema fails
                throw new Error(`Failed processing schema ${filename}: ${error.message}`);
            }
        });

        // Wait for all schema loading attempts to complete
        try {
            // AC: Uses Promise.all to wait for all schema loading operations.
            await Promise.all(schemaPromises);
            this.#logger.info(`SchemaLoader: Schema loading process complete. Added ${loadedSchemaCount} new schemas to the validator.`);
        } catch (error) {
            // An error was already logged by the failing promise, just re-throw
            // AC: Re-throws an error if any schema loading promise rejects.
            this.#logger.error(`SchemaLoader: One or more schemas failed to load. Aborting further data loading.`, error);
            throw error; // Propagate the error to the caller (WorldLoader)
        }


        // --- Verification: Ensure essential schemas are now loaded ---
        // AC: After loading, verifies that all essential schemas are now loaded.
        const requiredSchemaIds = [
            this.#config.getManifestSchemaId(),
            this.#config.getContentTypeSchemaId('events'),
            this.#config.getContentTypeSchemaId('actions'),
            this.#config.getContentTypeSchemaId('entities'),
            this.#config.getContentTypeSchemaId('items'),
            this.#config.getContentTypeSchemaId('locations'),
            this.#config.getContentTypeSchemaId('connections'),
            this.#config.getContentTypeSchemaId('triggers')
            // Add other *critical* schema types if needed (e.g., actions, quests?)
            // Depends on what subsequent loaders strictly require
        ].filter(id => !!id); // Filter out any potentially undefined IDs from config

        let allEssentialLoaded = true;
        this.#logger.info("SchemaLoader: Verifying essential schemas availability...");
        for (const id of requiredSchemaIds) {
            if (!this.#validator.isSchemaLoaded(id)) {
                // AC: Logs an error for each missing essential schema.
                this.#logger.error(`SchemaLoader: CRITICAL - Essential schema ${id} failed to load or compile. Content loading cannot proceed reliably.`);
                allEssentialLoaded = false;
                // Don't throw immediately, log all missing ones first
            } else {
                this.#logger.debug(`SchemaLoader: Essential schema ${id} confirmed available.`);
            }
        }

        if (!allEssentialLoaded) {
            // AC: Throws an error if any essential schema verification fails.
            throw new Error(`SchemaLoader: One or more prerequisite schemas are not available in the validator after loading attempt. Check logs.`);
        }

        this.#logger.info("SchemaLoader: Essential schemas confirmed available in validator.");
        // AC: Resolves the promise if all schemas load and essential ones are verified.
    }
}

// AC: schemaLoader.js exists and exports the SchemaLoader class.
export default SchemaLoader;