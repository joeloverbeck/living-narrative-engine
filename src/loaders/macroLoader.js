// src/loaders/macroLoader.js

import { SimpleItemLoader } from './simpleItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Loader responsible for macro definition files. Macros encapsulate reusable
 * action sequences that can be referenced by System Rules.
 *
 * @class MacroLoader
 * @augments BaseManifestItemLoader
 */
class MacroLoader extends SimpleItemLoader {
  /**
   * Creates an instance of MacroLoader.
   *
   * @param {IConfiguration} config - Engine configuration service.
   * @param {IPathResolver} pathResolver - Resolves mod file paths.
   * @param {IDataFetcher} dataFetcher - Fetches raw macro files.
   * @param {ISchemaValidator} schemaValidator - Validates macros against the schema.
   * @param {IDataRegistry} dataRegistry - Registry used to store loaded macros.
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
      'macros',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single macro definition file after validation.
   * Utilizes {@link processAndStoreItem} for ID parsing and storage.
   *
   * @protected
   * @override
   * @async
   * @param {string} modId - ID of the owning mod.
   * @param {string} filename - Original file name.
   * @param {string} resolvedPath - Resolved path to the file.
   * @param {object} data - Parsed macro definition data.
   * @param {string} registryKey - Content type registry key ("macros").
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} Result of storage.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    this._logger.debug(
      `MacroLoader [${modId}]: Processing macro file ${filename} (${registryKey}).`
    );

    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: 'macros',
      modId,
      filename,
      parseOptions: { allowFallback: true },
    });

    return { qualifiedId, didOverride };
  }
}

export default MacroLoader;
