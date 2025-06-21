/**
 * @file Defines the EventLoader class, responsible for loading
 * event definitions from mods based on the manifest.
 */

// --- Base Class Import ---
import { BaseInlineSchemaLoader } from './baseInlineSchemaLoader.js';
import { parseAndValidateId } from '../utils/idUtils.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest */

/**
 * Loads event definitions from mods.
 * @augments BaseInlineSchemaLoader
 */
class EventLoader extends BaseInlineSchemaLoader {
  /**
   * @param {IConfiguration} config
   * @param {IPathResolver} pathResolver
   * @param {IDataFetcher} dataFetcher
   * @param {ISchemaValidator} schemaValidator
   * @param {IDataRegistry} dataRegistry
   * @param {ILogger} logger
   */
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super('events', config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger);
  }

  /**
   * Processes a single fetched event definition file's data after primary validation.
   * @override
   * @protected
   * @param {string} modId
   * @param {string} filename
   * @param {string} resolvedPath
   * @param {any} data
   * @param {string} typeName
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>}
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
    this._logger.debug(`EventLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`);

    const { fullId: trimmedFullEventId, baseId: baseEventId } =
      parseAndValidateId(data, 'id', modId, filename, this._logger);

    const hasPayload =
      data.payloadSchema &&
      typeof data.payloadSchema === 'object' &&
      Object.keys(data.payloadSchema).length > 0;

    if (hasPayload) {
      this._logger.debug(`EventLoader [${modId}]: Found valid payloadSchema in ${filename} for event '${trimmedFullEventId}'.`);

      const payloadSchemaId = `${trimmedFullEventId}#payload`;
      await this._registerItemSchema(data, 'payloadSchema', payloadSchemaId, {
        warnMessage: `EventLoader [${modId}]: Payload schema ID '${payloadSchemaId}' for event '${trimmedFullEventId}' was already loaded. Overwriting.`,
        successDebugMessage: `EventLoader [${modId}]: Successfully registered payload schema '${payloadSchemaId}'.`,
        errorLogMessage: `EventLoader [${modId}]: CRITICAL - Failed to register payload schema '${payloadSchemaId}' for event '${trimmedFullEventId}'.`,
        throwErrorMessage: `CRITICAL: Failed to register payload schema '${payloadSchemaId}'.`,
        errorContext: () => ({ modId, filename, eventId: trimmedFullEventId }),
      });
    }

    this._logger.debug(`EventLoader [${modId}]: Delegating storage for event (base ID: '${baseEventId}') from ${filename} to base helper.`);

    const { qualifiedId, didOverride } = this._storeItemInRegistry(
      'events',
      modId,
      baseEventId,
      data,
      filename
    );

    this._logger.debug(`EventLoader [${modId}]: Successfully processed event definition from ${filename}. Returning final registry key: ${qualifiedId}, Overwrite: ${didOverride}`);
    return { qualifiedId, didOverride };
  }
}

export default EventLoader;