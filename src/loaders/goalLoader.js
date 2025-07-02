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

import { SimpleItemLoader } from './simpleItemLoader.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration}   IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver}    IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher}     IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry}    IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger}          ILogger
 */
export default class GoalLoader extends SimpleItemLoader {
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
}
