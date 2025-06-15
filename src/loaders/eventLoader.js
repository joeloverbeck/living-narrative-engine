// Filename: src/loaders/eventLoader.js

/**
 * @file Defines the EventLoader class, responsible for loading
 * event definitions from mods based on the manifest.
 */

// --- Base Class Import ---
// Adjust path relative to this file's location if needed
import { BaseInlineSchemaLoader } from './baseInlineSchemaLoader.js';

import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import { parseAndValidateId } from '../utils/idUtils.js';

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
 * @augments BaseInlineSchemaLoader
 */
class EventLoader extends BaseInlineSchemaLoader {
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
    const { fullId: trimmedFullEventId, baseId: baseEventId } =
      parseAndValidateId(data, 'id', modId, filename, this._logger);

    const hasPayload =
      data.payloadSchema &&
      typeof data.payloadSchema === 'object' &&
      Object.keys(data.payloadSchema).length > 0;

    this._logger.debug(
      `EventLoader [${modId}]: Extracted full event ID '${trimmedFullEventId}' and base event ID '${baseEventId}' from ${filename}.`
    );
    if (hasPayload) {
      this._logger.debug(
        `EventLoader [${modId}]: Found valid payloadSchema in ${filename} for event '${trimmedFullEventId}'.`
      );
    } else {
      this._logger.debug(
        `EventLoader [${modId}]: No valid payloadSchema found for event '${trimmedFullEventId}'. Skipping registration.`
      );
    }

    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: typeName,
      modId,
      filename,
      schemaProp: hasPayload ? 'payloadSchema' : undefined,
      schemaSuffix: hasPayload ? '#payload' : '',
      schemaMessages: (fullId) => ({
        warnMessage: `EventLoader [${modId}]: Payload schema ID '${fullId}#payload' for event '${fullId}' was already loaded. Overwriting/duplicate.`,
        successDebugMessage: `EventLoader [${modId}]: Successfully registered payload schema '${fullId}#payload'.`,
        errorLogMessage: `EventLoader [${modId}]: CRITICAL - Failed to register payload schema '${fullId}#payload' for event '${fullId}'.`,
        throwErrorMessage: `CRITICAL: Failed to register payload schema '${fullId}#payload'.`,
        errorContext: () => ({ modId, filename, eventId: fullId }),
      }),
    });

    this._logger.debug(
      `EventLoader [${modId}]: Extracted full event ID '${trimmedFullEventId}' and base event ID '${baseEventId}' from ${filename}.`
    );
    if (hasPayload) {
      this._logger.debug(
        `EventLoader [${modId}]: Found valid payloadSchema in ${filename} for event '${trimmedFullEventId}'.`
      );
    } else {
      this._logger.debug(
        `EventLoader [${modId}]: No valid payloadSchema found for event '${trimmedFullEventId}'. Skipping registration.`
      );
    }

    this._logger.debug(
      `EventLoader [${modId}]: Delegating storage for event (base ID: '${baseEventId}') from ${filename} to base helper.`
    );

    this._logger.debug(
      `EventLoader [${modId}]: Successfully processed event definition from ${filename}. Returning final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );
    return { qualifiedId, didOverride };
  }
}

// Export the class
export default EventLoader;
