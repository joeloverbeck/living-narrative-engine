//src/core/services/manifestLoader.js

/**
 * @fileoverview Defines the ManifestLoader class, responsible for loading
 * and validating a world's manifest file using injected core services.
 */

// --- Import Interfaces (for JSDoc/Type Hinting) ---
/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 */

/**
 * Handles the loading and validation of a specific world's manifest file.
 * It uses injected services to perform its tasks, ensuring separation of concerns.
 */
class ManifestLoader {
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
     * Constructs a ManifestLoader instance.
     *
     * @param {IConfiguration} configuration - Service to provide configuration values (e.g., manifest schema ID).
     * @param {IPathResolver} pathResolver - Service to resolve the world name to a manifest file path.
     * @param {IDataFetcher} fetcher - Service to fetch the raw manifest data.
     * @param {ISchemaValidator} validator - Service to validate the manifest data against its schema.
     * @param {ILogger} logger - Service for logging messages.
     * @throws {Error} If any required dependency is not provided or invalid.
     */
  constructor(configuration, pathResolver, fetcher, validator, logger) {
    // Basic validation
    if (!configuration || typeof configuration.getManifestSchemaId !== 'function') {
      throw new Error("ManifestLoader: Missing or invalid 'configuration' dependency (IConfiguration).");
    }
    if (!pathResolver || typeof pathResolver.resolveManifestPath !== 'function') {
      throw new Error("ManifestLoader: Missing or invalid 'pathResolver' dependency (IPathResolver).");
    }
    if (!fetcher || typeof fetcher.fetch !== 'function') {
      throw new Error("ManifestLoader: Missing or invalid 'fetcher' dependency (IDataFetcher).");
    }
    if (!validator || typeof validator.getValidator !== 'function' || typeof validator.isSchemaLoaded !== 'function') {
      throw new Error("ManifestLoader: Missing or invalid 'validator' dependency (ISchemaValidator).");
    }
    if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
      throw new Error("ManifestLoader: Missing or invalid 'logger' dependency (ILogger).");
    }

    this.#config = configuration;
    this.#resolver = pathResolver;
    this.#fetcher = fetcher;
    this.#validator = validator;
    this.#logger = logger;

    this.#logger.info('ManifestLoader: Instance created and services injected.');
  }

  /**
     * Loads the manifest file for the specified world, validates it against the
     * configured schema, and returns the validated data object.
     * Throws an error if fetching or validation fails.
     *
     * @param {string} worldName - The name of the world (e.g., 'demo') to load the manifest for.
     * @returns {Promise<object>} A Promise resolving with the validated manifest data object.
     * @throws {Error} If worldName is invalid, path resolution, fetching, schema lookup, or schema validation fails.
     */
  async loadAndValidateManifest(worldName) {
    if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
      throw new Error('ManifestLoader: Invalid or empty worldName provided.');
    }

    const manifestPath = this.#resolver.resolveManifestPath(worldName);
    const manifestSchemaId = this.#config.getManifestSchemaId();

    if (!manifestSchemaId) {
      throw new Error('ManifestLoader: Manifest schema ID is not configured. Cannot validate manifest.');
    }

    // Prerequisite Check: Ensure the schema is loaded in the validator
    if (!this.#validator.isSchemaLoaded(manifestSchemaId)) {
      const errorMsg = `ManifestLoader: Prerequisite manifest schema ('${manifestSchemaId}') not loaded in validator. Cannot validate manifest for world '${worldName}'. Ensure SchemaLoader ran successfully first.`;
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.#logger.info(`ManifestLoader: Loading manifest for world '${worldName}' from ${manifestPath} using schema ${manifestSchemaId}...`);

    try {
      // 1. Fetch Data
      const manifestData = await this.#fetcher.fetch(manifestPath);

      // 2. Get Validator Function
      const validatorFn = this.#validator.getValidator(manifestSchemaId);
      // This check is slightly redundant due to isSchemaLoaded check above, but provides defense-in-depth
      if (!validatorFn) {
        throw new Error(`ManifestLoader: Could not retrieve validator function for schema ${manifestSchemaId}, even though it was reported as loaded.`);
      }

      // 3. Validate Data
      const validationResult = validatorFn(manifestData);

      // 4. Check Result & Return/Throw
      if (!validationResult.isValid) {
        const errorDetails = JSON.stringify(validationResult.errors, null, 2);
        this.#logger.error(`ManifestLoader: Schema validation failed for ${manifestPath} using schema ${manifestSchemaId}:\n${errorDetails}`);
        throw new Error(`Schema validation failed for world manifest '${worldName}'. See console for details.`);
      }

      // --- Post-Validation Checks (Optional but recommended) ---
      // Example: Check for essential top-level properties if needed by later steps
      if (!manifestData.contentFiles || typeof manifestData.contentFiles !== 'object') {
        this.#logger.error(`ManifestLoader: Validated manifest for world '${worldName}' is missing the required 'contentFiles' object.`);
        throw new Error(`Manifest for world '${worldName}' is missing the required 'contentFiles' object.`);
      }
      // Add checks for startingLocationId, startingPlayerId etc. if they are critical *before* content loading

      this.#logger.info(`ManifestLoader: Manifest for world '${worldName}' loaded and validated successfully.`);
      // Add worldName to the manifest object itself for convenience later? Optional.
      // manifestData.worldName = worldName; // Consider implications before adding.

      return manifestData; // Return the validated data

    } catch (error) {
      this.#logger.error(`ManifestLoader: Failed to load or validate manifest ${manifestPath}`, error);
      // Re-throw a potentially more specific error to the caller (WorldLoader)
      throw new Error(`Error processing world manifest for '${worldName}': ${error.message}`);
    }
  }
}

export default ManifestLoader;