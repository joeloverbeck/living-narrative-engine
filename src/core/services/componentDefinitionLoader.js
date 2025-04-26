// src/core/services/componentDefinitionLoader.js

import {BaseManifestItemLoader} from './baseManifestItemLoader.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').ModManifest} ModManifest
 * @typedef {import('../interfaces/manifestItems.js').ComponentDefinition} ComponentDefinition
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 */

/**
 * @class ComponentDefinitionLoader
 * @extends BaseManifestItemLoader
 * @description Loads component definitions from mods, validates them against schemas,
 * and registers their data schemas with the validator.
 */
class ComponentDefinitionLoader extends BaseManifestItemLoader {

    /**
     * Creates an instance of ComponentDefinitionLoader.
     * @param {IConfiguration} config - The configuration service.
     * @param {IPathResolver} pathResolver - The path resolver service.
     * @param {IDataFetcher} dataFetcher - The data fetcher service.
     * @param {ISchemaValidator} schemaValidator - The schema validator service.
     * @param {IDataRegistry} dataRegistry - The data registry service.
     * @param {ILogger} logger - The logger service.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        super(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger);
        this._componentDefSchemaId = this._config.getContentTypeSchemaId('components');
        this._logger.debug('ComponentDefinitionLoader: Initialized.');
    }

    /**
     * Loads and registers component definitions for a given mod based on its manifest.
     * Delegates the core file iteration, fetching, and processing logic to the base class.
     *
     * @param {string} modId - The ID of the mod.
     * @param {ModManifest} modManifest - The manifest object for the mod.
     * @returns {Promise<number>} A promise that resolves with the number of successfully loaded component definitions.
     * @async
     */
    async loadComponentDefinitions(modId, modManifest) {
        this._logger.info(`ComponentDefinitionLoader: Loading component definitions for mod '${modId}'.`);

        // --- Retained Initial Validation ---
        if (!modId || !modManifest) {
            this._logger.error('ComponentDefinitionLoader: Mod ID or Manifest is missing.', {modId, modManifest});
            return 0; // Or throw an error, depending on desired strictness
        }

        // --- Delegate to Base Class ---
        // The base class method handles:
        // - Extracting valid filenames from manifest.content['components']
        // - Logging the number of files found
        // - Looping through filenames
        // - Calling _processFileWrapper for each file
        // - Handling Promise.allSettled for concurrent processing
        // - Aggregating success/failure counts
        // - Logging the final summary
        // The actual processing logic for each file is implemented in _processFetchedItem below.
        return await this._loadItemsInternal(modId, modManifest, 'components', 'components');
    }


    /**
     * Processes a single fetched component definition file.
     * This method is called by the base class's _processFileWrapper.
     * It validates the structure, extracts the component ID, registers the data schema,
     * and stores the definition metadata.
     *
     * @param {string} modId - The ID of the mod the item belongs to.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {object} rawData - The raw, fetched data from the JSON file.
     * @returns {Promise<object>} A promise resolving with the processed item metadata on success.
     * @protected
     * @async
     * @override
     * @throws {Error} Throws an error if validation fails or processing encounters a critical issue.
     */
    async _processFetchedItem(modId, filename, resolvedPath, rawData) {
        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Processing component file: ${filename}`);

        // 1. --- Validate Structure against Component Definition Schema ---
        const validationResult = this._schemaValidator.validate(this._componentDefSchemaId, rawData);
        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Validated definition structure for ${filename}. Result: isValid=${validationResult.isValid}`);
        if (!validationResult.isValid) {
            // Log the detailed schema validation error
            this._logger.error(`ComponentDefinitionLoader [${modId}]: Schema validation failed for component definition '${filename}' in mod '${modId}' using schema '${this._componentDefSchemaId}'. Errors:\n${JSON.stringify(validationResult.errors, null, 2)}`, {
                modId: modId,
                filename: filename,
                schemaId: this._componentDefSchemaId,
                validationErrors: validationResult.errors,
                resolvedPath: resolvedPath,
                definition: rawData // Include rawData for context
            });

            // Throw a specific error instead of returning null to signal failure
            const validationError = new Error(`Schema Validation Error: Schema validation failed for component ${filename} in mod ${modId}`);
            validationError.reason = 'Schema Validation Error'; // Add context for potential filtering
            validationError.modId = modId;
            validationError.filename = filename;
            validationError.resolvedPath = resolvedPath;
            validationError.validationErrors = validationResult.errors;
            throw validationError;
        }

