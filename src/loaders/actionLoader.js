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
import { validateModifierCondition } from '../logic/utils/entityPathValidator.js';

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
   * Validates entity paths in modifier conditions
   *
   * @param {object} data - Loaded action data
   * @param {string} actionId - Action ID for error messages
   * @returns {Array<{path: string, error: string, location: string, operatorName: string, actionId: string}>} - Array of validation errors
   * @private
   */
  #validateModifierEntityPaths(data, actionId) {
    const errors = [];

    // Check chanceBased.modifiers if present
    const modifiers = data?.chanceBased?.modifiers;
    if (!Array.isArray(modifiers)) {
      return errors;
    }

    for (let i = 0; i < modifiers.length; i++) {
      const modifier = modifiers[i];
      if (modifier?.condition) {
        const result = validateModifierCondition(modifier.condition);
        if (!result.isValid) {
          for (const err of result.errors) {
            errors.push({
              ...err,
              location: `chanceBased.modifiers[${i}].condition.${err.location}`,
              actionId,
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * Override to add modifier entity path validation and visual properties logging
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

    // Validate modifier entity paths
    const pathErrors = this.#validateModifierEntityPaths(
      data,
      result.qualifiedId
    );
    if (pathErrors.length > 0) {
      for (const error of pathErrors) {
        this._logger.warn(
          `ActionLoader: Invalid entity path in ${error.actionId} at ${error.location}: ` +
            `"${error.path}" - ${error.error}`
        );
      }
      // Graceful degradation: warn but continue loading
    }

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
