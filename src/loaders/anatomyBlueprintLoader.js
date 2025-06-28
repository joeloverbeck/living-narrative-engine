// src/loaders/anatomyBlueprintLoader.js

import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import { parseAndValidateId } from '../utils/idUtils.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads anatomy blueprint definitions from mods.
 * Blueprints define the structural graph of how body parts connect via sockets.
 *
 * @augments BaseManifestItemLoader
 */
class AnatomyBlueprintLoader extends BaseManifestItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'anatomyBlueprints',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched anatomy blueprint file's data.
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
      `AnatomyBlueprintLoader [${modId}]: Processing fetched item: ${filename} (Type: ${registryKey})`
    );

    // Validate the root field
    if (!data.root) {
      throw new Error(
        `Invalid blueprint in '${filename}' from mod '${modId}'. Missing required 'root' field.`
      );
    }

    // Create a synthetic ID from the filename since blueprints don't have explicit IDs
    const baseId = filename.replace(/\.bp\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Add the id to the data for storage
    data.id = `${modId}:${baseId}`;

    // Validate attachment references if present
    if (data.attachments && Array.isArray(data.attachments)) {
      this._validateAttachments(data.attachments, modId, filename);
    }

    // Store the blueprint in the registry
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: 'anatomyBlueprints',
      modId,
      filename,
    });

    this._logger.debug(
      `AnatomyBlueprintLoader [${modId}]: Successfully processed anatomy blueprint from ${filename}. Final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );
    
    return { qualifiedId, didOverride };
  }

  /**
   * Validates attachment array for proper structure
   *
   * @param attachments
   * @param modId
   * @param filename
   * @private
   */
  _validateAttachments(attachments, modId, filename) {
    const seenPairs = new Set();
    
    for (const attachment of attachments) {
      if (!attachment.parent || !attachment.socket || !attachment.child) {
        throw new Error(
          `Invalid attachment in blueprint '${filename}' from mod '${modId}'. Each attachment must have parent, socket, and child fields.`
        );
      }

      // Check for duplicate parent-socket pairs
      const pairKey = `${attachment.parent}:${attachment.socket}`;
      if (seenPairs.has(pairKey)) {
        this._logger.warn(
          `AnatomyBlueprintLoader [${modId}]: Duplicate parent-socket pair '${pairKey}' in blueprint '${filename}'. Only the last definition will be used.`
        );
      }
      seenPairs.add(pairKey);
    }
  }
}

export default AnatomyBlueprintLoader;