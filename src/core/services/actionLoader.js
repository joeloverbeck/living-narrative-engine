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

    // --- METHOD REMOVED: loadActionsForMod ---
    /*
     * Removed the loadActionsForMod method and its JSDoc comments as per REFACTOR-LOADER-2.
     * The generic loadItemsForMod in the base class should be used instead.
     */


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
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        this._logger.debug(`ActionLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`);

        // --- Step 1: Schema Validation ---
        const schemaId = this._getContentTypeSchemaId('actions');
        if (!schemaId) {
            this._logger.error(`ActionLoader [${modId}]: Cannot validate ${filename} - Action schema ID ('actions') is not configured or was not found.`);
            throw new Error(`Configuration Error: Action definition schema ID ('actions') not configured.`);
        }
        const validationResult = this._schemaValidator.validate(schemaId, data);
        if (!validationResult.isValid) {
            const errorDetails = JSON.stringify(validationResult.errors ?? [], null, 2);
            this._logger.error(
                `ActionLoader [${modId}]: Schema validation failed for action definition '${filename}' using schema '${schemaId}'. Errors:\n${errorDetails}`,
                {modId, filename, resolvedPath, schemaId, validationErrors: validationResult.errors, failedData: data}
            );
            throw new Error(`Schema validation failed for action definition '${filename}' in mod '${modId}'.`);
        }
        this._logger.debug(`ActionLoader [${modId}]: Schema validation passed for ${filename}.`);

        // --- Step 2: ID Extraction & Validation ---
        const idFromFile = data.id; // Can be "ns:name" or "name"

        if (typeof idFromFile !== 'string' || idFromFile.trim() === '') {
            this._logger.error(
                `ActionLoader [${modId}]: Invalid or missing 'id' in action definition file '${filename}'. ID must be a non-empty string.`,
                {modId, filename, resolvedPath, receivedId: idFromFile}
            );
            throw new Error(`Invalid or missing 'id' in action definition file '${filename}' for mod '${modId}'.`);
        }

        const trimmedIdFromFile = idFromFile.trim(); // e.g., "core:action_attack" or "cool_action"

        // **** FIX: Use robust base ID extraction ****
        const idParts = trimmedIdFromFile.split(':');
        // If colon exists and both parts are non-empty, assume ns:name format; otherwise, the whole ID is the base ID.
        // This handles "ns:name", "name", but would break on "ns:" or ":name" (which should be invalid anyway).
        const baseActionId = idParts.length > 1 && idParts[0].trim() && idParts[1].trim()
            ? idParts[1] // Get part after first colon
            : idParts[0]; // Use whole ID as base if no valid namespace format

        if (!baseActionId) { // Should not happen if initial check passed, but good failsafe
            this._logger.error(`ActionLoader [${modId}]: Could not extract valid base ID from ID '${trimmedIdFromFile}' in file '${filename}'.`);
            throw new Error(`Could not extract base Action ID from '${trimmedIdFromFile}' in ${filename}`);
        }
        // *******************************************

        this._logger.debug(`ActionLoader [${modId}]: Extracted full ID '${trimmedIdFromFile}' and base ID '${baseActionId}' from ${filename}.`);

        // Construct fully qualified ID for return value consistency (optional, depends on caller needs)
        // Using the trimmed ID from file ensures we capture the original intent (namespaced or not)
        const fullyQualifiedId = `${modId}:${trimmedIdFromFile}`;

        // --- Step 3: Data Storage (Using Base Helper) ---
        this._logger.debug(`ActionLoader [${modId}]: Delegating storage for action (base ID: '${baseActionId}') from ${filename} to base helper.`);
        try {
            // Use the extracted BASE action ID for the helper.
            this._storeItemInRegistry('actions', modId, baseActionId, data, filename);
        } catch (storageError) {
            // Error logging is handled within the base helper. Re-throw.
            throw storageError;
        }

        // --- Step 4: Return Value ---
        this._logger.debug(`ActionLoader [${modId}]: Successfully processed action from ${filename}. Returning fully qualified ID: ${fullyQualifiedId}`);
        return fullyQualifiedId; // Return consistent fully qualified ID format
    }
}

export default ActionLoader;