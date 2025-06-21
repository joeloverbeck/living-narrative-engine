// Filename: src/loaders/goalLoader.js

/**
 * @file Loads GOAP goal definitions from mods, validates them, and registers
 * them in the GameDataRepository under the `"goals"` category.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Manifest expectations
 * ────────────────────────────────────────────────────────────────────────────
 * • Each mod manifest may list goal files under `content.goals`.
 * • Files live inside the mod's `goals/` directory.
 * • Every file must conform to the `goal` JSON-schema (configured in
 * StaticConfiguration).
 *
 * Registry key: `<modId>:<baseGoalId>`
 * Registry cat: `"goals"`
 */

import { BaseManifestItemLoader } from './baseManifestItemLoader.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration}   IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver}    IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher}     IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry}    IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger}          ILogger
 */
export default class GoalLoader extends BaseManifestItemLoader {
  /**
   * @param {IConfiguration}   config
   * @param {IPathResolver}    pathResolver
   * @param {IDataFetcher}     dataFetcher
   * @param {ISchemaValidator} schemaValidator
   * @param {IDataRegistry}    dataRegistry
   * @param {ILogger}          logger
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
      'goals', // ← FIX: Changed to 'goals' to match configuration conventions.
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a validated goal data object and stores it in the data registry.
   *
   * @protected
   * @override
   * @param {string} modId - The ID of the mod owning the file.
   * @param {string} filename - The original filename from the manifest.
   * @param {string} resolvedPath - The fully resolved path to the file.
   * @param {any} data - The validated data fetched from the file.
   * @param {string} typeName - The content type name ('goals').
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} A promise resolving with the result.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
    // FIX: Updated method signature to match the base class abstract method.
    // schema validation already happened – just persist it
    const { qualifiedId, didOverride } = this._parseIdAndStoreItem(
      data,
      'id',
      'goals', // registry category
      modId,
      filename
    );

    return { qualifiedId, didOverride };
  }
}