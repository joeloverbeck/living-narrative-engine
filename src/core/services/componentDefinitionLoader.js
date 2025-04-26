// src/core/services/componentDefinitionLoader.js
// --- (Imports and other class parts remain the same) ---

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
        // (Constructor validation remains unchanged)
        if (!configuration || typeof configuration.getContentBasePath !== 'function' || typeof configuration.getContentTypeSchemaId !== 'function') {
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'configuration' dependency (IConfiguration). Requires getContentBasePath and getContentTypeSchemaId methods.");
        }
        if (!pathResolver || typeof pathResolver.resolveContentPath !== 'function' || typeof pathResolver.resolveModContentPath !== 'function') { // Added resolveModContentPath check
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'pathResolver' dependency (IPathResolver). Requires resolveContentPath and resolveModContentPath methods.");
        }
        if (!fetcher || typeof fetcher.fetch !== 'function') {
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'fetcher' dependency (IDataFetcher). Requires fetch method.");
        }
        // Updated check: added removeSchema
        if (!validator || typeof validator.addSchema !== 'function' || typeof validator.isSchemaLoaded !== 'function' || typeof validator.getValidator !== 'function' || typeof validator.removeSchema !== 'function') {
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'validator' dependency (ISchemaValidator). Requires addSchema, isSchemaLoaded, getValidator, and removeSchema methods.");
        }
        // Added check for 'get' method needed in Sub-Ticket 5
        if (!registry || typeof registry.store !== 'function' || typeof registry.get !== 'function') {
            throw new Error("ComponentDefinitionLoader: Missing or invalid 'registry' dependency (IDataRegistry). Requires store and get methods.");
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
     * Load every `*.component.json` definition file listed in the provided mod manifest.
     * Validates the definitions and registers their nested data schemas.
     *
     * @param {string} modId - The unique identifier of the mod being processed.
     * @param {ModManifest | null | undefined} modManifest - The parsed manifest object for the specified mod.
     * @returns {Promise<number>} A promise that resolves with the number of component definitions successfully loaded and processed for this mod.
     * Does not throw based on individual file failures, but returns the count of successes.
     * @throws {Error} If critical setup errors occur (e.g., configuration issues, schema validator problems).
     */
    async loadComponentDefinitions(modId, modManifest) {
        // --- Sanity Checks (unchanged) ---
        if (typeof modId !== 'string' || !modId.trim()) {
            this.#logger.error('ComponentDefinitionLoader.loadComponentDefinitions: Invalid or empty modId provided.');
            throw new Error('ComponentDefinitionLoader.loadComponentDefinitions: invalid or empty modId provided.');
        }

        this.#logger.info(`ComponentDefinitionLoader: Loading component definitions for mod '${modId}'...`);
        let componentFilenames = [];

        // --- Extract and Validate Component Filenames (unchanged) ---
        if (!modManifest || typeof modManifest !== 'object') {
            this.#logger.warn(`ComponentDefinitionLoader [${modId}]: Invalid or null modManifest provided. Assuming no components to load.`);
            return 0;
        }
        if (!modManifest.content) {
            this.#logger.info(`ComponentDefinitionLoader [${modId}]: Mod manifest does not contain a 'content' section. Assuming no components.`);
            return 0;
        }
        if (!Array.isArray(modManifest.content.components)) {
            if (modManifest.content.components == null) {
                this.#logger.info(`ComponentDefinitionLoader [${modId}]: Mod manifest 'content.components' is null or missing. Assuming no components.`);
            } else {
                this.#logger.warn(`ComponentDefinitionLoader [${modId}]: Mod manifest 'content.components' is not an array (type: ${typeof modManifest.content.components}). Assuming no components.`);
            }
            return 0;
        }

        const rawFilenames = modManifest.content.components;
        componentFilenames = rawFilenames.filter(f => {
            const isValid = typeof f === 'string' && f.trim();
            if (typeof f !== 'string' && f != null) {
                this.#logger.warn(`ComponentDefinitionLoader [${modId}]: Invalid non-string entry found in content.components: ${JSON.stringify(f)}. Skipping.`);
            } else if (typeof f === 'string' && !f.trim()) {
                this.#logger.warn(`ComponentDefinitionLoader [${modId}]: Empty string found in content.components. Skipping.`);
            }
            return isValid;
        });

        this.#logger.info(`ComponentDefinitionLoader [${modId}]: Found ${componentFilenames.length} valid component definition filenames listed in the manifest.`);

        if (componentFilenames.length === 0) {
            this.#logger.info(`ComponentDefinitionLoader [${modId}]: No valid component definition files listed to process after filtering. Finishing for this mod.`);
            return 0;
        }
        this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Valid files to process:`, componentFilenames);

        // --- Variables for Processing Results ---
        let processedCount = 0;
        let failureCount = 0; // Counter for failed files

        try {
            // --- Get Schema and Validator for the *Definition* files (unchanged) ---
            const definitionSchemaId = this.#config.getContentTypeSchemaId('components');
            if (!definitionSchemaId) {
                this.#logger.error(`ComponentDefinitionLoader [${modId}]: Schema ID for 'components' (definition files) not found in configuration.`);
                throw new Error(`Component definition schema ID ('components') is not configured.`);
            }
            if (!this.#validator.isSchemaLoaded(definitionSchemaId)) {
                this.#logger.error(`ComponentDefinitionLoader [${modId}]: CRITICAL - Component definition schema ('${definitionSchemaId}') is not loaded in the validator. Cannot proceed.`);
                throw new Error(`Required component definition schema ('${definitionSchemaId}') not loaded.`);
            }
            const definitionValidatorFn = this.#validator.getValidator(definitionSchemaId);
            if (!definitionValidatorFn) {
                this.#logger.error(`ComponentDefinitionLoader [${modId}]: CRITICAL - Could not retrieve validator function for schema '${definitionSchemaId}'.`);
                throw new Error(`Validator function unavailable for schema '${definitionSchemaId}'.`);
            }
            this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Using schema '${definitionSchemaId}' for validating definition file structure.`);


            // --- Create Processing Promises (unchanged) ---
            this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Mapping ${componentFilenames.length} filenames to processing promises...`);
            const processingPromises = componentFilenames.map(filename =>
                this.#processSingleComponentFile(filename, definitionValidatorFn, modId, definitionSchemaId)
            );


            // --- Wait for Promises to Settle (unchanged) ---
            this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Awaiting concurrent processing of ${processingPromises.length} component files...`);
            const settledResults = await Promise.allSettled(processingPromises);
            this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Concurrent processing finished. Analyzing results...`);


            // --- Process Settled Results ---
            settledResults.forEach((result, index) => {
                const sourceFilename = componentFilenames[index] ?? 'unknown file'; // Use filename from original array
                const sourcePath = result.status === 'rejected' ? result.reason?.resolvedPath : 'unknown path'; // Try to get path from rejection reason if available

                if (result.status === 'fulfilled') {
                    if (result.value != null) {
                        processedCount++;
                        this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Successfully processed component file '${sourceFilename}'. Data ID: ${result.value?.id || 'N/A'}.`);
                    } else {
                        // This case shouldn't happen if #processSingleComponentFile always throws on failure or returns data on success.
                        // However, log a warning just in case.
                        this.#logger.warn(`ComponentDefinitionLoader [${modId}]: Promise for file '${sourceFilename}' fulfilled but returned null/undefined. Treating as failure.`);
                        failureCount++;
                    }
                } else if (result.status === 'rejected') {
                    failureCount++;
                    // *** Updated error logging to include better context from the rejection reason ***
                    const reason = result.reason ?? new Error('Unknown rejection reason');
                    const rejectionDetails = {
                        modId: modId,
                        filename: sourceFilename,
                        resolvedPath: sourcePath, // Use path if available
                        error: reason // Log the actual error object/reason
                    };
                    this.#logger.error(
                        `ComponentDefinitionLoader [${modId}]: Processing failed for component file: ${sourceFilename}. Reason: ${reason?.message || reason}`,
                        rejectionDetails
                    );
                } else {
                    // This is highly unlikely for Promise.allSettled
                    this.#logger.warn(`ComponentDefinitionLoader [${modId}]: Unexpected outcome status '${result.status}' for component file ${sourceFilename} (Promise Index: ${index}). Treating as failure.`);
                    failureCount++;
                }
            });


            // --- Logging Summary (unchanged) ---
            this.#logger.info(`ComponentDefinitionLoader [${modId}]: Completed processing. Success: ${processedCount}/${componentFilenames.length}. Failures: ${failureCount}.`);
            if (failureCount > 0) {
                this.#logger.warn(`ComponentDefinitionLoader [${modId}]: Processing encountered ${failureCount} failures for component files. Check previous error logs for details.`);
            }

        } catch (error) {
            this.#logger.error(`ComponentDefinitionLoader [${modId}]: Critical error during component definition loading setup or processing loop.`, error);
            throw error; // Re-throw critical setup errors
        }

        // Return the final count of successful operations (including storage)
        return processedCount;
    }


    /**
     * Loads, validates, and processes a single component definition file.
     * Resolves the path, fetches data, validates structure, extracts key info,
     * validates and registers the nested data schema, and stores the metadata.
     * @private
     * @param {string} filename - The relative filename within the mod's components directory.
     * @param {(data:any) => ValidationResult} definitionValidatorFn - The pre-compiled Ajv validator function for the component definition structure.
     * @param {string} modId - The ID of the mod being processed (for path resolution and logging).
     * @param {string} definitionSchemaId - The schema ID used for validation (for logging errors).
     * @returns {Promise<object | null>} A promise that resolves with the processed definition data object if successful *and* stored.
     * Rejects if any critical error occurs during the processing of *this specific file* (e.g., fetch error, validation failure, storage error).
     * The rejection reason will be an Error object, potentially with added context like `reason` type and `resolvedPath`.
     */
    async #processSingleComponentFile(filename, definitionValidatorFn, modId, definitionSchemaId) {
        this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Processing component file: ${filename}`);
        let resolvedPath = '';
        let definitionData = null;
        let componentIdRaw = null; // Store raw ID before trimming
        let componentId = null; // Store trimmed ID

        try { // Outer try
            // --- Steps 1-4 remain the same ---

            // --- 1. Resolve Full File Path ---
            try {
                resolvedPath = this.#resolver.resolveModContentPath(modId, 'components', filename);
                this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Resolved path for ${filename} to ${resolvedPath}`);
            } catch (resolutionError) {
                const error = new Error(`Path Resolution Error: Failed to resolve path for component ${filename} in mod ${modId}: ${resolutionError.message}`);
                error.resolvedPath = resolvedPath || filename; // Attach path if available
                this.#logger.error(
                    `ComponentDefinitionLoader [${modId}]: Failed to resolve path for component file '${filename}'. Error: ${resolutionError.message}`,
                    {modId, filename, error: resolutionError}
                );
                throw error;
            }

            // --- 2. Fetch Content ---
            try {
                definitionData = await this.#fetcher.fetch(resolvedPath);
                this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Successfully fetched and parsed data for ${resolvedPath}.`);
            } catch (fetchError) {
                const error = new Error(`Workspace/Parse Error: Failed to fetch or parse component ${filename} from ${resolvedPath} in mod ${modId}: ${fetchError.message}`);
                error.resolvedPath = resolvedPath;
                this.#logger.error(
                    `ComponentDefinitionLoader [${modId}]: Failed to fetch or parse component definition from '${resolvedPath}'. Mod: ${modId}, File: ${filename}. Error: ${fetchError.message}`,
                    {modId, filename, path: resolvedPath, error: fetchError}
                );
                throw error;
            }

            // --- 3. Primary Schema Validation ---
            const definitionValidationResult = definitionValidatorFn(definitionData);
            this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Validated definition structure for ${filename}. Result: isValid=${definitionValidationResult.isValid}`);

            // --- 4. Handle Validation Failure ---
            if (!definitionValidationResult.isValid) {
                const formattedErrors = JSON.stringify(definitionValidationResult.errors, null, 2);
                const errorMessage = `Schema validation failed for component definition '${filename}' in mod '${modId}' using schema '${definitionSchemaId}'. Errors:\n${formattedErrors}`;
                const error = new Error(`Schema Validation Error: Schema validation failed for component ${filename} in mod ${modId}`);
                error.reason = 'Schema Validation Error'; // Add reason
                error.resolvedPath = resolvedPath;
                error.validationErrors = definitionValidationResult.errors; // Attach errors

                this.#logger.error(
                    `ComponentDefinitionLoader [${modId}]: ${errorMessage}`, // Keep detailed message here
                    { // Context for logging
                        modId: modId,
                        filename: filename,
                        schemaId: definitionSchemaId,
                        validationErrors: definitionValidationResult.errors,
                        resolvedPath: resolvedPath,
                        definition: definitionData // Include definition data on schema failure
                    }
                );
                throw error; // Throw the custom error
            }

            // --- 5. Extract/Validate ID and DataSchema ---
            componentIdRaw = definitionData?.id; // Store the raw value
            const dataSchema = definitionData?.dataSchema;

            // --- ID Validation ---
            if (typeof componentIdRaw !== 'string' || !componentIdRaw.trim()) {
                const foundValue = componentIdRaw === null ? 'null' : `"${componentIdRaw}"`;
                const errorMsg = `Component definition in file '${filename}' from mod '${modId}' is missing a valid string 'id'. Found: ${foundValue}. Skipping.`;
                const error = new Error(`Definition ID Error: Component definition from '${filename}' in mod '${modId}' is missing a valid string 'id'.`); // Shorter error message
                error.reason = 'Definition ID Error';
                error.resolvedPath = resolvedPath;

                this.#logger.error(
                    `ComponentDefinitionLoader [${modId}]: ${errorMsg}`,
                    {modId, resolvedPath, definition: definitionData}
                );
                throw error;
            }
            componentId = componentIdRaw.trim();

            // --- DataSchema Validation ---
            if (typeof dataSchema !== 'object' || dataSchema === null) {
                // *** CORRECTED FORMATTING FOR DATASCHEMA ***
                const foundValueString = dataSchema === null ? 'null' : `type: ${typeof dataSchema}`; // Get 'null' or 'type: xxx'
                const errorMsg = `Component definition ID '${componentId}' in file '${filename}' from mod '${modId}' is missing a valid object 'dataSchema'. Found: ${foundValueString}. Skipping.`; // Added colon
                const error = new Error(`Definition Schema Error: Component definition '${componentId}' from '${filename}' in mod '${modId}' is missing a valid object 'dataSchema'.`); // Shorter error message
                error.reason = 'Definition Schema Error';
                error.resolvedPath = resolvedPath;

                this.#logger.error(
                    `ComponentDefinitionLoader [${modId}]: ${errorMsg}`,
                    {modId, resolvedPath, definition: definitionData}
                );
                throw error;
            }
            this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Extracted valid componentId ('${componentId}') and dataSchema object for ${filename}.`);

            // --- Steps 6 & 7 remain the same ---

            // --- 6. Register Data Schema (with Override Logic) ---
            try {
                let schemaExists = false;
                try {
                    schemaExists = this.#validator.isSchemaLoaded(componentId);
                    this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Schema check for component '${componentId}': ${schemaExists ? 'EXISTS' : 'DOES NOT EXIST'}.`);
                } catch (checkError) {
                    const errorMsg = `Unexpected error during isSchemaLoaded check for component '${componentId}' in mod '${modId}', file '${filename}'.`;
                    const error = new Error(`${errorMsg} Error: ${checkError.message}`);
                    error.reason = 'Schema Registration Error';
                    error.resolvedPath = resolvedPath;
                    this.#logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                        modId, filename, componentId, error: checkError, resolvedPath
                    });
                    throw error;
                }

                if (schemaExists) {
                    this.#logger.warn(`ComponentDefinitionLoader [${modId}]: Overriding previously registered dataSchema for component ID '${componentId}' from file '${filename}'.`);
                    try {
                        const removed = this.#validator.removeSchema(componentId);
                        if (!removed) {
                            const errorMsg = `Failed to remove existing schema for component '${componentId}' before override attempt. Mod: ${modId}, File: ${filename}.`;
                            const error = new Error(errorMsg);
                            error.reason = 'Schema Registration Error';
                            error.resolvedPath = resolvedPath;
                            this.#logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                                modId, filename, componentId, path: resolvedPath
                            });
                            throw error;
                        }
                        this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Successfully removed existing schema for '${componentId}' before override.`);
                    } catch (removeError) {
                        const errorMsg = `Error during removeSchema for component '${componentId}'. Mod: ${modId}, File: ${filename}.`;
                        const error = new Error(`${errorMsg} Error: ${removeError.message}`);
                        error.reason = 'Schema Registration Error';
                        error.resolvedPath = resolvedPath;
                        this.#logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                            modId, filename, componentId, path: resolvedPath, error: removeError
                        });
                        throw error;
                    }
                }

                await this.#validator.addSchema(dataSchema, componentId);
                this.#logger.debug(`ComponentDefinitionLoader [${modId}]: Registered dataSchema for component ID '${componentId}' from file '${filename}'.`);

            } catch (registrationError) {
                // Re-throw if it's already our custom error, otherwise wrap it
                if (registrationError.reason === 'Schema Registration Error') {
                    throw registrationError;
                }
                const errorMsg = `Failed during dataSchema registration steps for component '${componentId}' from file '${filename}'.`;
                const error = new Error(`${errorMsg} Error: ${registrationError.message}`);
                error.reason = 'Schema Registration Error';
                error.resolvedPath = resolvedPath;
                this.#logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                    modId, filename, componentId, error: registrationError, resolvedPath
                });
                throw error;
            }

            // --- 7. Store Metadata in Registry (with Override Check and Error Handling) ---
            try {
                const storageKey = 'component_definitions';
                const existingDefinition = this.#registry.get(storageKey, componentId);

                if (existingDefinition) {
                    this.#logger.warn(
                        `ComponentDefinitionLoader [${modId}]: Overwriting existing component definition metadata in registry for ID '${componentId}' (from file '${filename}').`,
                        {modId, filename, componentId, path: resolvedPath}
                    );
                }

                this.#registry.store(storageKey, componentId, definitionData);
                this.#logger.debug(
                    `ComponentDefinitionLoader [${modId}]: Successfully stored component definition metadata for '${componentId}' (from file '${filename}') in registry.`,
                    {modId, filename, componentId, path: resolvedPath}
                );

            } catch (storageError) {
                const errorMsg = `CRITICAL: Failed to store component definition metadata for '${componentId}' (from file '${filename}') in registry.`;
                const error = new Error(`${errorMsg} Error: ${storageError.message}`);
                error.reason = 'Registry Storage Error';
                error.resolvedPath = resolvedPath;
                this.#logger.error(
                    `ComponentDefinitionLoader [${modId}]: ${errorMsg}`,
                    {modId, filename, componentId, path: resolvedPath, error: storageError}
                );
                throw error;
            }

            // If all steps succeed, return the validated definition data
            return definitionData;

        } catch (error) { // Outer catch
            // Attach resolvedPath if missing
            if (error && !error.resolvedPath && resolvedPath) {
                error.resolvedPath = resolvedPath;
            }

            // *** REMOVED THE 'if (!isAlreadyLoggedSpecificError)' CHECK ***
            // Always log the generic error when an error reaches this catch block.
            this.#logger.error(
                `ComponentDefinitionLoader [${modId}]: Error processing component definition file '${resolvedPath || filename}'. Error: ${error?.message || error}`, // Use resolvedPath in message
                {
                    modId,
                    filename, // Keep original filename for context
                    componentId: componentId || componentIdRaw || 'unknown_id',
                    path: resolvedPath,
                    error // Include the actual error object
                }
            );

            // Ensure the promise for this file is always rejected on any error caught here
            throw error; // Re-throw ANY error to reject the promise
        }
    }

}

// Export the class
export default ComponentDefinitionLoader;