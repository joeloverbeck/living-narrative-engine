// src/core/services/baseManifestItemLoader.js

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest // Assuming ModManifest type is defined here or imported
 */

/**
 * Abstract base class for loading items defined in a mod manifest's content section.
 * Provides common logic for discovering, fetching, and processing files.
 * Subclasses must implement the `_processFetchedItem` method.
 * @abstract
 * @class BaseManifestItemLoader
 */
export class BaseManifestItemLoader {
    /**
     * Protected reference to the configuration service.
     * @protected
     * @type {IConfiguration}
     */
    _config;
    /**
     * Protected reference to the path resolver service.
     * @protected
     * @type {IPathResolver}
     */
    _pathResolver;
    /**
     * Protected reference to the data fetcher service.
     * @protected
     * @type {IDataFetcher}
     */
    _dataFetcher;
    /**
     * Protected reference to the schema validator service.
     * @protected
     * @type {ISchemaValidator}
     */
    _schemaValidator;
    /**
     * Protected reference to the data registry service.
     * @protected
     * @type {IDataRegistry}
     */
    _dataRegistry;
    /**
     * Protected reference to the logger service.
     * @protected
     * @type {ILogger}
     */
    _logger;

    /**
     * Creates an instance of BaseManifestItemLoader.
     * @param {IConfiguration} config - Configuration service instance.
     * @param {IPathResolver} pathResolver - Path resolution service instance.
     * @param {IDataFetcher} dataFetcher - Data fetching service instance.
     * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
     * @param {IDataRegistry} dataRegistry - Data registry service instance.
     * @param {ILogger} logger - Logging service instance.
     * @throws {TypeError} If any dependency is missing, invalid, or lacks required methods.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        // --- Dependency Validation ---

        // IConfiguration
        if (!config || typeof config !== 'object') {
            throw new TypeError("BaseManifestItemLoader requires a valid IConfiguration instance.");
        }
        if (typeof config.getModsBasePath !== 'function') {
            throw new TypeError("BaseManifestItemLoader: IConfiguration instance must have a 'getModsBasePath' method.");
        }
        if (typeof config.getContentTypeSchemaId !== 'function') {
            throw new TypeError("BaseManifestItemLoader: IConfiguration instance must have a 'getContentTypeSchemaId' method.");
        }
        // Add checks for other IConfiguration methods if directly used by the base class in the future

        // IPathResolver
        if (!pathResolver || typeof pathResolver !== 'object') {
            throw new TypeError("BaseManifestItemLoader requires a valid IPathResolver instance.");
        }
        if (typeof pathResolver.resolveModContentPath !== 'function') {
            throw new TypeError("BaseManifestItemLoader: IPathResolver instance must have a 'resolveModContentPath' method.");
        }
        // Add checks for other IPathResolver methods if directly used by the base class in the future

        // IDataFetcher
        if (!dataFetcher || typeof dataFetcher !== 'object') {
            throw new TypeError("BaseManifestItemLoader requires a valid IDataFetcher instance.");
        }
        if (typeof dataFetcher.fetch !== 'function') {
            throw new TypeError("BaseManifestItemLoader: IDataFetcher instance must have a 'fetch' method.");
        }

        // ISchemaValidator
        if (!schemaValidator || typeof schemaValidator !== 'object') {
            throw new TypeError("BaseManifestItemLoader requires a valid ISchemaValidator instance.");
        }
        if (typeof schemaValidator.validate !== 'function') {
            throw new TypeError("BaseManifestItemLoader: ISchemaValidator instance must have a 'validate' method.");
        }
        if (typeof schemaValidator.getValidator !== 'function') {
            throw new TypeError("BaseManifestItemLoader: ISchemaValidator instance must have a 'getValidator' method.");
        }
        // Add checks for other ISchemaValidator methods (like addSchema, isSchemaLoaded) if needed by subclasses and validated here

        // IDataRegistry
        if (!dataRegistry || typeof dataRegistry !== 'object') {
            throw new TypeError("BaseManifestItemLoader requires a valid IDataRegistry instance.");
        }
        if (typeof dataRegistry.store !== 'function') {
            throw new TypeError("BaseManifestItemLoader: IDataRegistry instance must have a 'store' method.");
        }
        if (typeof dataRegistry.get !== 'function') {
            throw new TypeError("BaseManifestItemLoader: IDataRegistry instance must have a 'get' method.");
        }
        // Add checks for other IDataRegistry methods if directly used by the base class or needed by subclasses

        // ILogger
        if (!logger || typeof logger !== 'object') {
            throw new TypeError("BaseManifestItemLoader requires a valid ILogger instance.");
        }
        const requiredLoggerMethods = ['info', 'warn', 'error', 'debug'];
        for (const method of requiredLoggerMethods) {
            if (typeof logger[method] !== 'function') {
                throw new TypeError(`BaseManifestItemLoader: ILogger instance must have a '${method}' method.`);
            }
        }

        // --- Store Dependencies ---
        this._config = config;
        this._pathResolver = pathResolver;
        this._dataFetcher = dataFetcher;
        this._schemaValidator = schemaValidator;
        this._dataRegistry = dataRegistry;
        this._logger = logger;

        // Log successful initialization at debug level
        this._logger.debug(`${this.constructor.name}: Initialized successfully with all dependencies.`);
    }

    /**
     * Retrieves the schema ID for a given content type from the configuration.
     * Logs a warning if the schema ID is not found.
     *
     * @protected
     * @param {string} contentType - The logical name of the content type (e.g., 'actions', 'components').
     * @returns {string | null} The schema ID string if found, otherwise null.
     */
    _getContentTypeSchemaId(contentType) {
        const schemaId = this._config.getContentTypeSchemaId(contentType); // Uses this._config
        if (schemaId == null) { // Check for null or undefined
            // Uses this._logger
            this._logger.warn(`${this.constructor.name}: Schema ID for content type '${contentType}' not found in configuration.`);
            return null;
        }
        return schemaId;
    }


