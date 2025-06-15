// src/loaders/componentLoader.js

import { BaseInlineSchemaLoader } from './baseInlineSchemaLoader.js';

import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import { parseAndValidateId } from '../utils/idUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').ModManifest} ModManifest
 * @typedef {import('../interfaces/manifestItems.js').ComponentDefinition} ComponentDefinition
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 */

/**
 * Loads component definitions from mods, validates them against the component definition schema (handled by base class),
 * extracts metadata, registers the component's `dataSchema` with the validator, and stores
 * the definition metadata in the registry using a prefixed ID. It extends {@link BaseManifestItemLoader}
 * and implements the component-definition-specific processing logic in `_processFetchedItem`.
 *
 * @class ComponentLoader
 * @augments BaseInlineSchemaLoader
 */
class ComponentLoader extends BaseInlineSchemaLoader {
  /**
   * Initializes the ComponentLoader by calling the parent constructor with the specific type name 'components'.
   *
   * @param {IConfiguration} config - The configuration service.
   * @param {IPathResolver} pathResolver - The path resolver service.
   * @param {IDataFetcher} dataFetcher - The data fetcher service.
   * @param {ISchemaValidator} schemaValidator - The schema validator service.
   * @param {IDataRegistry} dataRegistry - The data registry service.
   * @param {ILogger} logger - The logger service.
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
   * Processes a single fetched component definition file's data **after** primary schema validation by the base class.
   * This method is called by the base class's `_processFileWrapper`.
   * It extracts and validates the required `id` and `dataSchema` properties,
   * registers the `dataSchema` with the ISchemaValidator using the **full component ID from the file** (e.g., `core:health`), handling overrides,
   * constructs the **final, prefixed** `finalItemId` (`modId:baseComponentId`),
   * delegates storage to the base class helper `_storeItemInRegistry`, and returns an object
   * containing the **final registry key** (`finalItemId`) and a flag indicating if an overwrite occurred.
   *
   * @param {string} modId - The ID of the mod the item belongs to.
   * @param {string} filename - The original filename from the manifest.
   * @param {string} resolvedPath - The fully resolved path used to fetch the file.
   * @param {any} data - The raw, parsed data object fetched from the file (already validated against primary schema).
   * @param {string} typeName - The content type name ('components').
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} An object containing the final registry key and overwrite status.
   * @throws {Error} Throws an error if configuration is missing, validation fails, schema registration fails, or storage fails.
   * @protected
   * @override
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
    this._logger.debug(
      `ComponentLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`
    );

    // --- 1. Property Extraction & Validation ---
    const { fullId: trimmedComponentIdFromFile, baseId: baseComponentId } =
      parseAndValidateId(data, 'id', modId, filename, this._logger);
    const dataSchema = data.dataSchema;

    if (typeof dataSchema !== 'object' || dataSchema === null) {
      const dataType = dataSchema === null ? 'null' : typeof dataSchema;
      const errorMsg = `ComponentLoader [${modId}]: Invalid 'dataSchema' found for component '${trimmedComponentIdFromFile}' in file '${filename}'. Expected an object but received type '${dataType}'.`;
      const error = new Error(
        `Invalid dataSchema type in ${filename} for component ${trimmedComponentIdFromFile}`
      );
      this._logger.error(
        errorMsg,
        {
          modId,
          filename,
          resolvedPath,
          componentId: trimmedComponentIdFromFile,
          receivedType: dataType,
        },
        error
      );
      throw error;
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
        errorLogMessage: `ComponentLoader [${modId}]: Error registering data schema for component '${fullId}' from file '${filename}'.`,
        errorContext: (err) => ({
          modId,
          filename,
          componentId: fullId,
          error: err,
        }),
      }),
    });

    this._logger.debug(
      `ComponentLoader [${modId}]: Extracted full ID '${trimmedComponentIdFromFile}' and base ID '${baseComponentId}' from ${filename}.`
    );
    this._logger.debug(
      `ComponentLoader [${modId}]: Constructed final registry key: '${qualifiedId}'.`
    );
    this._logger.debug(
      `ComponentLoader [${modId}]: Successfully processed component definition from ${filename}. Returning final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );
    return { qualifiedId, didOverride };
  }
}

export default ComponentLoader;
