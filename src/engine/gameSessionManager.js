// src/engine/gameSessionManager.js

import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
} from '../constants/eventIds.js';

/**
 * @typedef {import('./engineState.js').default} EngineState
 * @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager
 * @typedef {import('../interfaces/IPlaytimeTracker.js').IPlaytimeTracker} IPlaytimeTracker
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
   * Stops any running session and resets core state, optionally dispatching a UI event.
   *
   * @description Shared preparation logic for start and load operations.
   * @private
   * @param {string | null} uiEventId - Event id to dispatch or {@code null}.
   * @param {any} [payload] - Payload for the dispatched event.
   * @returns {Promise<void>} Resolves when preparation completes.
   */
  async _prepareEngineForOperation(uiEventId, payload) {
    if (this.#state.isInitialized || this.#state.isGameLoopRunning) {
      await this.#stopFn();
    }

    this.#resetCoreGameStateFn();

    if (uiEventId) {
      this.#logger.debug(
        'GameSessionManager._prepareEngineForOperation: Dispatching UI event.'
      );
      await this.#safeEventDispatcher.dispatch(uiEventId, payload);
    }
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
    }
    await this._prepareEngineForOperation(null);

    this.#state.activeWorld = worldName;
    this.#logger.debug(
      `GameSessionManager: Preparing new game session for world "${worldName}"...`
    );
  }

  /**
   * Performs common finalization steps when the game starts.
   *
   * @private
   * @param {string} worldName - Name of the world being started.
   * @returns {Promise<void>} Resolves when setup is complete.
   */
  async _finalizeGameStart(worldName) {
    this.#state.isInitialized = true;
    this.#state.isGameLoopRunning = true;

    if (this.#playtimeTracker) {
      this.#playtimeTracker.startSession();
    } else {
      this.#logger.warn(
        'GameSessionManager._finalizeGameStart: PlaytimeTracker not available, cannot start session.'
      );
    }

    this.#logger.debug(
      'GameSessionManager._finalizeGameStart: Dispatching UI event for game ready.'
    );
    await this.#safeEventDispatcher.dispatch(ENGINE_READY_UI, {
      activeWorld: worldName,
      message: 'Enter command...',
    });

    this.#logger.debug(
      'GameSessionManager._finalizeGameStart: Starting TurnManager...'
    );
    if (this.#turnManager) {
      await this.#turnManager.start();
    } else {
      this.#logger.error(
        'GameSessionManager._finalizeGameStart: TurnManager not available. Game cannot start turns.'
      );
      throw new Error(
        'GameSessionManager critical error: TurnManager service is unavailable during game finalization.'
      );
    }
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
    await this._finalizeGameStart(worldName);
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

    const shortSaveName = saveIdentifier.split(/[/\\]/).pop() || saveIdentifier;

    await this._prepareEngineForOperation(ENGINE_OPERATION_IN_PROGRESS_UI, {
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
    await this._finalizeGameStart(this.#state.activeWorld);
    this.#logger.debug(
      `GameSessionManager.finalizeLoadSuccess: Game loaded from "${saveIdentifier}" (World: ${this.#state.activeWorld}) and resumed.`
    );
    return { success: true, data: loadedSaveData };
  }
}

export default GameSessionManager;
