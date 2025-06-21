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
  /** @type {IDataRegistry} */
  _registry;
  /** @type {LoaderPhase[]} */
  _phases;
  /** @type {import('../interfaces/loadContracts.js').ILoadCache} */
  _cache;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IDataRegistry} dependencies.registry
   * @param {LoaderPhase[]} dependencies.phases - The ordered sequence of loading phases to execute.
   * @param {import('../interfaces/loadContracts.js').ILoadCache} dependencies.cache
   */
  constructor({ logger, registry, phases, cache }) {
    const depsToValidate = [
      {
        dependency: registry,
        name: 'IDataRegistry',
        methods: ['store', 'get', 'clear'],
      },
      {
        dependency: phases,
        name: 'PhasesArray',
        isArray: true,
        methods: ['forEach', 'map'], // Check it's array-like and not empty
        isNotEmpty: true,
      },
      {
        dependency: cache,
        name: 'ILoadCache',
        methods: ['clear', 'snapshot', 'restore'],
      },
    ];

    super(logger, depsToValidate);

    this._logger = logger;
    this._registry = registry;
    this._phases = phases;
    this._cache = cache;

    this._logger.debug(
      'ModsLoader: Instance created with phase-based architecture.'
    );
  }

  /**
   * Load everything for a world by executing the configured phases.
   *
   * @param {string} worldName - The name of the world to load.
   * @param {string[]} requestedModIds - An array of mod IDs to load.
   * @returns {Promise<void>}
   */
  async loadMods(worldName, requestedModIds = []) {
    this._logger.debug(
      `ModsLoader: Starting load sequence for world '${worldName}'...`
    );

    const context = createLoadContext({ worldName, requestedMods: requestedModIds, registry: this._registry });

    this._cache.clear();
    try {
      this._logger.debug('ModsLoader: Data registry cleared.');
      for (const phase of this._phases) {
        const phaseName = phase.name;
        this._logger.debug(`Executing phase: ${phaseName}`);
        await phase.execute(context);
        this._logger.debug(`Phase ${phaseName} completed.`);
      }
      this._logger.info(
        `ModsLoader: Load sequence for world '${worldName}' completed successfully.`
      );
    } catch (err) {
      if (err instanceof ModsLoaderPhaseError) {
        this._logger.error(
          `ModsLoader: CRITICAL failure during phase '${err.phase}'. Code: [${err.code}]. Error: ${err.message}`,
          { error: err.cause ?? err }
        );
        return Promise.reject(err);
      }
      const msg = `ModsLoader: CRITICAL load failure due to an unexpected error. Original error: ${err.message}`;
      this._logger.error(msg, err);
      return Promise.reject(
        new ModsLoaderError(msg, 'unknown_loader_error', err)
      );
    }
  }
}

export default ModsLoader;
