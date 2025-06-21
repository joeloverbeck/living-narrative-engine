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
     * @description Creates a new ContentPhase instance.
     * @param {object} params - Configuration parameters.
     * @param {ContentLoadManager} params.manager - The content load manager responsible for orchestrating content loaders.
     * @param {ILogger} params.logger - The logger service.
     */
    constructor({ manager, logger }) {
        super();
        /** @type {ContentLoadManager} */
        this.manager = manager;
        /** @type {ILogger} */
        this.logger = logger;
    }

    /**
     * @description Executes the content loading phase.
     * @param {LoadContext} ctx - The load context.
     * @returns {Promise<void>}
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
            // Per acceptance criteria, create a new object reference for totals to ensure immutability downstream.
            ctx.totals = JSON.parse(JSON.stringify(ctx.totals)); // snapshot
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