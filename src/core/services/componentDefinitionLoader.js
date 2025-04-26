// src/core/services/componentDefinitionLoader.js

/**
 * @fileoverview Defines the ComponentDefinitionLoader class, responsible for
 * orchestrating the loading of component definition files, validating their
 * structure, and preparing them for schema registration.
 */

// --- Import Interfaces (for JSDoc/Type Hinting) ---
/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry // Kept for potential future use (metadata storage)
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 */

/**
 * Orchestrates the loading and validation of component definition files (*.component.json).
 * It validates the structure of these definitions against the master
 * component-definition schema. Successfully validated definitions are collected
 * and their data schemas are registered with the ISchemaValidator. It also optionally
 * stores the full definition metadata in the IDataRegistry.
 *
 * This class acts as a key part of the data-driven component system setup.
 */
class ComponentDefinitionLoader {
    /** @private @type {IConfiguration} */
    #config;
    /** @private @type {IPathResolver} */
    #resolver;
    /** @private @type {IDataFetcher} */
    #fetcher;
    /** @private @type {ISchemaValidator} */
    #validator;
    /** @private @type {IDataRegistry} */
    #registry; // Keep for potential metadata storage later
    /** @private @type {ILogger} */
    #logger;

    /**
     * @private
     * @type {object[] | null}
     * @description Temporarily stores successfully loaded and validated definitions during processing.
     * Nullified after processing finishes or on error.
     */
    #validatedDefinitions = null;

    /**
     * Constructs a ComponentDefinitionLoader instance.
     *
     * @param {IConfiguration} configuration - Service to provide config values (e.g., component definition path, schema ID).
     * @param {IPathResolver} pathResolver - Service to resolve component definition filenames to full paths.
     * @param {IDataFetcher} fetcher - Service to fetch raw component definition data.
     * @param {ISchemaValidator} validator - Service for validating definitions and registering their data schemas.
     * @param {IDataRegistry} registry - Service to potentially store component definition metadata.
     * @param {ILogger} logger - Service for logging messages.
     * @throws {Error} If any required dependency is not provided or appears invalid based on essential methods check.
     */
    constructor(configuration, pathResolver, fetcher, validator, registry, logger) {
        // Validate dependencies
        if (!configuration || typeof configuration.getContentBasePath !== 'function' || typeof configuration.getContentTypeSchemaId !== 'function') {
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'configuration' dependency (IConfiguration). Requires getContentBasePath and getContentTypeSchemaId methods.");
        }
        if (!pathResolver || typeof pathResolver.resolveContentPath !== 'function') {
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'pathResolver' dependency (IPathResolver). Requires resolveContentPath method.");
        }
        if (!fetcher || typeof fetcher.fetch !== 'function') {
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'fetcher' dependency (IDataFetcher). Requires fetch method.");
        }
        if (!validator || typeof validator.addSchema !== 'function' || typeof validator.isSchemaLoaded !== 'function' || typeof validator.getValidator !== 'function') { // Added getValidator check
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'validator' dependency (ISchemaValidator). Requires addSchema, isSchemaLoaded, and getValidator methods.");
        }
        if (!registry || typeof registry.store !== 'function') {
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'registry' dependency (IDataRegistry). Requires store method.");
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.debug !== 'function') { // Added debug check
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'logger' dependency (ILogger). Requires info, error, warn, and debug methods.");
        }

        // Store injected services
        this.#config = configuration;
        this.#resolver = pathResolver;
        this.#fetcher = fetcher;
        this.#validator = validator;
        this.#registry = registry;
        this.#logger = logger;

        this.#logger.info('ComponentDefinitionLoader: Instance created and services injected.');
    }

