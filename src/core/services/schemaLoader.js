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
    if (!configuration || typeof configuration.getSchemaFiles !== 'function' || typeof configuration.getManifestSchemaId !== 'function') {
      throw new Error("SchemaLoader: Missing or invalid 'configuration' dependency (IConfiguration - requires getSchemaFiles, getManifestSchemaId).");
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
    if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') { // Added debug check
      throw new Error("SchemaLoader: Missing or invalid 'logger' dependency (ILogger - requires info, error, debug).");
    }

    this.#config = configuration;
    this.#resolver = pathResolver;
    this.#fetcher = fetcher;
    this.#validator = validator;
    this.#logger = logger;

    this.#logger.info('SchemaLoader: Instance created and services injected.');
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
    const path = this.#resolver.resolveSchemaPath(filename);
    let schemaId = null; // Keep track of ID for error reporting

    try {
      // Fetch the raw schema data
      const schemaData = await this.#fetcher.fetch(path);
      schemaId = schemaData?.$id; // Extract the schema ID

      // Validate that the schema has an ID
      if (!schemaId) {
        const errMsg = `Schema file ${filename} (at ${path}) is missing required '$id' property.`;
        this.#logger.error(`SchemaLoader: ${errMsg}`);
        throw new Error(errMsg);
      }

      // Check if this specific schema is already loaded in the validator
      if (!this.#validator.isSchemaLoaded(schemaId)) {
        // If not loaded, add it to the validator
        await this.#validator.addSchema(schemaData, schemaId);
        // Successfully added
        return true;
      } else {
        // If already loaded, log a debug message and skip adding it again
        this.#logger.debug(`SchemaLoader: Schema '${schemaId}' from ${filename} already loaded. Skipping addition.`);
        // Skipped (successfully processed, but not added)
        return false;
      }

    } catch (error) {
      // Catch errors during fetch, $id check, or addSchema for this specific file
      this.#logger.error(`SchemaLoader: Failed to load or process schema ${filename} (ID: ${schemaId || 'unknown'}, Path: ${path})`, error);
      // Re-throw the original error to cause Promise.all to reject
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
    const schemaFiles = this.#config.getSchemaFiles();

    if (!schemaFiles || schemaFiles.length === 0) {
      this.#logger.warn('SchemaLoader: No schema files listed in configuration. Skipping schema loading.');
      return; // Exit if no schemas are configured
    }

    this.#logger.info(`SchemaLoader: Processing ${schemaFiles.length} schemas listed in configuration...`);

    // Process each schema file listed in the configuration using the helper method
    // This map now returns an array of Promises, each resolving to true (added) or false (skipped), or rejecting.
    const schemaPromises = schemaFiles.map(filename => this.#loadAndAddSingleSchema(filename));

    try {
      // Wait for all schema processing promises to settle
      // Promise.all will reject immediately if any promise in schemaPromises rejects.
      // If successful, 'results' will be an array of booleans [true, false, true, ...]
      const results = await Promise.all(schemaPromises);

      // Calculate how many schemas were actually added (where the result was true)
      const loadedSchemaCount = results.filter(result => result === true).length;

      // Log success summary only if all promises resolved
      this.#logger.info(`SchemaLoader: Schema processing complete. Added ${loadedSchemaCount} new schemas to the validator (others may have been skipped).`);
    } catch (error) {
      // Catch any error re-thrown from the #loadAndAddSingleSchema helper method
      // Promise.all rejects immediately on the first error
      this.#logger.error('SchemaLoader: One or more configured schemas failed to load or process. Aborting.', error);
      // Re-throw the error to the caller of loadAndCompileAllSchemas
      throw error; // No need to wrap, the original error is already descriptive
    }
  }
}

export default SchemaLoader;