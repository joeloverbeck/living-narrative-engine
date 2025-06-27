// src/engine/gameEngine.js

import { tokens } from '../dependencyInjection/tokens.js';
import {
  ENGINE_INITIALIZING_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_STOPPED_UI,
  REQUEST_SHOW_SAVE_GAME_UI,
  REQUEST_SHOW_LOAD_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../constants/eventIds.js';
import EngineState from './engineState.js';
import GameSessionManager from './gameSessionManager.js';
import PersistenceCoordinator from './persistenceCoordinator.js';

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../interfaces/IGamePersistenceService.js').SaveResult} SaveResult */
/** @typedef {import('../interfaces/IGamePersistenceService.js').LoadAndRestoreResult} LoadAndRestoreResult */
/** @typedef {import('../interfaces/IPlaytimeTracker.js').IPlaytimeTracker} IPlaytimeTracker */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/IInitializationService.js').IInitializationService} IInitializationService */
/** @typedef {import('../interfaces/IInitializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

class GameEngine {
  /** @type {ILogger} */
  #logger;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ITurnManager} */
  #turnManager;
  /** @type {IGamePersistenceService} */
  #gamePersistenceService;
  /** @type {IPlaytimeTracker} */
  #playtimeTracker;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {IInitializationService} */
  #initializationService;

  /** @type {EngineState} */
  #engineState;
  /** @type {GameSessionManager} */
  #sessionManager;
  /** @type {PersistenceCoordinator} */
  #persistenceCoordinator;

  /**
   * Creates a new GameEngine instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {AppContainer} deps.container - DI container instance.
   * @param {ILogger} deps.logger - Logger for engine events.
   * @param {GameSessionManager} [deps.sessionManager] - Optional session manager.
   * @param {PersistenceCoordinator} [deps.persistenceCoordinator] - Optional persistence coordinator.
   */
  constructor({
    container,
    logger,
    sessionManager = null,
    persistenceCoordinator = null,
  }) {
    if (!logger) {
      throw new Error('GameEngine requires a logger.');
    }
    this.#logger = logger;
    this.#logger.debug('GameEngine: Constructor called.');
    try {
      this.#entityManager = container.resolve(tokens.IEntityManager);
      this.#turnManager = container.resolve(tokens.ITurnManager);
      this.#gamePersistenceService = /** @type {IGamePersistenceService} */ (
        container.resolve(tokens.GamePersistenceService)
      );
      this.#playtimeTracker = /** @type {IPlaytimeTracker} */ (
        container.resolve(tokens.PlaytimeTracker)
      );
      this.#safeEventDispatcher = container.resolve(
        tokens.ISafeEventDispatcher
      );
      this.#initializationService = /** @type {IInitializationService} */ (
        container.resolve(tokens.IInitializationService)
      );
    } catch (e) {
      this.#logger.error(
        `GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${e.message}`,
        e
      );
      throw new Error(
        `GameEngine: Failed to resolve core services. ${e.message}`
      );
    }
    this.#logger.debug('GameEngine: Core services resolved.');

    this.#engineState = new EngineState();

    const shouldResolveSession =
      !sessionManager &&
      container.isRegistered &&
      container.isRegistered(tokens.GameSessionManager);
    this.#sessionManager =
      sessionManager ||
      (shouldResolveSession
        ? container.resolve(tokens.GameSessionManager)
        : new GameSessionManager({
            logger: this.#logger,
            turnManager: this.#turnManager,
            playtimeTracker: this.#playtimeTracker,
            safeEventDispatcher: this.#safeEventDispatcher,
            engineState: this.#engineState,
            stopFn: this.stop.bind(this),
            resetCoreGameStateFn: this._resetCoreGameState.bind(this),
            startEngineFn: this.#startEngine.bind(this),
          }));

    const shouldResolvePersist =
      !persistenceCoordinator &&
      container.isRegistered &&
      container.isRegistered(tokens.PersistenceCoordinator);
    this.#persistenceCoordinator =
      persistenceCoordinator ||
      (shouldResolvePersist
        ? container.resolve(tokens.PersistenceCoordinator)
        : new PersistenceCoordinator({
            logger: this.#logger,
            gamePersistenceService: this.#gamePersistenceService,
            safeEventDispatcher: this.#safeEventDispatcher,
            sessionManager: this.#sessionManager,
            engineState: this.#engineState,
            handleLoadFailure: this._handleLoadFailure.bind(this),
          }));
  }

  _resetCoreGameState() {
    if (this.#entityManager) this.#entityManager.clearAll();
    else
      this.#logger.warn(
        'GameEngine._resetCoreGameState: EntityManager not available.'
      );
    if (this.#playtimeTracker) this.#playtimeTracker.reset();
    else
      this.#logger.warn(
        'GameEngine._resetCoreGameState: PlaytimeTracker not available.'
      );
    this.#logger.debug(
      'GameEngine: Core game state (EntityManager, PlaytimeTracker) cleared/reset.'
    );
  }

  /**
   * Marks the engine as fully started for the provided world.
   *
   * @private
   * @description Sets all engine state flags to active values.
   * @param {string} worldName - Name of the active world.
   * @returns {void}
   */
  #startEngine(worldName) {
    this.#engineState.isInitialized = true;
    this.#engineState.isGameLoopRunning = true;
    this.#engineState.activeWorld = worldName;
  }

  /**
   * Resets all engine state flags to their defaults.
   *
   * @private
   * @description Sets initialization, loop and world values to inactive.
   * @returns {void}
   */
  #resetEngineState() {
    this.#engineState.isInitialized = false;
    this.#engineState.isGameLoopRunning = false;
    this.#engineState.activeWorld = null;
  }

  async _executeInitializationSequence(worldName) {
    this.#logger.debug(
      'GameEngine._executeInitializationSequence: Dispatching UI event for initialization start.'
    );
    await this.#safeEventDispatcher.dispatch(
      ENGINE_INITIALIZING_UI,
      { worldName },
      { allowSchemaNotFound: true }
    );

    const initializationService = this.#initializationService;
    this.#logger.debug(
      'GameEngine._executeInitializationSequence: Using injected InitializationService.'
    );

    this.#logger.debug(
      `GameEngine._executeInitializationSequence: Invoking IInitializationService.runInitializationSequence for world "${worldName}"...`
    );
    const initResult = /** @type {InitializationResult} */ (
      await initializationService.runInitializationSequence(worldName)
    );

    this.#logger.debug(
      `GameEngine._executeInitializationSequence: Initialization sequence completed for "${worldName}". Success: ${initResult.success}`
    );
    return initResult;
  }

  /**
   * Resets engine state and dispatches a failure UI event.
   *
   * @private
   * @param {string} errorMessage - Failure message to display.
   * @param {string} title - Title for the failure UI event.
   * @returns {Promise<void>} Resolves when completed.
   */
  async _resetOnFailure(errorMessage, title) {
    this.#logger.debug(
      'GameEngine._resetOnFailure: Dispatching UI event for operation failed.'
    );
    if (this.#safeEventDispatcher) {
      await this.#safeEventDispatcher.dispatch(ENGINE_OPERATION_FAILED_UI, {
        errorMessage,
        errorTitle: title,
      });
    } else {
      this.#logger.error(
        'GameEngine._resetOnFailure: ISafeEventDispatcher not available, cannot dispatch UI failure event.'
      );
    }

    this.#resetEngineState();
  }

  async _handleNewGameFailure(error, worldName) {
    this.#logger.error(
      `GameEngine._handleNewGameFailure: Handling new game failure for world "${worldName}". Error: ${error.message}`,
      error
    );
    await this._resetOnFailure(
      `Failed to start new game: ${error.message}`,
      'Initialization Error'
    );
  }

  async startNewGame(worldName) {
    if (
      !worldName ||
      typeof worldName !== 'string' ||
      worldName.trim() === ''
    ) {
      const errorMsg =
        'GameEngine.startNewGame: worldName must be a non-empty string.';
      this.#logger.error(errorMsg);
      throw new TypeError(errorMsg);
    }
    this.#logger.debug(
      `GameEngine: startNewGame called for world "${worldName}".`
    );
    let initError = null;

    try {
      await this.#sessionManager.prepareForNewGameSession(worldName);
      this._resetCoreGameState();

      const initResult = await this._executeInitializationSequence(worldName);

      if (initResult.success) {
        await this.#sessionManager.finalizeNewGameSuccess(worldName);
      } else {
        const initializationError =
          initResult.error ||
          new Error('Unknown failure from InitializationService.');
        initError = initializationError;
        this.#logger.warn(
          `GameEngine: InitializationService reported failure for "${worldName}".`
        );
        await this._handleNewGameFailure(initializationError, worldName);
        throw initializationError;
      }
    } catch (error) {
      const caughtError =
        error instanceof Error ? error : new Error(String(error));
      this.#logger.error(
        `GameEngine: Overall catch in startNewGame for world "${worldName}". Error: ${caughtError.message || String(caughtError)}`,
        caughtError
      );
      if (caughtError !== initError) {
        await this._handleNewGameFailure(caughtError, worldName);
      }
      throw caughtError;
    }
  }

  async stop() {
    if (
      !this.#engineState.isInitialized &&
      !this.#engineState.isGameLoopRunning
    ) {
      this.#logger.debug(
        'GameEngine.stop: Engine not running or already stopped. No action taken.'
      );
      return;
    }

    this.#logger.debug('GameEngine.stop: Stopping game engine session...');
    this.#resetEngineState();

    if (this.#playtimeTracker) {
      this.#playtimeTracker.endSessionAndAccumulate();
      this.#logger.debug('GameEngine.stop: Playtime session ended.');
    } else {
      this.#logger.warn(
        'GameEngine.stop: PlaytimeTracker service not available, cannot end session.'
      );
    }

    await this.#safeEventDispatcher.dispatch(ENGINE_STOPPED_UI, {
      inputDisabledMessage: 'Game stopped. Engine is inactive.',
    });
    this.#logger.debug('GameEngine.stop: ENGINE_STOPPED_UI event dispatched.');

    if (this.#turnManager) {
      await this.#turnManager.stop();
      this.#logger.debug('GameEngine.stop: TurnManager stopped.');
    } else {
      this.#logger.warn(
        'GameEngine.stop: TurnManager service not available, cannot stop.'
      );
    }

    this.#logger.debug(
      'GameEngine.stop: Engine fully stopped and state reset.'
    );
  }

  async _handleLoadFailure(errorInfo, saveIdentifier) {
    const errorMessageString =
      errorInfo instanceof Error ? errorInfo.message : String(errorInfo);

    this.#logger.error(
      `GameEngine._handleLoadFailure: Handling game load failure for identifier "${saveIdentifier}". Error: ${errorMessageString}`,
      errorInfo instanceof Error ? errorInfo : undefined
    );
    await this._resetOnFailure(
      `Failed to load game: ${errorMessageString}`,
      'Load Failed'
    );

    return { success: false, error: errorMessageString, data: null };
  }

  async triggerManualSave(saveName) {
    return this.#persistenceCoordinator.triggerManualSave(saveName);
  }

  async loadGame(saveIdentifier) {
    if (
      !saveIdentifier ||
      typeof saveIdentifier !== 'string' ||
      saveIdentifier.trim() === ''
    ) {
      const errorMsg =
        'GameEngine.loadGame: saveIdentifier must be a non-empty string.';
      this.#logger.error(errorMsg);
      throw new TypeError(errorMsg);
    }
    return this.#persistenceCoordinator.loadGame(saveIdentifier);
  }

  /**
   * Ensures the persistence service exists.
   *
   * @private
   * @description Returns the game persistence service or throws if unavailable.
   * @returns {IGamePersistenceService} The persistence service.
   * @throws {Error} When the service is missing.
   */
  _ensurePersistenceService() {
    if (!this.#gamePersistenceService) {
      throw new Error('GamePersistenceService is unavailable.');
    }
    return this.#gamePersistenceService;
  }

  showSaveGameUI() {
    let persistenceService;
    try {
      persistenceService = this._ensurePersistenceService();
    } catch {
      this.#logger.error(
        'GameEngine.showSaveGameUI: GamePersistenceService is unavailable. Cannot show Save Game UI.'
      );
      return;
    }

    if (persistenceService.isSavingAllowed(this.#engineState.isInitialized)) {
      this.#logger.debug(
        'GameEngine.showSaveGameUI: Dispatching request to show Save Game UI.'
      );
      this.#safeEventDispatcher.dispatch(REQUEST_SHOW_SAVE_GAME_UI, {});
    } else {
      this.#logger.warn(
        'GameEngine.showSaveGameUI: Saving is not currently allowed.'
      );
      this.#safeEventDispatcher.dispatch(CANNOT_SAVE_GAME_INFO);
    }
  }

  showLoadGameUI() {
    try {
      this._ensurePersistenceService();
    } catch {
      this.#logger.error(
        'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.'
      );
      return;
    }
    this.#logger.debug(
      'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
    );
    this.#safeEventDispatcher.dispatch(REQUEST_SHOW_LOAD_GAME_UI, {});
  }

  getEngineStatus() {
    return {
      isInitialized: this.#engineState.isInitialized,
      isLoopRunning: this.#engineState.isGameLoopRunning,
      activeWorld: this.#engineState.activeWorld,
    };
  }
}

export default GameEngine;
