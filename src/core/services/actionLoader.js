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
import {BaseManifestItemLoader} from './baseManifestItemLoader.js'; // Correct path assumed based on sibling loaders [cite: 1]

/**
 * Loads action definitions from mods.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic.
 * Specific processing for action definitions will be implemented in this class.
 *
 * @class ActionLoader
 * @extends BaseManifestItemLoader
 */
class ActionLoader extends BaseManifestItemLoader { // Inheritance specified [cite: 1]

    /**
     * @private
     * @type {string | undefined | null} - Cached schema ID for action definitions.
     */
    #actionSchemaId;

    /**
     * Creates an instance of ActionLoader.
     * Passes dependencies to the base class constructor and caches the action schema ID.
     *
     * @param {IConfiguration} config - Configuration service instance.
     * @param {IPathResolver} pathResolver - Path resolution service instance.
     * @param {IDataFetcher} dataFetcher - Data fetching service instance.
     * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
     * @param {IDataRegistry} dataRegistry - Data registry service instance.
     * @param {ILogger} logger - Logging service instance.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        // Call the parent constructor with all necessary dependencies
        super(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger); // Calls super() passing dependencies [cite: 1]

        // Retrieve and cache the schema ID for actions
        this.#actionSchemaId = this._config.getContentTypeSchemaId('actions'); // Calls _config.getContentTypeSchemaId('actions') and stores result [cite: 1]

        // Log error if schema ID is not found
        if (this.#actionSchemaId == null) { // Checks for undefined or null [cite: 1]
            this._logger.error("ActionLoader: CRITICAL - Schema ID for 'actions' not found in configuration."); // Logs error on missing schema ID [cite: 1]
        }

        // Log debug message with cached schema ID status
        this._logger.debug(`ActionLoader: Initialized. Action schema ID: ${this.#actionSchemaId ? `'${this.#actionSchemaId}'` : 'NOT FOUND'}.`); // Logs debug message confirming initialization and cached ID [cite: 1]
    }

    /**
     * Loads and registers action definitions for a given mod based on its manifest.
     * This method delegates to the base class's internal loading mechanism,
     * which in turn calls this class's _processFetchedItem implementation.
     *
     * @param {string} modId - The ID of the mod.
     * @param {ModManifest} modManifest - The manifest object for the mod. // Corrected type hint assumption [cite: 1]
     * @returns {Promise<number>} A promise that resolves with the count of successfully loaded action definitions.
     * @async
     * @public // Added for clarity, though JS doesn't enforce [cite: 1]
     */
    async loadActionsForMod(modId, modManifest) { // AC: Async public method 'loadActionsForMod' added [cite: 1]
        // AC: Accepts modId and modManifest arguments [cite: 1]
        this._logger.info(`ActionLoader: Loading action definitions for mod '${modId}'.`); // AC: Logs informational message [cite: 1]

        // Basic input validation
        if (!modId || !modManifest) {
            this._logger.error('ActionLoader: Mod ID or Manifest is missing for loadActionsForMod.', {
                modId,
                modManifest
            });
            // Consider throwing an error or returning 0 based on desired strictness
            return 0;
        }

        // AC: Calls protected _loadItemsInternal method [cite: 1]
        // Delegate to the base class's protected method for loading items.
        // AC: Passes modId, modManifest, 'actions' (contentKey), 'actions' (contentTypeDir), 'actions' (typeName) [cite: 1]
        const count = await this._loadItemsInternal(modId, modManifest, 'actions', 'actions', 'actions'); // AC: Awaits result [cite: 1]

        // AC: Returns the numerical count received from _loadItemsInternal [cite: 1]
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
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) { // [cite: 1]
        // AC: Located _processFetchedItem [cite: 1]
        this._logger.debug(`ActionLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`); // [cite: 1]

        // --- Step 1: Schema Validation ---
        // AC: Retain the existing logic for: Validating the action schema.
        const schemaId = this.#actionSchemaId; // [cite: 1]

        if (!schemaId) { // [cite: 1]
            this._logger.error(`ActionLoader [${modId}]: Cannot validate ${filename} - Action schema ID ('actions') is not configured or was not found.`); // [cite: 1]
            throw new Error(`Configuration Error: Action definition schema ID not configured.`); // [cite: 1]
        }

        const validationResult = this._schemaValidator.validate(schemaId, data); // [cite: 1]
        this._logger.debug(`ActionLoader [${modId}]: Validated definition structure for ${filename}. Result: isValid=${validationResult.isValid}`); // [cite: 1]

        if (!validationResult.isValid) { // [cite: 1]
            const errorDetails = JSON.stringify(validationResult.errors ?? [], null, 2); // [cite: 1]
            this._logger.error( // [cite: 1]
                `ActionLoader [${modId}]: Schema validation failed for action definition '${filename}' using schema '${schemaId}'. Errors:\n${errorDetails}`, // [cite: 1]
                {modId, filename, resolvedPath, schemaId, validationErrors: validationResult.errors, failedData: data} // [cite: 1]
            );
            throw new Error(`Schema validation failed for action definition '${filename}' in mod '${modId}'.`); // [cite: 1]
        }
        this._logger.debug(`ActionLoader [${modId}]: Schema validation passed for ${filename}.`); // [cite: 1]
        // --- End Step 1 ---


        // --- Step 2: ID Extraction & Validation ---
        // AC: Retain the existing logic for: Extracting and validating the actionId (base ID).
        // AC: Retain the existing logic for: Constructing the finalActionId (e.g., ${modId}:${trimmedActionId}).
        const namespacedActionId = data.id; // e.g., "core:action_attack" [cite: 1]

        if (typeof namespacedActionId !== 'string' || namespacedActionId.trim() === '') { // [cite: 1]
            this._logger.error( // [cite: 1]
                `ActionLoader [${modId}]: Invalid or missing 'id' in action definition file '${filename}'. ID must be a non-empty namespaced string (e.g., 'namespace:action_name').`, // [cite: 1]
                {modId, filename, resolvedPath, receivedId: namespacedActionId} // [cite: 1]
            );
            throw new Error(`Invalid or missing 'id' in action definition file '${filename}' for mod '${modId}'.`); // [cite: 1]
        }

        // NOTE: `trimmedNamespacedActionId` holds the NAMESPACED id from the file.
        const trimmedNamespacedActionId = namespacedActionId.trim(); // e.g., "core:action_attack" [cite: 1]

        // Extract the *base* action ID (un-prefixed by namespace) for the storage helper.
        const idParts = trimmedNamespacedActionId.split(':'); // [cite: 1]
        if (idParts.length !== 2 || !idParts[0].trim() || !idParts[1].trim()) { // [cite: 1]
            this._logger.error( // [cite: 1]
                `ActionLoader [${modId}]: Invalid 'id' format in action definition file '${filename}'. ID '${trimmedNamespacedActionId}' must be in 'namespace:action_name' format.`, // [cite: 1]
                {modId, filename, resolvedPath, receivedId: trimmedNamespacedActionId} // [cite: 1]
            );
            throw new Error(`Invalid 'id' format ('${trimmedNamespacedActionId}') in action definition file '${filename}' for mod '${modId}'. Must be 'namespace:action_name'.`); // [cite: 1]
        }
        // The base ID is the part AFTER the colon, used for registry key construction by the helper.
        const baseActionId = idParts[1]; // e.g., "action_attack" [cite: 1]

        this._logger.debug(`ActionLoader [${modId}]: Extracted namespaced ID '${trimmedNamespacedActionId}' and base ID '${baseActionId}' from ${filename}.`); // [cite: 1]

        // The fully qualified ID includes the modId and the namespaced ID from the file.
        const fullyQualifiedId = `${modId}:${trimmedNamespacedActionId}`; // e.g., "MyMod:core:action_attack" [cite: 1]
        // --- End Step 2 ---


        // --- Step 3: Data Storage (Using Base Helper) ---
        // AC: Remove: Delete the existing code block responsible for calling _dataRegistry.get, logging warnings, augmenting data, and calling _dataRegistry.store.
        // AC: Add: Insert a call to this._storeItemInRegistry('actions', finalActionId, data, modId, filename). Ensure data passed is the original fetched data object.
        // ---> MODIFICATION: Calling base helper with baseActionId instead of finalActionId, consistent with other loaders and base class docs.
        // AC: _processFetchedItem correctly calls this._storeItemInRegistry with 'actions', the finalActionId (using baseActionId), the original data, modId, and filename.
        this._logger.debug(`ActionLoader [${modId}]: Delegating storage for action (base ID: '${baseActionId}') from ${filename} to base helper.`); // [cite: 1]
        try {
            // Use the BASE action ID (without namespace) for the helper.
            // The helper constructs the final key (`modId:baseActionId`) and augments the data.
            this._storeItemInRegistry('actions', modId, baseActionId, data, filename); // [cite: 1, 20]
            // Success/overwrite logging is handled within the base helper method. [cite: 20]
        } catch (storageError) { // [cite: 20]
            // Error logging is handled within the base helper. Re-throw to allow _processFileWrapper to catch it. [cite: 20]
            throw storageError; // [cite: 20]
        }
        // AC: ActionLoader._processFetchedItem no longer directly calls _dataRegistry.get or _dataRegistry.store. (Verified by replacement)
        // --- End Step 3 ---

        // --- Step 4: Return Value ---
        // AC: Ensure the method returns the finalActionId.
        // Return the fully qualified ID as required by the base class contract.
        this._logger.debug(`ActionLoader [${modId}]: Successfully processed action from ${filename}. Returning fully qualified ID: ${fullyQualifiedId}`); // [cite: 1]
        return fullyQualifiedId; // [cite: 1]
        // --- End Step 4 ---
    }
}

export default ActionLoader;