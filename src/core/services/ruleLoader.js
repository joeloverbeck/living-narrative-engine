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

    /**
     * @private
     * @type {string | null} - Cached schema ID for system rules.
     */
    #ruleSchemaId = null;

    /**
     * @private
     * @type {object | null | undefined} - Cached 'path' module. undefined means not yet attempted, null means failed to load.
     */
    #pathModule = undefined;

    /**
     * Constructs a RuleLoader instance.
     * Calls the parent constructor to store dependencies and caches the schema ID
     * for system rules using the configuration service provided to the base class.
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

        // Retain logic to fetch and cache rule schema ID using protected members
        this.#ruleSchemaId = this._config.getContentTypeSchemaId('system-rules');
        if (!this.#ruleSchemaId) {
            this._logger.warn(`RuleLoader: System rule schema ID is not configured ('system-rules'). Rule validation will be skipped.`);
        } else {
            this._logger.debug(`RuleLoader: Initialized with rule schema ID: ${this.#ruleSchemaId}`);
        }
        // Don't import 'path' here yet.
    }

    /**
     * Loads system rules defined in a specific mod's manifest.
     * // ... (rest of the method JSDoc and implementation remains the same)
     */
    async loadRulesForMod(modId, manifest) {
        if (!modId || typeof modId !== 'string' || modId.trim() === '') {
            this._logger.error(`RuleLoader: Invalid modId provided to loadRulesForMod. ModId: ${modId}`);
            throw new Error('Invalid modId provided to RuleLoader.loadRulesForMod.');
        }
        if (!manifest || typeof manifest !== 'object') {
            this._logger.error(`RuleLoader [${modId}]: Invalid manifest provided to loadRulesForMod.`);
            throw new Error(`Invalid manifest provided for mod '${modId}' to RuleLoader.loadRulesForMod.`);
        }

        this._logger.info(`RuleLoader [${modId}]: Delegating rule loading to BaseManifestItemLoader using manifest key 'rules' and content directory 'system-rules'.`);
        // Pass 'rules' as the typeName
        return this._loadItemsInternal(modId, manifest, 'rules', 'system-rules', 'rules');
    }

    /**
     * @private
     * Attempts to dynamically load the 'path' module and caches it.
     * @returns {Promise<object | null>} The loaded path module or null if unavailable/failed.
     */
    async #getPathModule() {
        if (this.#pathModule === undefined) { // Only attempt loading once
            try {
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
     * @override
     * @protected
     * Processes a single fetched system rule file's data.
     * This method is called by the base class's `_processFileWrapper`. It performs:
     * 1.  **Schema Validation:** Validates the fetched `data` against the configured system rule schema (if available and loaded).
     * 2.  **Rule ID Determination:** Extracts the rule ID from the `rule_id` field within the `data`. If not present or invalid, it derives a base ID from the `filename` (removing the extension), attempting to use the 'path' module if available. The final rule ID is prefixed with the `modId` (e.g., "MyMod:my_rule_name").
     * 3.  **Storage:** Stores the validated rule `data` in the data registry under the 'system-rules' category, using the `finalRuleId` as the key. It logs a warning if an existing rule with the same ID is being overwritten.
     *
     * @param {string} modId - The ID of the mod the rule file belongs to (e.g., "BaseGame", "MyMod").
     * @param {string} filename - The original filename as listed in the mod manifest (e.g., "my_rule.rule.json").
     * @param {string} resolvedPath - The fully resolved path used to fetch the file data (e.g., "./data/mods/MyMod/system-rules/my_rule.rule.json").
     * @param {any} data - The raw, parsed data object fetched from the rule file. Expected to conform to the system rule schema.
     * @param {string} typeName - The content type name ('rules'). <<< NEW PARAMETER (ignored by this implementation)
     * @returns {Promise<string>} A promise resolving with the `finalRuleId` (e.g., "MyMod:my_rule") upon successful processing, validation, and storage.
     * @throws {Error} Throws an error if schema validation fails (when applicable) or if storing the rule in the registry fails. The error will be logged by the base class wrapper.
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) { // <<< ADDED typeName
        // typeName is available but not used by this specific loader as per ticket instructions
        this._logger.debug(`RuleLoader [${modId}]: Processing fetched rule item: ${filename} from path ${resolvedPath} (Type: ${typeName})`);

        // --- Schema Validation (Conditional) ---
        const schemaId = this.#ruleSchemaId;
        let ruleValidatorFn = null;

        if (schemaId && this._schemaValidator.isSchemaLoaded(schemaId)) {
            ruleValidatorFn = this._schemaValidator.getValidator(schemaId);
            if (!ruleValidatorFn) {
                this._logger.error(`RuleLoader [${modId}]: Could not retrieve validator function for rule schema '${schemaId}' for file ${filename}. Validation will be skipped.`);
            }
        } else if (schemaId) {
            this._logger.warn(`RuleLoader [${modId}]: Rule schema '${schemaId}' is configured but not loaded. Skipping validation for ${filename}.`);
        } else {
            this._logger.warn(`RuleLoader [${modId}]: No rule schema ID configured. Skipping validation for ${filename}.`);
        }

        if (ruleValidatorFn) {
            this._logger.debug(`RuleLoader [${modId}]: Performing schema validation for ${filename} using schema '${schemaId}'...`);
            const validationResult = ruleValidatorFn(data);
            if (!validationResult.isValid) {
                const errorDetails = JSON.stringify(validationResult.errors, null, 2);
                this._logger.error(`RuleLoader [${modId}]: Schema validation failed for rule file '${filename}' at ${resolvedPath}. Errors:\n${errorDetails}`);
                throw new Error(`Schema validation failed for ${filename} in mod ${modId}.`);
            }
            this._logger.debug(`RuleLoader [${modId}]: Schema validation passed for ${filename}.`);
        }
        // --- End Schema Validation ---


        // --- Rule ID Determination ---
        const ruleIdInData = data?.rule_id;
        let baseRuleId;

        if (typeof ruleIdInData === 'string' && ruleIdInData.trim()) {
            baseRuleId = ruleIdInData.trim();
            this._logger.debug(`RuleLoader [${modId}]: Using rule_id '${baseRuleId}' from data in ${filename}.`);
            if (baseRuleId.startsWith(`${modId}:`)) {
                this._logger.warn(`RuleLoader [${modId}]: rule_id '${baseRuleId}' in ${filename} already contains mod prefix. Stripping prefix.`);
                baseRuleId = baseRuleId.substring(modId.length + 1);
            }

        } else {
            // --- MODIFIED: Load 'path' module here ---
            const pathModule = await this.#getPathModule(); // Await the helper method
            // --- End Modification ---

            // Fallback to filename without extension
            let namePart;
            if (pathModule) { // Check if loading succeeded
                namePart = pathModule.parse(filename).name;
            } else {
                // Fallback parsing logic (remains the same)
                const baseFilename = filename.includes('/') ? filename.substring(filename.lastIndexOf('/') + 1) : filename;
                namePart = baseFilename.includes('.') ? baseFilename.substring(0, baseFilename.lastIndexOf('.')) : baseFilename;
            }
            baseRuleId = namePart;
            this._logger.debug(`RuleLoader [${modId}]: No valid rule_id found in data for ${filename}. Using filename base '${baseRuleId}' as rule ID.`);
        }

        // Construct final ID with mod prefix
        const finalRuleId = `${modId}:${baseRuleId}`;
        this._logger.debug(`RuleLoader [${modId}]: Determined finalRuleId for ${filename} as '${finalRuleId}'.`);
        // --- End Rule ID Determination ---


        // --- Storage ---
        if (this._dataRegistry.get('system-rules', finalRuleId)) {
            this._logger.warn(`RuleLoader [${modId}]: Overwriting existing rule with ID '${finalRuleId}' from file '${filename}'.`);
        }

        try {
            this._dataRegistry.store('system-rules', finalRuleId, data);
            this._logger.debug(`RuleLoader [${modId}]: Successfully stored rule '${finalRuleId}' from file '${filename}'.`);
        } catch (storageError) {
            this._logger.error(`RuleLoader [${modId}]: Failed to store rule '${finalRuleId}' from file '${filename}'. Error: ${storageError.message}`, storageError);
            throw storageError; // Re-throw
        }
        // --- End Storage ---


        // --- Return Value ---
        return finalRuleId; // Return the ID on success
    }

    // =======================================================
    // --- End Sub-Ticket 3.3 Implementation --- // (Comment adjusted for context)
    // =======================================================


    /**
     * Loads all rules for a list of mods based on their manifests and load order.
     * // ... (rest of the method JSDoc and implementation remains the same)
     */
    async loadAllRules(modsToLoad) {
        this._logger.info(`RuleLoader: Starting rule loading for ${modsToLoad.length} mods.`);
        let totalRulesLoaded = 0;

        if (this.#ruleSchemaId && !this._schemaValidator.isSchemaLoaded(this.#ruleSchemaId)) {
            this._logger.error(`RuleLoader: Cannot proceed. Configured rule schema '${this.#ruleSchemaId}' is not loaded. Ensure schemas are loaded first.`);
            return 0;
        } else if (!this.#ruleSchemaId) {
            this._logger.warn(`RuleLoader: No rule schema ID configured ('system-rules'). Rules will be loaded without schema validation.`);
        }

        for (const {modId, manifest} of modsToLoad) {
            this._logger.debug(`RuleLoader: Loading rules for mod: ${modId}`);
            try {
                const count = await this.loadRulesForMod(modId, manifest);
                totalRulesLoaded += count;
            } catch (error) {
                this._logger.error(`RuleLoader: Unexpected error during rule loading for mod '${modId}'. Load sequence may be incomplete. Error: ${error.message}`, {
                    error,
                    modId
                });
            }
        }

        this._logger.info(`RuleLoader: Finished loading rules for all mods. Total rules registered: ${totalRulesLoaded}.`);
        return totalRulesLoaded;
    }

    /**
     * DEPRECATED: Placeholder method for compatibility during refactoring.
     * // ... (rest of the method JSDoc and implementation remains the same)
     */
    async loadAll() {
        this._logger.warn("RuleLoader.loadAll() is deprecated and likely non-functional in the new mod-based system. Use loadAllRules(modsToLoad) which requires the list of mods.");
        return Promise.resolve(0);
    }
}

export default RuleLoader;