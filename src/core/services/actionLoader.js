// Filename: src/core/services/actionLoader.js

/**
 * @fileoverview Defines the ActionLoader class, responsible for loading
 * action definitions from mods based on the manifest.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest */ // Assuming ModManifest type is defined here or imported

// --- Base Class Import ---
import {BaseManifestItemLoader} from './baseManifestItemLoader.js'; // Correct path assumed based on sibling loaders

/**
 * Loads action definitions from mods.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic.
 * Specific processing for action definitions will be implemented in this class.
 *
 * @class ActionLoader
 * @extends BaseManifestItemLoader
 */
class ActionLoader extends BaseManifestItemLoader { // Inheritance specified

    /**
     * Creates an instance of ActionLoader.
     * Passes dependencies to the base class constructor and checks for critical configuration.
     *
     * @param {IConfiguration} config - Configuration service instance.
     * @param {IPathResolver} pathResolver - Path resolution service instance.
     * @param {IDataFetcher} dataFetcher - Data fetching service instance.
     * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
     * @param {IDataRegistry} dataRegistry - Data registry service instance.
     * @param {ILogger} logger - Logging service instance.
     * @throws {Error} If critical configuration (like action schema ID) is missing and throwing is deemed appropriate.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        // Call the parent constructor first to initialize dependencies and logger
        super(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger); // Calls super() passing dependencies

        // --- ADDED: Check for Action Schema ID during construction ---
        // Use the base class helper to get the schema ID. The helper logs a warning if not found.
        const actionSchemaId = this._getContentTypeSchemaId('actions');
        if (actionSchemaId == null) {
            // Log a specific critical error as expected by the test
            this._logger.error(
                `ActionLoader: CRITICAL - Schema ID for 'actions' not found in configuration.`
            );
            // Optionally, throw an error if the loader is considered unusable without this config
            // throw new Error("ActionLoader critical configuration error: 'actions' schema ID missing.");
        }
        // --- END ADDED CHECK ---

        // Log debug message confirming initialization (if no critical error was thrown)
        this._logger.debug(`ActionLoader: Initialized.`); // Logs debug message confirming initialization
    }

    /**
     * Loads and registers action definitions for a given mod based on its manifest.
     * This method delegates to the base class's internal loading mechanism,
     * which in turn calls this class's _processFetchedItem implementation.
     *
     * @param {string} modId - The ID of the mod.
     * @param {ModManifest} modManifest - The manifest object for the mod. // Corrected type hint assumption
     * @returns {Promise<number>} A promise that resolves with the count of successfully loaded action definitions.
     * @async
     * @public // Added for clarity, though JS doesn't enforce
     */
    async loadActionsForMod(modId, modManifest) { // AC: Async public method 'loadActionsForMod' added
        // AC: Accepts modId and modManifest arguments
        this._logger.info(`ActionLoader: Loading action definitions for mod '${modId}'.`); // AC: Logs informational message

        // Basic input validation
        if (!modId || !modManifest) {
            this._logger.error('ActionLoader: Mod ID or Manifest is missing for loadActionsForMod.', {
                modId,
                modManifest
            });
            // Consider throwing an error or returning 0 based on desired strictness
            return 0;
        }

        // AC: Calls protected _loadItemsInternal method
        // Delegate to the base class's protected method for loading items.
        // AC: Passes modId, modManifest, 'actions' (contentKey), 'actions' (contentTypeDir), 'actions' (typeName)
        const count = await this._loadItemsInternal(modId, modManifest, 'actions', 'actions', 'actions'); // AC: Awaits result

        // AC: Returns the numerical count received from _loadItemsInternal
        return count;
    }


