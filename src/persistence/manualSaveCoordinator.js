import { BaseService } from '../utils/serviceBase.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('./gameStateCaptureService.js').default} GameStateCaptureService
 * @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService
 */

/**
 * @class ManualSaveCoordinator
 * @description Prepares game state and delegates manual save requests to ISaveLoadService.
 */
export default class ManualSaveCoordinator extends BaseService {
  /** @type {ILogger} */
  #logger;
  /** @type {GameStateCaptureService} */
  #gameStateCaptureService;
  /** @type {ISaveLoadService} */
  #saveLoadService;

  /**
   * Creates a new ManualSaveCoordinator.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {GameStateCaptureService} deps.gameStateCaptureService - Service capturing current game state.
   * @param {ISaveLoadService} deps.saveLoadService - Save/load service.
   */
  constructor({ logger, gameStateCaptureService, saveLoadService }) {
    super();
    this.#logger = this._init('ManualSaveCoordinator', logger, {
      gameStateCaptureService: {
        value: gameStateCaptureService,
        requiredMethods: ['captureCurrentGameState'],
      },
      saveLoadService: {
        value: saveLoadService,
        requiredMethods: ['saveManualGame'],
      },
    });
    this.#gameStateCaptureService = gameStateCaptureService;
    this.#saveLoadService = saveLoadService;
    this.#logger.debug('ManualSaveCoordinator: Instance created.');
  }

  /**
   * Prepares game state and performs the manual save.
   *
   * @param {string} saveName - Name of the save.
   * @param {string | null | undefined} activeWorldName - Name of the active world.
   * @returns {ReturnType<ISaveLoadService['saveManualGame']>} Result from save service.
   */
  async saveGame(saveName, activeWorldName) {
    this.#logger.debug(`ManualSaveCoordinator.saveGame: Saving "${saveName}".`);
    const state =
      this.#gameStateCaptureService.captureCurrentGameState(activeWorldName);
    return this.#saveLoadService.saveManualGame(saveName, state);
  }
}