    /**
     * Abstract method to be implemented by subclasses. Processes the data fetched
     * from a single content file. Subclasses should validate the data against
     * a schema (if applicable), extract/determine the **base** item ID (un-prefixed),
     * and delegate storage to `_storeItemInRegistry`. The implementation MUST return
     * the **fully qualified** item ID (e.g., `modId:itemId`) which includes the mod prefix.
     *
     * @abstract
     * @protected
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} data - The raw data fetched from the file.
     * @param {string} typeName - The content type name (e.g., 'items', 'locations').
     * @returns {Promise<string>} A promise resolving with the **fully qualified** item ID (e.g., `modId:itemId`).
     * @throws {Error} If processing or validation fails. This error will be caught by `_processFileWrapper`.
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) { // <<< ADDED typeName
        // istanbul ignore next
        throw new Error('Abstract method _processFetchedItem must be implemented by subclass.');
    }

    /**
     * Safely extracts and validates filenames from the manifest for a given content key.
     * Filters out non-string and empty string entries, logging warnings.
     * @protected
     * @param {object | null | undefined} manifest - The parsed mod manifest object.
     * @param {string} contentKey - The key within `manifest.content` (e.g., 'components', 'rules').
     * @param {string} modId - The ID of the mod being processed (for logging).
     * @returns {string[]} An array of valid, non-empty filenames. Returns empty array if key is missing, not an array, or contains no valid filenames.
     */
    _extractValidFilenames(manifest, contentKey, modId) {
        const filenames = manifest?.content?.[contentKey];

        // 1. Check if the key exists and is defined
        if (filenames === null || filenames === undefined) {
            this._logger.debug(`Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`);
            return [];
        }

        // 2. Check if it's an array
        if (!Array.isArray(filenames)) {
            this._logger.warn(`Mod '${modId}': Expected an array for content key '${contentKey}' but found type '${typeof filenames}'. Skipping.`);
            return [];
        }

        // 3. Filter and validate the array elements
        const validFilenames = filenames.filter(element => {
            // Check if it's a string
            if (typeof element !== 'string') {
                this._logger.warn(`Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`, element);
                return false; // Skip non-string entry
            }

            // Trim whitespace
            const trimmedElement = element.trim();

            // Check if the trimmed string is empty
            if (trimmedElement === '') {
                this._logger.warn(`Mod '${modId}': Empty string filename found in '${contentKey}' list after trimming. Skipping.`);
                return false; // Skip empty string entry
            }

            return true; // Keep valid, non-empty string
        }).map(element => element.trim()); // Ensure returned strings are trimmed

        return validFilenames;
    }

