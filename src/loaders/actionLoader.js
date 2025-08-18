/**
 * @file Defines the ActionLoader class, responsible for loading
 * action definitions from mods based on the manifest.
 */

// --- Base Class Import ---
import { SimpleItemLoader } from './simpleItemLoader.js';
import {
  hasVisualProperties,
  countActionsWithVisualProperties,
} from '../validation/visualPropertiesValidator.js';

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
class ActionLoader extends SimpleItemLoader {
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
   * Override to add visual properties logging
   *
   * @protected
   * @override
   * @async
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    // Call parent implementation
    const result = await super._processFetchedItem(
      modId,
      filename,
      resolvedPath,
      data,
      registryKey
    );

    // Add visual properties logging if present
    if (hasVisualProperties(data)) {
      this._logger.debug(
        `Action ${result.qualifiedId} loaded with visual properties:`,
        data.visual
      );
    }

    return result;
  }

  /**
   * Override to provide summary of visual properties
   *
   * @param modId
   * @param modManifest
   * @param contentKey
   * @param diskFolder
   * @param registryKey
   * @public
   * @async
   */
  async loadItemsForMod(
    modId,
    modManifest,
    contentKey,
    diskFolder,
    registryKey
  ) {
    const result = await super.loadItemsForMod(
      modId,
      modManifest,
      contentKey,
      diskFolder,
      registryKey
    );

    // Count actions with visual properties
    const actionsKey = `${registryKey}.${modId}`;
    const actions = this._dataRegistry.getAll(actionsKey) || [];
    const visualCount = countActionsWithVisualProperties(actions);

    if (visualCount > 0) {
      this._logger.info(
        `${visualCount} action(s) from mod '${modId}' have visual customization properties.`
      );
    }

    return result;
  }
}

export default ActionLoader;
