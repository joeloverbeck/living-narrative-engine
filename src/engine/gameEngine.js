// src/engine/gameEngine.js

import { tokens } from '../dependencyInjection/tokens.js';
import {
  GAME_LOADED_ID,
  GAME_SAVED_ID,
  NEW_GAME_STARTED_ID,
  LOADED_GAME_STARTED_ID,
  GAME_STOPPED_ID,
  ENGINE_INITIALIZING_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_STOPPED_UI,
  ENGINE_MESSAGE_DISPLAY_REQUESTED,
  REQUEST_SHOW_SAVE_GAME_UI,
  REQUEST_SHOW_LOAD_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../constants/eventIds.js';

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../interfaces/IGamePersistenceService.js').SaveResult} SaveResult */
/** @typedef {import('../interfaces/IGamePersistenceService.js').LoadAndRestoreResult} LoadAndRestoreResult */
/** @typedef {import('../interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/IInitializationService.js').IInitializationService} IInitializationService */

/** @typedef {import('../interfaces/IInitializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

class GameEngine {
  /** @type {AppContainer} */
  #container;
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

  /** @type {boolean} */
  #isEngineInitialized = false;
  /** @type {boolean} */
  #isGameLoopRunning = false;
  /** @type {string | null} */
  #activeWorld = null;

  constructor({ container }) {
    this.#container = container;
    try {
      this.#logger = container.resolve(tokens.ILogger);
    } catch (e) {
      console.error('GameEngine: CRITICAL - Logger not resolved.', e);
      throw new Error('GameEngine requires a logger.');
    }
    this.#logger.info('GameEngine: Constructor called.');
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
    } catch (e) {
      this.#logger.error(
        `GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${e.message}`,
        e
      );
      throw new Error(
        `GameEngine: Failed to resolve core services. ${e.message}`
      );
    }
    this.#logger.info('GameEngine: Core services resolved.');
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
   * Prepares the game engine for a new game session.
   * Handles preliminary checks and setup before the main game initialization sequence begins.
   * This includes stopping any existing game session if the engine is already initialized,
   * setting the active world, and logging the preparation step.
   *
   * @private
   * @async
   * @param {string} worldName - The name of the world for the new game session.
   * @returns {Promise<void>} A promise that resolves when the preparation is complete.
   * @fires GAME_STOPPED_ID - If an existing game is stopped via `this.stop()`.
   * @fires ENGINE_STOPPED_UI - If an existing game is stopped via `this.stop()`.
   * @memberof GameEngine
   */
  async _prepareForNewGameSession(worldName) {
    if (this.#isEngineInitialized) {
      this.#logger.warn(
        'GameEngine._prepareForNewGameSession: Engine already initialized. Stopping existing game before starting new.'
      );
      await this.stop(); // stop() handles setting #isEngineInitialized to false and #activeWorld to null
    }
    this.#activeWorld = worldName; // Set active world here as per ticket's Key Considerations
    this.#logger.info(
      `GameEngine: Preparing new game session for world "${worldName}"...`
    );
  }

  /**
   * Orchestrates the actual game world initialization sequence.
   * This method resolves and calls the `IInitializationService` to set up the game world
   * according to the provided world name. It also dispatches a UI event to indicate
   * that the initialization process has started.
   *
   * @private
   * @async
   * @param {string} worldName - The name of the world to initialize.
   * @returns {Promise<InitializationResult>} A promise that resolves with the result of the initialization sequence,
   * which includes a success flag and an optional error.
   * @fires ENGINE_INITIALIZING_UI - Dispatched via `ISafeEventDispatcher` to signal the start of initialization.
   * @throws {Error} If the `IInitializationService` cannot be resolved from the container.
   * @memberof GameEngine
   */
  async _executeInitializationSequence(worldName) {
    this.#logger.info(
      'GameEngine._executeInitializationSequence: Dispatching UI event for initialization start.'
    );
    await this.#safeEventDispatcher.dispatch(
      ENGINE_INITIALIZING_UI,
      { worldName },
      { allowSchemaNotFound: true }
    );

    this.#logger.info(
      'GameEngine._executeInitializationSequence: Resolving InitializationService...'
    );
    const initializationService = /** @type {IInitializationService} */ (
      this.#container.resolve(tokens.IInitializationService)
    );

    this.#logger.info(
      `GameEngine._executeInitializationSequence: Invoking IInitializationService.runInitializationSequence for world "${worldName}"...`
    );
    const initResult = /** @type {InitializationResult} */ (
      await initializationService.runInitializationSequence(worldName)
    );

    this.#logger.info(
      `GameEngine._executeInitializationSequence: Initialization sequence completed for "${worldName}". Success: ${initResult.success}`
    );
    return initResult;
  }

  /**
   * Finalizes the setup for a new game after successful world initialization.
   * This includes setting engine state flags, starting the playtime tracker,
   * dispatching game and UI events, and starting the turn manager.
   *
   * @private
   * @async
   * @param {string} worldName - The name of the world that was successfully initialized.
   * @returns {Promise<void>} A promise that resolves when all finalization actions are complete.
   * @memberof GameEngine
   * @description
   * Actions performed:
   * 1. Logs successful initialization and finalization start.
   * 2. Sets `#isEngineInitialized` to `true`.
   * 3. Sets `#isGameLoopRunning` to `true`.
   * 4. Starts a new session on `#playtimeTracker`.
   * 5. Dispatches `NEW_GAME_STARTED_ID` event with `worldName`.
   * 6. Logs dispatching of UI event for game ready.
   * 7. Dispatches `ENGINE_READY_UI` event with `activeWorld` (which is `#activeWorld`) and a default message.
   * 8. Logs start of `TurnManager`.
   * 9. Starts the `#turnManager`.
   * 10. Logs that the new game has started and is ready, including the active world name.
   */
  async _finalizeNewGameSuccess(worldName) {
    this.#logger.info(
      `GameEngine._finalizeNewGameSuccess: Initialization successful for world "${worldName}". Finalizing new game setup.`
    );

    this.#isEngineInitialized = true;
    this.#isGameLoopRunning = true;

    if (this.#playtimeTracker) {
      // Check if playtimeTracker is available
      this.#playtimeTracker.startSession();
    } else {
      this.#logger.warn(
        'GameEngine._finalizeNewGameSuccess: PlaytimeTracker not available, cannot start session.'
      );
    }

    await this.#safeEventDispatcher.dispatch(NEW_GAME_STARTED_ID, {
      worldName,
    });

    this.#logger.info(
      'GameEngine._finalizeNewGameSuccess: Dispatching UI event for game ready.'
    );
    await this.#safeEventDispatcher.dispatch(ENGINE_READY_UI, {
      activeWorld: this.#activeWorld, // #activeWorld should be set by _prepareForNewGameSession
      message: 'Enter command...',
    });

    this.#logger.info(
      'GameEngine._finalizeNewGameSuccess: Starting TurnManager...'
    );
    if (this.#turnManager) {
      // Check if turnManager is available
      await this.#turnManager.start();
    } else {
      this.#logger.error(
        'GameEngine._finalizeNewGameSuccess: TurnManager not available. Game cannot start turns.'
      );
      // Depending on how critical TurnManager is, we might want to throw an error or handle this more gracefully.
      // For now, logging an error. This could lead to a non-interactive game.
      throw new Error(
        'GameEngine critical error: TurnManager service is unavailable during game finalization.'
      );
    }

    this.#logger.info(
      `GameEngine._finalizeNewGameSuccess: New game started and ready (World: ${this.#activeWorld}).`
    );
  }

  /**
   * Handles the common tasks required when a new game attempt fails.
   * This includes logging the error, dispatching a UI failure event,
   * and resetting critical engine state flags.
   *
   * @private
   * @async
   * @param {Error} error - The error object that caused the new game failure.
   * @param {string} worldName - The name of the world for which the new game attempt failed.
   * @returns {Promise<void>} A promise that resolves when all failure handling actions are complete.
   * @memberof GameEngine
   */
  async _handleNewGameFailure(error, worldName) {
    this.#logger.error(
      `GameEngine._handleNewGameFailure: Handling new game failure for world "${worldName}". Error: ${error.message}`,
      error
    );
    this.#logger.info(
      'GameEngine._handleNewGameFailure: Dispatching UI event for operation failed.'
    );

    await this.#safeEventDispatcher.dispatch(ENGINE_OPERATION_FAILED_UI, {
      errorMessage: `Failed to start new game: ${error.message}`,
      errorTitle: 'Initialization Error',
    });

    this.#isEngineInitialized = false;
    this.#isGameLoopRunning = false;
    this.#activeWorld = null; // Clear world context as per requirements
  }

  /**
   * Starts a new game session for the specified world.
   * This method orchestrates the setup process by calling various private helper methods:
   * - `_prepareForNewGameSession`: Handles pre-initialization tasks like stopping an existing game.
   * - `_resetCoreGameState`: Clears existing game data.
   * - `_executeInitializationSequence`: Runs the main world initialization logic.
   * - `_finalizeNewGameSuccess`: Performs post-initialization setup if successful.
   * - `_handleNewGameFailure`: Manages cleanup and error reporting if any step fails.
   *
   * @async
   * @param {string} worldName - The name of the world to start.
   * @returns {Promise<void>} A promise that resolves when the new game is successfully started, or rejects if an error occurs.
   * @throws {Error} Throws an error if any part of the new game setup fails.
   * @memberof GameEngine
   */
  async startNewGame(worldName) {
    this.#logger.info(
      `GameEngine: startNewGame called for world "${worldName}".`
    );
    let specificInitializationError = null; // Used to track if the error came from initResult.success = false

    try {
      await this._prepareForNewGameSession(worldName);
      await this._resetCoreGameState(); // Awaited as per instruction, even if currently synchronous

      const initResult = await this._executeInitializationSequence(worldName);

      if (initResult.success) {
        await this._finalizeNewGameSuccess(worldName);
      } else {
        const initializationError =
          initResult.error ||
          new Error('Unknown failure from InitializationService.');
        specificInitializationError = initializationError;
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
      if (caughtError !== specificInitializationError) {
        await this._handleNewGameFailure(caughtError, worldName);
      }
      throw caughtError;
    }
  }

  /**
   * Stops the game engine session gracefully.
   * This method handles the shutdown of the game loop, ends the playtime tracking session,
   * stops the turn manager, dispatches UI and system events indicating the engine has stopped,
   * and resets the engine's initialization state and active world.
   * Relies on established interface contracts for service interactions.
   * Critical services like ILogger and ISafeEventDispatcher are assumed to be present.
   *
   * @async
   * @returns {Promise<void>} A promise that resolves when the engine has fully stopped.
   * @fires ENGINE_STOPPED_UI - Dispatched to inform the UI that the engine is inactive.
   * @fires GAME_STOPPED_ID - Dispatched to inform other systems that the game has stopped.
   * @memberof GameEngine
   */
  async stop() {
    if (!this.#isEngineInitialized && !this.#isGameLoopRunning) {
      this.#logger.info(
        'GameEngine.stop: Engine not running or already stopped. No action taken.'
      );
      return;
    }

    this.#logger.info('GameEngine.stop: Stopping game engine session...');
    this.#isGameLoopRunning = false;

    if (this.#playtimeTracker) {
      this.#playtimeTracker.endSessionAndAccumulate();
      this.#logger.info('GameEngine.stop: Playtime session ended.');
    } else {
      this.#logger.warn(
        'GameEngine.stop: PlaytimeTracker service not available, cannot end session.'
      );
    }

    await this.#safeEventDispatcher.dispatch(ENGINE_STOPPED_UI, {
      inputDisabledMessage: 'Game stopped. Engine is inactive.',
    });
    this.#logger.info('GameEngine.stop: ENGINE_STOPPED_UI event dispatched.');

    if (this.#turnManager) {
      await this.#turnManager.stop();
      this.#logger.info('GameEngine.stop: TurnManager stopped.');
    } else {
      this.#logger.warn(
        'GameEngine.stop: TurnManager service not available, cannot stop.'
      );
    }

    await this.#safeEventDispatcher.dispatch(GAME_STOPPED_ID, {});
    this.#logger.info('GameEngine.stop: GAME_STOPPED_ID event dispatched.');

    this.#isEngineInitialized = false;
    this.#activeWorld = null;

    this.#logger.info('GameEngine.stop: Engine fully stopped and state reset.');
  }

  /**
   * Triggers a manual save of the current game state with the given save name.
   * It checks if the engine is initialized and if the persistence service is available.
   * Dispatches UI events to inform the user about the progress and outcome of the save operation.
   *
   * @async
   * @param {string} saveName - The name to use for the save file.
   * @returns {Promise<SaveResult>} A promise that resolves to an object indicating the success or failure of the save operation.
   * @memberof GameEngine
   */
  async triggerManualSave(saveName) {
    this.#logger.info(
      `GameEngine.triggerManualSave: Manual save process initiated with name: "${saveName}"`
    );

    if (!this.#isEngineInitialized) {
      const errorMsg = 'Game engine is not initialized. Cannot save game.';
      this.#logger.error(`GameEngine.triggerManualSave: ${errorMsg}`);
      await this.#safeEventDispatcher.dispatch(
        ENGINE_MESSAGE_DISPLAY_REQUESTED,
        {
          message: errorMsg,
          type: 'error',
        }
      );
      return { success: false, error: errorMsg };
    }

    if (!this.#gamePersistenceService) {
      const errorMsg =
        'GamePersistenceService is not available. Cannot save game.';
      this.#logger.error(`GameEngine.triggerManualSave: ${errorMsg}`);
      await this.#safeEventDispatcher.dispatch(
        ENGINE_MESSAGE_DISPLAY_REQUESTED,
        {
          message: errorMsg,
          type: 'error',
        }
      );
      return { success: false, error: errorMsg };
    }

    /** @type {SaveResult} */
    let saveResult;

    try {
      this.#logger.info(
        `GameEngine.triggerManualSave: Dispatching ENGINE_OPERATION_IN_PROGRESS_UI for save: "${saveName}".`
      );
      await this.#safeEventDispatcher.dispatch(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Saving...',
          inputDisabledMessage: `Saving game "${saveName}"...`,
        }
      );

      // Pass this.#activeWorld to gamePersistenceService.saveGame
      saveResult = await this.#gamePersistenceService.saveGame(
        saveName,
        this.#isEngineInitialized,
        this.#activeWorld
      );

      if (saveResult.success) {
        const successMsg = `Game "${saveName}" saved successfully.`;
        this.#logger.info(
          `GameEngine.triggerManualSave: Save successful. Name: "${saveName}", Path: ${saveResult.filePath || 'N/A'}`
        );

        await this.#safeEventDispatcher.dispatch(GAME_SAVED_ID, {
          saveName: saveName,
          path: saveResult.filePath,
          type: 'manual',
        });
        this.#logger.info(
          `GameEngine.triggerManualSave: Dispatched GAME_SAVED_ID for "${saveName}".`
        );

        await this.#safeEventDispatcher.dispatch(
          ENGINE_MESSAGE_DISPLAY_REQUESTED,
          {
            message: successMsg,
            type: 'info',
          }
        );
        this.#logger.info(
          `GameEngine.triggerManualSave: Dispatched ENGINE_MESSAGE_DISPLAY_REQUESTED (info) for "${saveName}".`
        );
      } else {
        const errorMsg = `Manual save failed for "${saveName}". Error: ${saveResult.error || 'Unknown error'}`;
        this.#logger.error(
          `GameEngine.triggerManualSave: Save failed. Name: "${saveName}". Reported error: ${saveResult.error}`
        );
        await this.#safeEventDispatcher.dispatch(
          ENGINE_MESSAGE_DISPLAY_REQUESTED,
          {
            message: errorMsg,
            type: 'error',
          }
        );
        this.#logger.info(
          `GameEngine.triggerManualSave: Dispatched ENGINE_MESSAGE_DISPLAY_REQUESTED (error) for "${saveName}".`
        );
      }
    } catch (error) {
      const caughtErrorMsg =
        error instanceof Error ? error.message : String(error);
      this.#logger.error(
        `GameEngine.triggerManualSave: Unexpected error during save operation for "${saveName}". Error: ${caughtErrorMsg}`,
        error
      );

      saveResult = {
        success: false,
        error: `Unexpected error during save: ${caughtErrorMsg}`,
      };

      await this.#safeEventDispatcher.dispatch(
        ENGINE_MESSAGE_DISPLAY_REQUESTED,
        {
          message: `Save operation encountered an unexpected error for "${saveName}": ${caughtErrorMsg}`,
          type: 'error',
        }
      );
      this.#logger.info(
        `GameEngine.triggerManualSave: Dispatched ENGINE_MESSAGE_DISPLAY_REQUESTED (critical error) for "${saveName}".`
      );
    } finally {
      this.#logger.info(
        `GameEngine.triggerManualSave: Dispatching ENGINE_READY_UI after save attempt for "${saveName}".`
      );
      await this.#safeEventDispatcher.dispatch(ENGINE_READY_UI, {
        activeWorld: this.#activeWorld,
        message: 'Save operation finished. Ready.',
      });
    }
    return saveResult;
  }

  /**
   * Prepares the game engine for loading a game session.
   * This helper encapsulates preliminary steps such as stopping any current game,
   * resetting core game state, and dispatching a UI event to indicate the load
   * operation is in progress.
   *
   * @private
   * @async
   * @param {string} saveIdentifier - The identifier for the save game to be loaded.
   * @returns {Promise<void>} A promise that resolves when the preparation steps are complete.
   * @memberof GameEngine
   */
  async _prepareForLoadGameSession(saveIdentifier) {
    this.#logger.info(
      `GameEngine._prepareForLoadGameSession: Preparing to load game from identifier: ${saveIdentifier}`
    );

    if (this.#isEngineInitialized || this.#isGameLoopRunning) {
      await this.stop();
    }
    await this._resetCoreGameState();

    this.#logger.info(
      'GameEngine._prepareForLoadGameSession: Dispatching UI event for load operation in progress.'
    );
    const shortSaveName = saveIdentifier.split(/[/\\]/).pop() || saveIdentifier;
    await this.#safeEventDispatcher.dispatch(ENGINE_OPERATION_IN_PROGRESS_UI, {
      titleMessage: `Loading ${shortSaveName}...`,
      inputDisabledMessage: `Loading game from ${shortSaveName}...`,
    });
  }

  /**
   * Calls the IGamePersistenceService to load and restore game data.
   * This method encapsulates the direct interaction with the persistence service for loading.
   *
   * @private
   * @async
   * @param {string} saveIdentifier - The identifier for the save game to load.
   * @returns {Promise<LoadAndRestoreResult>} The outcome of the load and restore operation from the persistence service.
   * @memberof GameEngine
   */
  async _executeLoadAndRestore(saveIdentifier) {
    this.#logger.info(
      `GameEngine._executeLoadAndRestore: Calling IGamePersistenceService.loadAndRestoreGame for "${saveIdentifier}"...`
    );
    const restoreOutcome =
      await this.#gamePersistenceService.loadAndRestoreGame(saveIdentifier);
    this.#logger.info(
      `GameEngine._executeLoadAndRestore: Load and restore call completed for "${saveIdentifier}". Success: ${restoreOutcome.success}`
    );
    return restoreOutcome;
  }

  /**
   * Finalizes the setup for a loaded game after successful data restoration.
   * This includes setting engine state, updating active world, starting playtime
   * and turn manager, and dispatching relevant game and UI events.
   *
   * @private
   * @async
   * @param {SaveGameStructure} loadedSaveData - The successfully restored save game data.
   * @param {string} saveIdentifier - The identifier from which the game was loaded.
   * @returns {Promise<{success: true, data: SaveGameStructure}>} A promise that resolves with a success structure
   * containing the loaded save data.
   * @memberof GameEngine
   */
  async _finalizeLoadSuccess(loadedSaveData, saveIdentifier) {
    this.#logger.info(
      `GameEngine._finalizeLoadSuccess: Game state restored successfully from ${saveIdentifier}. Finalizing load setup.`
    );

    this.#activeWorld = loadedSaveData.metadata?.gameTitle || 'Restored Game';
    this.#isEngineInitialized = true;
    this.#isGameLoopRunning = true;

    if (this.#playtimeTracker) {
      this.#playtimeTracker.startSession();
    } else {
      this.#logger.warn(
        'GameEngine._finalizeLoadSuccess: PlaytimeTracker not available, cannot start session for loaded game.'
      );
    }

    await this.#safeEventDispatcher.dispatch(GAME_LOADED_ID, {
      saveIdentifier,
    });
    await this.#safeEventDispatcher.dispatch(LOADED_GAME_STARTED_ID, {
      saveIdentifier,
      worldName: this.#activeWorld,
    });

    this.#logger.info(
      'GameEngine._finalizeLoadSuccess: Dispatching UI event for game ready (after load).'
    );
    await this.#safeEventDispatcher.dispatch(ENGINE_READY_UI, {
      activeWorld: this.#activeWorld,
      message: 'Enter command...',
    });

    this.#logger.info(
      'GameEngine._finalizeLoadSuccess: Starting TurnManager for loaded game...'
    );
    if (this.#turnManager) {
      await this.#turnManager.start();
    } else {
      this.#logger.error(
        'GameEngine._finalizeLoadSuccess: TurnManager not available. Loaded game may not function correctly.'
      );
      throw new Error(
        'GameEngine critical error: TurnManager service is unavailable during loaded game finalization.'
      );
    }

    this.#logger.info(
      `GameEngine._finalizeLoadSuccess: Game loaded from "${saveIdentifier}" (World: ${this.#activeWorld}) and resumed.`
    );
    return { success: true, data: loadedSaveData };
  }

  /**
   * Centralizes the actions taken when a game load attempt fails.
   * This includes logging the error, dispatching a UI failure event,
   * resetting engine state flags, and preparing the standard failure response object.
   *
   * @private
   * @async
   * @param {string | Error} errorInfo - The error message string or Error object.
   * @param {string} saveIdentifier - The identifier for the save game that failed to load.
   * @returns {Promise<{success: false, error: string, data: null}>} The standard failure response object.
   * @memberof GameEngine
   */
  async _handleLoadFailure(errorInfo, saveIdentifier) {
    const errorMessageString =
      errorInfo instanceof Error ? errorInfo.message : String(errorInfo);

    this.#logger.error(
      `GameEngine._handleLoadFailure: Handling game load failure for identifier "${saveIdentifier}". Error: ${errorMessageString}`,
      errorInfo instanceof Error ? errorInfo : undefined
    );

    this.#logger.info(
      'GameEngine._handleLoadFailure: Dispatching UI event for operation failed (load).'
    );
    if (this.#safeEventDispatcher) {
      await this.#safeEventDispatcher.dispatch(ENGINE_OPERATION_FAILED_UI, {
        errorMessage: `Failed to load game: ${errorMessageString}`,
        errorTitle: 'Load Failed',
      });
    } else {
      this.#logger.error(
        'GameEngine._handleLoadFailure: ISafeEventDispatcher not available, cannot dispatch UI failure event.'
      );
    }

    this.#isEngineInitialized = false;
    this.#isGameLoopRunning = false;
    this.#activeWorld = null;

    return { success: false, error: errorMessageString, data: null };
  }

  /**
   * Orchestrates loading a game from a save identifier.
   * It coordinates helper methods to prepare for loading, execute the load operation,
   * finalize success, or handle failures consistently.
   *
   * @async
   * @param {string} saveIdentifier - The identifier for the save game to load.
   * @returns {Promise<{success: boolean, error?: string, data?: SaveGameStructure | null}>}
   * A promise that resolves with an object indicating success or failure.
   * On success, `data` contains the loaded game data.
   * On failure, `error` contains the error message.
   * @memberof GameEngine
   */
  async loadGame(saveIdentifier) {
    this.#logger.info(
      `GameEngine: loadGame called for identifier: ${saveIdentifier}`
    );

    if (!this.#gamePersistenceService) {
      const errorMsg =
        'GamePersistenceService is not available. Cannot load game.';
      this.#logger.error(`GameEngine.loadGame: ${errorMsg}`);
      await this.#safeEventDispatcher.dispatch(ENGINE_OPERATION_FAILED_UI, {
        errorMessage: errorMsg,
        errorTitle: 'Load Failed',
      });
      this.#isEngineInitialized = false;
      this.#isGameLoopRunning = false;
      this.#activeWorld = null;
      return { success: false, error: errorMsg, data: null };
    }

    try {
      await this._prepareForLoadGameSession(saveIdentifier);
      const restoreOutcome = await this._executeLoadAndRestore(saveIdentifier);

      if (restoreOutcome.success && restoreOutcome.data) {
        const loadedSaveData = /** @type {SaveGameStructure} */ (
          restoreOutcome.data
        );
        return await this._finalizeLoadSuccess(loadedSaveData, saveIdentifier);
      } else {
        const loadError =
          restoreOutcome.error ||
          'Restored data was missing or load operation failed.';
        this.#logger.warn(
          `GameEngine: Load/restore operation reported failure for "${saveIdentifier}".`
        );
        return await this._handleLoadFailure(loadError, saveIdentifier);
      }
    } catch (error) {
      const caughtError =
        error instanceof Error ? error : new Error(String(error));
      this.#logger.error(
        `GameEngine: Overall catch in loadGame for identifier "${saveIdentifier}". Error: ${caughtError.message || String(caughtError)}`,
        caughtError
      );
      return await this._handleLoadFailure(caughtError, saveIdentifier);
    }
  }

  /**
   * Requests the display of the save game UI.
   * This method is synchronous and dispatches events to request UI actions.
   * It checks for the availability of the GamePersistenceService and whether saving is currently allowed.
   *
   * @memberof GameEngine
   * @fires ENGINE_MESSAGE_DISPLAY_REQUESTED - If GamePersistenceService is unavailable.
   * @fires REQUEST_SHOW_SAVE_GAME_UI - If saving is allowed.
   * @fires CANNOT_SAVE_GAME_INFO - If saving is not currently allowed.
   */
  showSaveGameUI() {
    if (!this.#gamePersistenceService) {
      this.#logger.error(
        'GameEngine.showSaveGameUI: GamePersistenceService is unavailable. Cannot show Save Game UI.'
      );
      this.#safeEventDispatcher.dispatch(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
        message:
          'Cannot open save menu: GamePersistenceService is unavailable.',
        type: 'error',
      });
      return;
    }

    if (
      this.#gamePersistenceService.isSavingAllowed(this.#isEngineInitialized)
    ) {
      this.#logger.info(
        'GameEngine.showSaveGameUI: Dispatching request to show Save Game UI.'
      );
      // --- FIX START ---
      // Provide an empty object as the payload to satisfy the schema.
      this.#safeEventDispatcher.dispatch(REQUEST_SHOW_SAVE_GAME_UI, {});
      // --- FIX END ---
    } else {
      this.#logger.warn(
        'GameEngine.showSaveGameUI: Saving is not currently allowed.'
      );
      // As per ticket: "Dispatch the CANNOT_SAVE_GAME_INFO event (or ENGINE_MESSAGE_DISPLAY_REQUESTED with the specific message: "Cannot save at this moment...")."
      // Sticking with CANNOT_SAVE_GAME_INFO as it's more specific.
      this.#safeEventDispatcher.dispatch(CANNOT_SAVE_GAME_INFO); // Assuming CANNOT_SAVE_GAME_INFO also expects an empty payload or handles undefined gracefully. If it also has a schema requiring an object, it should also be {}.
    }
  }

  /**
   * Requests the display of the load game UI.
   * This method is synchronous and dispatches an event to request the UI action.
   * It also checks for the availability of the GamePersistenceService.
   *
   * @memberof GameEngine
   * @fires ENGINE_MESSAGE_DISPLAY_REQUESTED - If GamePersistenceService is unavailable.
   * @fires REQUEST_SHOW_LOAD_GAME_UI - To request the load game UI.
   */
  showLoadGameUI() {
    if (!this.#gamePersistenceService) {
      this.#logger.error(
        'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.'
      );
      this.#safeEventDispatcher.dispatch(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
        message:
          'Cannot open load menu: GamePersistenceService is unavailable.',
        type: 'error',
      });
      return;
    }
    this.#logger.info(
      'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
    );
    this.#safeEventDispatcher.dispatch(REQUEST_SHOW_LOAD_GAME_UI, {});
  }

  getEngineStatus() {
    return {
      isInitialized: this.#isEngineInitialized,
      isLoopRunning: this.#isGameLoopRunning,
      activeWorld: this.#activeWorld,
    };
  }
}

export default GameEngine;
