// src/loaders/phases/worldPhase.js

import { createLoadContext } from '../LoadContext.js';
import LoaderPhase from './LoaderPhase.js';
import {
    ModsLoaderPhaseError,
    ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';
import { logPhaseStart } from '../../utils/logPhaseStart.js';

/**
 * @typedef {import('../LoadContext.js').LoadContext} LoadContext
 * @typedef {import('../worldLoader.js').default} WorldLoader
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../data/schemas/mod-manifest.schema.json').ModManifest} ModManifest
 */

/**
 * @description Phase responsible for running the WorldLoader to process and instantiate world data from mods.
 * @class WorldPhase
 * @augments {LoaderPhase}
 * @module Loaders/Phases
 */
export default class WorldPhase extends LoaderPhase {
    /**
     * @param {object} params
     * @param {import('../worldLoader.js').default} params.worldLoader
     * @param {import('../../interfaces/coreServices.js').ILogger} params.logger
     */
    constructor({ worldLoader, logger }) {
        super('world');
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
    }

    /**
     * @description Executes the world loading phase.
     * @param {LoadContext} ctx - The load context.
     * @returns {Promise<LoadContext>}
     * @throws {ModsLoaderPhaseError} When world loading fails.
     * @async
     */
    async execute(ctx) {
        logPhaseStart(this.logger, 'WorldPhase');
        try {
            await this.worldLoader.loadWorlds(
                ctx.finalModOrder,
                ctx.manifests,
                ctx.totals
            );
            return ctx;
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