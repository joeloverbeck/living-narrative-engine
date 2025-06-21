// src/loaders/phases/manifestphase.js

import LoaderPhase from './loaderphase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';
import { logPhaseStart } from '../../utils/logPhaseStart.js';

/**
 * @description Phase responsible for handling manifest loading, dependency checks, version validation and final mod-order resolution.
 */
export default class ManifestPhase extends LoaderPhase {
  /**
   * @description Creates a new ManifestPhase instance.
   * @param {object} params - Configuration parameters
   * @param {import('../../loaders/modManifestProcessor.js').default} params.processor - Service for processing mod manifests
   * @param {import('../../interfaces/coreServices.js').ILogger} params.logger - Logger service
   */
  constructor({ processor, logger }) {
    super();
    this.processor = processor;
    this.logger = logger;
  }

  /**
   * @description Executes the manifest processing phase.
   * @param {import('../loadContext.js').LoadContext} ctx - The load context
   * @returns {Promise<void>}
   * @throws {ModsLoaderPhaseError} When manifest processing fails
   */
  async execute(ctx) {
    logPhaseStart(this.logger, 'ManifestPhase');
    try {
      const res = await this.processor.processManifests(
        ctx.requestedMods,
        ctx.worldName
      );
      ctx.finalModOrder = res.finalOrder;
      ctx.incompatibilities = res.incompatibilityCount;
    } catch (e) {
      throw new ModsLoaderPhaseError(
        ModsLoaderErrorCode.MANIFEST,
        e.message,
        'ManifestPhase',
        e
      );
    }
  }
}