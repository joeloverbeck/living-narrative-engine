/**
 * @file Contains ModProcessor which handles manifest validation and loader execution for a single mod.
 */

import LoadResultAggregator from './LoadResultAggregator.js';
import { resolvePath } from '../utils/objectUtils.js';

/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../data/schemas/mod-manifest.schema.json').ModManifest} ModManifest */
/** @typedef {import('./defaultLoaderConfig.js').LoaderConfigEntry} LoaderConfigEntry */
/** @typedef {import('./LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */

/**
 * @description Processes all loaders for a single mod within a phase.
 * @class
 */
export class ModProcessor {
  #logger;
  #validatedEventDispatcher;
  #aggregatorFactory;
  #timer;

  /**
   * @param {object} deps - Dependencies.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {ValidatedEventDispatcher} deps.validatedEventDispatcher - Event dispatcher.
   * @param {(counts: TotalResultsSummary) => LoadResultAggregator} [deps.aggregatorFactory] - Aggregator factory.
   * @param {() => number} [deps.timer] - Timer function for duration measurement.
   */
  constructor({
    logger,
    validatedEventDispatcher,
    aggregatorFactory = (counts) => new LoadResultAggregator(counts),
    timer = () => performance.now(),
  }) {
    this.#logger = logger;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#aggregatorFactory = aggregatorFactory;
    this.#timer = timer;
  }

  /**
   * Processes loaders for a single mod.
   *
   * @param {string} modId - Mod identifier.
   * @param {ModManifest|null} manifest - Manifest for the mod.
   * @param {TotalResultsSummary} totalCounts - Totals object to update.
   * @param {Array<LoaderConfigEntry>} phaseLoaders - Loaders configured for this phase.
   * @param {'definitions' | 'instances'} phase - Current phase.
   * @returns {Promise<{status:'success'|'skipped'|'failed',updatedTotals:TotalResultsSummary}>}
   *   Processing result and updated totals.
   */
  async processMod(modId, manifest, totalCounts, phaseLoaders, phase) {
    this.#logger.debug(
      `--- Loading content for mod: ${modId}, phase: ${phase} ---`
    );
    const aggregator = this.#aggregatorFactory(totalCounts);
    let modDurationMs = 0;
    /** @type {'success' | 'skipped' | 'failed'} */
    let status = 'success';
    let hasContentInPhase = false;

    try {
      const manifestCheck = await this.#validateManifest(
        modId,
        manifest,
        phase,
        aggregator
      );
      if (manifestCheck.shouldSkip) {
        return manifestCheck.result;
      }

