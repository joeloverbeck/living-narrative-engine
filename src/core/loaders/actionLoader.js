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
/** @typedef {import('../interfaces/validation.js').ValidationResult} ValidationResult */

// --- Base Class Import ---
import {BaseManifestItemLoader} from './baseManifestItemLoader.js'; // Correct path assumed based on sibling loaders

/**
 * Loads action definitions from mods.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic.
 * The content type managed by this loader is 'actions'.
 *
 * @class ActionLoader
 * @extends BaseManifestItemLoader
 */
class ActionLoader extends BaseManifestItemLoader { // Inheritance specified

    /**
     * Creates an instance of ActionLoader.
     * Passes dependencies and the specific contentType 'actions' to the base class constructor.
     *
     * @param {IConfiguration} config - Configuration service instance.
     * @param {IPathResolver} pathResolver - Path resolution service instance.
     * @param {IDataFetcher} dataFetcher - Data fetching service instance.
     * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
     * @param {IDataRegistry} dataRegistry - Data registry service instance.
     * @param {ILogger} logger - Logging service instance.
     * @throws {TypeError} Inherited from BaseManifestItemLoader if dependencies are invalid.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        super('actions', config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger);
        this._logger.debug(`ActionLoader: Initialized.`);
    }

    /**
     * Processes a single fetched action definition file's data. Validates the data
     * using the base class's primary schema validation, extracts and validates the
     * namespaced action ID (e.g., `namespace:action_name`), extracts the base
     * (un-prefixed) action ID (e.g., `action_name`), and delegates storage to the
     * base class's `_storeItemInRegistry` helper using the **base** action ID.
     * Returns the **fully qualified** action ID (`modId:namespace:action_name`).
     *
     * @override
     * @protected
     * @async
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} data - The raw data fetched from the file.
     * @param {string} typeName - The content type name ('actions').
     * @returns {Promise<string>} The **fully qualified** action ID (e.g., "MyMod:core:action_attack") upon success.
     * @throws {Error} If validation, ID validation/extraction, or storage fails. Propagated from base helpers or thrown directly.
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        this._logger.debug(`ActionLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`);

        try {
            this._validatePrimarySchema(data, filename, modId, resolvedPath);
        } catch (validationError) {
            this._logger.error(`ActionLoader [${modId}]: Halting processing for '${filename}' due to primary schema validation error.`);
            throw validationError;
        }

        // --- Step 2: ID Extraction & Validation ---
        const idFromFile = data.id;

        if (typeof idFromFile !== 'string' || idFromFile.trim() === '') {
            this._logger.error(
                `ActionLoader [${modId}]: Invalid or missing 'id' in action definition file '${filename}'. ID must be a non-empty string.`,
                {modId, filename, resolvedPath, receivedId: idFromFile}
            );
            throw new Error(`Invalid or missing 'id' in action definition file '${filename}' for mod '${modId}'.`);
        }

        const trimmedIdFromFile = idFromFile.trim();

        // --- CORRECTED: Refined Base ID Extraction Logic ---
        const idParts = trimmedIdFromFile.split(':');
        let baseActionId = null; // Initialize to null

        if (idParts.length === 1) {
            // Case: "name"
            const potentialBaseId = idParts[0].trim();
            if (potentialBaseId) { // Ensure it's not just whitespace
                baseActionId = potentialBaseId;
            }
        } else if (idParts.length > 1) {
            // Case: "ns:name" or potentially invalid like "ns:" or ":name"
            const namespacePart = idParts[0].trim();
            // Join back in case of multiple colons in name part, then trim
            const namePart = idParts.slice(1).join(':').trim();
            // BOTH parts must be non-empty after trimming
            if (namespacePart && namePart) {
                baseActionId = namePart;
            }
            // If either part is empty, baseActionId remains null
        }

        // Check if baseActionId was successfully extracted (is not null)
        if (!baseActionId) {
            this._logger.error(`ActionLoader [${modId}]: Could not extract valid base ID from ID '${trimmedIdFromFile}' in file '${filename}'. Format requires 'name' or 'namespace:name' with non-empty parts.`);
            // Throw a more specific error message matching the test expectation update
            throw new Error(`Could not extract base Action ID from '${trimmedIdFromFile}' in ${filename}. Invalid format.`);
        }
        // --- END CORRECTION ---

        this._logger.debug(`ActionLoader [${modId}]: Extracted full ID '${trimmedIdFromFile}' and base ID '${baseActionId}' from ${filename}.`);

        const fullyQualifiedId = `${modId}:${trimmedIdFromFile}`;

        // --- Step 3: Data Storage (Using Base Helper) ---
        this._logger.debug(`ActionLoader [${modId}]: Delegating storage for action (base ID: '${baseActionId}') from ${filename} to base helper.`);
        try {
            this._storeItemInRegistry('actions', modId, baseActionId, data, filename);
        } catch (storageError) {
            throw storageError;
        }

        // --- Step 4: Return Value ---
        this._logger.debug(`ActionLoader [${modId}]: Successfully processed action from ${filename}. Returning fully qualified ID: ${fullyQualifiedId}`);
        return fullyQualifiedId;
    }
}

export default ActionLoader;
