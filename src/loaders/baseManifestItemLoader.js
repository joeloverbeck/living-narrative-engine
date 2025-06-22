// Filename: src/loaders/baseManifestItemLoader.js

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 */

import AbstractLoader from './abstractLoader.js';
import { parseAndValidateId } from '../utils/idUtils.js';
import { validateAgainstSchema } from '../utils/schemaValidationUtils.js';
import { validateDependencies } from '../utils/validationUtils.js';

// --- Add LoadItemsResult typedef here for clarity ---
/**
 * @typedef {object} LoadItemsResult
 * @property {number} count - Number of items successfully loaded.
 * @property {number} overrides - Number of items that overwrote existing ones.
 * @property {number} errors - Number of individual file processing errors encountered.
 */

/**
 * Abstract base class for loading items defined in a mod manifest's content section.
 * Provides common logic for discovering, fetching, validating against the primary schema,
 * and processing files via subclass implementation.
 * Subclasses must implement the `_processFetchedItem` method.
 *
 * @abstract
 * @class BaseManifestItemLoader
 */
export class BaseManifestItemLoader extends AbstractLoader {
  /**
   * Protected reference to the configuration service.
   *
   * @protected
   * @type {IConfiguration}
   */
  _config;
  /**
   * Protected reference to the path resolver service.
   *
   * @protected
   * @type {IPathResolver}
   */
  _pathResolver;
  /**
   * Protected reference to the data fetcher service.
   *
   * @protected
   * @type {IDataFetcher}
   */
  _dataFetcher;
  /**
   * Protected reference to the schema validator service.
   *
   * @protected
   * @type {ISchemaValidator}
   */
  _schemaValidator;
  /**
   * Protected reference to the data registry service.
   *
   * @protected
   * @type {IDataRegistry}
   */
  _dataRegistry;

  /**
   * The primary schema ID used for validation by this loader instance.
   * Determined by the contentType passed to the constructor via configuration.
   * If null, primary validation might be skipped.
   *
   * @protected
   * @type {string | null}
   */
  _primarySchemaId;

  /**
   * Creates an instance of BaseManifestItemLoader.
   *
   * @param {string} contentType - The logical name of the content type this loader handles (e.g., 'actions', 'components'). Used to find the primary schema.
   * @param {IConfiguration} config - Configuration service instance.
   * @param {IPathResolver} pathResolver - Path resolution service instance.
   * @param {IDataFetcher} dataFetcher - Data fetching service instance.
   * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
   * @param {IDataRegistry} dataRegistry - Data registry service instance.
   * @param {ILogger} logger - Logging service instance.
   * @throws {TypeError} If contentType is invalid or any dependency is missing, invalid, or lacks required methods.
   */
  constructor(
    contentType,
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    validateDependencies(
      [
        {
          dependency: logger,
          name: 'ILogger',
          methods: ['info', 'warn', 'error', 'debug'],
        },
        {
          dependency: config,
          name: 'IConfiguration',
          methods: ['getModsBasePath', 'getContentTypeSchemaId'],
        },
        {
          dependency: pathResolver,
          name: 'IPathResolver',
          methods: ['resolveModContentPath'],
        },
        {
          dependency: dataFetcher,
          name: 'IDataFetcher',
          methods: ['fetch'],
        },
        {
          dependency: schemaValidator,
          name: 'ISchemaValidator',
          methods: ['validate', 'getValidator', 'isSchemaLoaded'],
        },
        {
          dependency: dataRegistry,
          name: 'IDataRegistry',
          methods: ['store', 'get'],
        },
      ],
      logger
    );
    super(logger);

    if (typeof contentType !== 'string' || contentType.trim() === '') {
      const errorMsg = `BaseManifestItemLoader requires a non-empty string for 'contentType'. Received: ${contentType}`;
      this._logger.error(errorMsg);
      throw new TypeError(errorMsg);
    }
    const trimmedContentType = contentType.trim();

    // --- Store Dependencies ---
    this._config = config;
    this._pathResolver = pathResolver;
    this._dataFetcher = dataFetcher;
    this._schemaValidator = schemaValidator;
    this._dataRegistry = dataRegistry;

    // --- Retrieve and Store Primary Schema ID ---
    this._primarySchemaId =
      this._config.getContentTypeSchemaId(trimmedContentType);
    if (this._primarySchemaId) {
      this._logger.debug(
        `${this.constructor.name}: Primary schema ID for content type '${trimmedContentType}' found: '${this._primarySchemaId}'`
      );
    } else {
      this._logger.warn(
        `${this.constructor.name}: Primary schema ID for content type '${trimmedContentType}' not found in configuration. Primary validation might be skipped.`
      );
      this._primarySchemaId = null;
    }
  }

