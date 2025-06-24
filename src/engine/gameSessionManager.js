// src/engine/gameSessionManager.js

import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
} from '../constants/eventIds.js';

/**
 * @typedef {import('./engineState.js').default} EngineState
 * @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager
 * @typedef {import('../interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Coordinates game session lifecycle tasks for starting and loading games.
 *
 * @class GameSessionManager
 */
class GameSessionManager {
  /** @type {ILogger} */
  #logger;
  /** @type {ITurnManager} */
  #turnManager;
  /** @type {IPlaytimeTracker} */
  #playtimeTracker;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {EngineState} */
  #state;
  /** @type {() => Promise<void>} */
  #stopFn;
  /** @type {() => Promise<void>} */
  #resetCoreGameStateFn;

  /**
   * Creates a new GameSessionManager instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {ITurnManager} deps.turnManager - Turn manager.
   * @param {IPlaytimeTracker} deps.playtimeTracker - Playtime tracker.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for UI events.
   * @param {EngineState} deps.engineState - Engine state reference.
   * @param {() => Promise<void>} deps.stopFn - Function to stop the engine.
   * @param {() => Promise<void>} deps.resetCoreGameStateFn - Function to reset core state.
   */
  constructor({
    logger,
    turnManager,
    playtimeTracker,
    safeEventDispatcher,
    engineState,
    stopFn,
    resetCoreGameStateFn,
  }) {
    this.#logger = logger;
    this.#turnManager = turnManager;
    this.#playtimeTracker = playtimeTracker;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#state = engineState;
    this.#stopFn = stopFn;
    this.#resetCoreGameStateFn = resetCoreGameStateFn;
  }

  /**
   * Prepares for starting a new game session.
   *
   * @param {string} worldName - Name of the world to start.
   * @returns {Promise<void>} Resolves when preparation completes.
   */
  async prepareForNewGameSession(worldName) {
    if (this.#state.isInitialized) {
      this.#logger.warn(
        'GameSessionManager.prepareForNewGameSession: Engine already initialized. Stopping existing game before starting new.'
      );
      await this.#stopFn();
    }
    this.#state.activeWorld = worldName;
    this.#logger.debug(
      `GameSessionManager: Preparing new game session for world "${worldName}"...`
    );
  }

  /**
   * Finalizes a successful new game start.
   *
   * @param {string} worldName - Initialized world name.
   * @returns {Promise<void>} Resolves when setup is complete.
   */
  async finalizeNewGameSuccess(worldName) {
    this.#logger.debug(
      `GameSessionManager.finalizeNewGameSuccess: Initialization successful for world "${worldName}". Finalizing new game setup.`
    );

    this.#state.isInitialized = true;
    this.#state.isGameLoopRunning = true;

    if (this.#playtimeTracker) {
      this.#playtimeTracker.startSession();
    } else {
      this.#logger.warn(
        'GameSessionManager.finalizeNewGameSuccess: PlaytimeTracker not available, cannot start session.'
      );
    }

    this.#logger.debug(
      'GameSessionManager.finalizeNewGameSuccess: Dispatching UI event for game ready.'
    );
    await this.#safeEventDispatcher.dispatch(ENGINE_READY_UI, {
      activeWorld: this.#state.activeWorld,
      message: 'Enter command...',
    });

    this.#logger.debug(
      'GameSessionManager.finalizeNewGameSuccess: Starting TurnManager...'
    );
    if (this.#turnManager) {
      await this.#turnManager.start();
    } else {
      this.#logger.error(
        'GameSessionManager.finalizeNewGameSuccess: TurnManager not available. Game cannot start turns.'
      );
      throw new Error(
        'GameSessionManager critical error: TurnManager service is unavailable during game finalization.'
      );
    }

    this.#logger.debug(
      `GameSessionManager.finalizeNewGameSuccess: New game started and ready (World: ${this.#state.activeWorld}).`
    );
  }

  /**
   * Prepares for loading a game session.
   *
   * @param {string} saveIdentifier - Identifier of the save to load.
   * @returns {Promise<void>} Resolves when preparation completes.
   */
  async prepareForLoadGameSession(saveIdentifier) {
    this.#logger.debug(
      `GameSessionManager.prepareForLoadGameSession: Preparing to load game from identifier: ${saveIdentifier}`
    );

    if (this.#state.isInitialized || this.#state.isGameLoopRunning) {
      await this.#stopFn();
    }
    await this.#resetCoreGameStateFn();

    this.#logger.debug(
      'GameSessionManager.prepareForLoadGameSession: Dispatching UI event for load operation in progress.'
    );
    const shortSaveName = saveIdentifier.split(/[/\\]/).pop() || saveIdentifier;
    await this.#safeEventDispatcher.dispatch(ENGINE_OPERATION_IN_PROGRESS_UI, {
      titleMessage: `Loading ${shortSaveName}...`,
      inputDisabledMessage: `Loading game from ${shortSaveName}...`,
    });
  }

  /**
   * Finalizes a successful load operation.
   *
   * @param {import('../interfaces/ISaveLoadService.js').SaveGameStructure} loadedSaveData - Restored save data.
   * @param {string} saveIdentifier - Identifier loaded from.
   * @returns {Promise<{success: true, data: import('../interfaces/ISaveLoadService.js').SaveGameStructure}>}
   *   Result object containing the loaded save data.
   */
  async finalizeLoadSuccess(loadedSaveData, saveIdentifier) {
    this.#logger.debug(
      `GameSessionManager.finalizeLoadSuccess: Game state restored successfully from ${saveIdentifier}. Finalizing load setup.`
    );

    this.#state.activeWorld =
      loadedSaveData.metadata?.gameTitle || 'Restored Game';
    this.#state.isInitialized = true;
    this.#state.isGameLoopRunning = true;

    if (this.#playtimeTracker) {
      this.#playtimeTracker.startSession();
    } else {
      this.#logger.warn(
        'GameSessionManager.finalizeLoadSuccess: PlaytimeTracker not available, cannot start session for loaded game.'
      );
    }

    this.#logger.debug(
      'GameSessionManager.finalizeLoadSuccess: Dispatching UI event for game ready (after load).'
    );
    await this.#safeEventDispatcher.dispatch(ENGINE_READY_UI, {
      activeWorld: this.#state.activeWorld,
      message: 'Enter command...',
    });

    this.#logger.debug(
      'GameSessionManager.finalizeLoadSuccess: Starting TurnManager for loaded game...'
    );
    if (this.#turnManager) {
      await this.#turnManager.start();
    } else {
      this.#logger.error(
        'GameSessionManager.finalizeLoadSuccess: TurnManager not available. Loaded game may not function correctly.'
      );
      throw new Error(
        'GameSessionManager critical error: TurnManager service is unavailable during loaded game finalization.'
      );
    }

    this.#logger.debug(
      `GameSessionManager.finalizeLoadSuccess: Game loaded from "${saveIdentifier}" (World: ${this.#state.activeWorld}) and resumed.`
    );
    return { success: true, data: loadedSaveData };
  }
}

export default GameSessionManager;
