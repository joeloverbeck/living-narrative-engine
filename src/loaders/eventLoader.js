// Filename: src/core/services/eventLoader.js

/**
 * @file Defines the EventLoader class, responsible for loading
 * event definitions from mods based on the manifest.
 */

// --- Base Class Import ---
// Adjust path relative to this file's location if needed
import { BaseManifestItemLoader } from './baseManifestItemLoader.js'; // Assuming it's in loaders sibling dir

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
 * @augments BaseManifestItemLoader
 */
class EventLoader extends BaseManifestItemLoader {
  /**
   * Creates an instance of EventLoader.
   * Passes dependencies and the specific content type 'events' to the base class constructor.
   *
   * AC: The constructor is defined and accepts the standard core service dependencies.
   * AC: EventLoader constructor calls super() passing 'events' as the first argument, followed by the dependency arguments in the correct order.
   *
   * @param {IConfiguration} config - Configuration service instance.
   * @param {IPathResolver} pathResolver - Path resolution service instance.
   * @param {IDataFetcher} dataFetcher - Data fetching service instance.
   * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
   * @param {IDataRegistry} dataRegistry - Data registry service instance.
   * @param {ILogger} logger - Logging service instance.
   */
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    // AC: Call super() passing 'events' and all dependencies.
    super(
      'events',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    // AC: Log initialization message.
    this._logger.debug(`EventLoader: Initialized.`);
  }

  /**
   * Processes a single fetched event definition file's data after primary validation.
   * Validates the data against the primary event schema, extracts the event ID,
   * registers any inline payload schema, stores the definition in the registry via the base helper,
   * and returns an object containing the final registry key and whether an overwrite occurred.
   *
   * @override
   * @protected
   * @async
   * @param {string} modId - The ID of the mod owning the file.
   * @param {string} filename - The original filename from the manifest.
   * @param {string} resolvedPath - The fully resolved path to the file.
   * @param {any} data - The raw data fetched from the file (this original object is used for storage).
   * @param {string} typeName - The content type name (should be 'events').
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} An object containing the final registry key and overwrite status.
   * @throws {Error} If primary validation fails (via _validatePrimarySchema), ID extraction fails, payload schema registration fails, or storage fails.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
    // <<< MODIFIED Return Type in JSDoc
    this._logger.debug(
      `EventLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`
    );

    // Primary validation happens in BaseManifestItemLoader._processFileWrapper

    // --- Event ID Extraction & Validation ---
    const fullEventIdFromFile = data.id;
    if (
      typeof fullEventIdFromFile !== 'string' ||
      fullEventIdFromFile.trim() === ''
    ) {
      const errorMsg = `EventLoader [${modId}]: Invalid or missing 'id' in event definition file '${filename}'.`;
      this._logger.error(errorMsg, {
        modId,
        filename,
        resolvedPath,
        receivedId: fullEventIdFromFile,
      });
      throw new Error(
        `Invalid or missing 'id' in event definition file '${filename}' for mod '${modId}'.`
      );
    }

    const trimmedFullEventId = fullEventIdFromFile.trim();
    let baseEventId = ''; // Initialize as empty
    const colonIndex = trimmedFullEventId.indexOf(':');

    if (colonIndex === -1) {
      baseEventId = trimmedFullEventId;
    } else if (colonIndex > 0 && colonIndex < trimmedFullEventId.length - 1) {
      const namespacePart = trimmedFullEventId.substring(0, colonIndex).trim();
      const baseIdPart = trimmedFullEventId.substring(colonIndex + 1).trim();
      if (namespacePart && baseIdPart) {
        baseEventId = baseIdPart;
      }
    }

    if (!baseEventId) {
      const errorMsg = `EventLoader [${modId}]: Could not extract valid base event ID from full ID '${trimmedFullEventId}' in file '${filename}'.`;
      this._logger.error(errorMsg, {
        modId,
        filename,
        fullEventIdFromFile: trimmedFullEventId,
      });
      throw new Error(
        `Could not extract valid base event ID from '${trimmedFullEventId}' in ${filename}`
      );
    }
    this._logger.debug(
      `EventLoader [${modId}]: Extracted full event ID '${trimmedFullEventId}' and base event ID '${baseEventId}' from ${filename}.`
    );

    // --- Payload Schema Registration ---
    const payloadSchema = data.payloadSchema;
    if (
      payloadSchema &&
      typeof payloadSchema === 'object' &&
      Object.keys(payloadSchema).length > 0
    ) {
      this._logger.debug(
        `EventLoader [${modId}]: Found valid payloadSchema in ${filename} for event '${trimmedFullEventId}'.`
      );
      const payloadSchemaId = `${trimmedFullEventId}#payload`;
      this._logger.debug(
        `EventLoader [${modId}]: Generated payload schema ID: ${payloadSchemaId}`
      );

      if (!this._schemaValidator.isSchemaLoaded(payloadSchemaId)) {
        this._logger.debug(
          `EventLoader [${modId}]: Payload schema '${payloadSchemaId}' not loaded. Attempting registration...`
        );
        try {
          await this._schemaValidator.addSchema(payloadSchema, payloadSchemaId);
          this._logger.debug(
            `EventLoader [${modId}]: Successfully registered payload schema '${payloadSchemaId}'.`
          );
        } catch (addSchemaError) {
          const errorMsg = `EventLoader [${modId}]: CRITICAL - Failed to register payload schema '${payloadSchemaId}' for event '${trimmedFullEventId}'.`;
          this._logger.error(
            errorMsg,
            { error: addSchemaError?.message || addSchemaError },
            addSchemaError
          );
          throw new Error(
            `CRITICAL: Failed to register payload schema '${payloadSchemaId}'.`
          );
        }
      } else {
        this._logger.warn(
          `EventLoader [${modId}]: Payload schema ID '${payloadSchemaId}' for event '${trimmedFullEventId}' was already loaded. Overwriting/duplicate.`
        );
      }
    } else {
      this._logger.debug(
        `EventLoader [${modId}]: No valid payloadSchema found for event '${trimmedFullEventId}'. Skipping registration.`
      );
    }

    // --- Data Storage and Return Value ---
    this._logger.debug(
      `EventLoader [${modId}]: Delegating storage for event (base ID: '${baseEventId}') from ${filename} to base helper.`
    );
    let didOverride = false; // <<< Initialize override flag
    try {
      // Capture the boolean return value from the helper
      didOverride = this._storeItemInRegistry(
        typeName,
        modId,
        baseEventId,
        data,
        filename
      ); // <<< CAPTURE result
    } catch (storageError) {
      // Error logging happens in helper, re-throw
      throw storageError;
    }

    const finalRegistryKey = `${modId}:${baseEventId}`;
    this._logger.debug(
      `EventLoader [${modId}]: Successfully processed event definition from ${filename}. Returning final registry key: ${finalRegistryKey}, Overwrite: ${didOverride}`
    );
    // Return the object as required by the base class contract
    return { qualifiedId: finalRegistryKey, didOverride: didOverride }; // <<< MODIFIED Return Value
  }
}

// Export the class
export default EventLoader;
