/**
 * @file Provides SimpleItemLoader extending BaseManifestItemLoader with
 * a default _processFetchedItem implementation that parses the item ID
 * and stores the item using processAndStoreItem.
 */

import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';

/**
 * Loader base class with default ID parsing and storage logic.
 * Subclasses may override `_processFetchedItem` for additional behaviour.
 *
 * @augments BaseManifestItemLoader
 */
export class SimpleItemLoader extends BaseManifestItemLoader {
  /**
   * Processes a fetched item by parsing its `id` property and storing
   * it in the registry using {@link processAndStoreItem}.
   *
   * @protected
   * @override
   * @async
   * @param {string} modId - Owning mod ID.
   * @param {string} filename - Original filename from the manifest.
   * @param {string} resolvedPath - Resolved file path (unused).
   * @param {any} data - Parsed item data.
   * @param {string} registryKey - Registry category key.
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>}
   *   Qualified ID and whether it overwrote an existing entry.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: registryKey,
      modId,
      filename,
    });

    return { qualifiedId, didOverride };
  }
}

export default SimpleItemLoader;
