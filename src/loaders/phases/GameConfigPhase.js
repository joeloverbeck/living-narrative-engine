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
   * @param {object} params
   * @param {import('../../loaders/gameConfigLoader.js').default} params.gameConfigLoader
   * @param {import('../../interfaces/coreServices.js').ILogger} params.logger
   */
  constructor({ gameConfigLoader, logger }) {
    super('gameConfig');
    this.gameConfigLoader = gameConfigLoader;
    this.logger = logger;
  }

  /**
   * @description Executes the game configuration loading phase.
   * @param {import('../LoadContext.js').LoadContext} ctx - The load context
   * @returns {Promise<import('../LoadContext.js').LoadContext>}
   * @throws {ModsLoaderPhaseError} When game configuration loading fails
   */
  async execute(ctx) {
    this.logger.info('— GameConfigPhase starting —');
    try {
      const requestedMods = await this.gameConfigLoader.loadConfig();
      
      this.logger.debug(
        `GameConfigPhase: Loaded ${requestedMods.length} mods from game configuration: [${requestedMods.join(', ')}]`
      );
      
      // Create new frozen context with modifications
      const next = {
        ...ctx,
        requestedMods,
      };
      
      return Object.freeze(next);
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