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
 * Loads component definitions from mods, validates them against the component definition schema,
 * extracts metadata, registers the component's `dataSchema` with the validator, and stores
 * the definition metadata in the registry. It extends {@link BaseManifestItemLoader}
 * and implements the component-definition-specific processing logic in `_processFetchedItem`.
 *
 * @class ComponentDefinitionLoader
 * @extends BaseManifestItemLoader
 */
class ComponentDefinitionLoader extends BaseManifestItemLoader {

    /**
     * @private
     * @type {string | undefined} - Cached schema ID for component definitions.
     */
    _componentDefSchemaId;

    /**
     * Initializes the ComponentDefinitionLoader by calling the parent constructor
     * and caching the schema ID for component definitions.
     *
     * @param {IConfiguration} config - The configuration service.
     * @param {IPathResolver} pathResolver - The path resolver service.
     * @param {IDataFetcher} dataFetcher - The data fetcher service.
     * @param {ISchemaValidator} schemaValidator - The schema validator service.
     * @param {IDataRegistry} dataRegistry - The data registry service.
     * @param {ILogger} logger - The logger service.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        super(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger); // Call parent constructor
        this._componentDefSchemaId = this._config.getContentTypeSchemaId('components');
        if (!this._componentDefSchemaId) {
            this._logger.error('ComponentDefinitionLoader: CRITICAL - Schema ID for component definitions (\'components\') not found in configuration. Validation will fail.');
        }
        this._logger.debug(`ComponentDefinitionLoader: Initialized. Using schema ID '${this._componentDefSchemaId || 'NOT CONFIGURED'}' for definitions.`);
    }

    /**
     * Loads and registers component definitions for a given mod based on its manifest.
     * Serves as the public entry point for loading components for a specific mod.
     * It delegates the core file iteration, fetching, and processing logic to the
     * base class's `_loadItemsInternal` method, which utilizes the `_processFetchedItem`
     * implementation provided by this class.
     *
     * @param {string} modId - The ID of the mod.
     * @param {ModManifest} modManifest - The manifest object for the mod.
     * @returns {Promise<number>} A promise that resolves with the count of successfully loaded component definitions.
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
        return await this._loadItemsInternal(modId, modManifest, 'components', 'components');
    }


    /**
     * Processes a single fetched component definition file's data.
     * This method is called by the base class's `_processFileWrapper`.
     * It validates the overall structure against the component definition schema,
     * extracts and validates the required `id` and `dataSchema` properties,
     * registers the `dataSchema` with the ISchemaValidator (handling overrides),
     * and finally stores the component definition metadata (the entire validated object,
     * augmented with source information) in the data registry.
     *
     * @param {string} modId - The ID of the mod the item belongs to.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path used to fetch the file.
     * @param {any} data - The raw, parsed data object fetched from the file.
     * @returns {Promise<string>} A promise resolving with the validated component ID on successful processing, validation, registration, and storage.
     * @throws {Error} Throws an error if configuration is missing, validation fails (structure or properties), schema registration fails, or storage fails.
     * @protected
     * @override
     */
    async _processFetchedItem(modId, filename, resolvedPath, data) {
        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Processing fetched item: ${filename}`);

        // --- 1. Implement Definition Schema Validation ---
        const definitionSchemaId = this._componentDefSchemaId;
        if (!definitionSchemaId) {
            this._logger.error(`ComponentDefinitionLoader [${modId}]: Cannot validate ${filename} - Component definition schema ID ('components') is not configured.`);
            throw new Error(`Configuration Error: Component definition schema ID not configured.`);
        }

        const validationResult = this._schemaValidator.validate(definitionSchemaId, data);
        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Validated definition structure for ${filename}. Result: isValid=${validationResult.isValid}`);

        if (!validationResult.isValid) {
            const errorDetails = JSON.stringify(validationResult.errors, null, 2);
            const errorMsg = `ComponentDefinitionLoader [${modId}]: Schema validation failed for component definition '${filename}' in mod '${modId}' using schema '${definitionSchemaId}'. Errors:\n${errorDetails}`;
            this._logger.error(
                errorMsg,
                {
                    modId,
                    filename,
                    resolvedPath,
                    schemaId: definitionSchemaId,
                    validationErrors: validationResult.errors,
                    definition: data
                }
            );
            const validationError = new Error(`Schema Validation Error for ${filename} in mod ${modId}`);
            validationError.details = validationResult.errors;
            throw validationError;
        }

