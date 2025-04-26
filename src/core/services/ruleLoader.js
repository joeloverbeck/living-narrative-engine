// src/core/services/ruleLoader.js

import path from 'path'; // Node.js path module

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('./modManifestLoader.js').ModManifest} ModManifest // Assuming ModManifest type is defined elsewhere
 */

/**
 * Service responsible for loading, validating, and registering SystemRule definitions
 * from mods based on their manifests.
 * Follows the strict manifest-based approach (Parent Ticket: PARENT-TICKET-ID).
 */
class RuleLoader {
    /** @type {IConfiguration} */
    #config;
    /** @type {IPathResolver} */
    #pathResolver;
    /** @type {IDataFetcher} */
    #fetcher;
    /** @type {ISchemaValidator} */
    #validator;
    /** @type {IDataRegistry} */
    #registry;
    /** @type {ILogger} */
    #logger;
    /** @type {string | null} */
    #ruleSchemaId = null; // Cache the schema ID

    /**
     * Constructs a RuleLoader instance.
     * @param {IConfiguration} config - Configuration service.
     * @param {IPathResolver} pathResolver - Path resolution service.
     * @param {IDataFetcher} fetcher - Data fetching service.
     * @param {ISchemaValidator} validator - Schema validation service.
     * @param {IDataRegistry} registry - Data registry service.
     * @param {ILogger} logger - Logging service.
     */
    constructor(config, pathResolver, fetcher, validator, registry, logger) {
        // --- Dependency validation ---
        if (!config || typeof config.getContentTypeSchemaId !== 'function') {
            throw new Error("RuleLoader: Missing or invalid 'config' dependency (IConfiguration). Requires getContentTypeSchemaId method.");
        }
        if (!pathResolver || typeof pathResolver.resolveModContentPath !== 'function') { // Check for the specific method needed
            throw new Error("RuleLoader: Missing or invalid 'pathResolver' dependency (IPathResolver). Requires resolveModContentPath method.");
        }
        if (!fetcher || typeof fetcher.fetch !== 'function') {
            throw new Error("RuleLoader: Missing or invalid 'fetcher' dependency (IDataFetcher). Requires fetch method.");
        }
        if (!validator || typeof validator.validate !== 'function' || typeof validator.isSchemaLoaded !== 'function') { // Check for validate and isSchemaLoaded
            throw new Error("RuleLoader: Missing or invalid 'validator' dependency (ISchemaValidator). Requires validate and isSchemaLoaded methods.");
        }
        if (!registry || typeof registry.store !== 'function') { // Check for store
            throw new Error("RuleLoader: Missing or invalid 'registry' dependency (IDataRegistry). Requires store method.");
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            throw new Error("RuleLoader: Missing or invalid 'logger' dependency (ILogger). Requires info, warn, error, and debug methods.");
        }

        this.#config = config;
        this.#pathResolver = pathResolver;
        this.#fetcher = fetcher;
        this.#validator = validator;
        this.#registry = registry;
        this.#logger = logger;

        // Pre-fetch the schema ID for system rules from configuration
        this.#ruleSchemaId = this.#config.getContentTypeSchemaId('system-rules');
        if (!this.#ruleSchemaId) {
            this.#logger.warn(`RuleLoader: System rule schema ID is not configured ('system-rules'). Rule validation will be skipped.`);
        } else {
            this.#logger.debug(`RuleLoader: Initialized with rule schema ID: ${this.#ruleSchemaId}`);
        }
    }

