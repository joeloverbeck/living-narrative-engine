// src/core/services/genericContentLoader.js

/**
 * @fileoverview Defines the GenericContentLoader class, responsible for loading,
 * validating, and storing various types of content definition files based on
 * the world manifest.
 */

// --- Import Interfaces (for JSDoc/Type Hinting) ---
/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 */

/**
 * Handles the generic loading process for content files (like actions, items, entities):
 * fetch -> parse -> validate (schema & conditional) -> store.
 * Uses injected services for configuration, path resolution, fetching, validation, and storage.
 */
class GenericContentLoader {
    /** @private @type {IConfiguration} */
    #config;
    /** @private @type {IPathResolver} */
    #resolver;
    /** @private @type {IDataFetcher} */
    #fetcher;
    /** @private @type {ISchemaValidator} */
    #validator;
    /** @private @type {IDataRegistry} */
    #registry;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Constructs a GenericContentLoader instance.
     *
     * @param {IConfiguration} configuration - Service to provide configuration values (schema IDs).
     * @param {IPathResolver} pathResolver - Service to resolve content filenames to paths.
     * @param {IDataFetcher} fetcher - Service to fetch raw content data.
     * @param {ISchemaValidator} validator - Service for schema validation.
     * @param {IDataRegistry} registry - Service to store loaded data.
     * @param {ILogger} logger - Service for logging messages.
     * @throws {Error} If any required dependency is not provided or invalid.
     */
    constructor(configuration, pathResolver, fetcher, validator, registry, logger) {
        // AC: Constructor accepts all specified service interfaces as parameters & validates them
        if (!configuration || typeof configuration.getContentTypeSchemaId !== 'function') {
            throw new Error("GenericContentLoader: Missing or invalid 'configuration' dependency (IConfiguration).");
        }
        if (!pathResolver || typeof pathResolver.resolveContentPath !== 'function') {
            throw new Error("GenericContentLoader: Missing or invalid 'pathResolver' dependency (IPathResolver).");
        }
        if (!fetcher || typeof fetcher.fetch !== 'function') {
            throw new Error("GenericContentLoader: Missing or invalid 'fetcher' dependency (IDataFetcher).");
        }
        if (!validator || typeof validator.getValidator !== 'function' || typeof validator.isSchemaLoaded !== 'function') {
            throw new Error("GenericContentLoader: Missing or invalid 'validator' dependency (ISchemaValidator).");
        }
        if (!registry || typeof registry.store !== 'function' || typeof registry.get !== 'function') {
            throw new Error("GenericContentLoader: Missing or invalid 'registry' dependency (IDataRegistry).");
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
            throw new Error("GenericContentLoader: Missing or invalid 'logger' dependency (ILogger).");
        }

        // AC: Constructor assigns injected services to internal properties.
        this.#config = configuration;
        this.#resolver = pathResolver;
        this.#fetcher = fetcher;
        this.#validator = validator;
        this.#registry = registry;
        this.#logger = logger;

        this.#logger.info("GenericContentLoader: Instance created and services injected.");
    }

