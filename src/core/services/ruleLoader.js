// src/core/services/ruleLoader.js

// Import BaseManifestItemLoader
import {BaseManifestItemLoader} from './baseManifestItemLoader.js';

// --- REMOVE the top-level dynamic import ---
// let pathModule = null;
// try {
//     pathModule = await import('path');
// } catch (e) {
//     console.warn("RuleLoader: Node.js 'path' module is not available in this environment. Filename parsing fallback will be used.");
// }
// --- End Removal ---


/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest // Define or import ModManifest type
 */

/**
 * Loads, validates, and registers SystemRule definitions from mods.
 * This class extends {@link BaseManifestItemLoader} and relies on the mod manifest
 * for discovering rule files (`content.rules`). It implements the rule-specific
 * fetching, validation, ID generation, and storage logic in the `_processFetchedItem`
 * method, which is called by the base class's processing loop.
 * @extends BaseManifestItemLoader
 */
class RuleLoader extends BaseManifestItemLoader {
    // Remove private fields for dependencies handled by base class

    // REMOVED: Private field for caching schema ID
    // #ruleSchemaId = null;

    /**
     * @private
     * @type {object | null | undefined} - Cached 'path' module. undefined means not yet attempted, null means failed to load.
     */
    #pathModule = undefined;

    /**
     * Constructs a RuleLoader instance.
     * Calls the parent constructor to store dependencies.
     *
     * @param {IConfiguration} config - Configuration service instance.
     * @param {IPathResolver} pathResolver - Path resolution service instance.
     * @param {IDataFetcher} fetcher - Data fetching service instance.
     * @param {ISchemaValidator} validator - Schema validation service instance.
     * @param {IDataRegistry} registry - Data registry service instance.
     * @param {ILogger} logger - Logging service instance.
     */
    constructor(config, pathResolver, fetcher, validator, registry, logger) {
        // Call super() first, passing all dependencies
        super(config, pathResolver, fetcher, validator, registry, logger);

        // REMOVED: Logic to cache schema ID in constructor
        // this.#ruleSchemaId = this._config.getContentTypeSchemaId('system-rules');
        // if (!this.#ruleSchemaId) {
        //     this._logger.warn(`RuleLoader: System rule schema ID is not configured ('system-rules'). Rule validation will be skipped.`);
        // } else {
        //     this._logger.debug(`RuleLoader: Initialized with rule schema ID: ${this.#ruleSchemaId}`);
        // }

        // Log initialization
        this._logger.debug(`RuleLoader: Initialized.`);
        // Don't import 'path' here yet.
    }

    // --- METHOD REMOVED: loadRulesForMod ---
    /*
     * Removed the loadRulesForMod method and its JSDoc comments as per REFACTOR-LOADER-2.
     * The generic loadItemsForMod in the base class should be used instead.
     */


