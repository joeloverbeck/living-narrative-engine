// src/engine/gameSessionManager.js

import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
} from '../constants/eventIds.js';
import { extractSaveName } from '../utils/savePathUtils.js';

/**
 * @typedef {import('./engineState.js').default} EngineState
 * @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager
 * @typedef {import('../interfaces/IPlaytimeTracker.js').IPlaytimeTracker} IPlaytimeTracker
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure
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
  /** @type {(worldName: string) => void} */
  #startEngineFn;
  /** @type {import('../anatomy/anatomyInitializationService.js').AnatomyInitializationService} */
  #anatomyInitializationService;

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
   * @param {(worldName: string) => void} deps.startEngineFn - Function to set engine state started.
   * @param {import('../anatomy/anatomyInitializationService.js').AnatomyInitializationService} deps.anatomyInitializationService - Anatomy initialization service.
   */
  constructor({
    logger,
    turnManager,
    playtimeTracker,
    safeEventDispatcher,
    engineState,
    stopFn,
    resetCoreGameStateFn,
    startEngineFn,
    anatomyInitializationService,
  }) {
    this.#logger = logger;
    this.#turnManager = turnManager;
    this.#playtimeTracker = playtimeTracker;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#state = engineState;
    this.#stopFn = stopFn;
    this.#resetCoreGameStateFn = resetCoreGameStateFn;
    this.#startEngineFn = startEngineFn;
    this.#anatomyInitializationService = anatomyInitializationService;
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
  async #prepareEngineForOperation(uiEventId, payload) {
    let failure = null;

    if (this.#state.isInitialized || this.#state.isGameLoopRunning) {
      try {
        await this.#stopFn();
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        this.#logger.error(
          'GameSessionManager._prepareEngineForOperation: stopFn threw while stopping current session.',
          normalizedError
        );
        failure = normalizedError;
      }
    }

    try {
      await this.#resetCoreGameStateFn();
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.#logger.error(
        'GameSessionManager._prepareEngineForOperation: resetCoreGameStateFn threw while clearing core state.',
        normalizedError
      );
      if (!failure) {
        failure = normalizedError;
      }
    }

    if (failure) {
      throw failure;
    }

    if (uiEventId) {
      this.#logger.debug(
        'GameSessionManager._prepareEngineForOperation: Dispatching UI event.'
      );
      try {
        const dispatchSuccessful = await this.#safeEventDispatcher.dispatch(
          uiEventId,
          payload
        );
        if (!dispatchSuccessful) {
          this.#logger.warn(
            `GameSessionManager._prepareEngineForOperation: SafeEventDispatcher reported failure when dispatching ${uiEventId}.`
          );
        }
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        this.#logger.error(
          `GameSessionManager._prepareEngineForOperation: SafeEventDispatcher threw when dispatching ${uiEventId}. Error: ${normalizedError.message}`,
          normalizedError
        );
      }
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
    await this.#prepareEngineForOperation(null);

    this.#state.setActiveWorld(worldName);
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
  async #finalizeGameStart(worldName) {
    let playSessionStarted = false;

    try {
      this.#startEngineFn(worldName);

      if (this.#playtimeTracker) {
        this.#playtimeTracker.startSession();
        playSessionStarted = true;
      } else {
        this.#logger.warn(
          'GameSessionManager._finalizeGameStart: PlaytimeTracker not available, cannot start session.'
        );
      }

      this.#logger.debug(
        'GameSessionManager._finalizeGameStart: Dispatching UI event for game ready.'
      );
      const readyDispatched = await this.#safeEventDispatcher.dispatch(
        ENGINE_READY_UI,
        {
          activeWorld: worldName,
          message: 'Enter command...',
        }
      );

      if (!readyDispatched) {
        this.#logger.warn(
          'GameSessionManager._finalizeGameStart: SafeEventDispatcher reported failure when dispatching ENGINE_READY_UI.'
        );
      }

      // Wait for anatomy generation to complete before starting turns
      if (this.#anatomyInitializationService) {
        const pendingCount =
          this.#anatomyInitializationService.getPendingGenerationCount();
        if (pendingCount > 0) {
          this.#logger.info(
            `GameSessionManager._finalizeGameStart: Waiting for ${pendingCount} anatomy generations to complete before starting turns...`
          );
          try {
            await this.#anatomyInitializationService.waitForAllGenerationsToComplete(
              15000
            ); // 15 second timeout
            this.#logger.info(
              'GameSessionManager._finalizeGameStart: Anatomy generation completed, starting turns.'
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message || 'Unknown error.'
                : typeof error === 'string'
                  ? error.trim() || 'Unknown error.'
                  : error !== undefined && error !== null
                    ? String(error)
                    : 'Unknown error.';

            this.#logger.warn(
              'GameSessionManager._finalizeGameStart: Anatomy generation did not complete in time, starting turns anyway.',
              { error: errorMessage, pendingCount }
            );
          }
        } else {
          this.#logger.debug(
            'GameSessionManager._finalizeGameStart: No pending anatomy generations detected.'
          );
        }
      } else {
        this.#logger.warn(
          'GameSessionManager._finalizeGameStart: AnatomyInitializationService not available, cannot wait for anatomy generation.'
        );
      }

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
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      if (this.#playtimeTracker && playSessionStarted) {
        try {
          this.#playtimeTracker.endSessionAndAccumulate();
        } catch (trackerError) {
          const normalizedTrackerError =
            trackerError instanceof Error
              ? trackerError
              : new Error(String(trackerError));
          this.#logger.error(
            'GameSessionManager._finalizeGameStart: Failed to rollback playtime session after start failure.',
            normalizedTrackerError
          );
        }
      }

      if (this.#resetCoreGameStateFn) {
        try {
          await this.#resetCoreGameStateFn();
        } catch (resetError) {
          const normalizedResetError =
            resetError instanceof Error
              ? resetError
              : new Error(String(resetError));
          this.#logger.error(
            'GameSessionManager._finalizeGameStart: Failed to reset core game state after start failure.',
            normalizedResetError
          );
        }
      }

      this.#state.reset();

      throw normalizedError;
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
    await this.#finalizeGameStart(worldName);
    this.#logger.debug(
      `GameSessionManager.finalizeNewGameSuccess: New game started and ready (World: ${this.#state.activeWorld}).`
    );
  }

  /**
   * Derives a concise, user-facing save name from a raw identifier.
   *
   * @private
   * @description Strips directory segments, trailing separators and dot-only
   * path tokens so load operations display a readable save name in UI
   * messages.
   * @param {string} saveIdentifier - Identifier used to locate the save file.
   * @returns {string} Condensed save name suitable for UI messaging.
   */
  #getDisplayNameForSave(saveIdentifier) {
    const normalizedIdentifier =
      typeof saveIdentifier === 'string'
        ? saveIdentifier
        : String(saveIdentifier ?? '');

    const trimmedSegments = normalizedIdentifier
      .split(/[/\\]+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    const meaningfulSegments = trimmedSegments.filter(
      (segment) => !/^[.]+$/.test(segment)
    );

    for (let i = meaningfulSegments.length - 1; i >= 0; i -= 1) {
      const formatted = this.#normalizeSaveName(meaningfulSegments[i]);
      if (formatted) {
        return formatted;
      }
    }

    const identifierWithoutSeparators = normalizedIdentifier.replace(
      /[/\\]/g,
      ''
    );

    if (
      identifierWithoutSeparators.length > 0 &&
      !/^[.]+$/.test(identifierWithoutSeparators)
    ) {
      const fallback = this.#normalizeSaveName(identifierWithoutSeparators);
      if (fallback) {
        return fallback;
      }
    }

    return 'Saved Game';
  }

  /**
   * Converts raw identifier segments into a user-friendly save name.
   *
   * @private
   * @description Removes known manual save prefixes, trims common file
   * extensions, and replaces underscores with spaces to mirror the
   * player-provided name as closely as possible.
   * @param {string} rawName - Identifier fragment extracted from the path.
   * @returns {string} Human-readable save label or an empty string when none can be derived.
   */
  #normalizeSaveName(rawName) {
    const normalizedName =
      typeof rawName === 'string' ? rawName : String(rawName ?? '');
    const trimmedName = normalizedName.trim();
    if (!trimmedName) {
      return '';
    }

    const extracted = extractSaveName(trimmedName);
    const isManualPattern =
      extracted !== trimmedName || trimmedName.toLowerCase().endsWith('.sav');
    const candidate = isManualPattern ? extracted : trimmedName;
    const decodedCandidate = this.#decodePercentEncodedSegment(candidate);
    const withSpaces = decodedCandidate.replace(/[_]+/g, ' ').trim();

    if (withSpaces.length > 0) {
      return withSpaces;
    }

    const trimmedDecoded = decodedCandidate.trim();
    if (trimmedDecoded.length > 0) {
      return trimmedDecoded;
    }

    const fallback = this.#decodePercentEncodedSegment(candidate.trim()).trim();
    if (fallback.length > 0) {
      return fallback;
    }

    return candidate.trim();
  }

  /**
   * Normalizes the world name recovered from save metadata.
   *
   * @private
   * @description Trims whitespace and falls back to a default label when the
   * metadata does not provide a usable world name. Prefers the user-visible
   * save identifier when available so legacy saves without titles still surface
   * meaningful labels.
   * @param {SaveGameStructure} loadedSaveData - Restored save data.
   * @param {string} saveIdentifier - Identifier used to locate the save file.
   * @returns {string} Sanitized world name ready for engine state updates.
   */
  #resolveWorldNameFromSave(loadedSaveData, saveIdentifier) {
    const metadata = loadedSaveData?.metadata ?? {};

    const rawTitle =
      typeof metadata.gameTitle === 'string' ? metadata.gameTitle.trim() : '';
    if (rawTitle.length > 0) {
      return rawTitle;
    }

    const rawWorldName =
      typeof metadata.worldName === 'string' ? metadata.worldName.trim() : '';
    if (rawWorldName.length > 0) {
      return rawWorldName;
    }

    const rawSaveName =
      typeof metadata.saveName === 'string' ? metadata.saveName.trim() : '';
    if (rawSaveName.length > 0) {
      return rawSaveName;
    }

    if (
      typeof saveIdentifier === 'string' &&
      saveIdentifier.trim().length > 0
    ) {
      const fallbackName = this.#getDisplayNameForSave(saveIdentifier);
      if (fallbackName && fallbackName !== 'Saved Game') {
        return fallbackName;
      }
    }

    return 'Restored Game';
  }

  /**
   * Safely decodes percent-encoded sequences found in save identifiers.
   *
   * @private
   * @description Converts URI-encoded segments (e.g., `%20`) into readable
   * characters while preserving the original value when decoding fails.
   * @param {string} segment - Identifier fragment potentially containing percent encoding.
   * @returns {string} The decoded segment when possible, otherwise the original value.
   */
  #decodePercentEncodedSegment(segment) {
    if (segment === null || segment === undefined) {
      return '';
    }

    const value = typeof segment === 'string' ? segment : String(segment ?? '');

    if (value.length === 0) {
      return '';
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
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

    const shortSaveName = this.#getDisplayNameForSave(saveIdentifier);

    await this.#prepareEngineForOperation(ENGINE_OPERATION_IN_PROGRESS_UI, {
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

    const resolvedWorldName = this.#resolveWorldNameFromSave(
      loadedSaveData,
      saveIdentifier
    );
    this.#state.setActiveWorld(resolvedWorldName);
    await this.#finalizeGameStart(resolvedWorldName);
    this.#logger.debug(
      `GameSessionManager.finalizeLoadSuccess: Game loaded from "${saveIdentifier}" (World: ${this.#state.activeWorld}) and resumed.`
    );
    return { success: true, data: loadedSaveData };
  }
}

export default GameSessionManager;
