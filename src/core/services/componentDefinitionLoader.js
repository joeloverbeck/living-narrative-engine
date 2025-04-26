// src/core/services/componentDefinitionLoader.js

// --- Import Base Class ---
import {BaseManifestItemLoader} from './baseManifestItemLoader.js'; // Assuming BaseManifestItemLoader is in the same directory

// --- Type Imports (keep relevant JSDoc types if needed) ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */
/** @typedef {import('../../types/modManifest.js').ModManifest} ModManifest */ // Assuming this type definition exists

/**
 * Orchestrates the loading and validation of component definition files (*.component.json).
 * Inherits common loading logic from BaseManifestItemLoader and specializes in
 * handling component definitions, including validating their structure, registering
 * their nested data schemas with the ISchemaValidator, and optionally storing
 * metadata in the IDataRegistry.
 *
 * This class acts as a key part of the data-driven component system setup.
 * @extends BaseManifestItemLoader
 */
class ComponentDefinitionLoader extends BaseManifestItemLoader { // Inherit from BaseManifestItemLoader

    /**
     * Constructs a ComponentDefinitionLoader instance.
     * Relies on the BaseManifestItemLoader constructor for dependency injection and validation.
     *
     * @param {IConfiguration} configuration - Service to provide config values (e.g., component definition path, schema ID).
     * @param {IPathResolver} pathResolver - Service to resolve component definition filenames to full paths.
     * @param {IDataFetcher} fetcher - Service to fetch raw component definition data.
     * @param {ISchemaValidator} validator - Service for validating definitions and registering their data schemas.
     * @param {IDataRegistry} registry - Service to potentially store component definition metadata.
     * @param {ILogger} logger - Service for logging messages.
     */
    constructor(configuration, pathResolver, fetcher, validator, registry, logger) {
        // Call the parent constructor with all dependencies
        super(configuration, pathResolver, fetcher, validator, registry, logger);

        // Optional debug log for specific loader initialization
        this._logger.debug('ComponentDefinitionLoader: Initialized.');

        // All previous manual dependency validation and assignment removed
    }

