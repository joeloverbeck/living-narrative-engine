// Filename: src/core/services/eventLoader.js

/**
 * @fileoverview Defines the EventLoader class, responsible for loading
 * event definitions from mods based on the manifest.
 */

// --- Base Class Import ---
// AC: The BaseManifestItemLoader class is correctly imported.
import {BaseManifestItemLoader} from './baseManifestItemLoader.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */ // Adjusted path assumption

/**
 * Loads event definitions from mods.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic.
 * Specific processing for event definitions will be implemented in this class.
 *
 * AC: An EventLoader class is defined within services/eventDefinitionLoader.js.
 * AC: The EventLoader class declaration correctly specifies extends BaseManifestItemLoader.
 * @class EventLoader
 * @extends BaseManifestItemLoader
 */
class EventLoader extends BaseManifestItemLoader {

    /**
     * Creates an instance of EventLoader.
     * Passes dependencies to the base class constructor.
     *
     * AC: The constructor is defined and accepts the standard core service dependencies (config, pathResolver, fetcher, validator, registry, logger).
     * @param {IConfiguration} config - Configuration service instance.
     * @param {IPathResolver} pathResolver - Path resolution service instance.
     * @param {IDataFetcher} dataFetcher - Data fetching service instance.
     * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
     * @param {IDataRegistry} dataRegistry - Data registry service instance.
     * @param {ILogger} logger - Logging service instance.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        // AC: The constructor calls super() exactly once, passing all received dependencies to the base class constructor.
        super(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger);

        // AC: The constructor logs a debug message: "EventLoader: Initialized." using the injected logger.
        this._logger.debug(`EventLoader: Initialized.`); // Corrected class name
    }

    // --- METHOD REMOVED: loadEventsForMod ---
    /*
     * Removed the loadEventsForMod method and its JSDoc comments as per REFACTOR-LOADER-2.
     * The generic loadItemsForMod in the base class should be used instead.
     */