  /**
   * Validates the provided data object against the primary schema associated with this loader instance.
   * It handles cases where the primary schema ID is missing or the schema isn't loaded.
   * Errors are logged in detail, and an exception is thrown on validation failure.
   * If the schema ID is present but the schema is not loaded, a warning is logged, and validation is skipped.
   *
   * @protected
   * @param {any} data - The data object to validate.
   * @param {string} filename - The original filename (for context in logs/errors).
   * @param {string} modId - The ID of the mod owning the data (for context in logs/errors).
   * @param {string} resolvedPath - The resolved path of the file (for context in logs/errors).
   * @returns {ValidationResult} Result of the validation. If skipping due to unloaded schema, returns `{isValid: true, errors: null}`.
   * @throws {Error} When the schema is missing (and skipping disabled), no validator function exists, or validation fails.
   */
  _validatePrimarySchema(data, filename, modId, resolvedPath) {
    const schemaId = this._primarySchemaId;
    const loaderName = this.constructor.name; // Get loader name for consistent logging

    if (!schemaId) {
      this._logger.debug(
        `${loaderName} [${modId}]: Skipping primary schema validation for '${filename}' as no primary schema ID is configured for this loader.`
      );
      return { isValid: true, errors: null };
    }

    return validateAgainstSchema(
      this._schemaValidator,
      schemaId,
      data,
      this._logger,
      {
        validationDebugMessage: `${loaderName} [${modId}]: Validating '${filename}' against primary schema '${schemaId}'.`,
        notLoadedMessage: `${loaderName} [${modId}]: Rule schema '${schemaId}' is configured but not loaded. Skipping validation for ${filename}.`,
        notLoadedLogLevel: 'warn',
        skipIfSchemaNotLoaded: true,
        failureMessage: `${loaderName} [${modId}]: Primary schema validation failed for '${filename}' using schema '${schemaId}'.`,
        failureContext: { modId, filename, resolvedPath },
        failureThrowMessage: `${loaderName} [${modId}]: Primary schema validation failed for '${filename}' using schema '${schemaId}'.`,
      }
    );
  }

  /**
   * Retrieves the schema ID for a given content type from the configuration.
   * Logs a warning if the schema ID is not found.
   *
   * @protected
   * @param {string} contentType - The logical name of the content type (e.g., 'actions', 'components').
   * @returns {string | null} The schema ID string if found, otherwise null.
   * @deprecated This method is kept for potential internal use but getting the primary schema ID is now handled in the constructor. Direct use discouraged.
   */
  _getContentTypeSchemaId(contentType) {
    const schemaId = this._config.getContentTypeSchemaId(contentType);
    if (schemaId === null || schemaId === undefined) {
      this._logger.warn(
        `${this.constructor.name}: Schema ID for content type '${contentType}' not found in configuration.`
      );
      return null;
    }
    return schemaId;
  }

  /**
   * Abstract method to be implemented by subclasses. Processes the data fetched
   * from a single content file **after** it has been validated against the primary schema
   * by the `_processFileWrapper`.
   *
   * **Implementation Guidance:**
   * 1.  **Extract Base ID:** Determine the **base** item ID (un-prefixed) from the validated `data` or `filename`.
   * 2.  **Further Validation/Processing:** Perform any additional type-specific validation (e.g., component `dataSchema` validation) or data transformation.
   * 3.  **Store Item:** Delegate storage to `this._storeItemInRegistry`, passing the required parameters including the **base** item ID. **Crucially, `_storeItemInRegistry` must now return a boolean indicating if an overwrite occurred.**
   * 4.  **Return Result Object:** The implementation MUST return an object `{ qualifiedId: string, didOverride: boolean }` where `qualifiedId` is the fully qualified item ID (e.g., `modId:baseItemId`) and `didOverride` is the boolean returned by `_storeItemInRegistry`.
   *
   * @abstract
   * @protected
   * @async
   * @param {string} _modId - The ID of the mod owning the file.
   * @param {string} _filename - The original filename from the manifest.
   * @param {string} _resolvedPath - The fully resolved path to the file.
   * @param {any} _data - The raw data fetched from the file (already validated against the primary schema).
   * @param {string} _registryKey - The content type name (e.g., 'items', 'locations').
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} A promise resolving with an object containing the fully qualified item ID and whether an overwrite occurred.
   * @throws {Error} If processing or validation fails. This error will be caught by `_processFileWrapper`.
   */
  async _processFetchedItem(
    _modId,
    _filename,
    _resolvedPath,
    _data,
    _registryKey
  ) {
    // <<< MODIFIED: Updated JSDoc Guidance and Return Type
    // istanbul ignore next
    throw new Error(
      'Abstract method _processFetchedItem must be implemented by subclass.'
    );
  }