        // --- 2. Implement Property Extraction ---
        const componentId = data.id;
        const dataSchema = data.dataSchema;

        // --- 3. Implement Property Validation ---
        if (typeof componentId !== 'string' || !componentId.trim()) {
            const errorMsg = `ComponentDefinitionLoader [${modId}]: Missing or invalid 'id' field in component definition file '${filename}'. Found: ${JSON.stringify(componentId)}`;
            this._logger.error(errorMsg, {
                modId, filename, resolvedPath, componentIdValue: componentId
            });
            throw new Error(`Invalid Component ID in ${filename}`);
        }
        const trimmedComponentId = componentId.trim();

        if (typeof dataSchema !== 'object' || dataSchema === null) {
            const dataType = dataSchema === null ? 'null' : typeof dataSchema;
            const errorMsg = `ComponentDefinitionLoader [${modId}]: Invalid 'dataSchema' found for component '${trimmedComponentId}' in file '${filename}'. Expected an object but received type '${dataType}'.`;
            const error = new Error(`Invalid dataSchema type in ${filename} for component ${trimmedComponentId}`);
            this._logger.error(errorMsg, {
                modId, filename, resolvedPath, componentId: trimmedComponentId, receivedType: dataType
            }, error);
            throw error;
        }

        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Extracted and validated properties for component '${trimmedComponentId}' from ${filename}.`);

        // --- 4. Schema Registration with Override Check ---
        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Attempting to register data schema for component '${trimmedComponentId}'.`);

        const alreadyLoaded = this._schemaValidator.isSchemaLoaded(trimmedComponentId);

        if (alreadyLoaded) {
            this._logger.warn(`Component Definition '${filename}' in mod '${modId}' is overwriting an existing data schema for component ID '${trimmedComponentId}'.`);
            try {
                const removed = this._schemaValidator.removeSchema(trimmedComponentId);
                if (removed) {
                    this._logger.debug(`ComponentDefinitionLoader [${modId}]: Successfully removed existing schema '${trimmedComponentId}' before overwriting.`);
                } else {
                    this._logger.warn(`ComponentDefinitionLoader [${modId}]: Attempted to remove existing schema '${trimmedComponentId}' but removal failed or schema was not found by removeSchema.`);
                }
            } catch (removalError) {
                const removalLogMsg = `ComponentDefinitionLoader [${modId}]: Error during removeSchema for component '${trimmedComponentId}' from file '${filename}'.`;
                this._logger.error(removalLogMsg, {
                    modId,
                    filename,
                    componentId: trimmedComponentId,
                    error: removalError
                }, removalError);
                throw removalError; // Re-throw original error
            }
        }

        try {
            await this._schemaValidator.addSchema(dataSchema, trimmedComponentId);
            this._logger.debug(`Registered dataSchema for component ID '${trimmedComponentId}' from file '${filename}'.`);

        } catch (error) {
            const addLogMsg = `ComponentDefinitionLoader [${modId}]: Error during addSchema for component '${trimmedComponentId}' from file '${filename}'.`;
            this._logger.error(addLogMsg, {modId, filename, componentId: trimmedComponentId, error}, error);
            throw error; // Re-throw original error
        }

        // --- 5. Store Component Definition Metadata ---
        this._logger.debug(`ComponentDefinitionLoader [${modId}]: Storing component definition metadata for '${trimmedComponentId}'.`);

        const existingDefinition = this._dataRegistry.get('component_definitions', trimmedComponentId);
        if (existingDefinition) {
            this._logger.warn(`Component Definition '${filename}' in mod '${modId}' is overwriting existing component definition metadata for ID '${trimmedComponentId}'.`);
        }

        try {
            const dataToStore = {
                ...data,
                modId: modId,
                _sourceFile: filename
            };
            this._dataRegistry.store('component_definitions', trimmedComponentId, dataToStore);
            this._logger.debug(`Successfully stored component definition metadata for '${trimmedComponentId}' from file '${filename}'.`);
        } catch (error) {
            this._logger.error(`Failed to store component definition metadata for ID '${trimmedComponentId}' from file '${filename}' in mod '${modId}'. Error: ${error.message}`, {
                modId,
                filename,
                componentId: trimmedComponentId,
                error
            });
            throw error;
        }

        // --- 6. Implement Success Return Value ---
        return trimmedComponentId;
    }

}

export default ComponentDefinitionLoader;