    /**
     * Processes a single fetched action definition file's data. Validates the data
     * against the action definition schema, extracts and validates the namespaced action ID
     * (e.g., `namespace:action_name`), extracts the base (un-prefixed) action ID
     * (e.g., `action_name`), and delegates storage to the base class's
     * `_storeItemInRegistry` helper using the **base** action ID. The helper handles
     * creating the final prefixed key (`modId:baseActionId`) for storage.
     * Returns the **fully qualified** action ID (`modId:namespace:action_name`).
     *
     * @override
     * @protected
     * @async
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} data - The raw data fetched from the file.
     * @param {string} typeName - The content type name (e.g., 'actions').
     * @returns {Promise<string>} The **fully qualified** action ID (e.g., "MyMod:core:action_attack") upon success.
     * @throws {Error} If schema validation, ID validation/extraction, or storage fails.
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) { //
        // AC: Located _processFetchedItem
        this._logger.debug(`ActionLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`); //

        // --- Step 1: Schema Validation ---
        // AC: Retain the existing logic for: Validating the action schema.
        // USE HELPER: Retrieve schema ID using the base class helper
        const schemaId = this._getContentTypeSchemaId('actions'); //

        if (!schemaId) { //
            // Warning logged by helper, but throw error here as validation cannot proceed
            this._logger.error(`ActionLoader [${modId}]: Cannot validate ${filename} - Action schema ID ('actions') is not configured or was not found.`); //
            throw new Error(`Configuration Error: Action definition schema ID ('actions') not configured.`); //
        }

        const validationResult = this._schemaValidator.validate(schemaId, data); //
        this._logger.debug(`ActionLoader [${modId}]: Validated definition structure for ${filename}. Result: isValid=${validationResult.isValid}`); //

        if (!validationResult.isValid) { //
            const errorDetails = JSON.stringify(validationResult.errors ?? [], null, 2); //
            this._logger.error( //
                `ActionLoader [${modId}]: Schema validation failed for action definition '${filename}' using schema '${schemaId}'. Errors:\n${errorDetails}`, //
                {modId, filename, resolvedPath, schemaId, validationErrors: validationResult.errors, failedData: data} //
            );
            throw new Error(`Schema validation failed for action definition '${filename}' in mod '${modId}'.`); //
        }
        this._logger.debug(`ActionLoader [${modId}]: Schema validation passed for ${filename}.`); //
        // --- End Step 1 ---


        // --- Step 2: ID Extraction & Validation ---
        // AC: Retain the existing logic for: Extracting and validating the actionId (base ID).
        // AC: Retain the existing logic for: Constructing the finalActionId (e.g., ${modId}:${trimmedActionId}).
        const namespacedActionId = data.id; // e.g., "core:action_attack"

        if (typeof namespacedActionId !== 'string' || namespacedActionId.trim() === '') { //
            this._logger.error( //
                `ActionLoader [${modId}]: Invalid or missing 'id' in action definition file '${filename}'. ID must be a non-empty namespaced string (e.g., 'namespace:action_name').`, //
                {modId, filename, resolvedPath, receivedId: namespacedActionId} //
            );
            throw new Error(`Invalid or missing 'id' in action definition file '${filename}' for mod '${modId}'.`); //
        }

        // NOTE: `trimmedNamespacedActionId` holds the NAMESPACED id from the file.
        const trimmedNamespacedActionId = namespacedActionId.trim(); // e.g., "core:action_attack"

        // Extract the *base* action ID (un-prefixed by namespace) for the storage helper.
        const idParts = trimmedNamespacedActionId.split(':'); //
        if (idParts.length !== 2 || !idParts[0].trim() || !idParts[1].trim()) { //
            this._logger.error( //
                `ActionLoader [${modId}]: Invalid 'id' format in action definition file '${filename}'. ID '${trimmedNamespacedActionId}' must be in 'namespace:action_name' format.`, //
                {modId, filename, resolvedPath, receivedId: trimmedNamespacedActionId} //
            );
            throw new Error(`Invalid 'id' format ('${trimmedNamespacedActionId}') in action definition file '${filename}' for mod '${modId}'. Must be 'namespace:action_name'.`); //
        }
        // The base ID is the part AFTER the colon, used for registry key construction by the helper.
        const baseActionId = idParts[1]; // e.g., "action_attack"

        this._logger.debug(`ActionLoader [${modId}]: Extracted namespaced ID '${trimmedNamespacedActionId}' and base ID '${baseActionId}' from ${filename}.`); //

        // The fully qualified ID includes the modId and the namespaced ID from the file.
        const fullyQualifiedId = `${modId}:${trimmedNamespacedActionId}`; // e.g., "MyMod:core:action_attack"
        // --- End Step 2 ---


        // --- Step 3: Data Storage (Using Base Helper) ---
        // AC: Remove: Delete the existing code block responsible for calling _dataRegistry.get, logging warnings, augmenting data, and calling _dataRegistry.store.
        // AC: Add: Insert a call to this._storeItemInRegistry('actions', finalActionId, data, modId, filename). Ensure data passed is the original fetched data object.
        // ---> MODIFICATION: Calling base helper with baseActionId instead of finalActionId, consistent with other loaders and base class docs.
        // AC: _processFetchedItem correctly calls this._storeItemInRegistry with 'actions', the finalActionId (using baseActionId), the original data, modId, and filename.
        this._logger.debug(`ActionLoader [${modId}]: Delegating storage for action (base ID: '${baseActionId}') from ${filename} to base helper.`); //
        try {
            // Use the BASE action ID (without namespace) for the helper.
            // The helper constructs the final key (`modId:baseActionId`) and augments the data.
            this._storeItemInRegistry('actions', modId, baseActionId, data, filename); //
            // Success/overwrite logging is handled within the base helper method.
        } catch (storageError) { //
            // Error logging is handled within the base helper. Re-throw to allow _processFileWrapper to catch it.
            throw storageError; //
        }
        // AC: ActionLoader._processFetchedItem no longer directly calls _dataRegistry.get or _dataRegistry.store. (Verified by replacement)
        // --- End Step 3 ---

        // --- Step 4: Return Value ---
        // AC: Ensure the method returns the finalActionId.
        // Return the fully qualified ID as required by the base class contract.
        this._logger.debug(`ActionLoader [${modId}]: Successfully processed action from ${filename}. Returning fully qualified ID: ${fullyQualifiedId}`); //
        return fullyQualifiedId; //
        // --- End Step 4 ---
    }
}

export default ActionLoader;