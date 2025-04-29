// src/core/services/ruleLoader.js

// Import BaseManifestItemLoader
import {BaseManifestItemLoader} from './baseManifestItemLoader.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest
 */

/**
 * Loads, validates, and registers SystemRule definitions from mods.
 * This class extends {@link BaseManifestItemLoader} and relies on the mod manifest
 * for discovering rule files (`content.rules`). It performs primary validation via the
 * base class and implements the rule-specific ID generation and storage logic in
 * the `_processFetchedItem` method.
 * @extends BaseManifestItemLoader
 */
class RuleLoader extends BaseManifestItemLoader {
    /**
     * @private
     * @type {object | null | undefined} - Cached 'path' module. undefined means not yet attempted, null means failed to load.
     */
    #pathModule = undefined;

    /**
     * Constructs a RuleLoader instance.
     * Calls the parent constructor, specifying the content type 'rules' and passing dependencies.
     *
     * @param {IConfiguration} config - Configuration service instance.
     * @param {IPathResolver} pathResolver - Path resolution service instance.
     * @param {IDataFetcher} fetcher - Data fetching service instance.
     * @param {ISchemaValidator} validator - Schema validation service instance.
     * @param {IDataRegistry} registry - Data registry service instance.
     * @param {ILogger} logger - Logging service instance.
     */
    constructor(config, pathResolver, fetcher, validator, registry, logger) {
        // AC: Call super() passing 'rules' as the first argument, followed by dependencies.
        super('rules', config, pathResolver, fetcher, validator, registry, logger);

        // Log initialization (Base class constructor handles logging)
        // this._logger.debug(`RuleLoader: Initialized.`); // Optional: Add specific RuleLoader init log if needed after super()
        // Don't import 'path' here yet.
    }

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
     * Processes a single fetched system rule file's data *after* primary schema validation.
     * This method is called by the base class's `_processFileWrapper`. It performs:
     * 1.  **Rule ID Determination:** Extracts the rule ID from the `rule_id` field within the `data`. If not present, it derives a base ID from the `filename`. The resulting ID is the **un-prefixed** `baseRuleId`.
     * 2.  **Storage:** Delegates storage to the base class helper `_storeItemInRegistry` using the category 'rules', the `modId`, the **un-prefixed** `baseRuleId`, the original `data`, and the `filename`. The helper constructs the prefixed key (`modId:baseRuleId`) for storage.
     * 3.  **Return Value:** Returns the **fully qualified, prefixed** rule ID (`modId:baseRuleId`) as required by the base class.
     *
     * @override
     * @protected
     * @async
     * @param {string} modId - The ID of the mod the rule file belongs to (e.g., "BaseGame", "MyMod").
     * @param {string} filename - The original filename as listed in the mod manifest (e.g., "my_rule.rule.json").
     * @param {string} resolvedPath - The fully resolved path used to fetch the file data.
     * @param {any} data - The raw, parsed data object fetched from the rule file (already passed primary schema validation).
     * @param {string} typeName - The content type name ('rules').
     * @returns {Promise<string>} A promise resolving with the **fully qualified, prefixed** rule ID (e.g., "MyMod:my_rule") upon successful processing.
     * @throws {Error} Throws an error if storing the rule in the registry fails (errors from `_storeItemInRegistry` are re-thrown).
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        // Note: Primary validation is now handled by _processFileWrapper calling _validatePrimarySchema *before* this method.
        this._logger.debug(`RuleLoader [${modId}]: Processing validated rule item: ${filename} from path ${resolvedPath} (Type: ${typeName})`);

        // AC: Removed the manual code block for retrieving schema ID and performing validation.
        // --- Schema Validation (Conditional) --- block removed ---


        // --- Rule ID Determination ---
        // AC: All existing rule-specific logic within _processFetchedItem (determining baseRuleId from data.rule_id or filename fallback using #getPathModule...) remains functional.
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
            // Attempt to remove common rule suffixes if present in the filename part
            const ruleSuffixes = ['.rule', '.rule.json', '.rule.yml', '.rule.yaml']; // Extend as needed
            for (const suffix of ruleSuffixes) {
                if (namePart.endsWith(suffix)) {
                    namePart = namePart.substring(0, namePart.length - suffix.length);
                    break; // Stop after removing the first matching suffix
                }
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
        // AC: (...calling _storeItemInRegistry...) remains functional.
        this._logger.debug(`RuleLoader [${modId}]: Delegating storage for rule (base ID: '${baseRuleId}') from ${filename} to base helper.`);
        try {
            // Pass the UN-PREFIXED baseRuleId to the helper.
            this._storeItemInRegistry('rules', modId, baseRuleId, data, filename);
            // Logging of success/overwrite/failure is handled within _storeItemInRegistry.
        } catch (storageError) {
            // Error logging is handled within the base helper. Re-throw to allow _processFileWrapper to catch it.
            throw storageError;
        }
        // --- End Storage ---


        // --- Return Value ---
        // Return the fully qualified, prefixed ID as required by the base class contract.
        // AC: (...returning the final ID) remains functional.
        const fullyQualifiedId = `${modId}:${baseRuleId}`; // Construct the prefixed ID for return
        this._logger.debug(`RuleLoader [${modId}]: Successfully processed rule from ${filename}. Returning fully qualified ID: ${fullyQualifiedId}`);
        return fullyQualifiedId;
        // --- End Return Value ---
    }


    /**
     * Loads all rules for a list of mods based on their manifests and load order.
     * This method iterates through the provided mod list, calling the base class's
     * `loadItemsForMod` for each mod sequentially. It aggregates the count of loaded rules.
     *
     * @param {Array<{modId: string, manifest: ModManifest}>} modsToLoad - An ordered list of mod objects, each containing `modId` and the `manifest` object.
     * @returns {Promise<number>} A promise that resolves with the total number of rules loaded across all specified mods.
     * @async
     */
    async loadAllRules(modsToLoad) {
        this._logger.info(`RuleLoader: Starting rule loading for ${modsToLoad.length} mods.`);
        let totalRulesLoaded = 0;

        // Pre-check schema availability before loop (Handled by BaseManifestItemLoader constructor and _validatePrimarySchema)
        // No need for explicit pre-check here as base class logic will handle it during processing.
        // If _primarySchemaId is set but schema not loaded, _validatePrimarySchema will throw.
        // If _primarySchemaId is null, validation will be skipped.

        // Load rules sequentially per mod
        for (const {modId, manifest} of modsToLoad) {
            this._logger.debug(`RuleLoader: Loading rules for mod: ${modId}`);
            try {
                // Await loading for the current mod using the generic base class method
                const count = await this.loadItemsForMod(
                    modId,
                    manifest,
                    'rules',    // contentKey in manifest (e.g., manifest.content.rules)
                    'rules',    // contentTypeDir (e.g., <mod>/rules/)
                    'rules'     // typeName for logging
                );
                totalRulesLoaded += count;
            } catch (error) {
                // Log errors during a specific mod's rule loading but continue with others
                // Note: _loadItemsInternal within loadItemsForMod catches and logs individual file errors,
                // this catch block here handles potential errors *within* loadItemsForMod itself (e.g., invalid args, though unlikely now).
                this._logger.error(`RuleLoader: Unexpected error during rule loading orchestration for mod '${modId}'. Processing might have stopped. Error: ${error.message}`, {
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

    // Method Removed: loadAll (Deprecated)
}

export default RuleLoader;