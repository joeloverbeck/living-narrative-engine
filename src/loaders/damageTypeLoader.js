/**
 * @file Defines the DamageTypeLoader class, responsible for loading
 * damage type definitions from mods based on the manifest.
 * @see src/loaders/damageTypeLoader.js
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

// --- Base Class Import ---
import { SimpleItemLoader } from './simpleItemLoader.js';

/**
 * Loads damage type definitions from mods.
 * Extends {@link SimpleItemLoader} to leverage common file processing logic.
 * The content type managed by this loader is 'damageTypes'.
 *
 * @class DamageTypeLoader
 * @augments SimpleItemLoader
 */
class DamageTypeLoader extends SimpleItemLoader {
  /**
   * Creates an instance of DamageTypeLoader.
   * Passes dependencies and the specific contentType 'damageTypes' to the base class constructor.
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
      'damageTypes', // Specifies the content type this loader handles
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }
}

export default DamageTypeLoader;