        // 2. --- Extract and Validate Component ID ---
        const componentId = rawData.id;
        if (!componentId || typeof componentId !== 'string' || !componentId.trim()) {
            // Log the error
            this._logger.error(`ComponentDefinitionLoader [${modId}]: Missing or invalid 'id' field in component definition file '${filename}'.`, {
                modId,
                filename,
                path: resolvedPath,
                data: rawData
            });
            // Throw an error to signal failure
            const idError = new Error(`Invalid Component ID: Missing or invalid 'id' field in component definition file '${filename}' for mod '${modId}'.`);
            idError.reason = 'Invalid Component ID';
            idError.modId = modId;
            idError.filename = filename;
            idError.resolvedPath = resolvedPath;
            throw idError;
        }
        const trimmedComponentId = componentId.trim();
        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Extracted valid componentId ('${trimmedComponentId}') from ${filename}.`);


        // 3. --- Check for Overrides (Handled by Base Class Registry Interaction - Optional Warning Here) ---
        const existingDefinition = this._dataRegistry.get('component_definitions', trimmedComponentId);
        if (existingDefinition) {
            this._logger.warn(`ComponentDefinitionLoader [${modId}]: Overwriting existing component definition with ID '${trimmedComponentId}' from file '${filename}'. Previous source likely: ${existingDefinition.modId || 'unknown'} (${existingDefinition._sourceFile || 'unknown'})`);
            // Potentially remove the old schema if it differs? Or assume addSchema handles updates.
            // For simplicity, assume addSchema overwrites/updates.
            // this._schemaValidator.removeSchema(trimmedComponentId); // Consider implications if schemas differ significantly
        }

        // 4. --- Register Component's Data Schema (if present) ---
        if (rawData.hasOwnProperty('dataSchema')) { // Check if the key *exists* at all
            const dataSchemaValue = rawData.dataSchema;
            const isObject = dataSchemaValue !== null && typeof dataSchemaValue === 'object'; // Explicit null check needed as typeof null === 'object'

            if (isObject) {
                // dataSchema is present and is a valid object - Register it
                this._logger.debug(`ComponentDefinitionLoader [${modId}]: Found valid 'dataSchema' object for component '${trimmedComponentId}' in ${filename}. Attempting registration.`);

                if (this._schemaValidator.isSchemaLoaded(trimmedComponentId)) {
                    this._logger.warn(`ComponentDefinitionLoader [${modId}]: Attempting to override previously registered dataSchema for component ID '${trimmedComponentId}' from file '${filename}'. Removing old schema first.`);
                    try {
                        const removed = this._schemaValidator.removeSchema(trimmedComponentId);
                        if (removed) {
                            this._logger.debug(`ComponentDefinitionLoader [${modId}]: Successfully removed existing schema for '${trimmedComponentId}' before override.`);
                        } else {
                            // This case might occur if isSchemaLoaded and removeSchema are somehow inconsistent in the validator implementation
                            this._logger.warn(`ComponentDefinitionLoader [${modId}]: removeSchema reported no schema found for '${trimmedComponentId}' despite isSchemaLoaded being true. Proceeding with addSchema.`);
                        }
                    } catch (removeError) {
                        // Treat failure to remove the old schema as a critical error
                        this._logger.error(`ComponentDefinitionLoader [${modId}]: Failed to remove existing dataSchema for component '${trimmedComponentId}' during override attempt from file '${filename}'.`, {
                            modId,
                            filename,
                            componentId: trimmedComponentId,
                            path: resolvedPath,
                            error: removeError.message
                        }, removeError);
                        const removeSchemaError = new Error(`Schema Removal Error: Failed to remove existing dataSchema for component '${trimmedComponentId}'. Reason: ${removeError.message}`);
                        removeSchemaError.reason = 'Schema Removal Error';
                        removeSchemaError.modId = modId;
                        removeSchemaError.filename = filename;
                        removeSchemaError.componentId = trimmedComponentId;
                        removeSchemaError.resolvedPath = resolvedPath;
                        removeSchemaError.originalError = removeError;
                        throw removeSchemaError; // Fail processing if old schema cannot be removed
                    }
                }

                try {
                    await this._schemaValidator.addSchema(dataSchemaValue, trimmedComponentId);
                    this._logger.debug(`ComponentDefinitionLoader [${modId}]: Registered dataSchema for component ID '${trimmedComponentId}' from ${filename}.`);
                } catch (schemaError) {
                    // Log and throw Schema Registration Error
                    this._logger.error(`ComponentDefinitionLoader [${modId}]: Failed to add dataSchema for component '${trimmedComponentId}' from file '${filename}'.`, {
                        modId,
                        filename,
                        componentId: trimmedComponentId,
                        path: resolvedPath,
                        error: schemaError.message,
                        schema: dataSchemaValue
                    }, schemaError);
                    const addSchemaError = new Error(`Schema Registration Error: Failed to add dataSchema for component '${trimmedComponentId}' from file '${filename}'. Reason: ${schemaError.message}`);
                    addSchemaError.reason = 'Schema Registration Error';
                    // ... add details ...
                    addSchemaError.originalError = schemaError;
                    throw addSchemaError;
                }
            } else {
                // dataSchema key exists but is NOT a valid object (e.g., null, string, number) - ERROR!
                const actualType = dataSchemaValue === null ? 'null' : typeof dataSchemaValue;
                const schemaTypeError = new Error(`Invalid dataSchema Type: Component definition '${trimmedComponentId}' from '${filename}' in mod '${modId}' has an invalid type for 'dataSchema' (expected object, got ${actualType}).`);
                schemaTypeError.reason = 'Invalid dataSchema Type';
                schemaTypeError.modId = modId;
                schemaTypeError.filename = filename;
                schemaTypeError.componentId = trimmedComponentId;
                schemaTypeError.resolvedPath = resolvedPath;
                schemaTypeError.invalidSchemaValue = dataSchemaValue; // Include the problematic value

                // Log this specific error before throwing
                this._logger.error(`ComponentDefinitionLoader [${modId}]: Invalid 'dataSchema' found for component '${trimmedComponentId}' in file '${filename}'. Expected an object but received type '${actualType}'.`, {
                    modId,
                    filename,
                    componentId: trimmedComponentId,
                    path: resolvedPath,
                    dataType: actualType,
                    dataSchemaValue: dataSchemaValue // Log the actual invalid value for debugging
                }, schemaTypeError); // Log the error object itself

                throw schemaTypeError; // Signal failure - do not proceed to store definition
            }
        } else {
            // dataSchema key is completely missing - This is acceptable, just skip registration
            this._logger.debug(`ComponentDefinitionLoader [${modId}]: No 'dataSchema' key found for component '${trimmedComponentId}' in ${filename}. Skipping schema registration.`);
            // If the key is missing, we should remove any potentially stale schema for this ID
            if (this._schemaValidator.isSchemaLoaded(trimmedComponentId)) {
                this._logger.warn(`ComponentDefinitionLoader [${modId}]: Component '${trimmedComponentId}' from ${filename} is missing the 'dataSchema' key, but a schema for this ID was previously registered. Removing old schema.`);
                try {
                    this._schemaValidator.removeSchema(trimmedComponentId);
                } catch (removeError) {
                    this._logger.error(`ComponentDefinitionLoader [${modId}]: Failed to remove previously registered schema for component '${trimmedComponentId}' (missing dataSchema key) during update from '${filename}'.`, { /* details */}, removeError);
                    // Continue processing the definition even if old schema removal failed? Yes, seems reasonable.
                }
            }
        }

        // 5. --- Store Definition Metadata in Registry ---
        const definitionToStore = {
            ...rawData, // Store the validated definition
            modId: modId, // Track origin mod
            _sourceFile: filename // Track origin filename
        };
        try {
            this._dataRegistry.store('component_definitions', trimmedComponentId, definitionToStore);
            this._logger.debug(`ComponentDefinitionLoader [${modId}]: Successfully stored component definition metadata for '${trimmedComponentId}'.`, {
                modId,
                filename,
                componentId: trimmedComponentId,
                path: resolvedPath
            });
        } catch (storeError) {
            // Log the error
            this._logger.error(`ComponentDefinitionLoader [${modId}]: Failed to store component definition '${trimmedComponentId}' from file '${filename}' in registry.`, {
                modId,
                filename,
                componentId: trimmedComponentId,
                path: resolvedPath,
                error: storeError.message
            }, storeError);
            // Throw an error to signal failure
            const registryError = new Error(`Registry Error: Failed to store component definition '${trimmedComponentId}' from '${filename}'. Reason: ${storeError.message}`);
            registryError.reason = 'Registry Error';
            registryError.modId = modId;
            registryError.filename = filename;
            registryError.componentId = trimmedComponentId;
            registryError.resolvedPath = resolvedPath;
            registryError.originalError = storeError;
            throw registryError;
        }


        // Return the processed item details (or just the ID) for success tracking in the base class
        return {
            id: trimmedComponentId,
            filename: filename,
            path: resolvedPath,
            type: 'component' // Add type for potential differentiation in results
        };
    }
}

export default ComponentDefinitionLoader;