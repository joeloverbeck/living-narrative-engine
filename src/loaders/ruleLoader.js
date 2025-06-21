// src/loaders/ruleLoader.js

// Import BaseManifestItemLoader
import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { expandMacros, validateMacroExpansion } from '../utils/macroUtils.js';
import { deriveBaseRuleIdFromFilename } from '../utils/ruleIdUtils.js';

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
 *
 * @augments BaseManifestItemLoader
 */
class RuleLoader extends BaseManifestItemLoader {
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
   * Processes a single fetched system rule file's data *after* primary schema validation.
   * This method is called by the base class's `_processFileWrapper`. It performs:
   * 1.  **Rule ID Determination:** Extracts the rule ID from `data.rule_id` or derives it from the filename. This is the **un-prefixed** `baseRuleId`.
   * 2.  **Storage:** Delegates storage to `_storeItemInRegistry` using the `baseRuleId`.
   * 3.  **Return Value:** Returns an object containing the **fully qualified, prefixed** rule ID (`modId:baseRuleId`) and whether an overwrite occurred during storage.
   *
   * @override
   * @protected
   * @async
   * @param {string} modId - The ID of the mod the rule file belongs to.
   * @param {string} filename - The original filename from the manifest.
   * @param {string} resolvedPath - The fully resolved path used to fetch the file data.
   * @param {any} data - The raw, parsed data object from the rule file (already primary-validated).
   * @param {string} registryKey - The content type name ('rules').
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} An object containing the final registry key and overwrite status.
   * @throws {Error} If storing the rule fails.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    // <<< MODIFIED Return Type in JSDoc
    this._logger.debug(
      `RuleLoader [${modId}]: Processing validated rule item: ${filename} from path ${resolvedPath} (Type: ${registryKey})`
    );

    // Primary validation happens in BaseManifestItemLoader._processFileWrapper

    // --- Rule ID Determination ---
    const ruleIdInData = data?.rule_id;
    let baseRuleId;

    if (typeof ruleIdInData === 'string' && ruleIdInData.trim()) {
      baseRuleId = ruleIdInData.trim();
      this._logger.debug(
        `RuleLoader [${modId}]: Using rule_id '${baseRuleId}' from data in ${filename}.`
      );
      if (baseRuleId.startsWith(`${modId}:`)) {
        this._logger.warn(
          `RuleLoader [${modId}]: rule_id '${baseRuleId}' in ${filename} already prefixed. Stripping prefix.`
        );
        baseRuleId = baseRuleId.substring(modId.length + 1);
      }
    } else {
      // Fallback to filename using utility helper
      baseRuleId = deriveBaseRuleIdFromFilename(filename);
      this._logger.debug(
        `RuleLoader [${modId}]: No valid 'rule_id' found. Derived baseRuleId '${baseRuleId}' from filename.`
      );
    }

    this._logger.debug(
      `RuleLoader [${modId}]: Determined baseRuleId for ${filename} as '${baseRuleId}'.`
    );
    // --- End Rule ID Determination ---

    // --- Macro Expansion ---
    if (Array.isArray(data.actions)) {
      this._logger.debug(
        `RuleLoader [${modId}]: Expanding macros in rule actions for ${filename}.`
      );

      data.actions = expandMacros(
        data.actions,
        this._dataRegistry,
        this._logger
      );

      // Validate that all macros were properly expanded
      if (
        !validateMacroExpansion(data.actions, this._dataRegistry, this._logger)
      ) {
        this._logger.warn(
          `RuleLoader [${modId}]: Some macros may not have been fully expanded in ${filename}.`
        );
      } else {
        this._logger.debug(
          `RuleLoader [${modId}]: All macros successfully expanded in ${filename}.`
        );
      }
    }

    // --- Storage ---
    this._logger.debug(
      `RuleLoader [${modId}]: Delegating storage for rule (base ID: '${baseRuleId}') from ${filename} to base helper.`
    );

    const { qualifiedId, didOverride } = this._storeItemInRegistry(
      'rules',
      modId,
      baseRuleId,
      data,
      filename
    );

    // --- End Storage ---

    // --- Return Value ---
    const finalRegistryKey = qualifiedId ?? `${modId}:${baseRuleId}`;
    this._logger.debug(
      `RuleLoader [${modId}]: Successfully processed rule from ${filename}. Returning final registry key: ${finalRegistryKey}, Overwrite: ${didOverride}`
    );
    return { qualifiedId: finalRegistryKey, didOverride };
  }

  /**
   * Loads all rules for a list of mods based on their manifests and load order.
   * This method iterates through the provided mod list, calling the base class's
   * `loadItemsForMod` for each mod sequentially. It aggregates the count of loaded rules.
   * NOTE: This method returns only the total count, not the detailed LoadItemsResult object,
   * as its original purpose seemed to be just summing counts. The detailed results per mod
   * are handled by ModsLoader using the updated loadItemsForMod return value.
   *
   * @param {Array<{modId: string, manifest: ModManifest}>} modsToLoad - An ordered list of mod objects.
   * @returns {Promise<number>} A promise resolving with the total number of rules loaded.
   * @async
   * @deprecated This aggregation logic is likely better handled by the caller (ModsLoader) using the detailed results from loadItemsForMod.
   */
  async loadAllRules(modsToLoad) {
    this._logger.warn(
      `RuleLoader: loadAllRules is potentially deprecated. Aggregation should use results from loadItemsForMod.`
    );
    this._logger.debug(
      `RuleLoader: Starting rule loading for ${modsToLoad.length} mods.`
    );
    let totalRulesLoaded = 0;

    for (const { modId, manifest } of modsToLoad) {
      this._logger.debug(`RuleLoader: Loading rules for mod: ${modId}`);
      try {
        // loadItemsForMod now returns { count, overrides, errors }
        const result = await this.loadItemsForMod(
          modId,
          manifest,
          'rules',
          'rules',
          'rules'
        );
        totalRulesLoaded += result.count; // Sum only the count for compatibility with old return type
      } catch (error) {
        this._logger.error(
          `RuleLoader: Unexpected error during rule loading orchestration for mod '${modId}'. Error: ${error.message}`,
          { error, modId }
        );
        // Continue to next mod
      }
    }

    this._logger.debug(
      `RuleLoader: Finished loading rules for all mods. Total rules count: ${totalRulesLoaded}.`
    );
    return totalRulesLoaded; // Return only the count as per original method signature
  }
}

export default RuleLoader;
