// src/loaders/anatomyRecipeLoader.js

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
 * Loads anatomy recipe definitions from mods.
 * Recipes define what parts a creature should have (types, tags, counts, preferences, exclusions).
 *
 * @augments BaseManifestItemLoader
 */
class AnatomyRecipeLoader extends BaseManifestItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'anatomyRecipes',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched anatomy recipe file's data.
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
      `AnatomyRecipeLoader [${modId}]: Processing fetched item: ${filename} (Type: ${registryKey})`
    );

    // Validate the recipeId field
    const { baseId } = parseAndValidateId(
      data,
      'recipeId',
      modId,
      filename,
      this._logger
    );

    // Process macro includes if present
    if (data.includes && Array.isArray(data.includes)) {
      this._logger.debug(
        `AnatomyRecipeLoader [${modId}]: Recipe '${baseId}' includes ${data.includes.length} macro(s)`
      );
      // Note: Macro resolution would be handled by a separate service at runtime
    }

    // Validate constraints if present
    if (data.constraints) {
      this._validateConstraints(data.constraints, modId, filename);
    }

    // Store the recipe in the registry
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'recipeId',
      category: 'anatomyRecipes',
      modId,
      filename,
    });

    this._logger.debug(
      `AnatomyRecipeLoader [${modId}]: Successfully processed anatomy recipe from ${filename}. Final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );

    return { qualifiedId, didOverride };
  }

  /**
   * Validates constraint arrays for proper structure
   *
   * @param constraints
   * @param modId
   * @param filename
   * @private
   */
  _validateConstraints(constraints, modId, filename) {
    if (constraints.requires && !Array.isArray(constraints.requires)) {
      throw new Error(
        `Invalid 'requires' constraint in recipe '${filename}' from mod '${modId}'. Expected array.`
      );
    }

    if (constraints.excludes && !Array.isArray(constraints.excludes)) {
      throw new Error(
        `Invalid 'excludes' constraint in recipe '${filename}' from mod '${modId}'. Expected array.`
      );
    }

    // Validate each constraint group has at least 2 items
    if (constraints.requires) {
      for (const group of constraints.requires) {
        if (!Array.isArray(group) || group.length < 2) {
          throw new Error(
            `Invalid 'requires' group in recipe '${filename}' from mod '${modId}'. Each group must have at least 2 items.`
          );
        }
      }
    }

    if (constraints.excludes) {
      for (const group of constraints.excludes) {
        if (!Array.isArray(group) || group.length < 2) {
          throw new Error(
            `Invalid 'excludes' group in recipe '${filename}' from mod '${modId}'. Each group must have at least 2 items.`
          );
        }
      }
    }
  }
}

export default AnatomyRecipeLoader;
