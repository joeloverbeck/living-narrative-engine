/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
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
     * Abstract method to be implemented by subclasses. Processes the data fetched
     * from a single content file. Subclasses should validate the data against
     * a schema (if applicable) and store it in the data registry.
     * @abstract
     * @protected
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} data - The raw data fetched from the file.
     * @returns {any | Promise<any>} The result of processing (e.g., the validated data object, null, or undefined). Can be async.
     * @throws {Error} If processing or validation fails. This error will be caught by `_processFileWrapper`.
     */
    _processFetchedItem(modId, filename, resolvedPath, data) {
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
     * @returns {Promise<any>} A promise that resolves with the result from `_processFetchedItem` or rejects if any step fails.
     * @throws {Error} Re-throws the caught error after logging to allow `Promise.allSettled` to detect failure.
     */
    async _processFileWrapper(modId, filename, contentTypeDir) {
        let resolvedPath = null; // Initialize outside try for catch block access
        try {
            // 1. Resolve Path
            resolvedPath = this._pathResolver.resolveModContentPath(modId, contentTypeDir, filename);
            this._logger.debug(`[${modId}] Resolved path for ${filename}: ${resolvedPath}`);

            // 2. Fetch Data
            const data = await this._dataFetcher.fetch(resolvedPath);
            this._logger.debug(`[${modId}] Fetched data from ${resolvedPath}`);

            // 3. Call Abstract Method
            // Pass original filename and resolved path for context
            const result = await this._processFetchedItem(modId, filename, resolvedPath, data);
            this._logger.debug(`[${modId}] Successfully processed ${filename}`);

            // 4. Return Result
            return result;

        } catch (error) {
            // 5. Log Detailed Error
            this._logger.error(
                `Error processing file:`,
                {
                    modId,
                    filename,
                    path: resolvedPath ?? 'Path not resolved', // Use resolvedPath if available
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
     * @returns {Promise<number>} A promise that resolves with the count of successfully processed items.
     */
    async _loadItemsInternal(modId, manifest, contentKey, contentTypeDir) {
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
            this._processFileWrapper(modId, filename, contentTypeDir)
        );

        // 4. Await Promises
        const settledResults = await Promise.allSettled(processingPromises);

        // 5. Process Results
        let processedCount = 0;
        let failedCount = 0;

        settledResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                processedCount++;
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
}