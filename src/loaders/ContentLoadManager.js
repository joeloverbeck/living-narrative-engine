// src/loaders/ContentLoadManager.js

/**
 * @file Implements ContentLoadManager, coordinating per-mod content loading
 * using configured content loaders.
 */

import LoadResultAggregator from './LoadResultAggregator.js';

/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../data/schemas/mod-manifest.schema.json').ModManifest} ModManifest */
/** @typedef {import('./defaultLoaderConfig.js').LoaderConfigEntry} LoaderConfigEntry */

/**
 * @description Manages loading of content for mods using various content loaders.
 * @class
 */
export class ContentLoadManager {
  #logger;
  #validatedEventDispatcher;
  #contentLoadersConfig;

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {ValidatedEventDispatcher} deps.validatedEventDispatcher - Event dispatcher.
   * @param {Array<LoaderConfigEntry>} deps.contentLoadersConfig - Loader configuration.
   */
  constructor({ logger, validatedEventDispatcher, contentLoadersConfig }) {
    this.#logger = logger;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#contentLoadersConfig = contentLoadersConfig;
  }

  /**
   * Loads content for all mods in two phases: definitions, then instances.
   *
   * @param {string[]} finalModOrder - Resolved load order of mods.
   * @param {Map<string, ModManifest>} manifests - Map of manifests keyed by ID.
   * @param {TotalResultsSummary} totalCounts - Object to accumulate totals across mods.
   * @returns {Promise<Record<string, 'success' | 'skipped' | 'failed'>>} Map of modIds to overall load status.
   */
  async loadContent(finalModOrder, manifests, totalCounts) {
    this.#logger.debug(
      'ModsLoader: Beginning content loading in two phases: definitions, then instances.'
    );

    // Phase 1: Definitions
    const definitionResults = await this.loadContentForPhase(
      finalModOrder,
      manifests,
      totalCounts,
      'definitions'
    );

    // Phase 2: Instances
    const instanceResults = await this.loadContentForPhase(
      finalModOrder,
      manifests,
      totalCounts,
      'instances'
    );

