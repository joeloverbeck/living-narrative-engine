// src/loaders/ContentLoadManager.js

/**
 * @file Implements ContentLoadManager, coordinating per-mod content loading
 * using configured content loaders.
 */

import LoadResultAggregator from './LoadResultAggregator.js';

/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */

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
   * @param {Array<{loader: *, contentKey: string, contentTypeDir: string, typeName: string}>} deps.contentLoadersConfig - Loader configuration.
   */
  constructor({ logger, validatedEventDispatcher, contentLoadersConfig }) {
    this.#logger = logger;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#contentLoadersConfig = contentLoadersConfig;
  }

  /**
   * Loads content for all mods in the provided order.
   *
   * @param {string[]} finalOrder - Resolved load order of mods.
   * @param {Map<string, ModManifest>} manifests - Map of manifests keyed by ID.
   * @param {TotalResultsSummary} totalCounts - Object to accumulate totals across mods.
   * @returns {Promise<Record<string, 'success' | 'skipped' | 'failed'>>} Map of modIds to load status.
   */
  async loadContent(finalOrder, manifests, totalCounts) {
    this.#logger.debug(
      'ModsLoader: Beginning content loading based on final order...'
    );

    /** @type {Record<string, 'success' | 'skipped' | 'failed'>} */
    const results = {};

    for (const modId of finalOrder) {
      const manifest = /** @type {ModManifest | null} */ (
        manifests.get(modId.toLowerCase())
      );
      results[modId] = await this.processMod(modId, manifest, totalCounts);
    }

    this.#logger.debug(
      'ModsLoader: Completed content loading loop for all mods in final order.'
    );
    return results;
  }

  /**
   * Processes content for a single mod using all configured loaders.
   *
   * @private
   * @param {string} modId - Mod identifier.
   * @param {ModManifest|null} manifest - Manifest for the mod.
   * @param {TotalResultsSummary} totalCounts - Aggregated totals object.
   * @returns {Promise<'success' | 'skipped' | 'failed'>} Status of the load process.
   */
  async processMod(modId, manifest, totalCounts) {
    this.#logger.debug(`--- Loading content for mod: ${modId} ---`);
    const aggregator = new LoadResultAggregator(totalCounts);
    let modDurationMs = 0;
    /** @type {'success' | 'skipped' | 'failed'} */
    let status = 'success';

    try {
      if (!manifest) {
        const reason = `Manifest not found in registry for mod ID '${modId}'. Skipping content load.`;
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
        status = 'skipped';
        return status;
      }

      this.#logger.debug(
        `ModsLoader [${modId}]: Manifest retrieved successfully. Processing content types...`
      );
      const modStartTime = performance.now();

      for (const config of this.#contentLoadersConfig) {
        const { loader, contentKey, contentTypeDir, typeName } = config;
        const hasContent =
          manifest.content &&
          Array.isArray(manifest.content[contentKey]) &&
          manifest.content[contentKey].length > 0;

        if (hasContent) {
          this.#logger.debug(
            `ModsLoader [${modId}]: Found content for '${contentKey}'. Invoking loader '${loader.constructor.name}'.`
          );
          try {
            const result = /** @type {LoadItemsResult} */ (
              await loader.loadItemsForMod(
                modId,
                manifest,
                contentKey,
                contentTypeDir,
                typeName
              )
            );
            if (result && typeof result.count === 'number') {
              aggregator.aggregate(result, typeName);
            } else {
              this.#logger.warn(
                `ModsLoader [${modId}]: Loader for '${typeName}' returned an unexpected result format. Assuming 0 counts.`,
                { result }
              );
              aggregator.aggregate(null, typeName);
            }
          } catch (loadError) {
            const errorMessage = loadError?.message || String(loadError);
            this.#logger.error(
              `ModsLoader [${modId}]: Error loading content type '${typeName}'. Continuing...`,
              { modId, typeName, error: errorMessage },
              loadError
            );
            aggregator.recordFailure(typeName);
            await this.#validatedEventDispatcher
              .dispatch(
                'initialization:world_loader:content_load_failed',
                { modId, typeName, error: errorMessage },
                { allowSchemaNotFound: true }
              )
              .catch((e) =>
                this.#logger.error(
                  `Failed dispatching content_load_failed event for ${modId}/${typeName}`,
                  e
                )
              );
            status = 'failed';
          }
        } else {
          this.#logger.debug(
            `ModsLoader [${modId}]: Skipping content type '${typeName}' (key: '${contentKey}') as it's not defined or empty in the manifest.`
          );
        }
      }

      const modEndTime = performance.now();
      modDurationMs = modEndTime - modStartTime;
      this.#logger.debug(
        `ModsLoader [${modId}]: Content loading loop took ${modDurationMs.toFixed(2)} ms.`
      );
    } catch (error) {
      this.#logger.error(
        `ModsLoader [${modId}]: Unexpected error during processing for mod '${modId}'. Skipping remaining content for this mod.`,
        { modId, error: error?.message },
        error
      );
      await this.#validatedEventDispatcher
        .dispatch(
          'initialization:world_loader:mod_load_failed',
          { modId, reason: `Unexpected error: ${error?.message}` },
          { allowSchemaNotFound: true }
        )
        .catch((dispatchError) =>
          this.#logger.error(
            `Failed dispatching mod_load_failed event for ${modId} after unexpected error: ${dispatchError.message}`,
            dispatchError
          )
        );
      status = 'failed';
      return status;
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
      .filter(([, result]) => result.count > 0)
      .map(([t, result]) => `${t}(${result.count})`)
      .sort()
      .join(', ');
    const summaryMessage = `Mod '${modId}' loaded in ${modDurationMs.toFixed(2)}ms: ${
      typeCountsString.length > 0 ? typeCountsString : 'No items loaded'
    }${typeCountsString.length > 0 ? ' ' : ''}-> Overrides(${totalModOverrides}), Errors(${totalModErrors})`;
    this.#logger.debug(summaryMessage);
    this.#logger.debug(`--- Finished loading content for mod: ${modId} ---`);
    return status;
  }
}

export default ContentLoadManager;
