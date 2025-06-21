import LoaderPhase from './LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';

/**
 * @description Phase responsible for loading the game configuration and populating the requested mods.
 */
export default class GameConfigPhase extends LoaderPhase {
  /**
   * @description Creates a new GameConfigPhase instance.
   * @param {object} params - Configuration parameters
   * @param {import('../../loaders/gameConfigLoader.js').default} params.gameConfigLoader - Service for loading game configuration
   * @param {import('../../interfaces/coreServices.js').ILogger} params.logger - Logger service
   */
  constructor({ gameConfigLoader, logger }) {
    super();
    this.gameConfigLoader = gameConfigLoader;
    this.logger = logger;
  }

  /**
   * @description Executes the game configuration loading phase.
   * @param {import('../LoadContext.js').LoadContext} ctx - The load context
   * @returns {Promise<void>}
   * @throws {ModsLoaderPhaseError} When game configuration loading fails
   */
  async execute(ctx) {
    this.logger.info('— GameConfigPhase starting —');
    try {
      const requestedMods = await this.gameConfigLoader.loadConfig();
      ctx.requestedMods = requestedMods;
      this.logger.debug(
        `GameConfigPhase: Loaded ${requestedMods.length} mods from game configuration: [${requestedMods.join(', ')}]`
      );
    } catch (e) {
      throw new ModsLoaderPhaseError(
        ModsLoaderErrorCode.GAME_CONFIG,
        e.message,
        'GameConfigPhase',
        e
      );
    }
  }
} 