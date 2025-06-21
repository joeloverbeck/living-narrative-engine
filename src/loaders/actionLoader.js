/**
 * @file Defines the ActionLoader class, responsible for loading
 * action definitions from mods based on the manifest.
 */

// --- Base Class Import ---
import { BaseManifestItemLoader } from './baseManifestItemLoader.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads action definitions from mods.
 *
 * @augments BaseManifestItemLoader
 */
class ActionLoader extends BaseManifestItemLoader {
  /**
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
    super(
      'actions',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched action file's data.
   *
   * @override
   * @protected
   * @param {string} modId
   * @param {string} filename
   * @param {string} resolvedPath
   * @param {any} data
   * @param {string} registryKey
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>}
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    this._logger.debug(
      `ActionLoader [${modId}]: Processing fetched item: ${filename} (Type: ${registryKey})`
    );

    // Use the reliable base class helper to handle ID parsing and storage.
    const { qualifiedId, didOverride } = this._parseIdAndStoreItem(
      data,
      'id',
      'actions',
      modId,
      filename
    );

    this._logger.debug(
      `ActionLoader [${modId}]: Successfully processed action from ${filename}. Returning final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );
    return { qualifiedId, didOverride };
  }
}

export default ActionLoader;
