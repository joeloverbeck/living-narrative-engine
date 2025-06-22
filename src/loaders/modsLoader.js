/**
 * @file World-famous ModsLoader — orchestrates loading of all mods and their
 * content by executing a sequence of well-defined phases.
 */

/* ── Type-only imports ──────────────────────────────────────────────────── */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../loaders/phases/LoaderPhase.js').default} LoaderPhase */
/** @typedef {import('./LoadContext.js').LoadContext} LoadContext */

/* ── Implementation imports ─────────────────────────────────────────────── */
import { ModsLoaderPhaseError } from '../errors/modsLoaderPhaseError.js';
import AbstractLoader from './abstractLoader.js';
import { createLoadContext } from './LoadContext.js';

/* ───────────────────────────────────────────────────────────────────────── */

/**
 * Orchestrates the entire mod-loading process by executing a series of phases.
 * Each phase is responsible for a specific part of the loading process,
 * such as loading schemas, processing manifests, loading content, etc.
 *
 * @class ModsLoader
 * @augments {AbstractLoader}
 */
class ModsLoader extends AbstractLoader {
  /** @type {ILogger} */
  _logger;
  /** @type {import('../interfaces/loadContracts.js').ILoadCache} */
  _cache;
  /** @type {object} */
  _session;
  /** @type {import('../interfaces/coreServices.js').IDataRegistry} */
  _registry;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {import('../interfaces/loadContracts.js').ILoadCache} dependencies.cache
   * @param {object} dependencies.session - Must have a run(ctx) method
   * @param {import('../interfaces/coreServices.js').IDataRegistry} dependencies.registry
   */
  constructor({ logger, cache, session, registry }) {
    // This validation logic was passed to a non-existent implementation.
    // The most important check, for the session object, can be done directly.
    // The rest of the validation is removed for clarity, as it wasn't functional.
    super(logger); // Simplified super call

    if (!session || typeof session.run !== 'function') {
      throw new Error(
        'A valid session object with a run() method must be provided.'
      );
    }

    this._logger = logger;
    this._cache = cache;
    this._session = session;
    this._registry = registry;
    this._logger.debug(
      'ModsLoader: Instance created with session-based architecture.'
    );
  }

  /**
   * Load everything for a world by executing the configured phases via the session.
   *
   * @param {string} worldName - The name of the world to load.
   * @param {string[]} requestedModIds - An array of mod IDs to load.
   * @returns {Promise<import('../interfaces/loadContracts.js').LoadReport>} A report containing the final mod order, totals, and incompatibilities.
   */
  async loadMods(worldName, requestedModIds = []) {
    this._logger.debug(
      `ModsLoader: Starting load sequence for world '${worldName}'...`
    );
    const context = createLoadContext({
      worldName,
      requestedMods: requestedModIds,
      registry: this._registry,
    });
    this._cache.clear();
    let success = false;
    try {
      this._logger.debug('ModsLoader: Data registry cleared.');
      const finalContext = await this._session.run(context);
      this._logger.info(
        `ModsLoader: Load sequence for world '${worldName}' completed successfully.`
      );
      success = true;

      return /** @type {import('../interfaces/loadContracts.js').LoadReport} */ ({
        finalModOrder: finalContext.finalModOrder.slice(),
        totals: Object.freeze({ ...finalContext.totals }),
        incompatibilities: finalContext.incompatibilities,
      });
    } catch (err) {
      if (err instanceof ModsLoaderPhaseError) {
        this._logger.error(
          `ModsLoader: CRITICAL failure during phase '${err.phase}'. Code: [${err.code}]. Error: ${err.message}`,
          { error: err.cause ?? err }
        );
        throw err;
      }
      // Re-throw other errors to let upstream handle them
      throw err;
    } finally {
      this._logger.info(
        `ModsLoader: Load sequence for world '${worldName}' ${success ? 'completed successfully' : 'failed'}.`
      );
    }
  }
}

export default ModsLoader;