    /**
     * Loads component definition files: discovers filenames, fetches content for each,
     * validates content against the component definition schema, extracts the nested
     * dataSchema from valid definitions, registers these data schemas with the
     * ISchemaValidator, and optionally stores the definition metadata in the IDataRegistry.
     * Rejects if any file fails to load or validate, if essential setup (like the
     * component definition schema) is missing, or if schema registration fails.
     *
     * @returns {Promise<void>} Resolves when all files are processed successfully and schemas registered,
     * rejects on the first critical error.
     * @throws {Error} If configuration is invalid, essential schemas/validators are missing,
     * any file processing fails, or schema registration fails.
     */
    async loadComponentDefinitions() {
        this.#logger.info('ComponentDefinitionLoader: Starting component definition loading based on manifest...');
        this.#validatedDefinitions = null;

        let componentFilenames = [];

        try {
            // --- 1. Get Files from Loaded Manifest ---
            const manifest = this.#registry.getManifest(); // Get the manifest loaded by WorldLoader
            if (!manifest) {
                throw new Error('ComponentDefinitionLoader: World manifest not found in registry. Ensure it was loaded before attempting to load components.');
            }
            if (!manifest.contentFiles || !Array.isArray(manifest.contentFiles.components)) {
                this.#logger.warn(`ComponentDefinitionLoader: World manifest for '${manifest.worldName}' does not contain a 'contentFiles.components' array. Assuming no world-specific components needed.`);
                componentFilenames = []; // Treat as empty list
            } else {
                componentFilenames = manifest.contentFiles.components;
            }
            this.#logger.info(`ComponentDefinitionLoader: Found ${componentFilenames.length} component definition filenames listed in the manifest.`);
            // --- End Manifest Reading ---

            if (componentFilenames.length === 0) {
                this.#logger.info('ComponentDefinitionLoader: No component definition files listed in manifest. Nothing to load or register for this world.');
                return;
            }
            this.#logger.debug('ComponentDefinitionLoader: Files to process:', componentFilenames);


            // --- 2. Get Schema and Validator for the *Definition* files ---
            const definitionSchemaId = this.#config.getContentTypeSchemaId('components');
            if (!definitionSchemaId) {
                this.#logger.error("ComponentDefinitionLoader: Schema ID for 'components' not found in configuration.");
                throw new Error('Component definition schema ID is not configured.');
            }
            if (!this.#validator.isSchemaLoaded(definitionSchemaId)) {
                this.#logger.error(`ComponentDefinitionLoader: CRITICAL - Component definition schema ('${definitionSchemaId}') is not loaded in the validator. Cannot proceed.`);
                throw new Error(`Required component definition schema ('${definitionSchemaId}') not loaded.`);
            }
            const definitionValidatorFn = this.#validator.getValidator(definitionSchemaId);
            if (!definitionValidatorFn) {
                this.#logger.error(`ComponentDefinitionLoader: CRITICAL - Could not retrieve validator function for schema '${definitionSchemaId}'.`);
                throw new Error(`Validator function unavailable for schema '${definitionSchemaId}'.`);
            }
            this.#logger.debug(`ComponentDefinitionLoader: Using schema '${definitionSchemaId}' for validating definition file structure.`);


            // --- 3. Load and Validate Definition Files ---
            const validatedDefinitionsInternal = []; // Use a local variable during processing
            const processingPromises = componentFilenames.map(filename =>
                this.#loadAndValidateDefinition(filename, definitionValidatorFn)
                    .then(definitionData => {
                        if (definitionData) { // Ensure helper returned data
                            validatedDefinitionsInternal.push(definitionData);
                        }
                    })
            );

            // Wait for all validation promises to complete.
            await Promise.all(processingPromises);

            // Store the collected definitions temporarily
            this.#validatedDefinitions = validatedDefinitionsInternal;
            this.#logger.info(`ComponentDefinitionLoader: Successfully validated ${this.#validatedDefinitions.length} component definitions.`);


            // --- 4. Register Nested Data Schemas & Store Metadata ---
            // <<< MODIFIED for Ticket 2.1.6 and 2.1.7 START >>>
            this.#logger.info(`ComponentDefinitionLoader: Starting registration of ${this.#validatedDefinitions.length} component data schemas and metadata storage...`);
            let processedCount = 0;

            // AC: Iterate through each successfully validated definitionData object
            for (const definitionData of this.#validatedDefinitions) {
                let componentId = 'unknown'; // For error reporting if extraction fails
                try {
                    // AC: Extract and Validate `id`
                    componentId = definitionData.id; // Extract ID first for logging context
                    if (!componentId || typeof componentId !== 'string' || componentId.trim() === '') {
                        // Basic validation, regex pattern check could be added if needed but schema should cover it
                        throw new Error('Invalid or missing \'id\' property in validated definition data. Expected non-empty string.');
                    }

                    // AC: Extract and Validate `dataSchema`
                    const dataSchema = definitionData.dataSchema;
                    if (!dataSchema || typeof dataSchema !== 'object') { // Null is an object, check explicitly? schema requires object.
                        throw new Error(`Invalid or missing 'dataSchema' property for component '${componentId}'. Expected a non-null object.`);
                    }
                    if (dataSchema === null) {
                        // This case should ideally be caught by the definition schema validation, but double-check
                        throw new Error(`Invalid 'dataSchema' property for component '${componentId}'. Must be an object, received null.`);
                    }


                    // AC: Call await this.#validator.addSchema(dataSchema, id). (Ticket 2.1.6)
                    // AC: Handle Registration Errors (try...catch implicitly handles this)
                    await this.#validator.addSchema(dataSchema, componentId);

                    // AC: Log success for schema registration using this.#logger.debug (Ticket 2.1.6)
                    this.#logger.debug(`ComponentDefinitionLoader: Successfully registered data schema for component '${componentId}'.`);

                    // --- TICKET 2.1.7 Implementation START ---
                    // AC: Call this.#registry.store(...) (Ticket 2.1.7)
                    this.#registry.store('component_definitions', definitionData.id, definitionData);

                    // AC: Log the storage action using this.#logger.debug (Ticket 2.1.7)
                    this.#logger.debug(`ComponentDefinitionLoader: Stored definition metadata for component '${definitionData.id}'.`);
                    // --- TICKET 2.1.7 Implementation END ---

                    processedCount++;

                } catch (error) {
                    // AC: If addSchema throws an error: Log a critical error... Throw an error to halt... (Ticket 2.1.6)
                    // Also covers errors during registry storage or logging (Ticket 2.1.7)
                    this.#logger.error(`ComponentDefinitionLoader: CRITICAL - Failed during post-validation processing for component '${componentId}'. Reason: ${error.message}`, error);
                    // Throw error to halt the entire loadComponentDefinitions process
                    throw new Error(`Failed during post-validation processing for component '${componentId}'. Halting load.`);
                }
            }

            // AC: After successfully iterating... log a final success message using this.#logger.info. (Ticket 2.1.6)
            this.#logger.info(`ComponentDefinitionLoader: Successfully processed (registered schema, stored metadata) for ${processedCount} component definitions.`);
            // <<< MODIFIED for Ticket 2.1.6 and 2.1.7 END >>>


        } catch (error) {
            this.#logger.error('ComponentDefinitionLoader: Critical error during component definition loading/validation, schema registration, or metadata storage.', error);
            throw error;
        } finally {
            this.#validatedDefinitions = null;
        }
    }