    /**
     * Wraps the processing of a single content file, handling path resolution,
     * fetching, calling the abstract processing method, and error logging.
     * Ensures errors are caught and logged centrally.
     * @protected
     * @async
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The filename to process.
     * @param {string} contentTypeDir - The directory name for this content type (e.g., 'items', 'actions').
     * @param {string} typeName - The content type name (e.g., 'items', 'locations'). <<< NEW PARAMETER
     * @returns {Promise<any>} A promise that resolves with the result from `_processFetchedItem` (expected to be the fully qualified ID) or rejects if any step fails.
     * @throws {Error} Re-throws the caught error after logging to allow `Promise.allSettled` to detect failure.
     */
    async _processFileWrapper(modId, filename, contentTypeDir, typeName) { // <<< ADDED typeName
        let resolvedPath = null; // Initialize outside try for catch block access
        try {
            // 1. Resolve Path
            resolvedPath = this._pathResolver.resolveModContentPath(modId, contentTypeDir, filename);
            this._logger.debug(`[${modId}] Resolved path for ${filename}: ${resolvedPath}`);

            // 2. Fetch Data
            const data = await this._dataFetcher.fetch(resolvedPath);
            this._logger.debug(`[${modId}] Fetched data from ${resolvedPath}`);

            // 3. Call Abstract Method
            // Pass original filename, resolved path, and typeName for context
            const result = await this._processFetchedItem(modId, filename, resolvedPath, data, typeName); // <<< PASS typeName
            this._logger.debug(`[${modId}] Successfully processed ${filename}. Result from _processFetchedItem: ${result}`); // Log the result (qualified ID)

            // 4. Return Result (The fully qualified ID from the subclass)
            return result;

        } catch (error) {
            // 5. Log Detailed Error
            this._logger.error(
                `Error processing file:`,
                {
                    modId,
                    filename,
                    path: resolvedPath ?? 'Path not resolved', // Use resolvedPath if available
                    typeName, // <<< Log typeName
                    error: error?.message || String(error) // Ensure error message is captured
                },
                error // Pass the full error object for potential stack trace logging
            );

            // 6. Re-throw Error (Crucial for Promise.allSettled)
            throw error;
        }
    }