  /**
   * Safely extracts and validates filenames from the manifest for a given content key.
   * Filters out non-string and empty string entries, logging warnings.
   *
   * @protected
   * @param {object | null | undefined} manifest - The parsed mod manifest object.
   * @param {string} contentKey - The key within `manifest.content` (e.g., 'components', 'rules').
   * @param {string} modId - The ID of the mod being processed (for logging).
   * @returns {string[]} An array of valid, non-empty filenames. Returns empty array if key is missing, not an array, or contains no valid filenames.
   */
  _extractValidFilenames(manifest, contentKey, modId) {
    // Support dot notation for nested content keys (e.g., 'entities.definitions')
    const getNested = (obj, path) =>
      path
        .split('.')
        .reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    const filenames = getNested(manifest?.content, contentKey);
    if (filenames === null || filenames === undefined) {
      this._logger.debug(
        `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
      );
      return [];
    }
    if (!Array.isArray(filenames)) {
      this._logger.warn(
        `Mod '${modId}': Expected an array for content key '${contentKey}' but found type '${typeof filenames}'. Skipping.`
      );
      return [];
    }
    const validFilenames = filenames
      .filter((element) => {
        if (typeof element !== 'string') {
          this._logger.warn(
            `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`,
            element
          );
          return false;
        }
        const trimmedElement = element.trim();
        if (trimmedElement === '') {
          this._logger.warn(
            `Mod '${modId}': Empty string filename found in '${contentKey}' list after trimming. Skipping.`
          );
          return false;
        }
        return true;
      })
      .map((element) => element.trim());
    return validFilenames;
  }

  /**
   * Wraps the processing of a single content file, handling path resolution,
   * fetching, primary schema validation, calling the abstract processing method,
   * and central error logging.
   * Ensures errors are caught and logged centrally.
   *
   * @protected
   * @async
   * @param {string} modId - The ID of the mod owning the file.
   * @param {string} filename - The filename to process.
   * @param {string} diskFolder - The directory name for this content type (e.g., 'items', 'actions').
   * @param {string} registryKey - The content type name (e.g., 'items', 'locations').
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} A promise that resolves with the result object from `_processFetchedItem` (containing qualifiedId and didOverride) or rejects if any step fails.
   * @throws {Error} Re-throws the caught error after logging to allow `Promise.allSettled` to detect failure.
   */
  async _processFileWrapper(modId, filename, diskFolder, registryKey) {
    // <<< MODIFIED RETURN TYPE
    let resolvedPath = null;
    try {
      // 1. Resolve Path
      resolvedPath = this._pathResolver.resolveModContentPath(
        modId,
        diskFolder,
        filename
      );
      this._logger.debug(
        `[${modId}] Resolved path for ${filename}: ${resolvedPath}`
      );

      // 2. Fetch Data
      const data = await this._dataFetcher.fetch(resolvedPath);
      this._logger.debug(`[${modId}] Fetched data from ${resolvedPath}`);

      // 3. Primary Schema Validation
      this._validatePrimarySchema(data, filename, modId, resolvedPath);

      // 4. Subclass Processing
      // Pass original filename, resolved path, and registryKey for context
      // _processFetchedItem now returns { qualifiedId, didOverride }
      const result = await this._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        data,
        registryKey
      );
      this._logger.debug(
        `[${modId}] Successfully processed ${filename}. Result: ID=${result.qualifiedId}, Overwrite=${result.didOverride}`
      );

      // Return the object received from _processFetchedItem
      return result; // <<< MODIFIED RETURNED VALUE
    } catch (error) {
      // 5. Central Error Logging
      this._logger.error(
        `Error processing file:`, // Consistent error message prefix
        {
          modId,
          filename,
          path: resolvedPath ?? 'Path not resolved', // Include resolved path if available
          registryKey,
          error: error?.message || String(error), // Get error message safely
        },
        error // Pass the original error object for full stack trace logging
      );
      throw error; // Re-throw the error so Promise.allSettled can see it failed
    }
  }

  /**
   * Orchestrates the loading of all items for a specific content type from a mod manifest.
   * Uses `_extractValidFilenames` and `_processFileWrapper`, handling results via `Promise.allSettled`.
   * Logs a summary of the results and returns detailed counts.
   *
   * @protected
   * @async
   * @param {string} modId - The ID of the mod being processed.
   * @param {object} manifest - The parsed mod manifest object.
   * @param {string} contentKey - The key within `manifest.content` (e.g., 'components').
   * @param {string} diskFolder - The directory name for this content type (e.g., 'components').
   * @param {string} registryKey - The content type name (e.g., 'components', 'locations').
   * @returns {Promise<LoadItemsResult>} A promise that resolves with an object containing the counts of successfully processed items (`count`), items that caused an overwrite (`overrides`), and items that failed processing (`errors`).
   */
  async _loadItemsInternal(
    modId,
    manifest,
    contentKey,
    diskFolder,
    registryKey
  ) {
    // <<< MODIFIED RETURN TYPE
    const filenames = this._extractValidFilenames(manifest, contentKey, modId);
    const totalAttempted = filenames.length;

    if (totalAttempted === 0) {
      this._logger.debug(
        `No valid ${contentKey} filenames found for mod ${modId}.`
      );
      // Return zero counts if no files to process
      return { count: 0, overrides: 0, errors: 0 }; // <<< MODIFIED RETURN VALUE
    }

    this._logger.debug(
      `Found ${totalAttempted} potential ${contentKey} files to process for mod ${modId}.`
    );

    const processingPromises = filenames.map((filename) =>
      this._processFileWrapper(modId, filename, diskFolder, registryKey)
    );

    const settledResults = await Promise.allSettled(processingPromises);

    let processedCount = 0;
    let overrideCount = 0; // <<< ADDED override counter
    let failedCount = 0;

    settledResults.forEach((result, index) => {
      const currentFilename = filenames[index]; // Get filename for logging context
      if (result.status === 'fulfilled') {
        processedCount++;
        // Check the didOverride flag from the result value
        if (result.value && result.value.didOverride === true) {
          // <<< CHECK for override
          overrideCount++;
        }
        // Debug log for success is already in _processFileWrapper
      } else {
        failedCount++;
        // Error logging is already handled comprehensively in _processFileWrapper
        // Only log a debug message here indicating which file failed in the batch
        this._logger.debug(
          `[${modId}] Failure recorded for ${currentFilename} in batch processing. Reason logged previously.`
        );
      }
    });

    // Log summary using the calculated counts
    const overrideMessage =
      overrideCount > 0 ? ` (${overrideCount} overrides)` : '';
    const failureMessage = failedCount > 0 ? ` (${failedCount} failed)` : '';
    this._logger.info(
      `Mod [${modId}] - Processed ${processedCount}/${totalAttempted} ${contentKey} items.${overrideMessage}${failureMessage}`
    );

    // Return the detailed result object
    return {
      count: processedCount,
      overrides: overrideCount,
      errors: failedCount,
    }; // <<< MODIFIED RETURN VALUE
  }

  /**
   * Centralized helper method for storing items in the registry with standardized key prefixing,
   * overwrite checking, and data augmentation.
   * This method constructs the final `modId:baseItemId` key, checks if an item with this key already
   * exists in the specified category, logs a warning if it does, prepares the final data object
   * (including the final prefixed `id`, `modId`, and `_sourceFile`), and attempts to store it in the registry.
   * It wraps registry interactions in a try/catch block for robust error handling.
   *
   * @protected
   * @param {string} category - The data registry category (e.g., 'items', 'actions', 'entity_definitions').
   * @param {string} modId - The ID of the mod providing the item.
   * @param {string} baseItemId - The item's **un-prefixed** base ID (extracted from the item data or filename).
   * @param {object} dataToStore - The original data object fetched and validated for the item.
   * @param {string} sourceFilename - The original filename from which the data was loaded (for logging).
   * @returns {{qualifiedId: string, didOverride: boolean}} Object containing the fully qualified ID and override flag.
   * @throws {Error} Re-throws any error encountered during interaction with the data registry (`get` or `store`).
   */
  _storeItemInRegistry(
    category,
    modId,
    baseItemId,
    dataToStore,
    sourceFilename
  ) {
    if (!category || typeof category !== 'string') {
      this._logger.error(
        `${this.constructor.name} [_storeItemInRegistry]: Category must be a non-empty string. Received: ${category}`
      );
      // Potentially throw an error or return an indicator of failure
      return { qualifiedId: null, didOverride: false, error: true };
    }
    if (!modId || typeof modId !== 'string') {
      this._logger.error(
        `${this.constructor.name} [_storeItemInRegistry]: ModId must be a non-empty string for category '${category}'. Received: ${modId}`
      );
      return { qualifiedId: null, didOverride: false, error: true };
    }
    if (!baseItemId || typeof baseItemId !== 'string') {
      this._logger.error(
        `${this.constructor.name} [_storeItemInRegistry]: BaseItemId must be a non-empty string for category '${category}', mod '${modId}'. Received: ${baseItemId}`
      );
      return { qualifiedId: null, didOverride: false, error: true };
    }
    if (!dataToStore || typeof dataToStore !== 'object') {
      this._logger.error(
        `${this.constructor.name} [_storeItemInRegistry]: Data for '${modId}:${baseItemId}' (category: ${category}) must be an object. Received: ${typeof dataToStore}`
      );
      return { qualifiedId: null, didOverride: false, error: true };
    }

    const qualifiedId = `${modId}:${baseItemId}`;

    // Check if dataToStore is a class instance (not a plain object)
    const isClassInstance = dataToStore.constructor !== Object;
    
    let dataWithMetadata;
    if (isClassInstance) {
      // For class instances, add metadata as own properties to preserve class identity
      dataWithMetadata = dataToStore;
      Object.defineProperties(dataWithMetadata, {
        _modId: { value: modId, writable: false, enumerable: true },
        _sourceFile: { value: sourceFilename, writable: false, enumerable: true },
        _fullId: { value: qualifiedId, writable: false, enumerable: true },
        id: { value: baseItemId, writable: false, enumerable: true }
      });
    } else {
      // For plain objects, create a new object with all properties plus metadata
      dataWithMetadata = Object.assign({}, dataToStore, {
        _modId: modId,
        _sourceFile: sourceFilename,
        _fullId: qualifiedId,
        id: baseItemId,
      });
    }

    this._logger.debug(
      `${this.constructor.name} [${modId}]: Storing item in registry. Category: '${category}', Qualified ID: '${qualifiedId}', Base ID: '${baseItemId}', Filename: '${sourceFilename}'`
    );

    const didOverride = this._dataRegistry.store(
      category,
      qualifiedId, // Store under the fully qualified ID
      dataWithMetadata // Store the object with metadata as own properties
    );

    if (didOverride) {
      this._logger.warn(
        `${this.constructor.name} [${modId}]: Item '${qualifiedId}' (Base: '${baseItemId}') in category '${category}' from file '${sourceFilename}' overwrote an existing entry.`
      );
    } else {
      this._logger.debug(
        `${this.constructor.name} [${modId}]: Item '${qualifiedId}' (Base: '${baseItemId}') stored successfully in category '${category}'.`
      );
    }
    return { qualifiedId, didOverride };
  }

  /**
   * Parses an item's ID using {@link parseAndValidateId} and stores the item in
   * the data registry.
   *
   * @protected
   * @param {object} data - The raw item data containing the ID property.
   * @param {string} idProp - The property name of the ID within `data`.
   * @param {string} category - Registry category for storage.
   * @param {string} modId - ID of the mod providing the item.
   * @param {string} filename - Original filename for context in logs.
   * @param {{ allowFallback?: boolean }} [options] - Optional parse options.
   * @returns {{qualifiedId: string, didOverride: boolean}} Result info.
   */
  _parseIdAndStoreItem(data, idProp, category, modId, filename, options = {}) {
    const { baseId } = parseAndValidateId(
      data,
      idProp,
      modId,
      filename,
      this._logger,
      options
    );
    const { qualifiedId, didOverride } = this._storeItemInRegistry(
      category,
      modId,
      baseId,
      data,
      filename
    );
    return { qualifiedId, didOverride };
  }

  /**
   * Generic entry point for loading all items of a specific type for a given mod.
   * This method encapsulates the common logic for validating inputs and delegating
   * the actual loading process to the internal `_loadItemsInternal` method.
   * Subclasses should call this public method instead of directly calling `_loadItemsInternal`.
   *
   * @public
   * @async
   * @param {string} modId - The ID of the mod. Must be a non-empty string.
   * @param {ModManifest} modManifest - The manifest object for the mod. Must be a non-null object.
   * @param {string} contentKey - The key in the manifest's `content` section (e.g., 'actions', 'components'). Must be a non-empty string.
   * @param {string} diskFolder - The subdirectory within the mod's folder containing the content files (e.g., 'actions', 'components'). Must be a non-empty string.
   * @param {string} registryKey - A descriptive name for the content type being loaded (e.g., 'actions', 'components'). Used for logging and context. Must be a non-empty string.
   * @returns {Promise<LoadItemsResult>} A promise that resolves with an object containing the counts (`count`, `overrides`, `errors`) for this type and mod. Returns `{ count: 0, overrides: 0, errors: 0 }` if initial validation fails.
   * @throws {TypeError} If `contentKey`, `diskFolder`, or `registryKey` are invalid (indicates a programming error in the calling subclass).
   */
  async loadItemsForMod(
    modId,
    modManifest,
    contentKey,
    diskFolder,
    registryKey
  ) {
    // <<< MODIFIED: Updated JSDoc Guidance and Return Type
    // Validate inputs first (programming error check)
    if (typeof modId !== 'string' || modId.trim() === '') {
      const errorMsg = `${this.constructor.name}: Programming Error - Invalid 'modId' provided for loading content. Must be a non-empty string. Received: ${modId}`;
      this._logger.error(errorMsg);
      throw new TypeError(errorMsg);
    }
    const trimmedModId = modId.trim();
    if (!modManifest || typeof modManifest !== 'object') {
      const errorMsg = `${this.constructor.name}: Programming Error - Invalid 'modManifest' provided for loading content for mod '${trimmedModId}'. Must be a non-null object. Received: ${modManifest}`;
      this._logger.error(errorMsg);
      throw new TypeError(errorMsg);
    }
    if (typeof contentKey !== 'string' || contentKey.trim() === '') {
      const errorMsg = `${this.constructor.name}: Programming Error - Invalid 'contentKey' provided for loading ${registryKey} for mod '${trimmedModId}'. Must be a non-empty string. Received: ${contentKey}`;
      this._logger.error(errorMsg);
      throw new TypeError(errorMsg);
    }
    const trimmedContentKey = contentKey.trim();
    if (typeof diskFolder !== 'string' || diskFolder.trim() === '') {
      const errorMsg = `${this.constructor.name}: Programming Error - Invalid 'diskFolder' provided for loading ${registryKey} for mod '${trimmedModId}'. Must be a non-empty string. Received: ${diskFolder}`;
      this._logger.error(errorMsg);
      throw new TypeError(errorMsg);
    }
    const trimmedDiskFolder = diskFolder.trim();
    if (typeof registryKey !== 'string' || registryKey.trim() === '') {
      const errorMsg = `${this.constructor.name}: Programming Error - Invalid 'registryKey' provided for loading content for mod '${trimmedModId}'. Must be a non-empty string. Received: ${registryKey}`;
      this._logger.error(errorMsg);
      throw new TypeError(errorMsg);
    }
    const trimmedRegistryKey = registryKey.trim();

    this._logger.info(
      `${this.constructor.name}: Loading ${trimmedRegistryKey} definitions for mod '${trimmedModId}'.`
    );

    // <<< MODIFIED: Call the internal method with validated parameters
    return this._loadItemsInternal(
      trimmedModId,
      modManifest,
      trimmedContentKey,
      trimmedDiskFolder,
      trimmedRegistryKey
    );
  }
}