    // Combine results: if a mod failed in either phase, it's marked as failed.
    // Skipped in one phase but success in another could be success, or based on specific logic.
    // For simplicity, let's say success requires success in phases it participated in.
    // A mod might not have content for all phases.
    const combinedResults = {};
    for (const modId of finalModOrder) {
      const defStatus = definitionResults[modId] || 'skipped'; // if not present, assume skipped for that phase
      const instStatus = instanceResults[modId] || 'skipped';

      if (defStatus === 'failed' || instStatus === 'failed') {
        combinedResults[modId] = 'failed';
      } else if (defStatus === 'success' || instStatus === 'success') {
        // If it succeeded in at least one phase it had content for, and didn't fail in another
        combinedResults[modId] = 'success';
      } else {
        combinedResults[modId] = 'skipped'; // Skipped in all relevant phases
      }
    }
    this.#logger.debug('ModsLoader: Completed both content loading phases.');
    return combinedResults;
  }

  /**
   * Loads content for all mods for a specific phase.
   *
   * @param {string[]} finalModOrder - Resolved load order of mods.
   * @param {Map<string, ModManifest>} manifests - Map of manifests keyed by ID.
   * @param {TotalResultsSummary} totalCounts - Object to accumulate totals across mods.
   * @param {'definitions' | 'instances'} phase - The loading phase.
   * @returns {Promise<Record<string, 'success' | 'skipped' | 'failed'>>} Map of modIds to load status for this phase.
   */
  async loadContentForPhase(finalModOrder, manifests, totalCounts, phase) {
    this.#logger.debug(
      `ModsLoader: Beginning content loading for phase: ${phase}...`
    );

    /** @type {Record<string, 'success' | 'skipped' | 'failed'>} */
    const results = {};
    const phaseLoaders = this.#contentLoadersConfig.filter(
      (loaderCfg) => loaderCfg.phase === phase
    );

    if (phaseLoaders.length === 0) {
      this.#logger.debug(
        `ModsLoader: No loaders configured for phase: ${phase}. Skipping.`
      );
      // Fill results with 'skipped' for all mods if no loaders for this phase
      for (const modId of finalModOrder) {
        results[modId] = 'skipped';
      }
      return results;
    }

    for (const modId of finalModOrder) {
      const manifest = /** @type {ModManifest | null} */ (
        manifests.get(modId.toLowerCase())
      );
      this.#logger.debug(`ContentLoadManager: Looking up manifest for modId '${modId}' (lowercase: '${modId.toLowerCase()}'), found: ${!!manifest}`);
      this.#logger.debug(`ContentLoadManager: Processing mod ${modId}, manifest found: ${!!manifest}`);
      // Pass the filtered phaseLoaders to processMod
      try {
        results[modId] = await this.processMod(
          modId,
          manifest,
          totalCounts,
          phaseLoaders,
          phase
        );
      } catch (error) {
        this.#logger.error(
          `ContentLoadManager: Error during processMod for ${modId}, phase ${phase}. Marking as failed and continuing with other mods in this phase.`,
          { modId, phase, error: error?.message },
          error
        );
        results[modId] = 'failed'; // Record it as failed for this phase
        // DO NOT re-throw; continue processing other mods in this phase.
      }
    }

    this.#logger.debug(
      `ModsLoader: Completed content loading loop for phase: ${phase}.`
    );
    return results;
  }

  /**
   * Processes content for a single mod using specified loaders for a given phase.
   *
   * @private
   * @param {string} modId - Mod identifier.
   * @param {ModManifest|null} manifest - Manifest for the mod.
   * @param {TotalResultsSummary} totalCounts - Aggregated totals object.
   * @param {Array<LoaderConfigEntry>} phaseLoaders - Loaders applicable for the current phase.
   * @param {'definitions' | 'instances'} phase - The current loading phase.
   * @returns {Promise<'success' | 'skipped' | 'failed'>} Status of the load process for this mod in this phase.
   */
  async processMod(modId, manifest, totalCounts, phaseLoaders, phase) {
    this.#logger.debug(
      `--- Loading content for mod: ${modId}, phase: ${phase} ---`
    );
    const aggregator = new LoadResultAggregator(totalCounts);
    let modDurationMs = 0;
    /** @type {'success' | 'skipped' | 'failed'} */
    let status = 'success'; // Assume success unless a loader fails or mod is skipped

    let hasContentInPhase = false;

    try {
      if (!manifest) {
        const reason = `Manifest not found in registry for mod ID '${modId}'. Skipping content load for phase ${phase}.`;
        this.#logger.error(`ModsLoader: ${reason}`);
        await this.#validatedEventDispatcher
          .dispatch(
            'initialization:world_loader:mod_load_failed',
            { modId, reason },
            { allowSchemaNotFound: true }
          )
          .catch((dispatchError) =>
            this.#logger.error(
              `Failed dispatching mod_load_failed event for ${modId}: ${dispatchError.message}`,
              dispatchError
            )
          );
        return 'skipped'; // Return 'skipped' as status for this mod in this phase
      }

      this.#logger.debug(
        `ModsLoader [${modId}, ${phase}]: Manifest retrieved successfully. Processing content types...`
      );
      const modStartTime = performance.now();

      for (const config of phaseLoaders) {
        // Iterate over phase-specific loaders
        const { loader, contentKey, diskFolder, registryKey } = config;
        const manifestContent = manifest.content || {};
        // Support dot notation for nested content keys (e.g., 'entities.definitions')
        const getNested = (obj, path) => path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
        const hasContentForLoader =
          Array.isArray(getNested(manifestContent, contentKey)) &&
          getNested(manifestContent, contentKey).length > 0;

        if (hasContentForLoader) {
          hasContentInPhase = true;
          this.#logger.debug(
            `ModsLoader [${modId}, ${phase}]: Processing ${contentKey} content with ${getNested(manifestContent, contentKey).length} files...`
          );
          this.#logger.debug(
            `ModsLoader [${modId}, ${phase}]: Found content for '${contentKey}'. Invoking loader '${loader.constructor.name}'.`
          );
          try {
            const result = /** @type {LoadItemsResult} */ (
              await loader.loadItemsForMod(
                modId,
                manifest,
                contentKey,
                diskFolder,
                registryKey
              )
            );
            if (result && typeof result.count === 'number') {
              aggregator.aggregate(result, registryKey);
            } else {
              this.#logger.warn(
                `ModsLoader [${modId}, ${phase}]: Loader for '${registryKey}' returned an unexpected result format. Assuming 0 counts.`,
                { result }
              );
              aggregator.aggregate(null, registryKey); // Ensure registryKey is recorded even with 0 counts.
            }
          } catch (error) {
            const errorMessage = error?.message || String(error);
            this.#logger.error(
              `ModsLoader [${modId}, ${phase}]: Error loading content type '${registryKey}'. Continuing...`,
              { modId, registryKey, phase, error: errorMessage },
              error
            );
            aggregator.recordFailure(registryKey);
            await this.#validatedEventDispatcher
              .dispatch(
                'initialization:world_loader:content_load_failed',
                { modId, registryKey, error: errorMessage, phase },
                { allowSchemaNotFound: true }
              )
              .catch((e) =>
                this.#logger.error(
                  `Failed dispatching content_load_failed event for ${modId}/${registryKey}/${phase}`,
                  e
                )
              );
            status = 'failed'; // Mark mod as failed for this phase
          }
        } else {
          this.#logger.debug(
            `ModsLoader [${modId}, ${phase}]: Skipping content type '${registryKey}' (key: '${contentKey}') as it's not defined or empty in the manifest.`
          );
        }
      }

      const modEndTime = performance.now();
      modDurationMs = modEndTime - modStartTime;
      this.#logger.debug(
        `ModsLoader [${modId}, ${phase}]: Content loading loop took ${modDurationMs.toFixed(2)} ms.`
      );
    } catch (error) {
      this.#logger.error(
        `ModsLoader [${modId}, ${phase}]: Unexpected error during processing for mod '${modId}' in phase '${phase}'. Skipping remaining content for this mod in this phase.`,
        { modId, phase, error: error?.message },
        error
      );
      await this.#validatedEventDispatcher
        .dispatch(
          'initialization:world_loader:mod_load_failed',
          {
            modId,
            reason: `Unexpected error in phase ${phase}: ${error?.message}`,
          },
          { allowSchemaNotFound: true }
        )
        .catch((dispatchError) =>
          this.#logger.error(
            `Failed dispatching mod_load_failed event for ${modId} after unexpected error in phase ${phase}: ${dispatchError.message}`,
            dispatchError
          )
        );
      return Promise.reject(error);
    }

    if (!hasContentInPhase && status !== 'failed') {
      // If the mod had no content for this phase and no errors occurred, it's considered 'skipped' for this phase.
      // This prevents a mod with only definitions from being marked as 'success' after the instance phase where it has no content.
      status = 'skipped';
    }

    const totalModOverrides = Object.values(aggregator.modResults).reduce(
      (sum, res) => sum + (res.overrides || 0),
      0
    );
    const totalModErrors = Object.values(aggregator.modResults).reduce(
      (sum, res) => sum + (res.errors || 0),
      0
    );
    const typeCountsString = Object.entries(aggregator.modResults)
      .filter(([, result]) => result.count > 0 || result.errors > 0) // Show if errors, even if count is 0
      .map(
        ([t, result]) =>
          `${t}(${result.count}${result.errors > 0 ? ` E:${result.errors}` : ''})`
      )
      .sort()
      .join(', ');

    const summaryMessage = `Mod '${modId}' phase '${phase}' loaded in ${modDurationMs.toFixed(2)}ms: ${
      typeCountsString.length > 0
        ? typeCountsString
        : 'No items processed in this phase'
    }${typeCountsString.length > 0 ? ' ' : ''}-> Overrides(${totalModOverrides}), Errors(${totalModErrors})`;

    this.#logger.debug(summaryMessage);
    this.#logger.debug(
      `--- Finished loading content for mod: ${modId}, phase: ${phase} ---`
    );
    return status;
  }
}

export default ContentLoadManager;