    /**
     * Orchestrates the loading of all items for a specific content type from a mod manifest.
     * Uses `_extractValidFilenames` and `_processFileWrapper`, handling results via `Promise.allSettled`.
     * Logs a summary of the results.
     * @protected
     * @async
     * @param {string} modId - The ID of the mod being processed.
     * @param {object} manifest - The parsed mod manifest object.
     * @param {string} contentKey - The key within `manifest.content` (e.g., 'components').
     * @param {string} contentTypeDir - The directory name for this content type (e.g., 'components').
     * @param {string} typeName - The content type name (e.g., 'components', 'locations'). <<< NEW PARAMETER
     * @returns {Promise<number>} A promise that resolves with the count of successfully processed items.
     */
    async _loadItemsInternal(modId, manifest, contentKey, contentTypeDir, typeName) { // <<< ADDED typeName
        // 1. Extract Filenames
        const filenames = this._extractValidFilenames(manifest, contentKey, modId);
        const totalAttempted = filenames.length;

        // 2. Handle Empty List
        if (totalAttempted === 0) {
            this._logger.debug(`No valid ${contentKey} filenames found for mod ${modId}.`);
            return 0; // Nothing to process, return 0 successes
        }

        this._logger.debug(`Found ${totalAttempted} potential ${contentKey} files to process for mod ${modId}.`);

        // 3. Create Processing Promises
        const processingPromises = filenames.map(filename =>
            this._processFileWrapper(modId, filename, contentTypeDir, typeName) // <<< PASS typeName
        );

        // 4. Await Promises
        const settledResults = await Promise.allSettled(processingPromises);

        // 5. Process Results
        let processedCount = 0;
        let failedCount = 0;

        settledResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                processedCount++;
                // Optionally log the returned qualified ID at debug level for tracing success
                this._logger.debug(`[${modId}] Successfully processed ${filenames[index]} - Qualified ID: ${result.value}`);
            } else { // result.status === 'rejected'
                failedCount++;
                // Error was already logged in detail by _processFileWrapper
                // Optionally, log the reason at debug level here for quick summary/correlation
                this._logger.debug(`[${modId}] Failed processing ${filenames[index]}. Reason: ${result.reason?.message || result.reason}`);
            }
        });

        // 6. Log Summary
        const failureMessage = failedCount > 0 ? ` (${failedCount} failed)` : '';
        this._logger.info(
            `Mod [${modId}] - Processed ${processedCount}/${totalAttempted} ${contentKey} items.${failureMessage}`
        );

        // 7. Return Count
        return processedCount;
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
     * @param {string} category - The data registry category (e.g., 'items', 'actions', 'entities').
     * @param {string} modId - The ID of the mod providing the item.
     * @param {string} baseItemId - The item's **un-prefixed** base ID (extracted from the item data or filename).
     * @param {object} dataToStore - The original data object fetched and validated for the item.
     * @param {string} sourceFilename - The original filename from which the data was loaded (for logging).
     * @returns {void} Does not return a value.
     * @throws {Error} Re-throws any error encountered during interaction with the data registry (`get` or `store`).
     */
    _storeItemInRegistry(category, modId, baseItemId, dataToStore, sourceFilename) {
        // AC: Define the _storeItemInRegistry method within the BaseManifestItemLoader class
        // Construct the final key using the modId and the un-prefixed baseItemId
        const finalRegistryKey = `${modId}:${baseItemId}`;

        try {
            // AC: The method correctly uses injected _dataRegistry and _logger.
            // Check for existing definition using the fully qualified key
            const existingDefinition = this._dataRegistry.get(category, finalRegistryKey);

            if (existingDefinition != null) {
                // AC: Override warnings are logged using the subclass's name via this.constructor.name.
                this._logger.warn(
                    `${this.constructor.name} [${modId}]: Overwriting existing ${category} definition with key '${finalRegistryKey}'. ` +
                    `New Source: ${sourceFilename}. Previous Source: ${existingDefinition._sourceFile || 'unknown'} from mod '${existingDefinition.modId || 'unknown'}.'`
                );
            }

            // Prepare the final data object, ensuring required fields are present/overwritten
            // The object stored should contain the FINAL, PREFIXED ID in its `id` field.
            // AC: Stored data includes id (matching finalItemId), modId, and _sourceFile.
            // AC: Ensure the method correctly augments the dataToStore object, specifically setting the id field to the finalItemId.
            const finalData = {
                ...dataToStore, // Spread the original data
                id: finalRegistryKey, // Ensure the final, prefixed key is stored within the object itself
                modId: modId,         // Ensure the mod ID is stored
                _sourceFile: sourceFilename // Ensure the source filename is stored
            };

            // AC: The method correctly uses injected _dataRegistry
            // Store the augmented data using the final, prefixed key
            this._dataRegistry.store(category, finalRegistryKey, finalData);

            // AC: The method correctly uses injected _logger.
            // Log successful storage at debug level
            this._logger.debug(
                `${this.constructor.name} [${modId}]: Successfully stored ${category} item '${finalRegistryKey}' from file '${sourceFilename}'.`
            );

        } catch (error) {
            // AC: Storage errors are logged and re-thrown.
            // AC: The method correctly uses injected _logger.
            // Log the error encountered during registry interaction
            this._logger.error(
                // AC: Override warnings are logged using the subclass's name via this.constructor.name. (Error logs also use it)
                `${this.constructor.name} [${modId}]: Failed to store ${category} item with key '${finalRegistryKey}' from file '${sourceFilename}' in data registry.`,
                {
                    category,
                    modId,
                    baseItemId,
                    finalRegistryKey,
                    sourceFilename,
                    error: error?.message || String(error)
                },
                error // Pass the original error object
            );
            // Re-throw the error to be handled by the calling context (e.g., _processFileWrapper)
            throw error;
        }
        // AC: The _storeItemInRegistry method is added to BaseManifestItemLoader.js with the specified signature and implementation.
    }

    // --- NEW METHOD: REFACTOR-LOADER-1 ---
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
     * @param {string} contentTypeDir - The subdirectory within the mod's folder containing the content files (e.g., 'actions', 'components'). Must be a non-empty string.
     * @param {string} typeName - A descriptive name for the content type being loaded (e.g., 'actions', 'components'). Used for logging and context. Must be a non-empty string.
     * @returns {Promise<number>} A promise that resolves with the numerical count of items successfully loaded and processed for this type and mod. Returns 0 if initial validation fails.
     * @throws {TypeError} If `contentKey`, `contentTypeDir`, or `typeName` are invalid (indicates a programming error in the calling subclass).
     */
    async loadItemsForMod(modId, modManifest, contentKey, contentTypeDir, typeName) {
        // AC: Log informational message at the start
        this._logger.info(`${this.constructor.name}: Loading ${typeName} definitions for mod '${modId}'.`);

        // AC: Validate modId (non-empty string)
        if (typeof modId !== 'string' || modId.trim() === '') {
            this._logger.error(`${this.constructor.name}: Invalid 'modId' provided for loading ${typeName}. Must be a non-empty string. Received: ${modId}`);
            return 0; // Return 0 if invalid
        }
        const trimmedModId = modId.trim(); // Use trimmed version going forward

        // AC: Validate modManifest (non-null object)
        if (!modManifest || typeof modManifest !== 'object') {
            this._logger.error(`${this.constructor.name}: Invalid 'modManifest' provided for loading ${typeName} for mod '${trimmedModId}'. Must be a non-null object. Received: ${typeof modManifest}`);
            return 0; // Return 0 if invalid
        }

        // AC: Validate contentKey, contentTypeDir, typeName (non-empty strings)
        if (typeof contentKey !== 'string' || contentKey.trim() === '') {
            const errorMsg = `${this.constructor.name}: Programming Error - Invalid 'contentKey' provided for loading ${typeName} for mod '${trimmedModId}'. Must be a non-empty string. Received: ${contentKey}`;
            this._logger.error(errorMsg);
            throw new TypeError(errorMsg); // Throw TypeError for programming errors
        }
        const trimmedContentKey = contentKey.trim();

        if (typeof contentTypeDir !== 'string' || contentTypeDir.trim() === '') {
            const errorMsg = `${this.constructor.name}: Programming Error - Invalid 'contentTypeDir' provided for loading ${typeName} for mod '${trimmedModId}'. Must be a non-empty string. Received: ${contentTypeDir}`;
            this._logger.error(errorMsg);
            throw new TypeError(errorMsg); // Throw TypeError for programming errors
        }
        const trimmedContentTypeDir = contentTypeDir.trim();

        if (typeof typeName !== 'string' || typeName.trim() === '') {
            // Note: This case is highly unlikely if the previous checks passed, but included for completeness.
            const errorMsg = `${this.constructor.name}: Programming Error - Invalid 'typeName' provided for loading content for mod '${trimmedModId}'. Must be a non-empty string. Received: ${typeName}`;
            this._logger.error(errorMsg);
            throw new TypeError(errorMsg); // Throw TypeError for programming errors
        }
        const trimmedTypeName = typeName.trim();


        // AC: Call _loadItemsInternal exactly once, passing parameters
        this._logger.debug(`${this.constructor.name} [${trimmedModId}]: Delegating loading for type '${trimmedTypeName}' to _loadItemsInternal.`);
        const count = await this._loadItemsInternal(
            trimmedModId,
            modManifest,
            trimmedContentKey,
            trimmedContentTypeDir,
            trimmedTypeName
        );

        // AC: Return the numerical count from _loadItemsInternal
        this._logger.debug(`${this.constructor.name} [${trimmedModId}]: Finished loading for type '${trimmedTypeName}'. Count: ${count}`);
        return count;
    }

    // --- END NEW METHOD ---
}