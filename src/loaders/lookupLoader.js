/**
 * @file Loader for lookup table definitions.
 */

import { SimpleItemLoader } from './simpleItemLoader.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Loader responsible for lookup table definition files. Lookups provide
 * static reference/mapping data that can be queried at runtime.
 *
 * @class LookupLoader
 * @augments SimpleItemLoader
 */
class LookupLoader extends SimpleItemLoader {
  /**
   * Creates an instance of LookupLoader.
   *
   * @param {IConfiguration} config - Engine configuration service.
   * @param {IPathResolver} pathResolver - Resolves mod file paths.
   * @param {IDataFetcher} dataFetcher - Fetches raw lookup files.
   * @param {ISchemaValidator} schemaValidator - Validates lookups against schema.
   * @param {IDataRegistry} dataRegistry - Registry for storing loaded lookups.
   * @param {ILogger} logger - Logger for diagnostic messages.
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
      'lookups',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Optional: Add custom validation to ensure each entry conforms to dataSchema.
   * Can override _processFetchedItem if needed, but SimpleItemLoader's default
   * implementation should suffice for basic use cases.
   */
}

export default LookupLoader;
