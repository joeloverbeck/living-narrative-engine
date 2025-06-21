// src/loaders/contentLoadManager.js

/**
 * @file Implements ContentLoadManager, coordinating per-mod content loading
 * using configured content loaders.
 */

import LoadResultAggregator from './LoadResultAggregator.js';

/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */
/** @typedef {import('./defaultLoaderConfig.js').LoaderConfigEntry} LoaderConfigEntry */
/** @typedef {import('./LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */

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
   * @param {string[]} finalOrder - Resolved load order of mods.
   * @param {Map<string, ModManifest>} manifests - Map of manifests keyed by ID.
   * @param {TotalResultsSummary} totalCounts - Object to accumulate totals across mods.
   * @returns {Promise<TotalResultsSummary>} The final, updated totals object.
   */
  async loadContent(finalOrder, manifests, totalCounts) {
    this.#logger.debug(
      'ModsLoader: Beginning content loading in two phases: definitions, then instances.'
    );

    let currentTotals = totalCounts;

    // Phase 1: Definitions
    const defPhaseResult = await this.loadContentForPhase(
      finalOrder,
      manifests,
      currentTotals,
      'definitions'
    );
    currentTotals = defPhaseResult.totals; // Update totals after phase 1

    // Phase 2: Instances
    const instPhaseResult = await this.loadContentForPhase(
      finalOrder,
      manifests,
      currentTotals,
      'instances'
    );
    currentTotals = instPhaseResult.totals; // Update totals after phase 2

    // Combine results for logging/status purposes.
    const definitionResults = defPhaseResult.results;
    const instanceResults = instPhaseResult.results;
    const combinedResults = {};
    for (const modId of finalOrder) {
      const defStatus = definitionResults[modId] || 'skipped';
      const instStatus = instanceResults[modId] || 'skipped';

      if (defStatus === 'failed' || instStatus === 'failed') {
        combinedResults[modId] = 'failed';
      } else if (defStatus === 'success' || instStatus === 'success') {
        combinedResults[modId] = 'success';
      } else {
        combinedResults[modId] = 'skipped';
      }
    }

    this.#logger.debug('ModsLoader: Completed both content loading phases.');
    return currentTotals;
  }

  /**
   * Loads content for all mods for a specific phase.
   *
   * @param {string[]} finalOrder - Resolved load order of mods.
   * @param {Map<string, ModManifest>} manifests - Map of manifests keyed by ID.
   * @param {TotalResultsSummary} totalCounts - Object to accumulate totals across mods.
   * @param {'definitions' | 'instances'} phase - The loading phase.
   * @returns {Promise<{results: Record<string, 'success' | 'skipped' | 'failed'>, totals: TotalResultsSummary}>} An object containing the phase status results and the updated totals.
   */
  async loadContentForPhase(finalOrder, manifests, totalCounts, phase) {
    this.#logger.debug(
      `ModsLoader: Beginning content loading for phase: ${phase}...`
    );
    let currentTotals = totalCounts;

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
      for (const modId of finalOrder) {
        results[modId] = 'skipped';
      }
      return { results, totals: currentTotals };
    }

    for (const modId of finalOrder) {
      const manifest = /** @type {ModManifest | null} */ (
        manifests.get(modId.toLowerCase())
      );
      // Pass the filtered phaseLoaders to processMod
      try {
        const processResult = await this.processMod(
          modId,
          manifest,
          currentTotals, // Pass current totals
          phaseLoaders,
          phase
        );
        results[modId] = processResult.status;
        currentTotals = processResult.totals; // Capture new totals
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
    return { results, totals: currentTotals };
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
   * @returns {Promise<{status: 'success' | 'skipped' | 'failed', totals: TotalResultsSummary}>} Status and updated totals.
   */
  async processMod(modId, manifest, totalCounts, phaseLoaders, phase) {
    this.#logger.debug(
      `--- Loading content for mod: ${modId}, phase: ${phase} ---`
    );
    let currentTotals = totalCounts;
    // This aggregator is only for creating the per-mod summary log message.
    const summaryAggregator = new LoadResultAggregator({});
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
        return { status: 'skipped', totals: currentTotals }; // Return 'skipped' as status for this mod in this phase
      }

      this.#logger.debug(
        `ModsLoader [${modId}, ${phase}]: Manifest retrieved successfully. Processing content types...`
      );
      const modStartTime = performance.now();

      for (const config of phaseLoaders) {
        // Iterate over phase-specific loaders
        const { loader, contentKey, diskFolder, registryKey } = config;
        const manifestContent = manifest.content || {};
        const hasContentForLoader =
          Array.isArray(manifestContent[contentKey]) &&
          manifestContent[contentKey].length > 0;

        if (hasContentForLoader) {
          hasContentInPhase = true; // Mark that this mod has content for the current phase
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
            const updateAggregator = new LoadResultAggregator(currentTotals);
            if (result && typeof result.count === 'number') {
              currentTotals = updateAggregator.aggregate(result, registryKey);
              summaryAggregator.aggregate(result, registryKey);
            } else {
              this.#logger.warn(
                `ModsLoader [${modId}, ${phase}]: Loader for '${registryKey}' returned an unexpected result format. Assuming 0 counts.`,
                { result }
              );
              currentTotals = updateAggregator.aggregate(null, registryKey);
              summaryAggregator.aggregate(null, registryKey);
            }
          } catch (error) {
            const errorMessage = error?.message || String(error);
            this.#logger.error(
              `ModsLoader [${modId}, ${phase}]: Error loading content type '${registryKey}'. Continuing...`,
              { modId, registryKey, phase, error: errorMessage },
              error
            );
            const updateAggregator = new LoadResultAggregator(currentTotals);
            currentTotals = updateAggregator.recordFailure(registryKey);
            summaryAggregator.recordFailure(registryKey);
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
        `ModsLoader [${modId}, ${phase}]: Content loading loop took ${modDurationMs.toFixed(
          2
        )} ms.`
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
      throw error;
    }

    if (!hasContentInPhase && status !== 'failed') {
      status = 'skipped';
    }

    const totalModOverrides = Object.values(summaryAggregator.modResults).reduce(
      (sum, res) => sum + (res.overrides || 0),
      0
    );
    const totalModErrors = Object.values(summaryAggregator.modResults).reduce(
      (sum, res) => sum + (res.errors || 0),
      0
    );
    const typeCountsString = Object.entries(summaryAggregator.modResults)
      .filter(([, result]) => result.count > 0 || result.errors > 0) // Show if errors, even if count is 0
      .map(
        ([t, result]) =>
          `${t}(${result.count}${result.errors > 0 ? ` E:${result.errors}` : ''})`
      )
      .sort()
      .join(', ');

    const summaryMessage = `Mod '${modId}' phase '${phase}' loaded in ${modDurationMs.toFixed(
      2
    )}ms: ${typeCountsString.length > 0
        ? typeCountsString
        : 'No items processed in this phase'
      }${typeCountsString.length > 0 ? ' ' : ''
      }-> Overrides(${totalModOverrides}), Errors(${totalModErrors})`;

    this.#logger.debug(summaryMessage);
    this.#logger.debug(
      `--- Finished loading content for mod: ${modId}, phase: ${phase} ---`
    );
    return { status, totals: currentTotals };
  }
}

export default ContentLoadManager;