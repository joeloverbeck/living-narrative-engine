// src/loaders/uiAssetsLoader.js

import { BaseManifestItemLoader } from './baseManifestItemLoader.js';

/**
 * Loader for UI asset files (icons and labels).
 *
 * @class UiAssetsLoader
 * @augments BaseManifestItemLoader
 */
class UiAssetsLoader extends BaseManifestItemLoader {
  /**
   * @param {import('../interfaces/coreServices.js').IConfiguration} config
   * @param {import('../interfaces/coreServices.js').IPathResolver} pathResolver
   * @param {import('../interfaces/coreServices.js').IDataFetcher} dataFetcher
   * @param {import('../interfaces/coreServices.js').ISchemaValidator} schemaValidator
   * @param {import('../interfaces/coreServices.js').IDataRegistry} dataRegistry
   * @param {import('../interfaces/coreServices.js').ILogger} logger
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
      'ui',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single UI asset file.
   *
   * @protected
   * @override
   * @async
   * @param {string} modId
   * @param {string} filename
   * @param {string} _resolvedPath
   * @param {object} data
   * @param {string} _typeName
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>}
   */
  async _processFetchedItem(modId, filename, _resolvedPath, data, _typeName) {
    const lower = filename.toLowerCase();
    let schemaId;
    let category;
    let baseId;

    if (lower.includes('icon')) {
      schemaId = this._config.getContentTypeSchemaId('ui-icons');
      category = 'ui_icons';
      baseId = 'icons';
    } else if (lower.includes('label')) {
      schemaId = this._config.getContentTypeSchemaId('ui-labels');
      category = 'ui_labels';
      baseId = 'labels';
    } else {
      this._logger.warn(
        `UiAssetsLoader [${modId}]: Unrecognized UI asset file '${filename}'.`
      );
      throw new Error(`Unknown UI asset file: ${filename}`);
    }

    const result = this._schemaValidator.validate(schemaId, data);
    if (!result.isValid) {
      this._logger.error(
        `UiAssetsLoader [${modId}]: Validation failed for ${filename} using schema '${schemaId}'.`,
        { errors: result.errors }
      );
      throw new Error(`UI asset validation failed for ${filename}`);
    }

    const { qualifiedId, didOverride } = this._storeItemInRegistry(
      category,
      modId,
      baseId,
      data,
      filename
    );

    return { qualifiedId, didOverride };
  }
}

export default UiAssetsLoader;
