/**
 * @file Defines the ConditionLoader class, responsible for loading
 * condition definitions from mods based on the manifest.
 * @see src/loaders/conditionLoader.js
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

// --- Base Class and Helper Import ---
import { SimpleItemLoader } from './simpleItemLoader.js';

/**
 * Loads reusable condition definitions from mods.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic.
 * The content type managed by this loader is 'conditions'.
 *
 * @class ConditionLoader
 * @augments BaseManifestItemLoader
 */
class ConditionLoader extends SimpleItemLoader {
  /**
   * Creates an instance of ConditionLoader.
   * Passes dependencies and the specific contentType 'conditions' to the base class constructor.
   *
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
      'conditions', // Specifies the content type this loader handles
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }
}

export default ConditionLoader;
