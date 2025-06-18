import BaseService from '../utils/serviceBase.js';

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
  }

  /**
   * Captures the current game state via GameStateCaptureService.
   *
   * @param {string | null | undefined} activeWorldName - Active world name.
   * @returns {import('../interfaces/ISaveLoadService.js').SaveGameStructure} Game state object.
   * @private
   */
  _captureGameState(activeWorldName) {
    return this.#gameStateCaptureService.captureCurrentGameState(
      activeWorldName
    );
  }

  /**
   * Ensures metadata is present and sets the save name.
   *
   * @param {import('../interfaces/ISaveLoadService.js').SaveGameStructure} state - Game state object.
   * @param {string} saveName - Desired save name.
   * @private
   */
  _setSaveMetadata(state, saveName) {
    if (!state.metadata) state.metadata = {};
    state.metadata.saveName = saveName;
  }

  /**
   * Delegates saving to ISaveLoadService.
   *
   * @param {string} saveName - Save slot name.
   * @param {import('../interfaces/ISaveLoadService.js').SaveGameStructure} state - Prepared game state.
   * @returns {ReturnType<ISaveLoadService['saveManualGame']>}
   * @private
   */
  _delegateManualSave(saveName, state) {
    return this.#saveLoadService.saveManualGame(saveName, state);
  }

  /**
   * Prepares game state and performs the manual save.
   *
   * @param {string} saveName - Name of the save.
   * @param {string | null | undefined} activeWorldName - Name of the active world.
   * @returns {ReturnType<ISaveLoadService['saveManualGame']>} Result from save service.
   */
  async saveGame(saveName, activeWorldName) {
    const state = this._captureGameState(activeWorldName);
    this._setSaveMetadata(state, saveName);
    return this._delegateManualSave(saveName, state);
  }
}
