// src/loaders/ContentLoadManager.js

/**
 * @file Implements ContentLoadManager, coordinating per-mod content loading
 * using configured content loaders.
 */

import ModProcessor from './ModProcessor.js';
import { deepClone } from '../utils/cloneUtils.js';
import { ContentLoadStatus } from './types.js';

/** @typedef {import('./LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */
/** @typedef {import('./LoadResultAggregator.js').default} LoadResultAggregator */
/** @typedef {import('./types.js').LoadPhaseResult} LoadPhaseResult */

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
  #contentLoadersConfig;
  #modProcessor;

  /**
   * Creates a new ContentLoadManager.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {ValidatedEventDispatcher} deps.validatedEventDispatcher - Event dispatcher.
   * @param {Array<LoaderConfigEntry>} deps.contentLoadersConfig - Loader configuration.
   * @param {(counts: TotalResultsSummary) => LoadResultAggregator} deps.aggregatorFactory -
   *   Factory for creating {@link LoadResultAggregator} instances.
   * @param {() => number} [deps.timer] -
   *   Optional function returning a high resolution timestamp.
   */
  constructor({
    logger,
    validatedEventDispatcher,
    contentLoadersConfig,
    aggregatorFactory,
    timer = () => performance.now(),
  }) {
    if (typeof aggregatorFactory !== 'function') {
      throw new Error('aggregatorFactory must be provided');
    }
    this.#logger = logger;
    this.#contentLoadersConfig = contentLoadersConfig;
    this.#modProcessor = new ModProcessor({
      logger,
      validatedEventDispatcher,
      aggregatorFactory,
      timer,
    });
  }

  /**
   * Loads content for all mods in two phases: definitions, then instances.
   *
   * @param {string[]} finalModOrder - Resolved load order of mods.
   * @param {Map<string, ModManifest>} manifests - Map of manifests keyed by ID.
   * @param {TotalResultsSummary} totalCounts - Totals from previous operations. This object is not mutated.
   * @returns {Promise<LoadPhaseResult>} Map of modIds to overall load status and
   *   the updated totals object.
   */
  async loadContent(finalModOrder, manifests, totalCounts) {
    this.#logger.debug(
      'ModsLoader: Beginning content loading in two phases: definitions, then instances.'
    );

    let runningTotals = deepClone(totalCounts);

    // Phase 1: Definitions
    const { results: definitionResults, updatedTotals: afterDefs } =
      await this.loadContentForPhase(
        finalModOrder,
        manifests,
        runningTotals,
        'definitions'
      );
    runningTotals = afterDefs;

    // Phase 2: Instances
    const { results: instanceResults, updatedTotals: afterInst } =
      await this.loadContentForPhase(
        finalModOrder,
        manifests,
        runningTotals,
        'instances'
      );
    runningTotals = afterInst;

    // Combine results: if a mod failed in either phase, it's marked as failed.
    // Skipped in one phase but success in another could be success, or based on specific logic.
    // For simplicity, let's say success requires success in phases it participated in.
    // A mod might not have content for all phases.
    const combinedResults = {};
    for (const modId of finalModOrder) {
      const defStatus = definitionResults[modId] || ContentLoadStatus.SKIPPED; // if not present, assume skipped for that phase
      const instStatus = instanceResults[modId] || ContentLoadStatus.SKIPPED;

      if (
        defStatus === ContentLoadStatus.FAILED ||
        instStatus === ContentLoadStatus.FAILED
      ) {
        combinedResults[modId] = ContentLoadStatus.FAILED;
      } else if (
        defStatus === ContentLoadStatus.SUCCESS ||
        instStatus === ContentLoadStatus.SUCCESS
      ) {
        // If it succeeded in at least one phase it had content for, and didn't fail in another
        combinedResults[modId] = ContentLoadStatus.SUCCESS;
      } else {
        combinedResults[modId] = ContentLoadStatus.SKIPPED; // Skipped in all relevant phases
      }
    }
    this.#logger.debug('ModsLoader: Completed both content loading phases.');
    return { results: combinedResults, updatedTotals: runningTotals };
  }

  /**
   * Loads content for all mods for a specific phase.
   *
   * @param {string[]} finalModOrder - Resolved load order of mods.
   * @param {Map<string, ModManifest>} manifests - Map of manifests keyed by ID.
   * @param {TotalResultsSummary} totalCounts - Totals from previous operations. This object is not mutated.
   * @param {'definitions' | 'instances'} phase - The loading phase.
   * @returns {Promise<LoadPhaseResult>} Map of modIds to load status for this
   *   phase and the updated totals object.
   */
  async loadContentForPhase(finalModOrder, manifests, totalCounts, phase) {
    this.#logger.debug(
      `ModsLoader: Beginning content loading for phase: ${phase}...`
    );

    /** @type {Record<string, ContentLoadStatus>} */
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
        results[modId] = ContentLoadStatus.SKIPPED;
      }
      return { results, updatedTotals: totalCounts };
    }

    for (const modId of finalModOrder) {
      const manifest = /** @type {ModManifest | null} */ (
        manifests.get(modId.toLowerCase())
      );
      this.#logger.debug(
        `ContentLoadManager: Looking up manifest for modId '${modId}' (lowercase: '${modId.toLowerCase()}'), found: ${!!manifest}`
      );
      this.#logger.debug(
        `ContentLoadManager: Processing mod ${modId}, manifest found: ${!!manifest}`
      );
      // Pass the filtered phaseLoaders to processMod
      try {
        const result = await this.processMod(
          modId,
          manifest,
          totalCounts,
          phaseLoaders,
          phase
        );
        results[modId] = result.status;

        // Merge the updated totals back into the main totals object
        totalCounts = this.#mergeTotals(totalCounts, result.updatedTotals);
      } catch (error) {
        this.#logger.error(
          `ContentLoadManager: Error during processMod for ${modId}, phase ${phase}. Marking as failed and continuing with other mods in this phase.`,
          { modId, phase, error: error?.message },
          error
        );
        results[modId] = ContentLoadStatus.FAILED; // Record it as failed for this phase
        // DO NOT re-throw; continue processing other mods in this phase.
      }
    }

    this.#logger.debug(
      `ModsLoader: Completed content loading loop for phase: ${phase}.`
    );
    return { results, updatedTotals: totalCounts };
  }

  /**
   * Merges updated totals from an aggregator back into the main totals object.
   *
   * @private
   * @param {TotalResultsSummary} mainTotals - The existing totals object.
   * @param {TotalResultsSummary} updatedTotals - Totals returned from a processor.
   * @returns {TotalResultsSummary} New totals object combining the two inputs.
   */
  #mergeTotals(mainTotals, updatedTotals) {
    const merged = { ...mainTotals };
    for (const [registryKey, counts] of Object.entries(updatedTotals)) {
      merged[registryKey] = {
        count: counts.count ?? 0,
        overrides: counts.overrides ?? 0,
        errors: counts.errors ?? 0,
      };
    }
    return merged;
  }

  async processMod(modId, manifest, totalCounts, phaseLoaders, phase) {
    if (!manifest) {
      return this.#modProcessor.processMod(
        modId,
        null,
        totalCounts,
        phaseLoaders,
        phase
      );
    }
    return this.#executeModProcessing(
      modId,
      manifest,
      totalCounts,
      phaseLoaders,
      phase
    );
  }

  #executeModProcessing(modId, manifest, totalCounts, phaseLoaders, phase) {
    return this.#modProcessor.processMod(
      modId,
      manifest,
      totalCounts,
      phaseLoaders,
      phase
    );
  }
}

export default ContentLoadManager;
