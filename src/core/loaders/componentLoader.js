// src/core/loaders/componentLoader.js

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
 * Loads component definitions from mods, validates them against the component definition schema (handled by base class),
 * extracts metadata, registers the component's `dataSchema` with the validator, and stores
 * the definition metadata in the registry using a prefixed ID. It extends {@link BaseManifestItemLoader}
 * and implements the component-definition-specific processing logic in `_processFetchedItem`.
 *
 * @class ComponentLoader
 * @extends BaseManifestItemLoader
 */
class ComponentLoader extends BaseManifestItemLoader {

    // REMOVED: Private field for caching schema ID (no longer needed here)

    /**
     * Initializes the ComponentLoader by calling the parent constructor with the specific type name 'components'.
     *
     * @param {IConfiguration} config - The configuration service.
     * @param {IPathResolver} pathResolver - The path resolver service.
     * @param {IDataFetcher} dataFetcher - The data fetcher service.
     * @param {ISchemaValidator} schemaValidator - The schema validator service.
     * @param {IDataRegistry} dataRegistry - The data registry service.
     * @param {ILogger} logger - The logger service.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        // AC: ComponentLoader constructor calls super() passing 'components' as the first argument
        super('components', config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger); // Call parent constructor with typeName

        // REMOVED: Logic to cache schema ID in constructor (handled by base or not needed directly)

        this._logger.debug(`ComponentLoader: Initialized.`);
    }

    // --- METHOD REMOVED: loadComponentDefinitions ---
    /*
     * Removed the loadComponentDefinitions method and its JSDoc comments as per REFACTOR-LOADER-2.
     * The generic loadItemsForMod in the base class should be used instead.
     */


