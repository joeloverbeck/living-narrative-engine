// src/loaders/phases/contentPhase.js

import LoaderPhase from './LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';
import { logPhaseStart } from '../../utils/logPhaseStart.js';

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
      await this.manager.loadContent(
        ctx.finalModOrder,
        ctx.manifests,
        ctx.totals
      );

      // Create a new object reference for totals to ensure immutability downstream.
      const totalsSnapshot = this.#cloneTotals(ctx.totals);

      // Create new frozen context with modifications
      const next = {
        ...ctx,
        totals: totalsSnapshot,
      };

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

  /**
   * Clones the totals object using structuredClone if available (Node ≥17),
   * otherwise falls back to JSON.parse(JSON.stringify(...)).
   * 
   * @private
   * @param {import('../LoadContext.js').TotalResultsSummary} totals - The totals object to clone.
   * @returns {import('../LoadContext.js').TotalResultsSummary} A deep clone of the totals object.
   */
  #cloneTotals(totals) {
    if (typeof structuredClone !== 'undefined') {
      return structuredClone(totals);
    } else {
      return JSON.parse(JSON.stringify(totals));
    }
  }
}