    /**
     * Loads system rules defined in a specific mod's manifest.
     * This implements the strict manifest-based loading strategy.
     * It relies entirely on the manifest's `content.rules` array and
     * contains no fallback logic for rule discovery.
     *
     * @param {string} modId - The ID of the mod whose rules are being loaded.
     * @param {ModManifest} manifest - The parsed manifest object for the mod.
     * @returns {Promise<number>} A promise that resolves with the number of rules successfully loaded and registered for this mod.
     */
    async loadRulesForMod(modId, manifest) {
        const ruleFiles = manifest?.content?.rules; // Get the list from manifest

        // --- Input Type Validation ---
        if (!Array.isArray(ruleFiles)) {
            if (ruleFiles != null) {
                this.#logger.warn(`RuleLoader [${modId}]: Invalid 'content.rules' field in manifest. Expected an array, got ${typeof ruleFiles}. Skipping rule loading for this mod.`);
            } else {
                this.#logger.debug(`RuleLoader [${modId}]: No 'content.rules' field found in manifest. No rules to load.`);
            }
            return 0; // No valid rule files specified
        }

        if (ruleFiles.length === 0) {
            this.#logger.info(`RuleLoader [${modId}]: Manifest specifies an empty 'content.rules' array. No rules to load.`);
            return 0;
        }
        // --- End Input Type Validation ---

        // --- Filter ruleFiles Array for Valid Strings ---
        const validFilenames = [];
        let failedFilename = null; // Keep track of which file failed resolution for logging context
        ruleFiles.forEach(entry => {
            if (typeof entry === 'string') {
                const trimmedEntry = entry.trim();
                if (trimmedEntry.length > 0) {
                    validFilenames.push(trimmedEntry);
                } else {
                    this.#logger.warn(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': (empty string after trimming) "${entry}"`);
                }
            } else if (entry !== null) {
                let entryString;
                try {
                    entryString = JSON.stringify(entry);
                } catch (e) {
                    entryString = String(entry); // Fallback
                }
                this.#logger.warn(`RuleLoader [${modId}]: Skipping invalid entry in 'content.rules': ${entryString}`);
            }
            // Null entries are skipped silently
        });
        // --- End Filter ---


        // --- Handle Empty List After Filtering and Delegate Processing ---
        if (validFilenames.length === 0) {
            this.#logger.info(`RuleLoader [${modId}]: No valid rule files listed in manifest 'content.rules' after filtering.`);
            return 0; // Return 0 successful loads
        }

        this.#logger.debug(`RuleLoader [${modId}]: Filtered rule filenames to process: ${JSON.stringify(validFilenames)}`);

        const absolutePaths = [];
        try {
            for (const filename of validFilenames) {
                failedFilename = filename; // Store filename in case of error
                const resolvedPath = this.#pathResolver.resolveModContentPath(modId, 'system-rules', filename);
                absolutePaths.push(resolvedPath);
            }
            failedFilename = null; // Reset if loop completes successfully
        } catch (pathError) {
            // Log the error including which file failed
            this.#logger.error(`RuleLoader [${modId}]: Failed to resolve path for rule file '${failedFilename}'. Aborting rule loading for this mod. Error: ${pathError.message}`, {
                error: pathError,
                modId: modId,
                filename: failedFilename, // Include the failing filename
                manifestRules: ruleFiles // Include original list for context
            });
            return 0; // Indicate failure by returning 0 rules loaded
        }

        this.#logger.info(`RuleLoader [${modId}]: Loading ${absolutePaths.length} rule file(s) specified by manifest.`);

        // Delegate processing to #processRulePaths
        try {
            return await this.#processRulePaths(absolutePaths, modId);
        } catch (processingError) {
            this.#logger.error(`RuleLoader [${modId}]: Unexpected error occurred during #processRulePaths. Error: ${processingError.message}`, {
                error: processingError,
                modId: modId,
                resolvedPaths: absolutePaths
            });
            return 0; // Assuming processing errors should also result in 0 loaded count for the mod
        }
        // --- End Delegation ---
    }

    /**
     * Processes a list of absolute paths to rule files for a specific mod.
     * Fetches, validates, and registers each rule.
     * @private
     * @param {string[]} absolutePaths - Array of absolute paths to validated rule files.
     * @param {string} modId - The ID of the mod these rules belong to.
     * @returns {Promise<number>} A promise resolving to the number of rules successfully processed and registered.
     * @throws {Error} If critical errors occur during fetching, parsing, validation, or storage.
     */
    async #processRulePaths(absolutePaths, modId) {
        let successfulLoads = 0;
        let ruleValidatorFn = null;

        // --- DEBUG LOG ---
        // console.log(`DEBUG [${modId}]: #processRulePaths received paths:`, absolutePaths);
        // --- END DEBUG ---

        // Get validator function once (logic unchanged)
        if (this.#ruleSchemaId && this.#validator.isSchemaLoaded(this.#ruleSchemaId)) {
            ruleValidatorFn = this.#validator.getValidator(this.#ruleSchemaId);
            if (!ruleValidatorFn) {
                this.#logger.error(`RuleLoader [${modId}]: Could not retrieve validator function for rule schema '${this.#ruleSchemaId}'. Validation will be effectively skipped.`);
            }
        } else if (this.#ruleSchemaId) {
            this.#logger.warn(`RuleLoader [${modId}]: Rule schema '${this.#ruleSchemaId}' is configured but not loaded. Skipping validation.`);
        }

        const processingPromises = absolutePaths.map(async (filePath) => {
            const filename = path.basename(filePath);
            try {
                // a. Fetch
                const ruleData = await this.#fetcher.fetch(filePath);

                // b. Validate (logic unchanged)
                if (ruleValidatorFn) {
                    const validationResult = ruleValidatorFn(ruleData);
                    if (!validationResult.isValid) {
                        const errorDetails = JSON.stringify(validationResult.errors, null, 2);
                        throw new Error(`Schema validation failed for ${filename}: ${errorDetails}`);
                    }
                }

                // c. Determine Rule ID (logic unchanged)
                const ruleIdInData = ruleData?.rule_id;
                const generatedRuleId = typeof ruleIdInData === 'string' && ruleIdInData.trim()
                    ? ruleIdInData.trim()
                    : ruleIdInData?.startsWith(`${modId}:`)
                        ? ruleIdInData.substring(modId.length + 1)
                        : path.parse(filename).name;
                const finalRuleId = `${modId}:${generatedRuleId}`;

                // Check for duplicates (logic unchanged)
                if (this.#registry.get('system-rules', finalRuleId)) {
                    this.#logger.warn(`RuleLoader [${modId}]: Overwriting existing rule with ID '${finalRuleId}' from file '${filename}'.`);
                }

                // d. Store (logic unchanged)
                this.#registry.store('system-rules', finalRuleId, ruleData);
                this.#logger.debug(`RuleLoader [${modId}]: Successfully processed and registered rule '${finalRuleId}' from file '${filename}'.`);

                // --- DEBUG LOG ---
                // console.log(`DEBUG [${modId}]: File '${filename}' fulfilled.`);
                // --- END DEBUG ---
                // Return value for success case is unchanged
                return {status: 'fulfilled', value: finalRuleId}; // This still needs to be returned for Promise.allSettled

            } catch (error) {
                // --- DEBUG LOG ---
                // console.log(`DEBUG [${modId}]: File '${filename}' caught error:`, error.message);
                // --- END DEBUG ---

                // e. Handle errors (Fetch, Parse, Validation, Storage)
                this.#logger.error(`RuleLoader [${modId}]: Failed to fetch rule file '${filename}'. Skipping.`, {
                    error,
                    modId,
                    filePath
                });

                // --- FIX: Re-throw the error so the promise rejects ---
                throw error;
                // --- END FIX ---

                // No return value needed here anymore
            }
        });

        const results = await Promise.allSettled(processingPromises);

        // --- DEBUG LOG ---
        // console.log(`DEBUG [${modId}]: Promise.allSettled results:`, JSON.stringify(results, null, 2));
        // --- END DEBUG ---

        // Reset counter - necessary if this function is called multiple times,
        // though it's scoped locally here, it's good practice.
        successfulLoads = 0;

        results.forEach(result => {
            // The check remains the same: only count fulfilled promises
            if (result.status === 'fulfilled') {
                successfulLoads++;
            }
            // --- DEBUG LOG ---
            // else {
            //     console.log(`DEBUG [${modId}]: Skipping increment for rejected promise. Reason:`, result.reason?.message);
            // }
            // --- END DEBUG ---
        });

        // Final summary logging (logic unchanged)
        if (successfulLoads > 0 && successfulLoads < absolutePaths.length) {
            this.#logger.warn(`RuleLoader [${modId}]: Processed ${successfulLoads} out of ${absolutePaths.length} rule files successfully (some failed).`);
        } else if (successfulLoads === absolutePaths.length && absolutePaths.length > 0) {
            this.#logger.info(`RuleLoader [${modId}]: Successfully processed and registered all ${successfulLoads} validated rule files for mod.`);
        } else if (successfulLoads === 0 && absolutePaths.length > 0) {
            this.#logger.error(`RuleLoader [${modId}]: Failed to process any of the ${absolutePaths.length} specified rule files. Check previous errors.`);
        }

        // --- DEBUG LOG ---
        // console.log(`DEBUG [${modId}]: #processRulePaths returning count: ${successfulLoads}`);
        // --- END DEBUG ---
        return successfulLoads;
    }


    /**
     * Loads all rules for a list of mods based on their manifests and load order.
     *
     * @param {Array<{modId: string, manifest: ModManifest}>} modsToLoad - An ordered list of mod IDs and their manifests.
     * @returns {Promise<number>} A promise resolving to the total number of rules loaded across all mods.
     */
    async loadAllRules(modsToLoad) {
        this.#logger.info(`RuleLoader: Starting rule loading for ${modsToLoad.length} mods.`);
        let totalRulesLoaded = 0;

        // Check if the required rule schema is loaded before starting
        if (this.#ruleSchemaId && !this.#validator.isSchemaLoaded(this.#ruleSchemaId)) {
            this.#logger.error(`RuleLoader: Cannot proceed. Configured rule schema '${this.#ruleSchemaId}' is not loaded. Ensure schemas are loaded first.`);
            return 0; // Halt loading if primary schema is missing
        } else if (!this.#ruleSchemaId) {
            this.#logger.warn(`RuleLoader: No rule schema ID configured ('system-rules'). Rules will be loaded without schema validation.`);
        }

        for (const {modId, manifest} of modsToLoad) {
            this.#logger.debug(`RuleLoader: Loading rules for mod: ${modId}`);
            try {
                // Delegate loading for this specific mod to loadRulesForMod
                const count = await this.loadRulesForMod(modId, manifest);
                totalRulesLoaded += count;
            } catch (error) {
                // This catch block would only be hit if loadRulesForMod re-threw an error,
                // but currently it returns 0 on path resolution or processing errors.
                this.#logger.error(`RuleLoader: Unexpected error during rule loading for mod '${modId}'. Load sequence may be incomplete. Error: ${error.message}`, {
                    error,
                    modId
                });
                // Consider re-throwing if mod-level failures should halt everything
                // throw error;
            }
        }

        this.#logger.info(`RuleLoader: Finished loading rules for all mods. Total rules registered: ${totalRulesLoaded}.`);
        // Optional: Rebuild registry index if needed
        // this.#registry.rebuildRuleIndex();

        return totalRulesLoaded;
    }

    /**
     * DEPRECATED: Placeholder method for compatibility during refactoring.
     * This method likely represented the old way of loading rules globally.
     * It should no longer be used directly; use `loadAllRules` instead.
     *
     * @deprecated Use loadAllRules(modsToLoad) instead.
     * @returns {Promise<void>}
     */
    async loadAll() {
        this.#logger.warn("RuleLoader.loadAll() is deprecated and likely non-functional in the new mod-based system. Use loadAllRules(modsToLoad) which requires the list of mods.");
        // Returning 0 to signify no rules loaded via this old path.
        return Promise.resolve(0);
    }
}

export default RuleLoader;