    /**
     * Loads, validates, and returns the content of a single component definition file.
     * Helper method for loadComponentDefinitions.
     * @private
     * @param {string} filename - The filename to process.
     * @param {(data: any) => ValidationResult} validatorFn - The schema validation function for component definitions.
     * @returns {Promise<object>} Resolves with the validated definition data object on success.
     * @throws {Error} Rejects with an error if path resolution, fetching, or validation fails.
     */
    async #loadAndValidateDefinition(filename, validatorFn) {
        let path = 'unknown'; // Default path for error logging if resolution fails
        try {
            // Resolve the full path
            this.#logger.debug(`ComponentDefinitionLoader: Processing file: ${filename}...`);
            path = this.#resolver.resolveModContentPath('core', 'components', filename);
            this.#logger.debug(`ComponentDefinitionLoader: Resolved mod path for ${filename}: ${path}`);

            // Fetch, validate, etc. (unchanged)
            const definitionData = await this.#fetcher.fetch(path);
            this.#logger.debug(`ComponentDefinitionLoader: Fetched content for ${path}`);

            // Validate the fetched definitionData
            const validationResult = validatorFn(definitionData);

            if (!validationResult.isValid) {
                const errorDetails = JSON.stringify(validationResult.errors, null, 2);
                this.#logger.error(`ComponentDefinitionLoader: Schema validation failed for ${filename} at path ${path}. Errors:\n${errorDetails}`);
                throw new Error(`Schema validation failed for component definition file '${filename}'.`);
            }

            // Log debug logs for processing each file and success logs upon successful validation.
            this.#logger.debug(`ComponentDefinitionLoader: Successfully validated ${filename} from ${path}.`);

            // Return the validated data for collection
            return definitionData;

        } catch (error) {
            // Log adding context if it's a generic error
            const errorMessage = `ComponentDefinitionLoader: Failed to load/validate component definition ${filename} (Path: ${path}). Reason: ${error.message}`;
            this.#logger.error(errorMessage, error); // Log original error too if available

            // Re-throw a new error with context to ensure Promise.all rejects clearly
            throw new Error(errorMessage);
        }
    }

    /**
     * Provides access to the definitions that were successfully loaded and validated
     * during the last call to `loadComponentDefinitions`.
     * NOTE: This method is now less relevant as registration/storage happens within loadComponentDefinitions.
     * Kept temporarily for potential debugging, but the primary consumer logic is now integrated.
     *
     * @deprecated Use is now internal to loadComponentDefinitions.
     * @returns {object[] | null} An array of validated component definition objects stored
     * during processing, or null if called outside processing or after an error.
     */
    getValidatedDefinitions() {
        this.#logger.warn('ComponentDefinitionLoader: getValidatedDefinitions() is deprecated as processing now happens internally. Accessing temporary state.');
        return this.#validatedDefinitions;
    }

}

// Export the class
export default ComponentDefinitionLoader;