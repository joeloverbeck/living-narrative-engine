// src/loaders/componentLoader.js

import { BaseInlineSchemaLoader } from './baseInlineSchemaLoader.js';
import { parseAndValidateId } from '../utils/idUtils.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads component definitions from mods.
 *
 * @augments BaseInlineSchemaLoader
 */
class ComponentLoader extends BaseInlineSchemaLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'components',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched component definition file's data and delegates
   * ID parsing, schema registration, and storage to
   * {@link processAndStoreItem}.
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
      `ComponentLoader [${modId}]: Processing fetched item: ${filename} (Type: ${registryKey})`
    );

    const { baseId } = parseAndValidateId(
      data,
      'id',
      modId,
      filename,
      this._logger
    );
    const dataSchema = data.dataSchema;

    if (typeof dataSchema !== 'object' || dataSchema === null) {
      const dataType = dataSchema === null ? 'null' : typeof dataSchema;
      const errorMsg = `Invalid 'dataSchema' for component '${baseId}' in '${filename}'. Expected object, received ${dataType}.`;
      throw new Error(errorMsg);
    }

    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: 'components',
      modId,
      filename,
      schemaProp: 'dataSchema',
      schemaMessages: (fullId) => ({
        warnMessage: `Component Definition '${filename}' in mod '${modId}' is overwriting an existing data schema for component ID '${fullId}'.`,
        successDebugMessage: `ComponentLoader [${modId}]: Registered dataSchema for component ID '${fullId}' from file '${filename}'.`,
      }),
    });

    this._logger.debug(
      `ComponentLoader [${modId}]: Successfully processed component definition from ${filename}. Returning final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );
    return { qualifiedId, didOverride };
  }
}

export default ComponentLoader;
