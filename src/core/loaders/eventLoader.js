// Filename: src/core/services/eventLoader.js

/**
 * @fileoverview Defines the EventLoader class, responsible for loading
 * event definitions from mods based on the manifest.
 */

// --- Base Class Import ---
// Adjust path relative to this file's location if needed
import {BaseManifestItemLoader} from './baseManifestItemLoader'; // Assuming it's in loaders sibling dir

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
// Assume manifest type might be defined elsewhere or use a generic object
/** @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest */

/**
 * Loads event definitions from mods.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic,
 * including primary schema validation. Specific processing for event definitions,
 * particularly payload schema registration, is implemented in this class.
 *
 * @class EventLoader
 * @extends BaseManifestItemLoader
 */
class EventLoader extends BaseManifestItemLoader {

    /**
     * Creates an instance of EventLoader.
     * Passes dependencies and the specific content type 'events' to the base class constructor.
     *
     * AC: The constructor is defined and accepts the standard core service dependencies.
     * AC: EventLoader constructor calls super() passing 'events' as the first argument, followed by the dependency arguments in the correct order.
     * @param {IConfiguration} config - Configuration service instance.
     * @param {IPathResolver} pathResolver - Path resolution service instance.
     * @param {IDataFetcher} dataFetcher - Data fetching service instance.
     * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
     * @param {IDataRegistry} dataRegistry - Data registry service instance.
     * @param {ILogger} logger - Logging service instance.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        // AC: Call super() passing 'events' and all dependencies.
        super('events', config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger);

        // AC: Log initialization message.
        this._logger.debug(`EventLoader: Initialized.`);
    }

    /**
     * Processes a single fetched event definition file's data after primary validation.
     * Validates the data against the primary event schema, extracts the event ID,
     * registers any inline payload schema, stores the definition in the registry via the base helper,
     * and returns the final registry key.
     *
     * AC: An implementation for the required protected async method _processFetchedItem(...) exists.
     * @override
     * @protected
     * @async
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} data - The raw data fetched from the file (this original object is used for storage).
     * @param {string} typeName - The content type name (should be 'events').
     * @returns {Promise<string>} A promise resolving with the fully qualified item ID (e.g., `modId:baseEventId`) upon successful processing.
     * @throws {Error} If primary validation fails (via _validatePrimarySchema), ID extraction fails, payload schema registration fails, or storage fails.
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        // Log entry point with correct class name
        this._logger.debug(`EventLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`);

        // AC: EventLoader._processFetchedItem calls this._validatePrimarySchema(data, filename, modId, resolvedPath) as the first step.
        // Base class handles logging success/failure internally. Will throw on failure.
        // Note: The test mocks this to succeed by default, allowing ID extraction logic to run.
        this._validatePrimarySchema(data, filename, modId, resolvedPath);

        // AC: EventLoader._processFetchedItem no longer contains the manual code block for retrieving the schema ID (_getContentTypeSchemaId) and calling this._schemaValidator.validate for the primary event schema.
        // --- MANUAL VALIDATION BLOCK REMOVED ---

        // AC: All existing event-specific logic within _processFetchedItem remains functional.
        // --- LOADER-003.3: Event ID Extraction & Validation Start ---
        const fullEventIdFromFile = data.id;
        if (typeof fullEventIdFromFile !== 'string' || fullEventIdFromFile.trim() === '') {
            const errorMsg = `EventLoader [${modId}]: Invalid or missing 'id' in event definition file '${filename}'. ID must be a non-empty string.`;
            this._logger.error(errorMsg, {modId, filename, resolvedPath, receivedId: fullEventIdFromFile});
            throw new Error(`Invalid or missing 'id' in event definition file '${filename}' for mod '${modId}'.`);
        }

        const trimmedFullEventId = fullEventIdFromFile.trim();
        let baseEventId = ''; // Initialize as empty

        // --- FIXED ID EXTRACTION LOGIC ---
        const colonIndex = trimmedFullEventId.indexOf(':');

        if (colonIndex === -1) {
            // No colon: Use the whole ID if it's not empty.
            baseEventId = trimmedFullEventId;
        } else if (colonIndex > 0 && colonIndex < trimmedFullEventId.length - 1) {
            // Colon found, and it's not at the start or end.
            const namespacePart = trimmedFullEventId.substring(0, colonIndex).trim();
            const baseIdPart = trimmedFullEventId.substring(colonIndex + 1).trim();
            // Both namespace and base ID must be non-empty after trimming.
            if (namespacePart && baseIdPart) {
                baseEventId = baseIdPart;
            }
            // If either part is empty (e.g., "ns: ", " :base"), baseEventId remains ''.
        }
        // If colon is at the start (index 0) or end (index length-1), or if parts were empty,
        // baseEventId will remain ''.

        // Check if a valid, non-empty baseEventId was extracted.
        if (!baseEventId) {
            const errorMsg = `EventLoader [${modId}]: Could not extract valid base event ID from full ID '${trimmedFullEventId}' in file '${filename}'. ID format must be 'namespace:baseId' or 'baseId' with non-empty parts.`;
            this._logger.error(errorMsg, {modId, filename, fullEventIdFromFile: trimmedFullEventId});
            // Throw the error that the test expects
            throw new Error(`Could not extract valid base event ID from '${trimmedFullEventId}' in ${filename}`);
        }
        // --- END FIXED ID EXTRACTION LOGIC ---

        this._logger.debug(`EventLoader [${modId}]: Extracted full event ID '${trimmedFullEventId}' and base event ID '${baseEventId}' from ${filename}.`);
        // --- LOADER-003.3 End ---

        // --- LOADER-003.4: Payload Schema Registration Start ---
        const payloadSchema = data.payloadSchema;
        // Check if payloadSchema exists, is an object, not null, and has properties
        if (payloadSchema && typeof payloadSchema === 'object' && Object.keys(payloadSchema).length > 0) {
            this._logger.debug(`EventLoader [${modId}]: Found valid payloadSchema in ${filename} for event '${trimmedFullEventId}'.`);
            const payloadSchemaId = `${trimmedFullEventId}#payload`; // Construct unique ID
            this._logger.debug(`EventLoader [${modId}]: Generated payload schema ID: ${payloadSchemaId}`);

            // AC: Checking for and registering payloadSchema via this._schemaValidator.addSchema remains functional.
            if (!this._schemaValidator.isSchemaLoaded(payloadSchemaId)) {
                this._logger.debug(`EventLoader [${modId}]: Payload schema '${payloadSchemaId}' not loaded. Attempting registration...`);
                try {
                    // Pass the schema object and its unique ID
                    await this._schemaValidator.addSchema(payloadSchema, payloadSchemaId);
                    this._logger.debug(`EventLoader [${modId}]: Successfully registered payload schema '${payloadSchemaId}' for event '${trimmedFullEventId}'.`);
                } catch (addSchemaError) {
                    // Log critical failure if registration fails
                    const errorMsg = `EventLoader [${modId}]: CRITICAL - Failed to register payload schema '${payloadSchemaId}' for event '${trimmedFullEventId}' from file '${filename}'.`;
                    this._logger.error(errorMsg, {
                        modId,
                        filename,
                        fullEventIdFromFile: trimmedFullEventId,
                        payloadSchemaId,
                        error: addSchemaError?.message || addSchemaError // Safely access error message
                    }, addSchemaError); // Log the original error object
                    // Throw to halt processing for this file
                    throw new Error(`CRITICAL: Failed to register payload schema '${payloadSchemaId}' for event '${trimmedFullEventId}'.`);
                }
            } else {
                // Log a warning if the schema ID was already registered
                this._logger.warn(`EventLoader [${modId}]: Payload schema ID '${payloadSchemaId}' for event '${trimmedFullEventId}' in file '${filename}' was already loaded. Overwriting or duplicate definition detected.`);
                // Note: Ajv might overwrite by default, or throw depending on options.
                // We currently allow overwriting but log a warning.
            }
        } else {
            // Log if no valid payload schema is found or if it's empty
            this._logger.debug(`EventLoader [${modId}]: No valid payloadSchema found in ${filename} for event '${trimmedFullEventId}'. Skipping payload schema registration.`);
        }
        // --- LOADER-003.4: Payload Schema Registration End ---

        // --- LOADER-003.5: Data Storage and Return Value Start ---

        // 1. Log delegation
        this._logger.debug(`EventLoader [${modId}]: Delegating storage for event (base ID: '${baseEventId}') from ${filename} to base helper.`);

        // 2. Call storage helper (handles its own try/catch and logging)
        // AC: Calling _storeItemInRegistry remains functional.
        // It constructs the final key (modId:baseEventId) and adds metadata.
        // It will throw if registry interaction fails.
        this._storeItemInRegistry(typeName, modId, baseEventId, data, filename);

        // 3. Construct final return value (must match the key used by the helper)
        // AC: Returning the final ID remains functional.
        const finalRegistryKey = `${modId}:${baseEventId}`;

        // 4. Log successful processing and return value
        this._logger.debug(`EventLoader [${modId}]: Successfully processed event definition from ${filename}. Returning final registry key: ${finalRegistryKey}`);

        // 5. Return the final registry key
        return finalRegistryKey;

        // --- LOADER-003.5: Data Storage and Return Value End ---
    }
}

// Export the class
export default EventLoader;