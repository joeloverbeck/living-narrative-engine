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
        super(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger); // Calls super() passing dependencies

        // Retrieve and cache the schema ID for actions
        this.#actionSchemaId = this._config.getContentTypeSchemaId('actions'); // Calls _config.getContentTypeSchemaId('actions') and stores result

        // Log error if schema ID is not found
        if (this.#actionSchemaId == null) { // Checks for undefined or null
            // *** CORRECTION: Use consistent class name in log ***
            this._logger.error("ActionLoader: CRITICAL - Schema ID for 'actions' not found in configuration."); // Logs error on missing schema ID
        }

        // Log debug message with cached schema ID status
        // *** CORRECTION: Use consistent class name in log ***
        this._logger.debug(`ActionLoader: Initialized. Action schema ID: ${this.#actionSchemaId ? `'${this.#actionSchemaId}'` : 'NOT FOUND'}.`); // Logs debug message confirming initialization and cached ID
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
        // *** CORRECTION: Use consistent class name in log ***
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
     * against the action definition schema, extracts and validates the action ID,
     * checks for existing definitions using the fully qualified ID (modId:actionId),
     * and stores the data in the registry using the qualified ID.
     * @override
     * @protected
     * @async
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} data - The raw data fetched from the file.
     * @param {string} typeName - The content type name (e.g., 'actions').
     * @returns {Promise<string>} The fully qualified action ID (modId:actionId) upon success.
     * @throws {Error} If schema validation, ID validation, or storage fails.
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        // *** CORRECTION: Use consistent class name in log ***
        this._logger.debug(`ActionLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`);

        // --- Step 1: Schema Validation ---
        const schemaId = this.#actionSchemaId;

        if (!schemaId) {
            // *** CORRECTION: Use consistent class name in log ***
            this._logger.error(`ActionLoader [${modId}]: Cannot validate ${filename} - Action schema ID ('actions') is not configured or was not found.`);
            throw new Error(`Configuration Error: Action definition schema ID not configured.`);
        }

        const validationResult = this._schemaValidator.validate(schemaId, data);
        // *** CORRECTION: Use consistent class name in log ***
        this._logger.debug(`ActionLoader [${modId}]: Validated definition structure for ${filename}. Result: isValid=${validationResult.isValid}`);

        if (!validationResult.isValid) {
            const errorDetails = JSON.stringify(validationResult.errors ?? [], null, 2);
            // *** CORRECTION: Use consistent class name in log ***
            this._logger.error(
                `ActionLoader [${modId}]: Schema validation failed for action definition '${filename}' using schema '${schemaId}'. Errors:\n${errorDetails}`,
                {modId, filename, resolvedPath, schemaId, validationErrors: validationResult.errors, failedData: data}
            );
            throw new Error(`Schema validation failed for action definition '${filename}' in mod '${modId}'.`);
        }
        // *** CORRECTION: Use consistent class name in log ***
        this._logger.debug(`ActionLoader [${modId}]: Schema validation passed for ${filename}.`);
        // --- End Step 1 ---


        // --- Step 2: ID Extraction & Validation ---
        const actionId = data.id;

        if (typeof actionId !== 'string' || actionId.trim() === '') {
            // *** CORRECTION: Use consistent class name in log ***
            this._logger.error(
                `ActionLoader [${modId}]: Invalid or missing 'id' in action definition file '${filename}'. ID must be a non-empty string.`,
                {modId, filename, resolvedPath, receivedId: actionId}
            );
            throw new Error(`Invalid or missing 'id' in action definition file '${filename}' for mod '${modId}'.`);
        }

        const trimmedActionId = actionId.trim();
        // *** CORRECTION: Use consistent class name in log ***
        this._logger.debug(`ActionLoader [${modId}]: Extracted and validated action ID '${trimmedActionId}' from ${filename}.`);

        // *** CORRECTION: Construct final ID (modId:actionId) *before* registry checks/stores ***
        const finalActionId = `${modId}:${trimmedActionId}`;
        // --- End Step 2 ---


        // --- Step 3: Overwrite Check & Data Storage ---
        // AC: Construct dataToStore object with modId and _sourceFile
        const dataToStore = {
            ...data, // Shallow copy original data
            id: finalActionId, // Store the final, fully qualified ID in the object itself
            modId: modId,
            _sourceFile: filename
        };

        // AC: Call dataRegistry.get to check for existing definition
        // *** CORRECTION: Use finalActionId for get check ***
        const existingDefinition = this._dataRegistry.get('actions', finalActionId);

        // AC: Check if definition exists and log warning if overwriting
        if (existingDefinition != null) { // Checks for non-null and non-undefined
            // *** CORRECTION: Use consistent class name in log ***
            // *** CORRECTION: Log uses finalActionId and includes more context ***
            this._logger.warn(
                `ActionLoader [${modId}]: Overwriting existing action definition with ID '${finalActionId}'. ` +
                `Source: ${filename}. (Previous source: ${existingDefinition._sourceFile} from mod '${existingDefinition.modId}')`
            );
        }

        // AC: Call dataRegistry.store to save the definition
        // AC: If store throws, error propagates (handled by base class wrapper)
        try {
            // *** CORRECTION: Use finalActionId for store key ***
            this._dataRegistry.store('actions', finalActionId, dataToStore);
            // AC: Log debug message confirming successful storage
            // *** CORRECTION: Use consistent class name in log and finalActionId ***
            this._logger.debug(`ActionLoader [${modId}]: Stored action definition '${finalActionId}' from ${filename}.`);
        } catch (storageError) {
            // Log the specific storage error before allowing it to propagate
            // *** CORRECTION: Use consistent class name in log and finalActionId ***
            this._logger.error(
                `ActionLoader [${modId}]: Failed to store action definition '${finalActionId}' from file '${filename}' in data registry.`,
                {modId, filename, resolvedPath, actionId: finalActionId, error: storageError}
            );
            throw storageError; // Re-throw the error to be caught by _processFileWrapper
        }
        // --- End Step 3 ---

        // *** CORRECTION: Return the final, fully qualified ID ***
        return finalActionId;
    }
}

export default ActionLoader;