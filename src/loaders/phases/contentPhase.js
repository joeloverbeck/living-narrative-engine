// src/loaders/phases/contentPhase.js

import LoaderPhase from './LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';
import { logPhaseStart } from '../../utils/logPhaseStart.js';
import { cloneTotals } from '../../utils/cloneTotals.js';

/**
 * @typedef {import('../LoadContext.js').LoadContext} LoadContext
 * @typedef {import('../ContentLoadManager.js').default} ContentLoadManager
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../data/schemas/mod-manifest.schema.json').ModManifest} ModManifest
 */

/**
 * @description Phase responsible for delegating the loading of all mod content (components, actions, entities, etc.)
 * to the ContentLoadManager.
 * @class ContentPhase
 * @augments {LoaderPhase}
 */
export default class ContentPhase extends LoaderPhase {
  /**
   * @param {object} params
   * @param {import('../ContentLoadManager.js').default} params.manager
   * @param {import('../../interfaces/coreServices.js').ILogger} params.logger
   */
  constructor({ manager, logger }) {
    super('content');
    /** @type {ContentLoadManager} */
    this.manager = manager;
    /** @type {ILogger} */
    this.logger = logger;
  }

  /**
   * @description Executes the content loading phase.
   * @param {LoadContext} ctx - The load context.
   * @returns {Promise<LoadContext>}
   * @throws {ModsLoaderPhaseError} When content loading fails for any reason.
   */
  async execute(ctx) {
    logPhaseStart(this.logger, 'ContentPhase');
    try {
      // Clone totals up-front so mutations do not affect the previous context
      const nextTotals = cloneTotals(ctx.totals);
      const next = { ...ctx, totals: nextTotals };

      await this.manager.loadContent(
        next.finalModOrder,
        next.manifests,
        next.totals
      );

      return Object.freeze(next);
    } catch (e) {
      throw new ModsLoaderPhaseError(
        ModsLoaderErrorCode.CONTENT,
        e.message,
        'ContentPhase',
        e
      );
    }
  }
}
