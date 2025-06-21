// src/loaders/phases/worldPhase.js

import LoaderPhase from './LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';

/**
 * @typedef {import('../LoadContext.js').LoadContext} LoadContext
 * @typedef {import('../worldLoader.js').default} WorldLoader
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest
 */

/**
 * @description Phase responsible for running the WorldLoader to process and instantiate world data from mods.
 * @class WorldPhase
 * @extends {LoaderPhase}
 * @module Loaders/Phases
 */
export default class WorldPhase extends LoaderPhase {
  /**
   * @description Creates a new WorldPhase instance.
   * @param {object} params - Configuration parameters.
   * @param {WorldLoader} params.worldLoader - The loader responsible for processing world files.
   * @param {ILogger} params.logger - The logger service.
   * @param {Map<string, ModManifest>} params.manifests - A map of all loaded and validated mod manifests.
   */
  constructor({ worldLoader, logger, manifests }) {
    super();
    /**
     * @type {WorldLoader}
     * @private
     */
    this.worldLoader = worldLoader;
    /**
     * @type {ILogger}
     * @private
     */
    this.logger = logger;
    /**
     * @type {Map<string, ModManifest>}
     * @private
     */
    this.manifests = manifests;
  }

  /**
   * @description Executes the world loading phase.
   * @param {LoadContext} ctx - The load context.
   * @returns {Promise<void>}
   * @throws {ModsLoaderPhaseError} When world loading fails.
   * @async
   */
  async execute(ctx) {
    this.logger.info('— WorldPhase starting —');
    try {
      await this.worldLoader.loadWorlds(
        ctx.finalModOrder,
        this.manifests,
        ctx.totals
      );
    } catch (e) {
      throw new ModsLoaderPhaseError(
        ModsLoaderErrorCode.WORLD,
        e.message,
        'WorldPhase',
        e
      );
    }
  }
}
