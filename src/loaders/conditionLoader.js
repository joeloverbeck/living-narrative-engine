/**
 * @file Defines the ConditionLoader class, responsible for loading
 * condition definitions from mods based on the manifest.
 * @see src/loaders/conditionLoader.js
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

// --- Base Class and Helper Import ---
import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';

/**
 * Loads reusable condition definitions from mods.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic.
 * The content type managed by this loader is 'conditions'.
 *
 * @class ConditionLoader
 * @augments BaseManifestItemLoader
 */
class ConditionLoader extends BaseManifestItemLoader {
  /**
   * Creates an instance of ConditionLoader.
   * Passes dependencies and the specific contentType 'conditions' to the base class constructor.
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
    super(
      'conditions', // Specifies the content type this loader handles
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched condition definition file's data. This method
   * relies entirely on the reusable `processAndStoreItem` helper, which handles
   * primary schema validation (via the wrapper), ID extraction, and storage in the
   * 'conditions' registry category.
   *
   * @override
   * @protected
   * @async
   * @param {string} modId - The ID of the mod owning the file.
   * @param {string} filename - The original filename from the manifest.
   * @param {string} resolvedPath - The fully resolved path to the file.
   * @param {any} data - The raw data fetched from the file.
   * @param {string} registryKey - The content type name ('conditions').
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} An object containing the final registry key and overwrite status.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    this._logger.debug(
      `ConditionLoader [${modId}]: Processing item: ${filename} (Type: ${registryKey})`
    );

    // Delegate all processing to the generic helper function.
    // It will use the 'id' property for the ID and store it in the 'conditions' category.
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: 'conditions',
      modId,
      filename,
    });

    this._logger.debug(
      `ConditionLoader [${modId}]: Successfully processed condition from ${filename}. Returning final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );
    return { qualifiedId, didOverride };
  }
}

export default ConditionLoader;