    /**
     * Overrides the abstract method from BaseManifestItemLoader.
     * Processes the data fetched from a single component definition file.
     * Validates the definition structure, extracts key info (ID, dataSchema),
     * registers the nested data schema with override logic, and stores the metadata.
     * @protected
     * @override
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} definitionData - The raw data fetched from the file (expected to be an object).
     * @returns {Promise<object | null>} A promise that resolves with the processed definition data object if successful *and* stored.
     * Rejects if any critical error occurs during the processing of *this specific file* (e.g., validation failure, storage error).
     * The rejection reason will be an Error object, potentially with added context like `reason` type and `resolvedPath`.
     * @throws {Error} Re-throws errors related to fetching (handled by wrapper), validation, schema registration, or storage.
     */
    async _processFetchedItem(modId, filename, resolvedPath, definitionData) {
        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Processing component file: ${filename} at ${resolvedPath}`);
        let componentIdRaw = null;
        let componentId = null;

        // Retrieve the main definition schema validator once per processing call if needed
        const definitionSchemaId = this._config.getContentTypeSchemaId('components');
        if (!definitionSchemaId) {
            const errorMsg = `Schema ID for 'components' (definition files) not found in configuration. Mod: ${modId}`;
            this._logger.error(errorMsg);
            throw new Error(errorMsg); // Critical configuration error
        }

        const definitionValidatorFn = this._schemaValidator.getValidator(definitionSchemaId);
        if (!definitionValidatorFn) {
            const errorMsg = `CRITICAL - Could not retrieve validator function for schema '${definitionSchemaId}'. Mod: ${modId}`;
            this._logger.error(errorMsg);
            throw new Error(errorMsg); // Critical validator setup error
        }

        try {
            // --- 1. Primary Schema Validation ---
            const definitionValidationResult = definitionValidatorFn(definitionData);
            this._logger.debug(`ComponentDefinitionLoader [${modId}]: Validated definition structure for ${filename}. Result: isValid=${definitionValidationResult.isValid}`);

            if (!definitionValidationResult.isValid) {
                const formattedErrors = JSON.stringify(definitionValidationResult.errors, null, 2);
                const errorMessage = `Schema validation failed for component definition '${filename}' in mod '${modId}' using schema '${definitionSchemaId}'. Errors:\n${formattedErrors}`;
                const error = new Error(`Schema Validation Error: Schema validation failed for component ${filename} in mod ${modId}`);
                error.reason = 'Schema Validation Error';
                error.resolvedPath = resolvedPath;
                error.validationErrors = definitionValidationResult.errors;

                this._logger.error(
                    `ComponentDefinitionLoader [${modId}]: ${errorMessage}`,
                    {
                        modId,
                        filename,
                        schemaId: definitionSchemaId,
                        validationErrors: definitionValidationResult.errors,
                        resolvedPath,
                        definition: definitionData
                    }
                );
                throw error;
            }

            // --- 2. Extract/Validate ID and DataSchema ---
            componentIdRaw = definitionData?.id;
            const dataSchema = definitionData?.dataSchema;

            if (typeof componentIdRaw !== 'string' || !componentIdRaw.trim()) {
                const foundValue = componentIdRaw === null ? 'null' : `"${componentIdRaw}"`;
                const errorMsg = `Component definition in file '${filename}' from mod '${modId}' is missing a valid string 'id'. Found: ${foundValue}. Skipping.`;
                const error = new Error(`Definition ID Error: Component definition from '${filename}' in mod '${modId}' is missing a valid string 'id'.`);
                error.reason = 'Definition ID Error';
                error.resolvedPath = resolvedPath;
                this._logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                    modId,
                    resolvedPath,
                    definition: definitionData
                });
                throw error;
            }
            componentId = componentIdRaw.trim();

            if (typeof dataSchema !== 'object' || dataSchema === null) {
                const foundValueString = dataSchema === null ? 'null' : `type: ${typeof dataSchema}`;
                const errorMsg = `Component definition ID '${componentId}' in file '${filename}' from mod '${modId}' is missing a valid object 'dataSchema'. Found: ${foundValueString}. Skipping.`;
                const error = new Error(`Definition Schema Error: Component definition '${componentId}' from '${filename}' in mod '${modId}' is missing a valid object 'dataSchema'.`);
                error.reason = 'Definition Schema Error';
                error.resolvedPath = resolvedPath;
                this._logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                    modId,
                    resolvedPath,
                    definition: definitionData
                });
                throw error;
            }
            this._logger.debug(`ComponentDefinitionLoader [${modId}]: Extracted valid componentId ('${componentId}') and dataSchema object for ${filename}.`);

            // --- 3. Register Data Schema (with Override Logic) ---
            // Use protected services via this._serviceName
            try {
                let schemaExists = false;
                try {
                    schemaExists = this._schemaValidator.isSchemaLoaded(componentId);
                    this._logger.debug(`ComponentDefinitionLoader [${modId}]: Schema check for component '${componentId}': ${schemaExists ? 'EXISTS' : 'DOES NOT EXIST'}.`);
                } catch (checkError) {
                    const errorMsg = `Unexpected error during isSchemaLoaded check for component '${componentId}' in mod '${modId}', file '${filename}'.`;
                    const error = new Error(`${errorMsg} Error: ${checkError.message}`);
                    error.reason = 'Schema Registration Error';
                    error.resolvedPath = resolvedPath;
                    this._logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                        modId,
                        filename,
                        componentId,
                        error: checkError,
                        resolvedPath
                    });
                    throw error;
                }

                if (schemaExists) {
                    this._logger.warn(`ComponentDefinitionLoader [${modId}]: Overriding previously registered dataSchema for component ID '${componentId}' from file '${filename}'.`);
                    try {
                        const removed = this._schemaValidator.removeSchema(componentId);
                        if (!removed) {
                            const errorMsg = `Failed to remove existing schema for component '${componentId}' before override attempt. Mod: ${modId}, File: ${filename}.`;
                            const error = new Error(errorMsg);
                            error.reason = 'Schema Registration Error';
                            error.resolvedPath = resolvedPath;
                            this._logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                                modId,
                                filename,
                                componentId,
                                path: resolvedPath
                            });
                            throw error;
                        }
                        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Successfully removed existing schema for '${componentId}' before override.`);
                    } catch (removeError) {
                        const errorMsg = `Error during removeSchema for component '${componentId}'. Mod: ${modId}, File: ${filename}.`;
                        const error = new Error(`${errorMsg} Error: ${removeError.message}`);
                        error.reason = 'Schema Registration Error';
                        error.resolvedPath = resolvedPath;
                        this._logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                            modId,
                            filename,
                            componentId,
                            path: resolvedPath,
                            error: removeError
                        });
                        throw error;
                    }
                }

                await this._schemaValidator.addSchema(dataSchema, componentId);
                this._logger.debug(`ComponentDefinitionLoader [${modId}]: Registered dataSchema for component ID '${componentId}' from file '${filename}'.`);

            } catch (registrationError) {
                if (registrationError.reason === 'Schema Registration Error') {
                    throw registrationError;
                }
                const errorMsg = `Failed during dataSchema registration steps for component '${componentId}' from file '${filename}'.`;
                const error = new Error(`${errorMsg} Error: ${registrationError.message}`);
                error.reason = 'Schema Registration Error';
                error.resolvedPath = resolvedPath;
                this._logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                    modId,
                    filename,
                    componentId,
                    error: registrationError,
                    resolvedPath
                });
                throw error;
            }

            // --- 4. Store Metadata in Registry (with Override Check) ---
            try {
                const storageKey = 'component_definitions'; // Use a consistent key
                const existingDefinition = this._dataRegistry.get(storageKey, componentId);

                if (existingDefinition) {
                    this._logger.warn(
                        `ComponentDefinitionLoader [${modId}]: Overwriting existing component definition metadata in registry for ID '${componentId}' (from file '${filename}').`,
                        {modId, filename, componentId, path: resolvedPath}
                    );
                }

                this._dataRegistry.store(storageKey, componentId, definitionData);
                this._logger.debug(
                    `ComponentDefinitionLoader [${modId}]: Successfully stored component definition metadata for '${componentId}' (from file '${filename}') in registry.`,
                    {modId, filename, componentId, path: resolvedPath}
                );

            } catch (storageError) {
                const errorMsg = `CRITICAL: Failed to store component definition metadata for '${componentId}' (from file '${filename}') in registry.`;
                const error = new Error(`${errorMsg} Error: ${storageError.message}`);
                error.reason = 'Registry Storage Error';
                error.resolvedPath = resolvedPath;
                this._logger.error(`ComponentDefinitionLoader [${modId}]: ${errorMsg}`, {
                    modId,
                    filename,
                    componentId,
                    path: resolvedPath,
                    error: storageError
                });
                throw error;
            }

            // If all steps succeed, return the validated definition data
            return definitionData;

        } catch (error) {
            // Log details if error occurs during processing this item
            this._logger.error(
                `ComponentDefinitionLoader [${modId}]: Error processing component definition file '${resolvedPath || filename}'. Error: ${error?.message || error}`,
                {modId, filename, componentId: componentId || componentIdRaw || 'unknown_id', path: resolvedPath, error}
            );
            // Re-throw the error to be caught by the _processFileWrapper in the base class
            throw error;
        }
    }

    /**
     * Public method to initiate the loading of component definitions for a specific mod.
     * Uses the base class's orchestration logic (`_loadItemsInternal`).
     *
     * @param {string} modId - The unique identifier of the mod being processed.
     * @param {ModManifest | null | undefined} modManifest - The parsed manifest object for the specified mod.
     * @returns {Promise<number>} A promise that resolves with the number of component definitions successfully loaded and processed for this mod.
     * @throws {Error} If critical setup errors occur (e.g., configuration issues - handled by base class or constructor).
     */
    async loadComponentDefinitions(modId, modManifest) {
        if (typeof modId !== 'string' || !modId.trim()) {
            this._logger.error('ComponentDefinitionLoader.loadComponentDefinitions: Invalid or empty modId provided.');
            // Consider throwing instead of returning 0 if modId is invalid.
            // Throwing aligns better with indicating a fundamental issue with the call.
            throw new Error('ComponentDefinitionLoader.loadComponentDefinitions: invalid or empty modId provided.');
        }
        if (!modManifest || typeof modManifest !== 'object') {
            this._logger.warn(`ComponentDefinitionLoader [${modId}]: Invalid or null modManifest provided. Assuming no components to load.`);
            return 0; // Return 0 if manifest is invalid or missing
        }

        this._logger.info(`ComponentDefinitionLoader: Loading component definitions for mod '${modId}'...`);

        // Delegate to the base class's internal loading orchestrator
        // Pass the content key ('components') and the directory name ('components')
        return this._loadItemsInternal(modId, modManifest, 'components', 'components');
    }

    // --- REMOVED private #processSingleComponentFile as its logic is now in _processFetchedItem ---

}

// Export the class
export default ComponentDefinitionLoader;