/**
 * @file Loads anatomy blueprint parts from mods
 * @see data/schemas/anatomy.blueprint-part.schema.json
 */

import { SimpleItemLoader } from './simpleItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads anatomy blueprint part definitions from mods.
 * Blueprint parts are reusable anatomy structure definitions that can be composed into blueprints.
 *
 * @augments SimpleItemLoader
 */
class AnatomyBlueprintPartLoader extends SimpleItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'anatomyBlueprintParts',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched anatomy blueprint part file's data.
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
      `AnatomyBlueprintPartLoader [${modId}]: Processing fetched item: ${filename} (Type: ${registryKey})`
    );

    // Validate required fields
    if (!data.id) {
      throw new Error(
        `Invalid blueprint part in '${filename}' from mod '${modId}'. Missing required 'id' field.`
      );
    }

    // Store the blueprint part in the registry
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: 'anatomyBlueprintParts',
      modId,
      filename,
    });

    this._logger.debug(
      `AnatomyBlueprintPartLoader [${modId}]: Successfully processed anatomy blueprint part from ${filename}. Final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );

    return { qualifiedId, didOverride };
  }
}

export default AnatomyBlueprintPartLoader;
