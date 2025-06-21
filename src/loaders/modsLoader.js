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
import ModsLoaderError from '../errors/modsLoaderError.js';
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
    const depsToValidate = [
      {
        dependency: cache,
        name: 'ILoadCache',
        methods: ['clear', 'snapshot', 'restore'],
      },
      {
        dependency: session,
        name: 'IModsLoadSession',
        methods: ['run'],
      },
      {
        dependency: registry,
        name: 'IDataRegistry',
        methods: ['store', 'get', 'clear'],
      },
    ];
    super(logger, depsToValidate);
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
    const { createLoadContext } = await import('./LoadContext.js');
    const context = createLoadContext({ worldName, requestedMods: requestedModIds, registry: this._registry });
    this._cache.clear();
    try {
      this._logger.debug('ModsLoader: Data registry cleared.');
      await this._session.run(context);
      this._logger.info(
        `ModsLoader: Load sequence for world '${worldName}' completed successfully.`
      );
      
      return /** @type {import('../interfaces/loadContracts.js').LoadReport} */ ({
        finalModOrder: context.finalModOrder.slice(),
        totals: Object.freeze({ ...context.totals }),
        incompatibilities: context.incompatibilities,
      });
    } catch (err) {
      if (err instanceof ModsLoaderPhaseError) {
        this._logger.error(
          `ModsLoader: CRITICAL failure during phase '${err.phase}'. Code: [${err.code}]. Error: ${err.message}`,
          { error: err.cause ?? err }
        );
        throw err;
      }
      const msg = `ModsLoader: CRITICAL load failure due to an unexpected error. Original error: ${err.message}`;
      this._logger.error(msg, err);
      throw new ModsLoaderError(msg, 'unknown_loader_error', err);
    }
  }
}

export default ModsLoader;