    /**
     * Loads, validates, and stores all content files for a specific type name.
     * Orchestrates the fetch -> parse -> validate -> store workflow for a list of files.
     *
     * @param {string} typeName - The type of content being loaded (e.g., 'actions', 'items', 'triggers').
     * @param {string[]} filenames - An array of filenames for this content type (from the manifest).
     * @returns {Promise<void>} Resolves when all files for this type are processed, or rejects on the first critical error for this type.
     * @throws {Error} If setup fails (e.g., schema not found) or if any file processing fails critically.
     */
    async loadContentFiles(typeName, filenames) {
        // AC: loadContentFiles logs the start of loading for a type.
        this.#logger.info(`GenericContentLoader: Starting load for content type '${typeName}' (${filenames.length} files)...`);

        if (!typeName || typeof typeName !== 'string') {
            this.#logger.error(`GenericContentLoader: Invalid typeName provided: ${typeName}`);
            throw new Error(`GenericContentLoader: Invalid typeName provided: ${typeName}`);
        }
        if (!Array.isArray(filenames)) {
            this.#logger.error(`GenericContentLoader: Invalid filenames provided for type '${typeName}'. Expected array.`);
            throw new Error(`GenericContentLoader: Invalid filenames provided for type '${typeName}'. Expected array.`);
        }
        if (filenames.length === 0) {
            this.#logger.info(`GenericContentLoader: No files listed for content type '${typeName}'. Skipping.`);
            return; // Nothing to do
        }

        // AC: Schema validation uses IConfiguration to get the schema ID
        const schemaId = this.#config.getContentTypeSchemaId(typeName);
        if (!schemaId) {
            // AC: Logs a warning and skips if no schema ID is configured for the type.
            this.#logger.warn(`GenericContentLoader: No schema ID configured for content type '${typeName}'. Skipping loading for this type.`);
            return; // Cannot validate without a schema ID
        }

        // AC: Schema validation uses ISchemaValidator to get the validator function.
        const validatorFn = this.#validator.getValidator(schemaId);
        if (!validatorFn) {
            // AC: Throws an error if the validator function cannot be retrieved.
            // This should ideally not happen if WorldLoader ensures schemas are loaded first, but check defensively.
            const errorMsg = `GenericContentLoader: Schema validator function not found for schema ID '${schemaId}' (required for type '${typeName}'). Ensure schema was loaded correctly. Skipping loading for this type.`;
            this.#logger.error(errorMsg);
            throw new Error(`Validator function unavailable for schema '${schemaId}' (type '${typeName}')`);
        }

        // Process files in parallel for efficiency within a type
        // AC: Processes each filename provided in the array.
        const filePromises = filenames.map(filename => this.#loadAndProcessFile(typeName, filename, schemaId, validatorFn));

        try {
            // Wait for all files of this type to be processed.
            // Promise.all will reject immediately if any file promise rejects.
            await Promise.all(filePromises);
            // AC: Logs successful completion for the content type.
            this.#logger.info(`GenericContentLoader: Successfully finished loading content type '${typeName}'.`);
        } catch (error) {
            // AC: Errors during processing are logged gracefully.
            // Error is already logged in #loadAndProcessFile, but log the overall failure for the type.
            this.#logger.error(`GenericContentLoader: Failed to load one or more files for content type '${typeName}'. See previous errors for details.`, error);
            // Re-throw to signal failure to WorldLoader for this type.
            throw error;
        }
    }

    /**
     * Loads and processes a single content file.
     * Helper method for loadContentFiles.
     * @private
     * @param {string} typeName - The type of content.
     * @param {string} filename - The filename to process.
     * @param {string} schemaId - The schema ID to validate against.
     * @param {(data: any) => ValidationResult} validatorFn - The schema validation function.
     * @returns {Promise<void>} Resolves on success, rejects on failure for this file.
     */
    async #loadAndProcessFile(typeName, filename, schemaId, validatorFn) {
        let path = ''; // Declare path here to be available in catch block
        try {
            // --- 1. Resolve Path ---
            // AC: Uses IPathResolver to get the full path for each file.
            if (/[\\/]/.test(filename)) {
                this.#logger.warn(`GenericContentLoader: Filename '${filename}' for type '${typeName}' contains path separators. Ensure filenames in manifest are just the base filename.`);
                // Proceed anyway, assuming resolver handles it, but warn.
            }
            path = this.#resolver.resolveContentPath(typeName, filename);
            this.#logger.debug(`GenericContentLoader: Processing file: ${path}`);

            // --- 2. Fetch Data ---
            // AC: Uses IDataFetcher to fetch the content of each file.
            // AC: Implements the core fetch, parse, schema validate logic.
            const data = await this.#fetcher.fetch(path); // Assumes fetcher parses JSON

            // --- 3. Validate Schema ---
            // AC: Uses the retrieved validator function to validate the fetched data.
            const validationResult = validatorFn(data);
            if (!validationResult.isValid) {
                // AC: Logs an error and throws if schema validation fails.
                const errorDetails = JSON.stringify(validationResult.errors, null, 2);
                this.#logger.error(`Schema validation failed for ${path} (type ${typeName}) using schema ${schemaId}:\n${errorDetails}`);
                throw new Error(`Schema validation failed for ${typeName} file '${filename}'.`);
            }

            // Add other conditional validations here if needed for other types

            // --- 5. Extract ID ---
            const dataId = data?.id;
            if (!dataId || typeof dataId !== 'string' || dataId.trim() === '') {
                // AC: Throws an error if the validated data lacks a valid 'id' property.
                this.#logger.error(`Data in ${path} (type ${typeName}) is missing a valid required 'id' property.`);
                throw new Error(`Data in ${path} (type ${typeName}) is missing a valid required 'id' property.`);
            }

            // --- 6. Check for Duplicates ---
            // AC: Duplicate ID detection logs a warning before overwriting data.
            const existing = this.#registry.get(typeName, dataId);
            if (existing) {
                this.#logger.warn(`GenericContentLoader: Duplicate ID detected for ${typeName}: '${dataId}' in file ${filename} (${path}). Overwriting previous definition stored in registry.`);
            }

            // --- 6.5 Register Nested Payload Schema (for Events) ---
            if (typeName === 'events' && data.payloadSchema && typeof data.payloadSchema === 'object') {
                const payloadSchemaObject = data.payloadSchema;
                const payloadSchemaId = `${dataId}#payload`; // e.g., "event:display_message#payload"

                // Only add if not already present (optional, addSchema might handle duplicates)
                if (!this.#validator.isSchemaLoaded(payloadSchemaId)) {
                    this.#logger.debug(`GenericContentLoader: Registering nested payload schema with ID: ${payloadSchemaId}`);
                    try {
                        // Use the main validator instance to add this specific schema part
                        await this.#validator.addSchema(payloadSchemaObject, payloadSchemaId);
                        this.#logger.debug(`GenericContentLoader: Successfully added payload schema ${payloadSchemaId}`);
                    } catch (addSchemaError) {
                        // Log severely, as this could break runtime validation
                        this.#logger.error(`GenericContentLoader: CRITICAL - Failed to add payload schema ${payloadSchemaId} for event ${dataId}:`, addSchemaError);
                        // Decide if this should be a fatal error for the file/type
                        throw new Error(`Failed to register payload schema ${payloadSchemaId} for event ${dataId}: ${addSchemaError.message}`);
                    }
                } else {
                    this.#logger.debug(`GenericContentLoader: Payload schema ${payloadSchemaId} already loaded. Skipping addition.`);
                }
            }

            // --- 7. Store Data ---
            // AC: Successfully loaded and validated content data...is stored in the IDataRegistry
            // AC: Uses IDataRegistry to store the validated data using typeName and data.id.
            this.#registry.store(typeName, dataId, data);
            this.#logger.debug(`GenericContentLoader: Stored ${typeName} with ID '${dataId}' from ${path}.`);

        } catch (error) {
            // AC: Errors during path resolution, fetch, parse, validation...are logged gracefully
            // AC: Throws an error to halt processing for the type if a file fails critically.
            this.#logger.error(`GenericContentLoader: Failed to load/process file ${filename} (type ${typeName}, path: ${path || 'unknown'})`, error);
            // Re-throw the error to cause Promise.all in the caller to reject.
            // Ensure the message includes context.
            throw new Error(`Error processing ${typeName} file ${filename} at path ${path || 'unknown'}: ${error.message}`);
        }
    }
}

// AC: genericContentLoader.js exists and exports the GenericContentLoader class.
export default GenericContentLoader;