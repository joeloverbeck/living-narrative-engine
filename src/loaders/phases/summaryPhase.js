// src/loaders/phases/summaryPhase.js

import LoaderPhase from './loaderphase.js';
import {
    ModsLoaderPhaseError,
    ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';
import { logPhaseStart } from '../../utils/logPhaseStart.js';

/**
 * @typedef {import('../loadContext.js').LoadContext} LoadContext
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/coreServices.js').ISummaryLogger} ISummaryLogger
 */

/**
 * @description The final phase of the mod loading process, responsible for logging a summary of the entire operation.
 * @class SummaryPhase
 * @augments {LoaderPhase}
 * @module Loaders/Phases
 */
export default class SummaryPhase extends LoaderPhase {
    /**
     * @description Creates a new SummaryPhase instance.
     * @param {object} params - Configuration parameters.
     * @param {ISummaryLogger} params.summaryLogger - The service responsible for formatting and logging the summary output.
     * @param {ILogger} params.logger - The general logger service.
     */
    constructor({ summaryLogger, logger }) {
        super();

        /**
         * @type {ISummaryLogger}
         * @private
         */
        this.summaryLogger = summaryLogger;

        /**
         * @type {ILogger}
         * @private
         */
        this.logger = logger;
    }

    /**
     * @description Executes the summary logging phase.
     * @param {LoadContext} ctx - The load context containing all the data from previous phases.
     * @returns {Promise<void>}
     * @throws {ModsLoaderPhaseError} Throws a phase-specific error if the summary logging fails.
     * @async
     */
    async execute(ctx) {
        logPhaseStart(this.logger, 'SummaryPhase');
        try {
            this.summaryLogger.logSummary(
                this.logger,
                ctx.worldName,
                ctx.requestedMods,
                ctx.finalModOrder,
                ctx.incompatibilities,
                ctx.totals
            );
        } catch (e) {
            throw new ModsLoaderPhaseError(
                ModsLoaderErrorCode.SUMMARY,
                e.message,
                'SummaryPhase',
                e
            );
        }
    }
}