      this.#logger.debug(
        `ModsLoader [${modId}, ${phase}]: Manifest retrieved successfully. Processing content types...`
      );
      const start = this.#timer();

      const { hasContent, status: loaderStatus } = await this.#runLoadersForMod(
        modId,
        /** @type {ModManifest} */ (manifest),
        phaseLoaders,
        phase,
        aggregator
      );

      hasContentInPhase = hasContent;
      status = loaderStatus;

      const end = this.#timer();
      modDurationMs = end - start;
      this.#logger.debug(
        `ModsLoader [${modId}, ${phase}]: Content loading loop took ${modDurationMs.toFixed(2)} ms.`
      );
    } catch (error) {
      this.#logger.error(
        `ModsLoader [${modId}, ${phase}]: Unexpected error during processing for mod '${modId}' in phase '${phase}'. Skipping remaining content for this mod in this phase.`,
        { modId, phase, error: error?.message },
        error
      );
      await this.#recordModFailure(
        modId,
        `Unexpected error in phase ${phase}: ${error?.message}`,
        phase
      );
      return Promise.reject(error);
    }

    if (!hasContentInPhase && status !== 'failed') {
      status = 'skipped';
    }

    const summaryMessage = this.#buildSummaryMessage(
      modId,
      phase,
      modDurationMs,
      aggregator
    );
    this.#logger.debug(summaryMessage);
    this.#logger.debug(
      `--- Finished loading content for mod: ${modId}, phase: ${phase} ---`
    );
    return { status, updatedTotals: aggregator.getTotalCounts() };
  }

  async #validateManifest(modId, manifest, phase, aggregator) {
    if (!manifest) {
      const reason = `Manifest not found in registry for mod ID '${modId}'. Skipping content load for phase ${phase}.`;
      this.#logger.error(`ModsLoader: ${reason}`);
      await this.#recordModFailure(modId, reason);
      return {
        shouldSkip: true,
        result: {
          status: 'skipped',
          updatedTotals: aggregator.getTotalCounts(),
        },
      };
    }
    return { shouldSkip: false };
  }

  async #runLoadersForMod(modId, manifest, phaseLoaders, phase, aggregator) {
    let status = 'success';
    let hasContentInPhase = false;
    for (const config of phaseLoaders) {
      const { loader, contentKey, diskFolder, registryKey } = config;
      const manifestContent = manifest.content || {};
      const contentList = resolvePath(manifestContent, contentKey);
      const hasContentForLoader =
        Array.isArray(contentList) && contentList.length > 0;

      if (hasContentForLoader) {
        hasContentInPhase = true;
        this.#logger.debug(
          `ModsLoader [${modId}, ${phase}]: Processing ${contentKey} content with ${contentList.length} files...`
        );
        this.#logger.debug(
          `ModsLoader [${modId}, ${phase}]: Found content for '${contentKey}'. Invoking loader '${loader.constructor.name}'.`
        );
        try {
          const result =
            /** @type {import('./baseManifestItemLoader.js').LoadItemsResult} */ (
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
            if (Array.isArray(result.failures) && result.failures.length > 0) {
              for (const { file, error } of result.failures) {
                const msg = error?.message || String(error);
                this.#logger.error(
                  `ModsLoader [${modId}, ${phase}]: ${registryKey} file '${file}' failed: ${msg}`,
                  { modId, registryKey, phase, file, error: msg },
                  error
                );
              }
            }
          } else {
            this.#logger.warn(
              `ModsLoader [${modId}, ${phase}]: Loader for '${registryKey}' returned an unexpected result format. Assuming 0 counts.`,
              { result }
            );
            aggregator.aggregate(null, registryKey);
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
          status = 'failed';
        }
      } else {
        this.#logger.debug(
          `ModsLoader [${modId}, ${phase}]: Skipping content type '${registryKey}' (key: '${contentKey}') as it's not defined or empty in the manifest.`
        );
      }
    }
    return { hasContent: hasContentInPhase, status };
  }

  async #recordModFailure(modId, reason, phase) {
    await this.#validatedEventDispatcher
      .dispatch(
        'initialization:world_loader:mod_load_failed',
        { modId, reason },
        { allowSchemaNotFound: true }
      )
      .catch((dispatchError) =>
        this.#logger.error(
          `Failed dispatching mod_load_failed event for ${modId}${phase ? ` after unexpected error in phase ${phase}` : ''}: ${dispatchError.message}`,
          dispatchError
        )
      );
  }

  #buildSummaryMessage(modId, phase, durationMs, aggregator) {
    const totalModOverrides = Object.values(aggregator.modResults).reduce(
      (sum, res) => sum + (res.overrides || 0),
      0
    );
    const totalModErrors = Object.values(aggregator.modResults).reduce(
      (sum, res) => sum + (res.errors || 0),
      0
    );
    const typeCountsString = Object.entries(aggregator.modResults)
      .filter(([, result]) => result.count > 0 || result.errors > 0)
      .map(
        ([t, result]) =>
          `${t}(${result.count}${result.errors > 0 ? ` E:${result.errors}` : ''})`
      )
      .sort()
      .join(', ');
    return `Mod '${modId}' phase '${phase}' loaded in ${durationMs.toFixed(2)}ms: ${
      typeCountsString.length > 0
        ? typeCountsString
        : 'No items processed in this phase'
    }${typeCountsString.length > 0 ? ' ' : ''}-> Overrides(${totalModOverrides}), Errors(${totalModErrors})`;
  }
}

export default ModProcessor;