    /**
     * Processes a single fetched component definition file's data **after** primary schema validation by the base class.
     * This method is called by the base class's `_processFileWrapper`.
     * It extracts and validates the required `id` and `dataSchema` properties,
     * registers the `dataSchema` with the ISchemaValidator using the **full component ID from the file** (e.g., `core:health`), handling overrides,
     * constructs the **final, prefixed** `finalItemId` (`modId:baseComponentId`),
     * and delegates storage to the base class helper `_storeItemInRegistry`.
     * Returns the **final, prefixed** `finalItemId`.
     *
     * **Important:** The component's `dataSchema` is registered using the **full ID from the file** (e.g., `core:health`),
     * while the component definition itself is stored in the registry using the **prefixed ID derived from modId and baseId**
     * (e.g., `core:health`) by the `_storeItemInRegistry` helper.
     *
     * @param {string} modId - The ID of the mod the item belongs to.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path used to fetch the file.
     * @param {any} data - The raw, parsed data object fetched from the file (already validated against primary schema).
     * @param {string} typeName - The content type name ('components').
     * @returns {Promise<string>} A promise resolving with the **fully qualified, prefixed** component ID (`finalItemId`) on successful processing.
     * @throws {Error} Throws an error if configuration is missing, validation fails, schema registration fails, or storage fails.
     * @protected
     * @override
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        // AC: Located _processFetchedItem method
        this._logger.debug(`ComponentLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`);
        console.log(`[DEBUG][${modId}] START _processFetchedItem for ${filename}`); // DEBUG START

        // AC: ComponentLoader._processFetchedItem no longer contains the manual code block for primary schema validation.
        // --- REMOVED: Definition Schema Validation Block ---
        // The primary schema validation (using _getContentTypeSchemaId and _schemaValidator.validate)
        // is now handled by the BaseManifestItemLoader._processFileWrapper *before* this method is called.

        // AC: All existing component-specific logic within _processFetchedItem remains functional.

        // --- 1. Property Extraction --- (Was step 2)
        // AC: Retain the existing logic for extracting and validating componentId (base ID) and dataSchema.
        const componentIdFromFile = data.id; // e.g., "core:health" or "health"
        const dataSchema = data.dataSchema;
        console.log(`[DEBUG][${modId}] Extracted id: ${JSON.stringify(componentIdFromFile)}, dataSchema type: ${typeof dataSchema}`); // DEBUG VALUES

        // --- 2. Property Validation --- (Was step 3)
        // Use toString() before trim() for safety in case componentIdFromFile is not a string (e.g., null)
        const trimmedComponentIdFromFile = componentIdFromFile?.toString().trim();
        console.log(`[DEBUG][${modId}] Trimmed id: ${JSON.stringify(trimmedComponentIdFromFile)}`); // DEBUG TRIMMED ID

        if (!trimmedComponentIdFromFile) {
            console.error(`[DEBUG][${modId}] INVALID ID DETECTED in ${filename}. Throwing...`); // DEBUG THROW POINT 1
            const errorMsg = `ComponentLoader [${modId}]: Missing or invalid 'id' field in component definition file '${filename}'. Found: ${JSON.stringify(componentIdFromFile)}`;
            this._logger.error(errorMsg, {modId, filename, resolvedPath, componentIdValue: componentIdFromFile});
            throw new Error(`Invalid Component ID in ${filename}`);
        }

        // Extract BASE component ID (e.g., "health" from "core:health" or just "health")
        // This ID is used for constructing the final storage key.
        const idParts = trimmedComponentIdFromFile.split(':');
        const baseComponentId = idParts.length > 1 ? idParts.slice(1).join(':') : idParts[0];
        console.log(`[DEBUG][${modId}] Base id: ${JSON.stringify(baseComponentId)}`); // DEBUG BASE ID

        // Also check if baseComponentId became empty after splitting/trimming
        if (!baseComponentId) {
            console.error(`[DEBUG][${modId}] INVALID BASE ID DETECTED from '${trimmedComponentIdFromFile}' in ${filename}. Throwing...`); // DEBUG THROW POINT 1.5
            this._logger.error(`ComponentLoader [${modId}]: Could not extract valid base ID from component ID '${trimmedComponentIdFromFile}' in file '${filename}'.`);
            throw new Error(`Could not extract base Component ID from '${trimmedComponentIdFromFile}' in ${filename}`);
        }

        if (typeof dataSchema !== 'object' || dataSchema === null) {
            const dataType = dataSchema === null ? 'null' : typeof dataSchema;
            console.error(`[DEBUG][${modId}] INVALID dataSchema DETECTED in ${filename} (type: ${dataType}). Throwing...`); // DEBUG THROW POINT 2
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
        this._logger.debug(`ComponentLoader [${modId}]: Extracted full ID '${trimmedComponentIdFromFile}' and base ID '${baseComponentId}' from ${filename}.`);
        console.log(`[DEBUG][${modId}] Validation PASSED for ${filename}. Proceeding to schema registration.`); // DEBUG PRE-ADD-SCHEMA

        // --- 3. Schema Registration with Override Check --- (Was step 4)
        // AC: Retain logic for handling overrides, registering dataSchema via this._schemaValidator.addSchema
        this._logger.debug(`ComponentLoader [${modId}]: Attempting to register/manage data schema using FULL ID '${trimmedComponentIdFromFile}'.`);
        const alreadyLoaded = this._schemaValidator.isSchemaLoaded(trimmedComponentIdFromFile);

        if (alreadyLoaded) {
            this._logger.warn(`Component Definition '${filename}' in mod '${modId}' is overwriting an existing data schema for component ID '${trimmedComponentIdFromFile}'.`);
            try {
                const removed = this._schemaValidator.removeSchema(trimmedComponentIdFromFile);
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
                // Decide whether to re-throw based on application requirements
                throw removalError;
            }
        }

        try {
            // AC: Ensure registering dataSchema via this._schemaValidator.addSchema remains functional
            console.log(`[DEBUG][${modId}] Calling addSchema for ${trimmedComponentIdFromFile}`); // DEBUG ADD SCHEMA CALL
            await this._schemaValidator.addSchema(dataSchema, trimmedComponentIdFromFile);
            console.log(`[DEBUG][${modId}] addSchema call finished for ${trimmedComponentIdFromFile}`); // DEBUG ADD SCHEMA DONE
            this._logger.debug(`ComponentLoader [${modId}]: Registered dataSchema for component ID '${trimmedComponentIdFromFile}' from file '${filename}'.`);
        } catch (error) {
            const addLogMsg = `ComponentLoader [${modId}]: Error during addSchema for component '${trimmedComponentIdFromFile}' from file '${filename}'.`;
            this._logger.error(addLogMsg, {
                modId,
                filename,
                componentId: trimmedComponentIdFromFile,
                error: error
            }, error);
            // Decide whether to re-throw based on application requirements
            throw error;
        }

        // --- 4. Construct Final Item ID --- (Was step 5)
        // AC: Retain logic for constructing finalItemId
        // Using the *base* component ID for consistency as per REFACTOR-2's storage helper convention.
        const finalItemId = `${modId}:${baseComponentId}`; // e.g., "core:health"
        this._logger.debug(`ComponentLoader [${modId}]: Constructed finalItemId for registry: '${finalItemId}'.`);

        // --- 5. Store Component Definition Metadata (Using Helper) --- (Was step 6)
        // AC: Retain logic for calling _storeItemInRegistry
        this._logger.debug(`ComponentLoader [${modId}]: Delegating storage of component definition metadata using BASE ID '${baseComponentId}' to base class helper.`);

        try {
            // Call the base helper, passing the BASE component ID.
            // The helper is responsible for creating the `finalItemId` key (`modId:baseComponentId`)
            // and augmenting the 'data' object with the finalItemId in the 'id' field before storing.
            this._storeItemInRegistry('components', modId, baseComponentId, data, filename);
            // Success logging is handled within the helper.
        } catch (storageError) {
            // Error logging is handled within the helper. Re-throw to allow _processFileWrapper to catch it.
            throw storageError;
        }

        // --- 6. Return the Final Item ID --- (Was step 7)
        // AC: Ensure the method returns the finalItemId.
        // The final ID represents the key used in the registry.
        this._logger.debug(`ComponentLoader [${modId}]: Successfully processed component definition from ${filename}. Returning final ID: ${finalItemId}`);
        console.log(`[DEBUG][${modId}] END _processFetchedItem for ${filename}`); // DEBUG END
        return finalItemId;
    }

}

export default ComponentLoader;