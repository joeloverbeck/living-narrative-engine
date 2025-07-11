/**
 * @file Loads anatomy slot libraries from mods
 * @see data/schemas/anatomy.slot-library.schema.json
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
 * Loads anatomy slot library definitions from mods.
 * Slot libraries contain reusable slot and clothing definitions.
 *
 * @augments SimpleItemLoader
 */
class AnatomySlotLibraryLoader extends SimpleItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'anatomySlotLibraries',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched anatomy slot library file's data.
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
      `AnatomySlotLibraryLoader [${modId}]: Processing fetched item: ${filename} (Type: ${registryKey})`
    );

    // Validate required fields
    if (!data.id) {
      throw new Error(
        `Invalid slot library in '${filename}' from mod '${modId}'. Missing required 'id' field.`
      );
    }

    // Store the slot library in the registry
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: 'anatomySlotLibraries',
      modId,
      filename,
    });

    this._logger.debug(
      `AnatomySlotLibraryLoader [${modId}]: Successfully processed anatomy slot library from ${filename}. Final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );

    return { qualifiedId, didOverride };
  }
}

export default AnatomySlotLibraryLoader;
