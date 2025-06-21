export { default } from './contentPhase.js';
// src/loaders/phases/contentPhase.js

import LoaderPhase from './loaderphase.js';
import {
    ModsLoaderPhaseError,
    ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';
import { logPhaseStart } from '../../utils/logPhaseStart.js';

/**
 * @typedef {import('../loadContext.js').LoadContext} LoadContext
 * @typedef {import('../contentLoadManager.js').default} ContentLoadManager
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest
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
     * @param {Map<string, ModManifest>} params.manifests - A map of all loaded and validated mod manifests.
     */
    constructor({ manager, logger, manifests }) {
        super();
        /** @type {ContentLoadManager} */
        this.manager = manager;
        /** @type {ILogger} */
        this.logger = logger;
        /** @type {Map<string, ModManifest>} */
        this.manifests = manifests;
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
                this.manifests,
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