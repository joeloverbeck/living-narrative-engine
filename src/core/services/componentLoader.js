// src/core/services/componentLoader.js

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
 * the definition metadata in the registry using a prefixed ID. It extends {@link BaseManifestItemLoader}
 * and implements the component-definition-specific processing logic in `_processFetchedItem`.
 *
 * @class ComponentLoader
 * @extends BaseManifestItemLoader
 */
class ComponentLoader extends BaseManifestItemLoader {

    /**
     * @private
     * @type {string | undefined} - Cached schema ID for component definitions.
     */
    _componentDefSchemaId;

    /**
     * Initializes the ComponentLoader by calling the parent constructor
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
            // <<< CORRECTED CLASS NAME in log
            this._logger.error('ComponentLoader: CRITICAL - Schema ID for component definitions (\'components\') not found in configuration. Validation will fail.');
        }
        // <<< CORRECTED CLASS NAME in log
        this._logger.debug(`ComponentLoader: Initialized. Using schema ID '${this._componentDefSchemaId || 'NOT CONFIGURED'}' for definitions.`);
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
        // <<< CORRECTED CLASS NAME in log
        this._logger.info(`ComponentLoader: Loading component definitions for mod '${modId}'.`);

        // --- Retained Initial Validation ---
        if (!modId || !modManifest) {
            // <<< CORRECTED CLASS NAME in log
            this._logger.error('ComponentLoader: Mod ID or Manifest is missing.', {modId, modManifest});
            return 0; // Or throw an error, depending on desired strictness
        }

        // --- Delegate to Base Class ---
        // Pass 'components' as the typeName, contentKey, and contentTypeDir
        // (Assuming component files are in a 'components' directory within the mod)
        return await this._loadItemsInternal(modId, modManifest, 'components', 'components', 'components');
    }


    /**
     * Processes a single fetched component definition file's data.
     * This method is called by the base class's `_processFileWrapper`.
     * It validates the overall structure against the component definition schema,
     * extracts and validates the required `id` and `dataSchema` properties,
     * registers the `dataSchema` with the ISchemaValidator using the **un-prefixed** `trimmedComponentId` (handling overrides),
     * and finally stores the component definition metadata in the data registry using the base class helper `_storeItemInRegistry`,
     * which applies the standardized `modId:trimmedComponentId` key format.
     * Returns the **fully qualified** `modId:trimmedComponentId`.
     *
     * **Important:** The component's `dataSchema` is registered using the **un-prefixed** ID (e.g., `my_component`)
     * while the component definition itself is stored in the registry using the **prefixed** ID
     * (e.g., `MyMod:my_component`) by the `_storeItemInRegistry` helper.
     *
     * @param {string} modId - The ID of the mod the item belongs to.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path used to fetch the file.
     * @param {any} data - The raw, parsed data object fetched from the file.
     * @param {string} typeName - The content type name ('components').
     * @returns {Promise<string>} A promise resolving with the **fully qualified, prefixed** component ID (`modId:trimmedComponentId`) on successful processing.
     * @throws {Error} Throws an error if configuration is missing, validation fails, schema registration fails, or storage fails.
     * @protected
     * @override
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        // typeName is available ('components')
        this._logger.debug(`ComponentLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`);

        // --- 1. Definition Schema Validation ---
        const definitionSchemaId = this._componentDefSchemaId;
        if (!definitionSchemaId) {
            this._logger.error(`ComponentLoader [${modId}]: Cannot validate ${filename} - Component definition schema ID ('components') is not configured.`);
            throw new Error(`Configuration Error: Component definition schema ID not configured.`);
        }

        const validationResult = this._schemaValidator.validate(definitionSchemaId, data);
        this._logger.debug(`ComponentLoader [${modId}]: Validated definition structure for ${filename}. Result: isValid=${validationResult.isValid}`);

        if (!validationResult.isValid) {
            // ... (Schema validation error handling remains the same - logs error, throws) ...
            const errorDetails = JSON.stringify(validationResult.errors, null, 2);
            const errorMsg = `ComponentLoader [${modId}]: Schema validation failed for component definition '${filename}' in mod '${modId}' using schema '${definitionSchemaId}'. Errors:\n${errorDetails}`;
            this._logger.error(errorMsg, { /* ... details ... */}); // Log with only 2 args
            const validationError = new Error(`Schema Validation Error for ${filename} in mod ${modId}`);
            validationError.details = validationResult.errors;
            throw validationError;
        }

        // --- 2. Property Extraction ---
        const componentIdFromFile = data.id; // e.g., "core:health" or "myMod:position"
        const dataSchema = data.dataSchema;

        // --- 3. Property Validation ---
        const trimmedComponentIdFromFile = componentIdFromFile?.trim(); // e.g., "core:health"
        if (!trimmedComponentIdFromFile) {
            const errorMsg = `ComponentLoader [${modId}]: Missing or invalid 'id' field in component definition file '${filename}'. Found: ${JSON.stringify(componentIdFromFile)}`;
            this._logger.error(errorMsg, {modId, filename, resolvedPath, componentIdValue: componentIdFromFile});
            throw new Error(`Invalid Component ID in ${filename}`);
        }

        // ***** MODIFICATION: EXTRACT BASE ID *****
        // Assumes format "prefix:baseId" or just "baseId" if no colon.
        // Takes everything after the *first* colon as the base ID.
        const idParts = trimmedComponentIdFromFile.split(':');
        const baseComponentId = idParts.length > 1 ? idParts.slice(1).join(':') : idParts[0];
        // Example: "core:health" -> baseComponentId = "health"
        // Example: "myMod:custom:thing" -> baseComponentId = "custom:thing"
        // Example: "position" -> baseComponentId = "position"

        if (!baseComponentId) { // Check if baseId extraction failed (e.g., ID was just ":")
            this._logger.error(`ComponentLoader [${modId}]: Could not extract valid base ID from component ID '${trimmedComponentIdFromFile}' in file '${filename}'.`);
            throw new Error(`Could not extract base Component ID from '${trimmedComponentIdFromFile}' in ${filename}`);
        }
        // ***** END MODIFICATION *****

        if (typeof dataSchema !== 'object' || dataSchema === null) {
            const dataType = dataSchema === null ? 'null' : typeof dataSchema;
            const errorMsg = `ComponentLoader [${modId}]: Invalid 'dataSchema' found for component '${trimmedComponentIdFromFile}' in file '${filename}'. Expected an object but received type '${dataType}'.`;
            const error = new Error(`Invalid dataSchema type in ${filename} for component ${trimmedComponentIdFromFile}`);
            this._logger.error(errorMsg, {
                modId,
                filename,
                resolvedPath,
                componentId: trimmedComponentIdFromFile,
                receivedType: dataType
            }, error);
            throw error;
        }

        // Log uses the full ID from the file for clarity during processing steps
        this._logger.debug(`ComponentLoader [${modId}]: Extracted and validated properties for component '${trimmedComponentIdFromFile}' (base: '${baseComponentId}') from ${filename}.`);

        // --- 4. Schema Registration with Override Check ---
        // **IMPORTANT:** Register the dataSchema using the FULL ID read from the file.
        this._logger.debug(`ComponentLoader [${modId}]: Attempting to register data schema using FULL ID '${trimmedComponentIdFromFile}'.`);

        // Check/Remove/Add schema using the FULL ID from the file
        const alreadyLoaded = this._schemaValidator.isSchemaLoaded(trimmedComponentIdFromFile);

        if (alreadyLoaded) {
            this._logger.warn(`Component Definition '${filename}' in mod '${modId}' is overwriting an existing data schema for component ID '${trimmedComponentIdFromFile}'.`);
            try {
                const removed = this._schemaValidator.removeSchema(trimmedComponentIdFromFile); // Remove using FULL ID
                if (removed) {
                    this._logger.debug(`ComponentLoader [${modId}]: Successfully removed existing schema '${trimmedComponentIdFromFile}' before overwriting.`);
                } else {
                    this._logger.warn(`ComponentLoader [${modId}]: Attempted to remove existing schema '${trimmedComponentIdFromFile}' but removal failed or schema was not found by removeSchema.`);
                }
            } catch (removalError) {
                const removalLogMsg = `ComponentLoader [${modId}]: Error during removeSchema for component '${trimmedComponentIdFromFile}' from file '${filename}'.`;
                this._logger.error(removalLogMsg, {
                    modId,
                    filename,
                    componentId: trimmedComponentIdFromFile,
                    error: removalError
                }, removalError);
                throw removalError;
            }
        }

        try {
            // Add using FULL ID from the file
            await this._schemaValidator.addSchema(dataSchema, trimmedComponentIdFromFile);
            this._logger.debug(`ComponentLoader [${modId}]: Registered dataSchema for component ID '${trimmedComponentIdFromFile}' from file '${filename}'.`);
        } catch (error) {
            const addLogMsg = `ComponentLoader [${modId}]: Error during addSchema for component '${trimmedComponentIdFromFile}' from file '${filename}'.`;
            this._logger.error(addLogMsg, {modId, filename, componentId: trimmedComponentIdFromFile, error}, error);
            throw error;
        }

        // --- 5. Store Component Definition Metadata (Using Helper) ---
        // **IMPORTANT:** Store the metadata using the extracted BASE (un-prefixed) ID.
        // The helper will prepend the current modId.
        this._logger.debug(`ComponentLoader [${modId}]: Delegating storage of component definition metadata for BASE ID '${baseComponentId}' to base class helper (will use prefixed key).`);

        try {
            // ***** MODIFICATION: Pass the BASE ID to the helper *****
            this._storeItemInRegistry('components', modId, baseComponentId, data, filename);
        } catch (storageError) {
            throw storageError;
        }

        // --- 6. Return the correct fully qualified ID ---
        // The canonical ID should be modId:baseComponentId.
        // ***** MODIFICATION: Construct the correct ID *****
        const qualifiedId = `${modId}:${baseComponentId}`;
        this._logger.debug(`ComponentLoader [${modId}]: Successfully processed component definition from ${filename}. Returning qualified ID: ${qualifiedId}`);
        return qualifiedId; // Return the correctly constructed ID
    }

}

export default ComponentLoader;