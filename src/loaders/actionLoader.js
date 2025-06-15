// Filename: src/loaders/actionLoader.js

/**
 * @file Defines the ActionLoader class, responsible for loading
 * action definitions from mods based on the manifest.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest */ // Assuming ModManifest type is defined here or imported
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */

// --- Base Class Import ---
import { BaseManifestItemLoader } from './baseManifestItemLoader.js'; // Correct path assumed based on sibling loaders
import { parseAndValidateId } from '../utils/idUtils.js';

/**
 * Loads action definitions from mods.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic.
 * The content type managed by this loader is 'actions'.
 *
 * @class ActionLoader
 * @augments BaseManifestItemLoader
 */
class ActionLoader extends BaseManifestItemLoader {
  // Inheritance specified

  /**
   * Creates an instance of ActionLoader.
   * Passes dependencies and the specific contentType 'actions' to the base class constructor.
   *
   * @param {IConfiguration} config - Configuration service instance.
   * @param {IPathResolver} pathResolver - Path resolution service instance.
   * @param {IDataFetcher} dataFetcher - Data fetching service instance.
   * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
   * @param {IDataRegistry} dataRegistry - Data registry service instance.
   * @param {ILogger} logger - Logging service instance.
   * @throws {TypeError} Inherited from BaseManifestItemLoader if dependencies are invalid.
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
      'actions',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
    this._logger.debug(`ActionLoader: Initialized.`);
  }

  /**
   * Processes a single fetched action definition file's data. Validates the data
   * using the base class's primary schema validation, extracts and validates the
   * namespaced action ID (e.g., `namespace:action_name`), extracts the base
   * (un-prefixed) action ID (e.g., `action_name`), delegates storage to the
   * base class's `_storeItemInRegistry` helper using the **base** action ID,
   * and returns an object containing the **final registry key** (`modId:baseActionId`)
   * and a flag indicating if an overwrite occurred.
   *
   * @override
   * @protected
   * @async
   * @param {string} modId - The ID of the mod owning the file.
   * @param {string} filename - The original filename from the manifest.
   * @param {string} resolvedPath - The fully resolved path to the file.
   * @param {any} data - The raw data fetched from the file.
   * @param {string} typeName - The content type name ('actions').
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} An object containing the final registry key and overwrite status.
   * @throws {Error} If validation, ID validation/extraction, or storage fails. Propagated from base helpers or thrown directly.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
    // <<< MODIFIED Return Type in JSDoc
    this._logger.debug(
      `ActionLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`
    );

    // Primary validation happens in BaseManifestItemLoader._processFileWrapper now
    // No need to call this._validatePrimarySchema(data, filename, modId, resolvedPath); here

    // --- Step 2 & 3: ID Handling and Storage via Helper ---
    const { qualifiedId, didOverride } = this._parseIdAndStoreItem(
      data,
      'id',
      'actions',
      modId,
      filename
    );

    // --- Step 4: Return Value ---
    this._logger.debug(
      `ActionLoader [${modId}]: Successfully processed action from ${filename}. Returning final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );
    return { qualifiedId, didOverride };
  }
}

export default ActionLoader;