    /**
     * @private
     * Attempts to dynamically load the 'path' module and caches it.
     * @returns {Promise<object | null>} The loaded path module or null if unavailable/failed.
     */
    async #getPathModule() {
        if (this.#pathModule === undefined) { // Only attempt loading once
            try {
                // Dynamically import the 'path' module
                // Note: Ensure the environment supports dynamic import()
                this.#pathModule = await import('path');
                this._logger.debug("RuleLoader: Successfully loaded Node.js 'path' module dynamically.");
            } catch (e) {
                this.#pathModule = null; // Mark as failed
                this._logger.warn("RuleLoader: Node.js 'path' module is not available in this environment. Filename parsing fallback will be used.");
            }
        }
        return this.#pathModule;
    }


    /**
     * Processes a single fetched system rule file's data.
     * This method is called by the base class's `_processFileWrapper`. It performs:
     * 1.  **Schema Validation:** Validates the fetched `data` against the configured system rule schema (if available).
     * 2.  **Rule ID Determination:** Extracts the rule ID from the `rule_id` field within the `data`. If not present, it derives a base ID from the `filename`. The resulting ID is the **un-prefixed** `baseRuleId`.
     * 3.  **Storage:** Delegates storage to the base class helper `_storeItemInRegistry` using the category 'system-rules', the `modId`, the **un-prefixed** `baseRuleId`, the original `data`, and the `filename`. The helper constructs the prefixed key (`modId:baseRuleId`) for storage.
     * 4.  **Return Value:** Returns the **fully qualified, prefixed** rule ID (`modId:baseRuleId`) as required by the base class.
     *
     * @override
     * @protected
     * @async
     * @param {string} modId - The ID of the mod the rule file belongs to (e.g., "BaseGame", "MyMod").
     * @param {string} filename - The original filename as listed in the mod manifest (e.g., "my_rule.rule.json").
     * @param {string} resolvedPath - The fully resolved path used to fetch the file data.
     * @param {any} data - The raw, parsed data object fetched from the rule file.
     * @param {string} typeName - The content type name ('system-rules').
     * @returns {Promise<string>} A promise resolving with the **fully qualified, prefixed** rule ID (e.g., "MyMod:my_rule") upon successful processing.
     * @throws {Error} Throws an error if schema validation fails (when applicable) or if storing the rule in the registry fails (errors from `_storeItemInRegistry` are re-thrown).
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        // AC: Located _processFetchedItem
        this._logger.debug(`RuleLoader [${modId}]: Processing fetched rule item: ${filename} from path ${resolvedPath} (Type: ${typeName})`);

        // --- Schema Validation (Conditional) ---
        // AC: Keep the schema validation logic
        // USE HELPER: Retrieve schema ID using the base class helper
        const schemaId = this._getContentTypeSchemaId('system-rules');
        let ruleValidatorFn = null;

        if (schemaId && this._schemaValidator.isSchemaLoaded(schemaId)) {
            ruleValidatorFn = this._schemaValidator.getValidator(schemaId);
            if (!ruleValidatorFn) {
                this._logger.error(`RuleLoader [${modId}]: Could not retrieve validator function for rule schema '${schemaId}' for file ${filename}. Validation will be skipped.`);
            }
        } else if (schemaId) {
            this._logger.warn(`RuleLoader [${modId}]: Rule schema '${schemaId}' is configured but not loaded. Skipping validation for ${filename}.`);
        } else {
            // Warning logged by helper
            this._logger.warn(`RuleLoader [${modId}]: No rule schema ID configured ('system-rules'). Skipping validation for ${filename}.`);
        }

        if (ruleValidatorFn) {
            this._logger.debug(`RuleLoader [${modId}]: Performing schema validation for ${filename} using schema '${schemaId}'...`);
            const validationResult = ruleValidatorFn(data);
            if (!validationResult.isValid) {
                const errorDetails = JSON.stringify(validationResult.errors ?? [], null, 2);
                this._logger.error(`RuleLoader [${modId}]: Schema validation failed for rule file '${filename}' at ${resolvedPath}. Errors:\n${errorDetails}`);
                throw new Error(`Schema validation failed for ${filename} in mod ${modId}.`);
            }
            this._logger.debug(`RuleLoader [${modId}]: Schema validation passed for ${filename}.`);
        }
        // --- End Schema Validation ---


        // --- Rule ID Determination ---
        // AC: Keep the schema validation and rule ID determination logic (resulting in the un-prefixed baseRuleId).
        const ruleIdInData = data?.rule_id;
        let baseRuleId; // This will hold the UN-PREFIXED ID used for registry key construction by the helper.

        if (typeof ruleIdInData === 'string' && ruleIdInData.trim()) {
            baseRuleId = ruleIdInData.trim();
            this._logger.debug(`RuleLoader [${modId}]: Using rule_id '${baseRuleId}' from data in ${filename}.`);
            // Check if the ID from data already contains the mod prefix and strip it if necessary.
            if (baseRuleId.startsWith(`${modId}:`)) {
                this._logger.warn(`RuleLoader [${modId}]: rule_id '${baseRuleId}' in ${filename} already contains mod prefix '${modId}:'. Stripping prefix to get baseRuleId.`);
                baseRuleId = baseRuleId.substring(modId.length + 1);
            }
        } else {
            // Fallback to filename if rule_id is missing or invalid in data
            const pathModule = await this.#getPathModule(); // Await the helper method

            let namePart;
            if (pathModule) { // Use path module if available
                namePart = pathModule.parse(filename).name;
            } else {
                // Fallback parsing logic (remains the same)
                const baseFilename = filename.includes('/') ? filename.substring(filename.lastIndexOf('/') + 1) : filename;
                namePart = baseFilename.includes('.') ? baseFilename.substring(0, baseFilename.lastIndexOf('.')) : baseFilename;
            }
            baseRuleId = namePart; // Assign filename base as the baseRuleId
            this._logger.debug(`RuleLoader [${modId}]: No valid 'rule_id' found in data for ${filename}. Derived baseRuleId '${baseRuleId}' from filename.`);
        }

        // At this point, baseRuleId holds the un-prefixed ID.
        this._logger.debug(`RuleLoader [${modId}]: Determined baseRuleId for ${filename} as '${baseRuleId}'.`);
        // --- End Rule ID Determination ---


        // --- Storage ---
        // Delegate storage to the base helper, passing the *base* rule ID.
        // The helper constructs the final prefixed registry key `modId:baseRuleId`.
        // AC: Add a call to the base class helper method: this._storeItemInRegistry...
        // AC: The call uses 'system-rules' as the category, the modId, the un-prefixed baseRuleId as baseItemId, the original data, and the filename.
        this._logger.debug(`RuleLoader [${modId}]: Delegating storage for rule (base ID: '${baseRuleId}') from ${filename} to base helper.`);
        try {
            // Pass the UN-PREFIXED baseRuleId to the helper.
            this._storeItemInRegistry('system-rules', modId, baseRuleId, data, filename);
            // Logging of success/overwrite/failure is handled within _storeItemInRegistry.
        } catch (storageError) {
            // Error logging is handled within the base helper. Re-throw to allow _processFileWrapper to catch it.
            throw storageError;
        }
        // --- End Storage ---


        // --- Return Value ---
        // Return the fully qualified, prefixed ID as required by the base class contract.
        // AC: Modify the return statement to return the fully qualified, prefixed ID: return \modId:{baseRuleId};.
        const fullyQualifiedId = `${modId}:${baseRuleId}`; // Construct the prefixed ID for return
        this._logger.debug(`RuleLoader [${modId}]: Successfully processed rule from ${filename}. Returning fully qualified ID: ${fullyQualifiedId}`);
        return fullyQualifiedId;
        // --- End Return Value ---
    }


    /**
     * Loads all rules for a list of mods based on their manifests and load order.
     * This method iterates through the provided mod list, calling `loadRulesForMod`
     * for each mod sequentially. It aggregates the count of loaded rules.
     *
     * @param {Array<{modId: string, manifest: ModManifest}>} modsToLoad - An ordered list of mod objects, each containing `modId` and the `manifest` object.
     * @returns {Promise<number>} A promise that resolves with the total number of rules loaded across all specified mods.
     * @async
     */
    async loadAllRules(modsToLoad) {
        this._logger.info(`RuleLoader: Starting rule loading for ${modsToLoad.length} mods.`);
        let totalRulesLoaded = 0;

        // Pre-check schema availability before loop
        // USE HELPER: Get schema ID using the helper
        const ruleSchemaId = this._getContentTypeSchemaId('system-rules');

        if (ruleSchemaId && !this._schemaValidator.isSchemaLoaded(ruleSchemaId)) {
            this._logger.error(`RuleLoader: Cannot proceed. Configured rule schema '${ruleSchemaId}' is not loaded. Ensure schemas are loaded first.`);
            // Consider throwing here if rules absolutely require validation to load
            return 0;
        } else if (!ruleSchemaId) {
            // Warning logged by helper
            this._logger.warn(`RuleLoader: No rule schema ID configured ('system-rules'). Rules will be loaded without schema validation.`);
        }

        // Load rules sequentially per mod
        for (const {modId, manifest} of modsToLoad) {
            this._logger.debug(`RuleLoader: Loading rules for mod: ${modId}`);
            try {
                // Await loading for the current mod
                // --- UPDATED: Use the generic loadItemsForMod ---
                const count = await this.loadItemsForMod(modId, manifest, 'rules', 'system-rules', 'system-rules');
                // const count = await this.loadRulesForMod(modId, manifest); // OLD CALL REMOVED
                totalRulesLoaded += count;
            } catch (error) {
                // Log errors during a specific mod's rule loading but continue with others
                this._logger.error(`RuleLoader: Unexpected error during rule loading for mod '${modId}'. Load sequence may be incomplete for this mod. Error: ${error.message}`, {
                    error, // Include full error object context
                    modId
                });
                // Decide if a single mod failure should halt everything or just be skipped
                // Current implementation continues to next mod.
            }
        }

        this._logger.info(`RuleLoader: Finished loading rules for all mods. Total rules registered: ${totalRulesLoaded}.`);
        return totalRulesLoaded;
    }

    // --- METHOD REMOVED: loadAll (Optional) ---
    /*
     * Removed the loadAll method as per REFACTOR-LOADER-2 (Optional AC).
     * This method was incompatible with the per-mod loading model.
     */
    // async loadAll() {
    //     this._logger.warn("RuleLoader.loadAll() is deprecated and likely non-functional in the new mod-based system. Use loadAllRules(modsToLoad) which requires the list of mods.");
    //     // Return 0 as it cannot load anything without mod context.
    //     return Promise.resolve(0);
    // }
}

export default RuleLoader;