    /**
     * Processes a single fetched event definition file's data. Validates the data,
     * extracts the event ID, registers any inline payload schema, stores the
     * definition in the registry, and returns the final registry key.
     *
     * AC: A placeholder (or initial implementation) for the required protected async method _processFetchedItem(...) exists.
     * @override
     * @protected
     * @async
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} data - The raw data fetched from the file (this original object is used for storage).
     * @param {string} typeName - The content type name (e.g., 'events').
     * @returns {Promise<string>} A promise resolving with the fully qualified item ID (e.g., `modId:baseEventId`) upon successful processing.
     * @throws {Error} If configuration is missing, validation fails, ID extraction fails, payload schema registration fails, or storage fails.
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        // Log entry point with correct class name
        this._logger.debug(`EventLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`);

        // --- LOADER-003.2: Schema Validation ---
        const schemaId = this._getContentTypeSchemaId('events');
        if (schemaId == null) {
            const errorMsg = `EventLoader [${modId}]: Cannot validate ${filename} - Event schema ID ('events') is not configured.`;
            this._logger.error(errorMsg, {modId, filename, resolvedPath});
            throw new Error(`Configuration Error: Event definition schema ID ('events') not configured.`);
        }
        this._logger.debug(`EventLoader [${modId}]: Validating ${filename} against schema '${schemaId}'...`);
        const validationResult = this._schemaValidator.validate(schemaId, data);
        if (!validationResult.isValid) {
            const errorDetails = JSON.stringify(validationResult.errors ?? [], null, 2);
            const errorMsg = `EventLoader [${modId}]: Schema validation failed for event definition '${filename}'.`;
            this._logger.error(
                errorMsg,
                {modId, filename, resolvedPath, schemaId, validationErrors: validationResult.errors}
            );
            this._logger.error(`Validation Errors:\n${errorDetails}`);
            throw new Error(`Schema validation failed for event definition '${filename}' in mod '${modId}'.`);
        }
        this._logger.debug(`EventLoader [${modId}]: Schema validation passed for ${filename}.`);
        // --- LOADER-003.2 End ---

        // --- LOADER-003.3: Event ID Extraction & Validation Start ---
        const fullEventIdFromFile = data.id;
        if (typeof fullEventIdFromFile !== 'string' || fullEventIdFromFile.trim() === '') {
            const errorMsg = `EventLoader [${modId}]: Invalid or missing 'id' in event definition file '${filename}'. ID must be a non-empty string.`;
            this._logger.error(errorMsg, {modId, filename, resolvedPath, receivedId: fullEventIdFromFile});
            throw new Error(`Invalid or missing 'id' in event definition file '${filename}' for mod '${modId}'.`);
        }
        const trimmedFullEventId = fullEventIdFromFile.trim();
        let baseEventId = '';
        const idParts = trimmedFullEventId.split(':');
        if (idParts.length > 1 && idParts[0].trim() && idParts[1].trim()) {
            baseEventId = idParts.slice(1).join(':').trim();
        } else {
            baseEventId = idParts[0].trim();
        }
        if (!baseEventId) {
            const errorMsg = `EventLoader [${modId}]: Could not extract valid base event ID from full ID '${trimmedFullEventId}' in file '${filename}'.`;
            this._logger.error(errorMsg, {modId, filename, fullEventIdFromFile: trimmedFullEventId});
            throw new Error(`Could not extract valid base event ID from '${trimmedFullEventId}' in ${filename}`);
        }
        this._logger.debug(`EventLoader [${modId}]: Extracted full event ID '${trimmedFullEventId}' and base event ID '${baseEventId}' from ${filename}.`);
        // --- LOADER-003.3 End ---

        // --- LOADER-003.4: Payload Schema Registration Start ---
        const payloadSchema = data.payloadSchema;
        if (payloadSchema && typeof payloadSchema === 'object' && payloadSchema !== null && Object.keys(payloadSchema).length > 0) {
            this._logger.debug(`EventLoader [${modId}]: Found valid payloadSchema in ${filename} for event '${trimmedFullEventId}'.`);
            const payloadSchemaId = `${trimmedFullEventId}#payload`;
            this._logger.debug(`EventLoader [${modId}]: Generated payload schema ID: ${payloadSchemaId}`);
            if (!this._schemaValidator.isSchemaLoaded(payloadSchemaId)) {
                this._logger.debug(`EventLoader [${modId}]: Payload schema '${payloadSchemaId}' not loaded. Attempting registration...`);
                try {
                    await this._schemaValidator.addSchema(payloadSchema, payloadSchemaId);
                    this._logger.debug(`EventLoader [${modId}]: Successfully registered payload schema '${payloadSchemaId}' for event '${trimmedFullEventId}'.`);
                } catch (addSchemaError) {
                    const errorMsg = `EventLoader [${modId}]: CRITICAL - Failed to register payload schema '${payloadSchemaId}' for event '${trimmedFullEventId}' from file '${filename}'.`;
                    this._logger.error(errorMsg, {
                        modId,
                        filename,
                        fullEventIdFromFile: trimmedFullEventId,
                        payloadSchemaId,
                        error: addSchemaError?.message || addSchemaError
                    }, addSchemaError);
                    throw new Error(`CRITICAL: Failed to register payload schema '${payloadSchemaId}' for event '${trimmedFullEventId}'.`);
                }
            } else {
                this._logger.warn(`EventLoader [${modId}]: Payload schema ID '${payloadSchemaId}' for event '${trimmedFullEventId}' in file '${filename}' was already loaded. Overwriting or duplicate definition detected.`);
            }
        } else {
            this._logger.debug(`EventLoader [${modId}]: No valid payloadSchema found in ${filename} for event '${trimmedFullEventId}'. Skipping payload schema registration.`);
        }
        // --- LOADER-003.4: Payload Schema Registration End ---

        // --- LOADER-003.5: Data Storage and Return Value Start ---

        // 1. Log delegation
        this._logger.debug(`EventLoader [${modId}]: Delegating storage for event (base ID: '${baseEventId}') from ${filename} to base helper.`);

        // 2. Call storage helper (handles its own try/catch internally)
        // The helper uses baseEventId to construct the final key and stores the original 'data' object.
        this._storeItemInRegistry('events', modId, baseEventId, data, filename);
        // Success/error logging is handled within _storeItemInRegistry.

        // 3. Construct final return value
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