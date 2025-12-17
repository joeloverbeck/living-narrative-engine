// src/engine/gameEngine.js

import { tokens } from '../dependencyInjection/tokens.js';
import {
  ENGINE_INITIALIZING_UI,
  ENGINE_STOPPED_UI,
  UI_SHOW_LLM_PROMPT_PREVIEW,
} from '../constants/eventIds.js';
import {
  processOperationFailure,
  getReadableErrorMessage,
} from '../utils/engineErrorUtils.js';
import { assertNonBlankString } from '../utils/dependencyUtils.js';
import createSafeErrorLogger from '../utils/safeErrorLogger.js';
import EngineState from './engineState.js';
import GameSessionManager from './gameSessionManager.js';

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../interfaces/IPlaytimeTracker.js').IPlaytimeTracker} IPlaytimeTracker */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/IInitializationService.js').IInitializationService} IInitializationService */
/** @typedef {import('../interfaces/IInitializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('../turns/pipeline/turnActionChoicePipeline.js').TurnActionChoicePipeline} TurnActionChoicePipeline */
/** @typedef {import('../prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline */
/** @typedef {import('../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../entities/entityDisplayDataProvider.js').EntityDisplayDataProvider} EntityDisplayDataProvider */

class GameEngine {
  /** @type {ILogger} */
  #logger;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ITurnManager} */
  #turnManager;
  /** @type {IPlaytimeTracker} */
  #playtimeTracker;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {IInitializationService} */
  #initializationService;
  /** @type {TurnActionChoicePipeline} */
  #turnActionChoicePipeline;
  /** @type {IAIPromptPipeline} */
  #aiPromptPipeline;
  /** @type {ILLMAdapter} */
  #llmAdapter;
  /** @type {EntityDisplayDataProvider} */
  #entityDisplayDataProvider;

  /** @type {EngineState} */
  #engineState;
  /** @type {GameSessionManager} */
  #sessionManager;

