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
 * fetch -> parse -> validate (schema & runtime component data) -> store.
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
     * @param {ISchemaValidator} validator - Service for schema validation (primary and runtime component).
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
        // Updated check to include 'validate' needed for runtime component validation
        if (!validator || typeof validator.getValidator !== 'function' || typeof validator.isSchemaLoaded !== 'function' || typeof validator.validate !== 'function') {
            throw new Error("GenericContentLoader: Missing or invalid 'validator' dependency (ISchemaValidator - requires getValidator, isSchemaLoaded, validate).");
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

        this.#logger.info('GenericContentLoader: Instance created and services injected.');
    }

    /**
     * Loads, validates, and stores all content files for a specific type name.
     * Orchestrates the fetch -> parse -> validate (schema + runtime) -> store workflow for a list of files.
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
            this.#logger.error(`GenericContentLoader: Failed to load one or more files for content type '${typeName}'. See previous errors for details.`, error);
            // Re-throw to signal failure to WorldLoader for this type.
            throw error;
        }
    }

    /**
     * Loads and processes a single content file, including runtime component validation.
     * Helper method for loadContentFiles.
     * @private
     * @param {string} typeName - The type of content (e.g., 'entities', 'items').
     * @param {string} filename - The filename to process.
     * @param {string} schemaId - The primary schema ID to validate the overall file structure against.
     * @param {(data: any) => ValidationResult} validatorFn - The primary schema validation function.
     * @returns {Promise<void>} Resolves on success (both validations pass, stored), rejects on failure for this file.
     */
    async #loadAndProcessFile(typeName, filename, schemaId, validatorFn) {
        let path = '';
        // **** ADD TEMPORARY LOG ****
        console.log(`>>> #loadAndProcessFile entered for: ${filename}`);
        try {
            // --- 1. Resolve Path ---
            if (/[\\/]/.test(filename)) {
                this.#logger.warn(`GenericContentLoader: Filename '${filename}' for type '${typeName}' contains path separators. Ensure filenames in manifest are just the base filename.`);
            }
            path = this.#resolver.resolveModContentPath('core', typeName, filename);
            this.#logger.debug(`GenericContentLoader: Processing file: ${path}`);

            // --- 2. Fetch Data ---
            // **** ADD TEMPORARY LOG ****
            console.log(`>>> Fetching path: ${path}`);
            const data = await this.#fetcher.fetch(path); // Assumes fetcher parses JSON

            // --- 3. Primary Schema Validation ---
            // AC: Validation Trigger (after fetch, before registry storage)
            const primaryValidationResult = validatorFn(data);
            if (!primaryValidationResult.isValid) {
                const errorDetails = JSON.stringify(primaryValidationResult.errors, null, 2);
                this.#logger.error(`Primary schema validation failed for ${path} (type ${typeName}) using schema ${schemaId}:\n${errorDetails}`);
                throw new Error(`Primary schema validation failed for ${typeName} file '${filename}'.`);
            }
            this.#logger.debug(`GenericContentLoader: Primary schema validation passed for ${path}.`);

            // --- 4. Runtime Component Data Validation (Refined Ticket 2.2) ---
            // AC: Target Service (within #loadAndProcessFile)
            // Check if the data has a 'components' map. This applies mainly to entity types.
            // Assumes entity types ('entities', 'items', 'locations', etc.) use the schema defining the 'components' map.
            // Other types (actions, events) might not have this map.
            if (data && typeof data.components === 'object' && data.components !== null) {
                // AC: Component Iteration
                this.#logger.debug(`GenericContentLoader: Performing runtime component validation for ${path}.`);
                let allComponentsValid = true;
                const componentEntries = Object.entries(data.components);

                if (componentEntries.length > 0) {
                    for (const [componentId, componentData] of componentEntries) {
                        // AC: Runtime Validation Call
                        // Use the injected ISchemaValidator directly via #validator.validate
                        // This expects ComponentDefinitionLoader to have registered the component's dataSchema using its ID [cite: 43]
                        const componentValidationResult = this.#validator.validate(componentId, componentData); // [cite: 43]

                        // AC: Failure Handling
                        if (!componentValidationResult.isValid) {
                            allComponentsValid = false;
                            const errorDetails = JSON.stringify(componentValidationResult.errors, null, 2);
                            // AC: Failure Handling - Log clear error
                            this.#logger.error(`Runtime component data validation failed for entity ${path} (ID: ${data.id || 'N/A'}), component '${componentId}'. Errors:\n${errorDetails}`); // [cite: 108]
                            // No need to throw immediately, check all components first, then throw below if any failed.
                        } else {
                            this.#logger.debug(`   - Component '${componentId}' in ${filename} passed runtime validation.`);
                        }
                    }

                    if (!allComponentsValid) {
                        // AC: Failure Handling - Reject loading process
                        throw new Error(`Runtime component data validation failed for one or more components in ${typeName} file '${filename}'. See logs for details.`); // [cite: 108]
                    }
                    this.#logger.debug(`GenericContentLoader: All runtime component validations passed for ${path}.`);
                } else {
                    this.#logger.debug(`GenericContentLoader: Entity ${path} has an empty 'components' map. Skipping runtime component validation loop.`);
                }
            } else {
                // If there's no 'components' map, skip runtime component validation for this file.
                this.#logger.debug(`GenericContentLoader: File ${path} does not contain a 'components' map. Skipping runtime component validation.`);
            }

            // --- 5. Extract ID (After all validations) ---
            const dataId = data?.id;
            if (!dataId || typeof dataId !== 'string' || dataId.trim() === '') {
                this.#logger.error(`Data in ${path} (type ${typeName}) is missing a valid required 'id' property.`);
                throw new Error(`Data in ${path} (type ${typeName}) is missing a valid required 'id' property.`);
            }

            // --- 6. Check for Duplicates ---
            // **** ADD TEMPORARY LOG ****
            console.log(`>>> Getting from registry for: ${dataId}`);
            const existing = this.#registry.get(typeName, dataId);
            if (existing) {
                this.#logger.warn(`GenericContentLoader: Duplicate ID detected for ${typeName}: '${dataId}' in file ${filename} (${path}). Overwriting previous definition stored in registry.`);
            }

            // --- 6.5 Register Nested Payload Schema (for Events - Unrelated to Ticket 2.2) ---
            // (Keep existing logic for event payload schemas)
            if (typeName === 'events' && data.payloadSchema && typeof data.payloadSchema === 'object') {
                const payloadSchemaObject = data.payloadSchema;
                const payloadSchemaId = `${dataId}#payload`; // e.g., "event:display_message#payload"
                if (!this.#validator.isSchemaLoaded(payloadSchemaId)) {
                    this.#logger.debug(`GenericContentLoader: Registering nested payload schema with ID: ${payloadSchemaId}`);
                    try {
                        await this.#validator.addSchema(payloadSchemaObject, payloadSchemaId);
                        this.#logger.debug(`GenericContentLoader: Successfully added payload schema ${payloadSchemaId}`);
                    } catch (addSchemaError) {
                        this.#logger.error(`GenericContentLoader: CRITICAL - Failed to add payload schema ${payloadSchemaId} for event ${dataId}:`, addSchemaError);
                        throw new Error(`Failed to register payload schema ${payloadSchemaId} for event ${dataId}: ${addSchemaError.message}`);
                    }
                } else {
                    this.#logger.debug(`GenericContentLoader: Payload schema ${payloadSchemaId} already loaded. Skipping addition.`);
                }
            }

            // --- 7. Store Data (Only if ALL validations passed) ---
            // AC: Registry Storage - Only fully validated entities are stored [cite: 109]
            // AC: Success Handling - Reaching this point means all checks passed [cite: 44]
            this.#registry.store(typeName, dataId, data);
            this.#logger.debug(`GenericContentLoader: Stored ${typeName} with ID '${dataId}' from ${path} after passing all validations.`);

        } catch (error) {
            // Errors from path resolution, fetch, parsing, primary schema validation, OR runtime component validation will land here.
            this.#logger.error(`GenericContentLoader: Failed to load/process file ${filename} (type ${typeName}, path: ${path || 'unknown'})`, error);
            // Re-throw the error to cause Promise.all in the caller to reject.
            throw new Error(`Error processing ${typeName} file ${filename} at path ${path || 'unknown'}: ${error.message}`);
        }
    }
}

// AC: genericContentLoader.js exists and exports the GenericContentLoader class.
export default GenericContentLoader;