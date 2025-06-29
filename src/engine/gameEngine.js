// src/engine/gameEngine.js

import { tokens } from '../dependencyInjection/tokens.js';
import {
  ENGINE_INITIALIZING_UI,
  ENGINE_STOPPED_UI,
  REQUEST_SHOW_SAVE_GAME_UI,
  REQUEST_SHOW_LOAD_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../constants/eventIds.js';
import { processOperationFailure } from './engineErrorUtils.js';
import EngineState from './engineState.js';
import GameSessionManager from './gameSessionManager.js';
import PersistenceCoordinator from './persistenceCoordinator.js';
import { assertNonBlankString } from '../utils/dependencyUtils.js';

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
    this.#engineState.setStarted(worldName);
  }

  /**
   * Resets all engine state flags to their defaults.
   *
   * @private
   * @description Sets initialization, loop and world values to inactive.
   * @returns {void}
   */
  #resetEngineState() {
    this.#engineState.reset();
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
   * @private
   * @param {string} contextMessage - Context for the log entry.
   * @param {unknown} error - Error or message to process.
   * @param {string} title - Title for the failure UI event.
   * @param {string} userPrefix - Prefix for the user-facing error message.
   * @param {boolean} [returnResult] - Whether to return a failure object.
   * @returns {Promise<void | {success: false, error: string, data: null}>}
   */
  async _processOperationFailure(
    contextMessage,
    error,
    title,
    userPrefix,
    returnResult = false
  ) {
    return processOperationFailure(
      this.#logger,
      this.#safeEventDispatcher,
      contextMessage,
      error,
      title,
      userPrefix,
      this.#resetEngineState.bind(this),
      returnResult
    );
  }

  async _handleNewGameFailure(error, worldName) {
    await this._processOperationFailure(
      `_handleNewGameFailure: Handling new game failure for world "${worldName}"`,
      error,
      'Initialization Error',
      'Failed to start new game'
    );
  }

  /**
   * Validates the world name parameter for startNewGame.
   *
   * @private
   * @param {string} worldName - Name of the world to validate.
   * @returns {void}
   */
  _validateWorldName(worldName) {
    assertNonBlankString(
      worldName,
      'worldName',
      'GameEngine.startNewGame',
      this.#logger
    );
  }

  /**
   * Prepares the engine and runs the initialization sequence.
   *
   * @private
   * @param {string} worldName - Name of the world being started.
   * @returns {Promise<InitializationResult>} Result of initialization.
   */
  async _initializeNewGame(worldName) {
    await this.#sessionManager.prepareForNewGameSession(worldName);
    this._resetCoreGameState();
    return this._executeInitializationSequence(worldName);
  }

  /**
   * Finalizes a successful initialization run.
   *
   * @private
   * @param {string} worldName - Name of the world being started.
   * @returns {Promise<void>} Resolves when finalized.
   */
  async _finalizeInitializationSuccess(worldName) {
    await this.#sessionManager.finalizeNewGameSuccess(worldName);
  }

  /**
   * Handles initialization errors and ensures failure cleanup.
   *
   * @private
   * @param {unknown} error - Error thrown during initialization.
   * @param {Error|null} initError - InitializationService error if applicable.
   * @param {string} worldName - Name of the world being started.
   * @returns {Promise<never>} Always throws the processed error.
   */
  async _handleInitializationError(error, initError, worldName) {
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

  async startNewGame(worldName) {
    this._validateWorldName(worldName);
    this.#logger.debug(
      `GameEngine: startNewGame called for world "${worldName}".`
    );
    let initError = null;

    try {
      const initResult = await this._initializeNewGame(worldName);

      if (initResult.success) {
        await this._finalizeInitializationSuccess(worldName);
      } else {
        initError =
          initResult.error ||
          new Error('Unknown failure from InitializationService.');
        this.#logger.warn(
          `GameEngine: InitializationService reported failure for "${worldName}".`
        );
        await this._handleNewGameFailure(initError, worldName);
        throw initError;
      }
    } catch (error) {
      await this._handleInitializationError(error, initError, worldName);
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
    return this._processOperationFailure(
      `_handleLoadFailure: Handling game load failure for identifier "${saveIdentifier}"`,
      errorInfo,
      'Load Failed',
      'Failed to load game',
      true
    );
  }

  async triggerManualSave(saveName) {
    return this.#persistenceCoordinator.triggerManualSave(saveName);
  }

  async loadGame(saveIdentifier) {
    assertNonBlankString(
      saveIdentifier,
      'saveIdentifier',
      'GameEngine.loadGame',
      this.#logger
    );
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

  /**
   * Checks for the persistence service and logs a provided message if absent.
   *
   * @private
   * @description Returns the game persistence service or `null` when missing.
   * @param {string} unavailableMessage - Error message to log when service is missing.
   * @returns {IGamePersistenceService | null} The persistence service or `null`.
   */
  _ensurePersistenceServiceAvailable(unavailableMessage) {
    try {
      return this._ensurePersistenceService();
    } catch {
      this.#logger.error(unavailableMessage);
      return null;
    }
  }

  showSaveGameUI() {
    const persistenceService = this._ensurePersistenceServiceAvailable(
      'GameEngine.showSaveGameUI: GamePersistenceService is unavailable. Cannot show Save Game UI.'
    );
    if (!persistenceService) {
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
    if (
      !this._ensurePersistenceServiceAvailable(
        'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.'
      )
    ) {
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
