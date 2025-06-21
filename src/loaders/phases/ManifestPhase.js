import LoaderPhase from './LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';

/**
 * @description Phase responsible for handling manifest loading, dependency checks, version validation and final mod-order resolution.
 */
export default class ManifestPhase extends LoaderPhase {
  name = 'ManifestPhase';

  /**
   * @description Creates a new ManifestPhase instance.
   * @param {object} params - Configuration parameters
   * @param {import('../../loaders/ModManifestProcessor.js').default} params.processor - Service for processing mod manifests
   * @param {import('../../interfaces/coreServices.js').ILogger} params.logger - Logger service
   */
  constructor({ processor, logger }) {
    super();
    this.processor = processor;
    this.logger = logger;
  }

  /**
   * @description Executes the manifest processing phase.
   * @param {import('../LoadContext.js').LoadContext} ctx - The load context
   * @returns {Promise<import('../LoadContext.js').LoadContext>}
   * @throws {ModsLoaderPhaseError} When manifest processing fails
   */
  async execute(ctx) {
    this.logger.info('— ManifestPhase starting —');
    try {
      const res = await this.processor.processManifests(
        ctx.requestedMods,
        ctx.worldName
      );
      ctx.finalModOrder = res.finalModOrder;
      ctx.incompatibilities = res.incompatibilityCount;
      ctx.manifests = res.loadedManifestsMap;
      return ctx;
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
