/**
 * @file Defines the ExpressionLoader class, responsible for loading
 * expression definitions from mods based on the manifest.
 * Expressions define narrative perception log entries triggered by
 * actor emotional/sexual state changes.
 * @see src/loaders/expressionLoader.js
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
 * Loads expression definitions from mods.
 * Expressions are JSON files that define narrative perception log entries
 * triggered when an actor's emotional or sexual state matches specified prerequisites.
 * Extends {@link SimpleItemLoader} to leverage common file processing logic.
 * The content type managed by this loader is 'expressions'.
 *
 * @class ExpressionLoader
 * @augments SimpleItemLoader
 */
class ExpressionLoader extends SimpleItemLoader {
  /**
   * Creates an instance of ExpressionLoader.
   * Passes dependencies and the specific contentType 'expressions' to the base class constructor.
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
      'expressions', // Specifies the content type this loader handles
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }
}

export default ExpressionLoader;