  /**
   * Creates a new GameEngine instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {AppContainer} deps.container - DI container instance.
   * @param {ILogger} deps.logger - Logger for engine events.
   * @param {GameSessionManager} [deps.sessionManager] - Optional session manager.
   */
  constructor({ container, logger, sessionManager = null }) {
    if (!logger) {
      throw new Error('GameEngine requires a logger.');
    }
    this.#logger = logger;
    this.#logger.debug('GameEngine: Constructor called.');
    try {
      this.#entityManager = container.resolve(tokens.IEntityManager);
      this.#turnManager = container.resolve(tokens.ITurnManager);
      this.#playtimeTracker = /** @type {IPlaytimeTracker} */ (
        container.resolve(tokens.PlaytimeTracker)
      );
      this.#safeEventDispatcher = container.resolve(
        tokens.ISafeEventDispatcher
      );
      this.#initializationService = /** @type {IInitializationService} */ (
        container.resolve(tokens.IInitializationService)
      );
      this.#turnActionChoicePipeline = container.resolve(
        tokens.TurnActionChoicePipeline
      );
      this.#aiPromptPipeline = /** @type {IAIPromptPipeline} */ (
        container.resolve(tokens.IAIPromptPipeline)
      );
      this.#llmAdapter = /** @type {ILLMAdapter} */ (
        container.resolve(tokens.LLMAdapter)
      );
      this.#entityDisplayDataProvider = container.resolve(
        tokens.EntityDisplayDataProvider
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
            resetCoreGameStateFn: this.#resetCoreGameState.bind(this),
            startEngineFn: this.#startEngine.bind(this),
            anatomyInitializationService:
              container.isRegistered &&
              container.isRegistered(tokens.AnatomyInitializationService)
                ? container.resolve(tokens.AnatomyInitializationService)
                : null,
          }));
  }

  #resetCoreGameState() {
    /** @type {Error | null} */
    let entityResetError = null;
    /** @type {Error | null} */
    let playtimeResetError = null;

    if (this.#entityManager) {
      try {
        this.#entityManager.clearAll();
      } catch (error) {
        entityResetError =
          error instanceof Error ? error : new Error(String(error));
        this.#logger.error(
          'GameEngine._resetCoreGameState: Failed to clear EntityManager.',
          entityResetError
        );
      }
    } else {
      this.#logger.warn(
        'GameEngine._resetCoreGameState: EntityManager not available.'
      );
    }

    if (this.#playtimeTracker) {
      try {
        this.#playtimeTracker.reset();
      } catch (error) {
        playtimeResetError =
          error instanceof Error ? error : new Error(String(error));
        this.#logger.error(
          'GameEngine._resetCoreGameState: Failed to reset PlaytimeTracker.',
          playtimeResetError
        );
      }
    } else {
      this.#logger.warn(
        'GameEngine._resetCoreGameState: PlaytimeTracker not available.'
      );
    }

    if (entityResetError || playtimeResetError) {
      if (
        entityResetError &&
        playtimeResetError &&
        entityResetError !== playtimeResetError
      ) {
        try {
          if (!('cause' in entityResetError) || !entityResetError.cause) {
            entityResetError.cause = playtimeResetError;
          } else if (Array.isArray(entityResetError.resetErrors)) {
            entityResetError.resetErrors.push(playtimeResetError);
          } else {
            entityResetError.resetErrors = [playtimeResetError];
          }
        } catch {
          entityResetError.resetErrors = [playtimeResetError];
        }
      }

      throw entityResetError || playtimeResetError;
    }

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

  async #executeInitializationSequence(worldName) {
    this.#logger.debug(
      'GameEngine._executeInitializationSequence: Dispatching UI event for initialization start.'
    );
    try {
      const dispatched = await this.#safeEventDispatcher.dispatch(
        ENGINE_INITIALIZING_UI,
        { worldName },
        { allowSchemaNotFound: true }
      );

      if (dispatched === false) {
        this.#logger.warn(
          'GameEngine._executeInitializationSequence: SafeEventDispatcher reported failure when dispatching ENGINE_INITIALIZING_UI.'
        );
      }
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.#logger.error(
        'GameEngine._executeInitializationSequence: SafeEventDispatcher threw when dispatching ENGINE_INITIALIZING_UI.',
        normalizedError
      );
    }

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

    const reportedSuccess =
      initResult && typeof initResult === 'object' && 'success' in initResult
        ? /** @type {{ success: unknown }} */ (initResult).success
        : 'unknown';
    this.#logger.debug(
      `GameEngine._executeInitializationSequence: Initialization sequence completed for "${worldName}". Success: ${reportedSuccess}`
    );
    return initResult;
  }

  /**
   * Normalizes initialization results returned by the initialization service.
   *
   * @private
   * @param {unknown} initResult - Result returned by the initialization service.
   * @param {string} worldName - Name of the world being initialized.
   * @returns {InitializationResult} A validated initialization result structure.
   */
  #normalizeInitializationResult(initResult, worldName) {
    if (
      !initResult ||
      typeof initResult !== 'object' ||
      typeof (/** @type {{ success?: unknown }} */ (initResult).success) !==
        'boolean'
    ) {
      const receivedType = initResult === null ? 'null' : typeof initResult;
      this.#logger.error(
        `GameEngine.startNewGame: InitializationService returned invalid result for "${worldName}".`,
        {
          receivedType,
          receivedValue: initResult,
        }
      );

      const failureError = new Error(
        'InitializationService returned an invalid result.'
      );

      try {
        // Preserve the unexpected value for debuggers supporting Error.cause.
        failureError.cause = initResult;
      } catch {
        failureError.originalResult = initResult;
      }

      return {
        success: false,
        error: failureError,
      };
    }

    return /** @type {InitializationResult} */ (initResult);
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
  async #processOperationFailure(
    contextMessage,
    error,
    title,
    userPrefix,
    returnResult = false
  ) {
    const resetState = () => {
      /** @type {unknown} */
      let coreResetError;
      try {
        this.#resetCoreGameState();
      } catch (error) {
        coreResetError = error;
      }

      /** @type {unknown} */
      let engineResetError;
      try {
        this.#resetEngineState();
      } catch (error) {
        engineResetError = error;
      }

      if (coreResetError) {
        if (
          engineResetError &&
          coreResetError instanceof Error &&
          !('engineResetError' in coreResetError)
        ) {
          try {
            if (!('cause' in coreResetError) || !coreResetError.cause) {
              coreResetError.cause = engineResetError;
            } else {
              coreResetError.engineResetError = engineResetError;
            }
          } catch {
            coreResetError.engineResetError = engineResetError;
          }
        }
        throw coreResetError;
      }

      if (engineResetError) {
        throw engineResetError;
      }
    };
    return processOperationFailure(
      this.#logger,
      this.#safeEventDispatcher,
      contextMessage,
      error,
      title,
      userPrefix,
      resetState,
      returnResult
    );
  }

  async #handleNewGameFailure(error, worldName) {
    await this.#processOperationFailure(
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
  #validateWorldName(worldName) {
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
  async #initializeNewGame(worldName) {
    await this.#sessionManager.prepareForNewGameSession(worldName);
    this.#resetCoreGameState();
    const initResult = await this.#executeInitializationSequence(worldName);
    return this.#normalizeInitializationResult(initResult, worldName);
  }

  /**
   * Finalizes a successful initialization run.
   *
   * @private
   * @param {string} worldName - Name of the world being started.
   * @returns {Promise<void>} Resolves when finalized.
   */
  async #finalizeInitializationSuccess(worldName) {
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
  async #handleInitializationError(error, initError, worldName) {
    const caughtError =
      error instanceof Error ? error : new Error(String(error));
    this.#logger.error(
      `GameEngine: Overall catch in startNewGame for world "${worldName}". Error: ${caughtError.message || String(caughtError)}`,
      caughtError
    );
    if (caughtError !== initError) {
      await this.#handleNewGameFailure(caughtError, worldName);
    }
    throw caughtError;
  }

  async startNewGame(worldName) {
    this.#validateWorldName(worldName);
    const normalizedWorldName = worldName.trim();
    this.#logger.debug(
      `GameEngine: startNewGame called for world "${normalizedWorldName}".`
    );

    // Create safe error logger with SafeEventDispatcher batch mode management
    const safeErrorLogger = createSafeErrorLogger({
      logger: this.#logger,
      safeEventDispatcher: this.#safeEventDispatcher,
    });

    // Use game loading mode to handle legitimate bulk events during initialization
    return await safeErrorLogger.withGameLoadingMode(
      async () => {
        let initError = null;

        try {
          const initResult = await this.#initializeNewGame(normalizedWorldName);

          if (initResult.success) {
            await this.#finalizeInitializationSuccess(normalizedWorldName);
            return initResult;
          }

          const rawInitError = initResult.error;
          if (rawInitError instanceof Error) {
            initError = rawInitError;
          } else {
            const readableMessage = getReadableErrorMessage(rawInitError);
            const normalizedMessage =
              readableMessage === 'Unknown error.'
                ? 'Unknown failure from InitializationService.'
                : readableMessage;

            initError = new Error(normalizedMessage);

            if (rawInitError !== undefined) {
              try {
                initError.cause = rawInitError;
              } catch {
                initError.originalError = rawInitError;
              }
            }
          }
          this.#logger.warn(
            `GameEngine: InitializationService reported failure for "${normalizedWorldName}".`
          );
          await this.#handleNewGameFailure(initError, normalizedWorldName);
          throw initError;
        } catch (error) {
          await this.#handleInitializationError(
            error,
            initError,
            normalizedWorldName
          );
        }
      },
      {
        context: 'game-initialization',
        timeoutMs: 60000, // 1 minute timeout for game loading
      }
    );
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

    let caughtError = null;

    if (this.#playtimeTracker) {
      try {
        this.#playtimeTracker.endSessionAndAccumulate();
        this.#logger.debug('GameEngine.stop: Playtime session ended.');
      } catch (trackerError) {
        const normalizedTrackerError =
          trackerError instanceof Error
            ? trackerError
            : new Error(String(trackerError));
        this.#logger.error(
          'GameEngine.stop: Failed to end playtime session cleanly.',
          normalizedTrackerError
        );
        caughtError = normalizedTrackerError;
      }
    } else {
      this.#logger.warn(
        'GameEngine.stop: PlaytimeTracker service not available, cannot end session.'
      );
    }

    let stopEventResult;
    try {
      stopEventResult = await this.#safeEventDispatcher.dispatch(
        ENGINE_STOPPED_UI,
        {
          inputDisabledMessage: 'Game stopped. Engine is inactive.',
        }
      );
      this.#logger.debug(
        'GameEngine.stop: ENGINE_STOPPED_UI event dispatched.'
      );
      if (stopEventResult === false) {
        this.#logger.warn(
          'GameEngine.stop: SafeEventDispatcher reported failure when dispatching ENGINE_STOPPED_UI event.'
        );
      }
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      if (!caughtError) {
        caughtError = normalizedError;
      }
      this.#logger.error(
        'GameEngine.stop: Encountered error while stopping engine. Engine state will be reset.',
        normalizedError
      );
    }

    let cleanupFailed = false;

    try {
      if (this.#turnManager) {
        await this.#turnManager.stop();
        this.#logger.debug('GameEngine.stop: TurnManager stopped.');
      } else {
        this.#logger.warn(
          'GameEngine.stop: TurnManager service not available, cannot stop.'
        );
      }
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      if (!caughtError) {
        caughtError = normalizedError;
      }
      this.#logger.error(
        'GameEngine.stop: Encountered error while stopping engine. Engine state will be reset.',
        normalizedError
      );
    } finally {
      const attachCleanupError = (cleanupError) => {
        cleanupFailed = true;
        if (!caughtError) {
          caughtError = cleanupError;
          return;
        }
        if (caughtError instanceof Error && cleanupError !== caughtError) {
          try {
            if (!('cleanupErrors' in caughtError)) {
              caughtError.cleanupErrors = [];
            }
            if (Array.isArray(caughtError.cleanupErrors)) {
              caughtError.cleanupErrors.push(cleanupError);
            }
          } catch {
            // If augmenting the original error fails, fall back to setting the cleanup error directly.
            caughtError.cleanupErrors = [cleanupError];
          }
        }
      };

      try {
        this.#resetCoreGameState();
        this.#logger.debug(
          'GameEngine.stop: Core game state cleared after stop.'
        );
      } catch (resetError) {
        const normalizedResetError =
          resetError instanceof Error
            ? resetError
            : new Error(String(resetError));
        this.#logger.error(
          'GameEngine.stop: Failed to reset core game state cleanly.',
          normalizedResetError
        );
        attachCleanupError(normalizedResetError);
      }

      try {
        this.#resetEngineState();
        if (cleanupFailed) {
          this.#logger.warn(
            'GameEngine.stop: Engine state reset completed with cleanup errors.'
          );
        } else {
          this.#logger.debug(
            'GameEngine.stop: Engine fully stopped and state reset.'
          );
        }
      } catch (engineResetError) {
        const normalizedEngineResetError =
          engineResetError instanceof Error
            ? engineResetError
            : new Error(String(engineResetError));
        this.#logger.error(
          'GameEngine.stop: Failed to reset engine state cleanly.',
          normalizedEngineResetError
        );
        attachCleanupError(normalizedEngineResetError);
      }
    }

    if (caughtError) {
      throw caughtError;
    }
  }

  /**
   * Builds and dispatches an LLM prompt preview event for the current actor.
   * Does not trigger turn advancement or LLM network calls.
   *
   * @returns {Promise<void>}
   */
  async previewLlmPromptForCurrentActor() {
    const errors = [];
    const handler = this.#turnManager?.getActiveTurnHandler?.();
    const turnContext = handler?.getTurnContext?.() ?? null;
    const actor = this.#turnManager?.getCurrentActor?.() ?? null;

    const timestamp = new Date().toISOString();

    if (!turnContext || !actor) {
      await this.#dispatchPromptPreview({
        prompt: null,
        actorId: null,
        actorName: null,
        llmId: null,
        actionCount: 0,
        timestamp,
        errors: ['No active turn context'],
      });
      return;
    }

    const actorId = actor.id;
    const actorName =
      this.#entityDisplayDataProvider?.getEntityName?.(actorId, actorId) ||
      actorId;

    /** @type {import('../turns/dtos/actionComposite.js').ActionComposite[]} */
    let availableActions = [];
    let prompt = null;
    let llmId = null;

    try {
      availableActions = await this.#turnActionChoicePipeline.buildChoices(
        actor,
        turnContext
      );
      llmId = await this.#llmAdapter.getCurrentActiveLlmId();
      prompt = await this.#aiPromptPipeline.generatePrompt(
        actor,
        turnContext,
        availableActions
      );
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      errors.push(normalizedError.message || String(normalizedError));

      if (!llmId && this.#llmAdapter?.getCurrentActiveLlmId) {
        try {
          llmId = await this.#llmAdapter.getCurrentActiveLlmId();
        } catch (llmIdError) {
          const normalizedLlmIdError =
            llmIdError instanceof Error
              ? llmIdError
              : new Error(String(llmIdError));
          errors.push(
            normalizedLlmIdError.message || String(normalizedLlmIdError)
          );
        }
      }
    }

    await this.#dispatchPromptPreview({
      prompt,
      actorId,
      actorName,
      llmId,
      actionCount: Array.isArray(availableActions)
        ? availableActions.length
        : 0,
      timestamp,
      errors,
    });
  }

  async #dispatchPromptPreview(payload) {
    try {
      const dispatched = await this.#safeEventDispatcher.dispatch(
        UI_SHOW_LLM_PROMPT_PREVIEW,
        payload,
        { allowSchemaNotFound: true }
      );
      if (dispatched === false) {
        this.#logger.warn(
          'GameEngine.previewLlmPromptForCurrentActor: SafeEventDispatcher reported failure when dispatching UI_SHOW_LLM_PROMPT_PREVIEW.'
        );
      }
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.#logger.error(
        'GameEngine.previewLlmPromptForCurrentActor: SafeEventDispatcher threw while dispatching UI_SHOW_LLM_PROMPT_PREVIEW.',
        normalizedError
      );
    }
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
