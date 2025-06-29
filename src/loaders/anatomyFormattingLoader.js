// src/loaders/anatomyFormattingLoader.js

import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { parseAndValidateId } from '../utils/idUtils.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads anatomy formatting rules from mods.
 * These rules control how body part descriptions are generated and formatted.
 *
 * @augments BaseManifestItemLoader
 */
class AnatomyFormattingLoader extends BaseManifestItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'anatomyFormatting',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched anatomy formatting file's data.
   * Validates and stores the formatting rules in the registry.
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
      `AnatomyFormattingLoader [${modId}]: Processing fetched item: ${filename}`
    );

    // Parse and validate the ID
    const { baseId } = parseAndValidateId(
      data,
      'id',
      modId,
      filename,
      this._logger
    );

    // Validate required arrays exist (even if empty)
    const arrayFields = [
      'descriptionOrder',
      'groupedParts',
      'pairedParts',
      'noArticleParts',
      'descriptorOrder',
      'commaSeparatedDescriptors',
      'descriptorValueKeys',
    ];

    for (const field of arrayFields) {
      if (data[field] !== undefined && !Array.isArray(data[field])) {
        throw new Error(
          `Invalid '${field}' for anatomy formatting '${baseId}' in '${filename}'. Expected array, received ${typeof data[
            field
          ]}.`
        );
      }
    }

    // Validate irregularPlurals is an object if present
    if (
      data.irregularPlurals !== undefined &&
      (typeof data.irregularPlurals !== 'object' ||
        data.irregularPlurals === null ||
        Array.isArray(data.irregularPlurals))
    ) {
      throw new Error(
        `Invalid 'irregularPlurals' for anatomy formatting '${baseId}' in '${filename}'. Expected object, received ${
          data.irregularPlurals === null ? 'null' : typeof data.irregularPlurals
        }.`
      );
    }

    // Store in registry
    const { qualifiedId, didOverride } = this._storeItemInRegistry(
      'anatomyFormatting',
      modId,
      baseId,
      data,
      filename
    );

    this._logger.debug(
      `AnatomyFormattingLoader [${modId}]: Successfully processed anatomy formatting from ${filename}. Registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );

    return { qualifiedId, didOverride };
  }
}

export default AnatomyFormattingLoader;