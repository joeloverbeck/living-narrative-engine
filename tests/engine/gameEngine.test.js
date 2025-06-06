// tests/engine/gameEngine.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import GameEngine from '../../src/engine/gameEngine.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import {
  GAME_LOADED_ID,
  GAME_SAVED_ID,
  NEW_GAME_STARTED_ID,
  LOADED_GAME_STARTED_ID,
  GAME_STOPPED_ID,
  // --- Import new UI Event IDs ---
  ENGINE_INITIALIZING_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_STOPPED_UI,
  ENGINE_MESSAGE_DISPLAY_REQUESTED,
  REQUEST_SHOW_SAVE_GAME_UI,
  REQUEST_SHOW_LOAD_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../../src/constants/eventIds.js';

// --- JSDoc Type Imports for Mocks ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../src/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../src/interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../../src/interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */
/** @typedef {import('../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../src/interfaces/IInitializationService.js').IInitializationService} IInitializationService */
/** @typedef {import('../../src/interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

describe('GameEngine', () => {
  let mockContainer;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<IEntityManager>} */
  let mockEntityManager;
  /** @type {jest.Mocked<ITurnManager>} */
  let mockTurnManager;
  /** @type {jest.Mocked<IGamePersistenceService>} */
  let mockGamePersistenceService;
  /** @type {jest.Mocked<IPlaytimeTracker>} */
  let mockPlaytimeTracker;
  /** @type {jest.Mocked<ISafeEventDispatcher>} */
  let mockSafeEventDispatcher;
  /** @type {jest.Mocked<IInitializationService>} */
  let mockInitializationService;

  let gameEngine; // Instance of GameEngine

  const MOCK_WORLD_NAME = 'TestWorld';

  const setupMockContainer = () => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };
    mockEntityManager = {
      clearAll: jest.fn(),
      getActiveEntities: jest.fn().mockReturnValue([]),
    };
    mockTurnManager = {
      start: jest.fn(),
      stop: jest.fn(),
      nextTurn: jest.fn(),
    };
    mockGamePersistenceService = {
      saveGame: jest.fn(),
      loadAndRestoreGame: jest.fn(),
      isSavingAllowed: jest.fn(),
    };
    mockPlaytimeTracker = {
      reset: jest.fn(),
      startSession: jest.fn(),
      endSessionAndAccumulate: jest.fn(),
      getAccumulatedPlaytime: jest.fn().mockReturnValue(0),
      setAccumulatedPlaytime: jest.fn(),
    };
    mockSafeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    }; // .mockResolvedValue since dispatch can be async internally
    mockInitializationService = { runInitializationSequence: jest.fn() };

    mockContainer = {
      resolve: jest.fn((token) => {
        switch (token) {
          case tokens.ILogger:
            return mockLogger;
          case tokens.IEntityManager:
            return mockEntityManager;
          case tokens.ITurnManager:
            return mockTurnManager;
          case tokens.GamePersistenceService:
            return mockGamePersistenceService;
          case tokens.PlaytimeTracker:
            return mockPlaytimeTracker;
          case tokens.ISafeEventDispatcher:
            return mockSafeEventDispatcher;
          case tokens.IInitializationService:
            return mockInitializationService;
          default:
            const tokenName =
              Object.keys(tokens).find((key) => tokens[key] === token) ||
              token?.toString();
            throw new Error(
              `GameEngine.test.js: Unmocked token: ${tokenName || 'unknown token'}`
            );
        }
      }),
    };
  };

  beforeEach(() => {
    setupMockContainer(); // Sets up all mocks fresh for each top-level test
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // gameEngine instance is created within specific describe blocks or tests if custom setup is needed
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should instantiate and resolve all core services successfully', () => {
      gameEngine = new GameEngine({ container: mockContainer }); // Instantiation for this test
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'GameEngine: Constructor called.'
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.GamePersistenceService
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.PlaytimeTracker
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'GameEngine: Core services resolved.'
      );
    });

    it('should throw an error if ILogger cannot be resolved', () => {
      jest.spyOn(mockContainer, 'resolve').mockImplementation((token) => {
        if (token === tokens.ILogger)
          throw new Error('Logger failed to resolve');
        throw new Error(
          `Unexpected token resolution attempt in ILogger failure test: ${token?.toString()}`
        );
      });

      expect(() => new GameEngine({ container: mockContainer })).toThrow(
        'GameEngine requires a logger.'
      );
      expect(console.error).toHaveBeenCalledWith(
        'GameEngine: CRITICAL - Logger not resolved.',
        expect.any(Error)
      );
    });

    it('should throw an error and log if any other core service fails to resolve', () => {
      const resolutionError = new Error('EntityManager failed to resolve');
      jest.spyOn(mockContainer, 'resolve').mockImplementation((token) => {
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IEntityManager) throw resolutionError;
        if (token === tokens.ITurnManager) return mockTurnManager;
        if (token === tokens.GamePersistenceService)
          return mockGamePersistenceService;
        if (token === tokens.PlaytimeTracker) return mockPlaytimeTracker;
        if (token === tokens.ISafeEventDispatcher)
          return mockSafeEventDispatcher;
        throw new Error(
          `GameEngine.test.js - Constructor Core Service: Unmocked token during specific failure test: ${token?.toString()}`
        );
      });

      expect(() => new GameEngine({ container: mockContainer })).toThrow(
        `GameEngine: Failed to resolve core services. ${resolutionError.message}`
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${resolutionError.message}`,
        resolutionError
      );
    });
  });

  describe('startNewGame', () => {
    beforeEach(() => {
      gameEngine = new GameEngine({ container: mockContainer }); // Standard instance for these tests
      mockInitializationService.runInitializationSequence.mockResolvedValue({
        success: true,
      });
    });

    it('should successfully start a new game', async () => {
      await gameEngine.startNewGame(MOCK_WORLD_NAME);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_INITIALIZING_UI,
        { worldName: MOCK_WORLD_NAME },
        { allowSchemaNotFound: true }
      );
      expect(mockEntityManager.clearAll).toHaveBeenCalled();
      expect(mockPlaytimeTracker.reset).toHaveBeenCalled();
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IInitializationService
      );
      expect(
        mockInitializationService.runInitializationSequence
      ).toHaveBeenCalledWith(MOCK_WORLD_NAME);
      expect(mockPlaytimeTracker.startSession).toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        NEW_GAME_STARTED_ID,
        { worldName: MOCK_WORLD_NAME }
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        {
          activeWorld: MOCK_WORLD_NAME,
          message: 'Enter command...',
        }
      );
      expect(mockTurnManager.start).toHaveBeenCalled();

      const status = gameEngine.getEngineStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.isLoopRunning).toBe(true);
      expect(status.activeWorld).toBe(MOCK_WORLD_NAME);
    });

    it('should stop an existing game if already initialized, with correct event payloads from stop()', async () => {
      mockInitializationService.runInitializationSequence.mockResolvedValueOnce(
        { success: true }
      );
      await gameEngine.startNewGame('InitialWorld');

      mockPlaytimeTracker.endSessionAndAccumulate.mockClear();
      mockTurnManager.stop.mockClear();
      mockSafeEventDispatcher.dispatch.mockClear();
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();

      mockInitializationService.runInitializationSequence.mockResolvedValueOnce(
        { success: true }
      );
      await gameEngine.startNewGame(MOCK_WORLD_NAME);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'GameEngine._prepareForNewGameSession: Engine already initialized. Stopping existing game before starting new.'
      );
      expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(
        1
      );
      expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        GAME_STOPPED_ID,
        {}
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        { inputDisabledMessage: 'Game stopped. Engine is inactive.' }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'GameEngine.stop: Stopping game engine session...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'GameEngine.stop: Engine fully stopped and state reset.'
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        {
          activeWorld: MOCK_WORLD_NAME,
          message: 'Enter command...',
        }
      );
      const status = gameEngine.getEngineStatus();
      expect(status.activeWorld).toBe(MOCK_WORLD_NAME);
    });

    it('should handle InitializationService failure', async () => {
      const initError = new Error('Initialization failed via service');
      mockInitializationService.runInitializationSequence.mockResolvedValue({
        success: false,
        error: initError,
      });

      await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(
        initError
      );

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `Failed to start new game: ${initError.message}`,
          errorTitle: 'Initialization Error',
        }
      );
      const status = gameEngine.getEngineStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.isLoopRunning).toBe(false);
      expect(status.activeWorld).toBeNull();
    });

    it('should handle general errors during start-up and dispatch failure event', async () => {
      mockInitializationService.runInitializationSequence.mockResolvedValue({
        success: true,
      });
      const startupError = new Error('TurnManager failed to start');
      mockPlaytimeTracker.startSession.mockImplementation(() => {}); // Make sure this doesn't throw
      mockTurnManager.start.mockRejectedValue(startupError); // TurnManager fails to start

      await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(
        startupError
      );

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `Failed to start new game: ${startupError.message}`, // Error from TurnManager
          errorTitle: 'Initialization Error',
        }
      );
      const status = gameEngine.getEngineStatus();
      expect(status.isInitialized).toBe(false); // Should be reset by _handleNewGameFailure
      expect(status.isLoopRunning).toBe(false);
      expect(status.activeWorld).toBeNull();
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      // Ensure gameEngine is fresh for each 'stop' test
      gameEngine = new GameEngine({ container: mockContainer });
    });

    it('should successfully stop a running game, with correct logging, events, and state changes', async () => {
      mockInitializationService.runInitializationSequence.mockResolvedValue({
        success: true,
      });
      await gameEngine.startNewGame(MOCK_WORLD_NAME); // Start the game first

      // Clear mocks to ensure we only check calls from stop()
      mockPlaytimeTracker.endSessionAndAccumulate.mockClear();
      mockTurnManager.stop.mockClear();
      mockSafeEventDispatcher.dispatch.mockClear();
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();

      await gameEngine.stop();

      const logCalls = mockLogger.info.mock.calls;
      expect(logCalls).toEqual(
        expect.arrayContaining([
          ['GameEngine.stop: Stopping game engine session...'],
          ['GameEngine.stop: Playtime session ended.'],
          ['GameEngine.stop: ENGINE_STOPPED_UI event dispatched.'],
          ['GameEngine.stop: TurnManager stopped.'],
          ['GameEngine.stop: GAME_STOPPED_ID event dispatched.'],
          ['GameEngine.stop: Engine fully stopped and state reset.'],
        ])
      );

      expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(
        1
      );
      expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        { inputDisabledMessage: 'Game stopped. Engine is inactive.' }
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        GAME_STOPPED_ID,
        {}
      );

      const status = gameEngine.getEngineStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.isLoopRunning).toBe(false);
      expect(status.activeWorld).toBeNull();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should do nothing and log if engine is already stopped', async () => {
      // gameEngine is fresh, so not initialized
      const initialStatus = gameEngine.getEngineStatus();
      expect(initialStatus.isInitialized).toBe(false);
      expect(initialStatus.isLoopRunning).toBe(false);

      mockLogger.info.mockClear(); // Clear logs from constructor if any
      mockPlaytimeTracker.endSessionAndAccumulate.mockClear();
      mockTurnManager.stop.mockClear();
      mockSafeEventDispatcher.dispatch.mockClear();

      await gameEngine.stop();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'GameEngine.stop: Engine not running or already stopped. No action taken.'
      );
      expect(
        mockPlaytimeTracker.endSessionAndAccumulate
      ).not.toHaveBeenCalled();
      expect(mockTurnManager.stop).not.toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        expect.anything()
      );
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        GAME_STOPPED_ID,
        expect.anything()
      );
    });

    it('should log warning for PlaytimeTracker if it is not available during stop, after a successful start', async () => {
      const originalResolve = mockContainer.resolve;
      mockContainer.resolve = jest.fn((token) => {
        if (token === tokens.PlaytimeTracker) return null;
        return originalResolve(token); // Use the original mock setup for other tokens
      });

      gameEngine = new GameEngine({ container: mockContainer }); // PlaytimeTracker is now null for this instance

      mockInitializationService.runInitializationSequence.mockResolvedValue({
        success: true,
      });
      mockLogger.warn.mockClear();
      await gameEngine.startNewGame(MOCK_WORLD_NAME); // Should start, but with warnings about PT

      const statusAfterStart = gameEngine.getEngineStatus();
      expect(statusAfterStart.isInitialized).toBe(true);
      expect(statusAfterStart.isLoopRunning).toBe(true);

      mockLogger.warn.mockClear(); // Clear warnings from startNewGame
      mockLogger.info.mockClear();
      // mockPlaytimeTracker.endSessionAndAccumulate should not be called as the instance is null

      await gameEngine.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'GameEngine.stop: PlaytimeTracker service not available, cannot end session.'
      );
      // The actual mockPlaytimeTracker object's methods won't be called as this.#playtimeTracker is null.

      expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'GameEngine.stop: Stopping game engine session...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'GameEngine.stop: Engine fully stopped and state reset.'
      );

      mockContainer.resolve = originalResolve; // Restore
    });
  });

  describe('triggerManualSave', () => {
    const SAVE_NAME = 'MySaveFile';
    const MOCK_ACTIVE_WORLD_FOR_SAVE = 'TestWorldForSaving';

    it('should dispatch error and not attempt save if engine is not initialized', async () => {
      // Create a fresh, uninitialized engine for this test
      setupMockContainer(); // Ensure mocks are clean for this specific setup
      const uninitializedGameEngine = new GameEngine({
        container: mockContainer,
      });
      mockSafeEventDispatcher.dispatch.mockClear(); // Clear any dispatches from constructor

      const result = await uninitializedGameEngine.triggerManualSave(SAVE_NAME);
      const expectedErrorMsg =
        'Game engine is not initialized. Cannot save game.';

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_MESSAGE_DISPLAY_REQUESTED,
        {
          message: expectedErrorMsg,
          type: 'error',
        }
      );
      expect(mockGamePersistenceService.saveGame).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: expectedErrorMsg });
    });

    describe('when engine is initialized', () => {
      beforeEach(async () => {
        setupMockContainer(); // Fresh mocks for each test in this inner describe
        gameEngine = new GameEngine({ container: mockContainer });
        mockInitializationService.runInitializationSequence.mockResolvedValue({
          success: true,
        });
        // This call sets this.#activeWorld to MOCK_ACTIVE_WORLD_FOR_SAVE in the gameEngine instance
        await gameEngine.startNewGame(MOCK_ACTIVE_WORLD_FOR_SAVE);

        mockSafeEventDispatcher.dispatch.mockClear();
        mockLogger.info.mockClear();
        mockLogger.error.mockClear();
        mockLogger.warn.mockClear();
        mockGamePersistenceService.saveGame.mockClear();
      });

      it('should dispatch error if GamePersistenceService is unavailable', async () => {
        const originalGlobalResolve = mockContainer.resolve;

        // Temporarily modify the global mockContainer's resolve behavior
        mockContainer.resolve = jest.fn((token) => {
          if (token === tokens.GamePersistenceService) return null;
          // Delegate to the original setup for other tokens to ensure GameEngine constructor works
          // AND IInitializationService is resolved for startNewGame
          if (token === tokens.ILogger) return mockLogger;
          if (token === tokens.IEntityManager) return mockEntityManager;
          if (token === tokens.ITurnManager) return mockTurnManager;
          if (token === tokens.PlaytimeTracker) return mockPlaytimeTracker;
          if (token === tokens.ISafeEventDispatcher)
            return mockSafeEventDispatcher;
          if (token === tokens.IInitializationService)
            return mockInitializationService;
          throw new Error(
            `GPS unavailable test: Unmocked token: ${token?.toString()}`
          );
        });

        const engineWithNullGps = new GameEngine({ container: mockContainer });

        mockInitializationService.runInitializationSequence.mockResolvedValue({
          success: true,
        }); // For startNewGame below
        await engineWithNullGps.startNewGame(MOCK_ACTIVE_WORLD_FOR_SAVE); // Initialize this specific engine

        mockSafeEventDispatcher.dispatch.mockClear(); // Clear events from this engine's startNewGame
        mockLogger.error.mockClear();

        const result = await engineWithNullGps.triggerManualSave(SAVE_NAME);
        const expectedErrorMsg =
          'GamePersistenceService is not available. Cannot save game.';

        expect(mockLogger.error).toHaveBeenCalledWith(
          `GameEngine.triggerManualSave: ${expectedErrorMsg}`
        );
        expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
          ENGINE_MESSAGE_DISPLAY_REQUESTED,
          {
            message: expectedErrorMsg,
            type: 'error',
          }
        );
        expect(result).toEqual({ success: false, error: expectedErrorMsg });

        mockContainer.resolve = originalGlobalResolve; // Restore global mockContainer.resolve
      });

      it('should successfully save, dispatch all UI events in order, and return success result', async () => {
        const saveResultData = { success: true, filePath: 'path/to/my.sav' };
        mockGamePersistenceService.saveGame.mockResolvedValue(saveResultData);

        const result = await gameEngine.triggerManualSave(SAVE_NAME);

        const dispatchCalls = mockSafeEventDispatcher.dispatch.mock.calls;

        expect(dispatchCalls[0][0]).toBe(ENGINE_OPERATION_IN_PROGRESS_UI);
        expect(dispatchCalls[0][1]).toEqual({
          titleMessage: 'Saving...',
          inputDisabledMessage: `Saving game "${SAVE_NAME}"...`,
        });

        // 👇 MODIFIED EXPECTATION HERE
        expect(mockGamePersistenceService.saveGame).toHaveBeenCalledWith(
          SAVE_NAME,
          true,
          MOCK_ACTIVE_WORLD_FOR_SAVE
        );

        expect(dispatchCalls[1][0]).toBe(GAME_SAVED_ID);
        expect(dispatchCalls[1][1]).toEqual({
          saveName: SAVE_NAME,
          path: saveResultData.filePath,
          type: 'manual',
        });

        expect(dispatchCalls[2][0]).toBe(ENGINE_MESSAGE_DISPLAY_REQUESTED);
        expect(dispatchCalls[2][1]).toEqual({
          message: `Game "${SAVE_NAME}" saved successfully.`,
          type: 'info',
        });

        expect(dispatchCalls[3][0]).toBe(ENGINE_READY_UI);
        expect(dispatchCalls[3][1]).toEqual({
          activeWorld: MOCK_ACTIVE_WORLD_FOR_SAVE,
          message: 'Save operation finished. Ready.',
        });

        expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(4);
        expect(result).toEqual(saveResultData);
      });

      it('should handle save failure from persistence service, dispatch UI events, and return failure result', async () => {
        const saveFailureData = {
          success: false,
          error: 'Disk is critically full',
        };
        mockGamePersistenceService.saveGame.mockResolvedValue(saveFailureData);

        const result = await gameEngine.triggerManualSave(SAVE_NAME);

        const dispatchCalls = mockSafeEventDispatcher.dispatch.mock.calls;

        expect(dispatchCalls[0][0]).toBe(ENGINE_OPERATION_IN_PROGRESS_UI);
        expect(dispatchCalls[0][1]).toEqual({
          titleMessage: 'Saving...',
          inputDisabledMessage: `Saving game "${SAVE_NAME}"...`,
        });

        // 👇 MODIFIED EXPECTATION HERE
        expect(mockGamePersistenceService.saveGame).toHaveBeenCalledWith(
          SAVE_NAME,
          true,
          MOCK_ACTIVE_WORLD_FOR_SAVE
        );

        expect(dispatchCalls[1][0]).toBe(ENGINE_MESSAGE_DISPLAY_REQUESTED);
        expect(dispatchCalls[1][1]).toEqual({
          message: `Manual save failed for "${SAVE_NAME}". Error: ${saveFailureData.error}`,
          type: 'error',
        });

        expect(dispatchCalls[2][0]).toBe(ENGINE_READY_UI);
        expect(dispatchCalls[2][1]).toEqual({
          activeWorld: MOCK_ACTIVE_WORLD_FOR_SAVE,
          message: 'Save operation finished. Ready.',
        });

        expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(3);
        expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
          GAME_SAVED_ID,
          expect.anything()
        );
        expect(result).toEqual(saveFailureData);
      });

      it('should handle unexpected error during saveGame call, dispatch UI events, and return failure result', async () => {
        const unexpectedError = new Error('Network connection failed');
        mockGamePersistenceService.saveGame.mockRejectedValue(unexpectedError);

        const result = await gameEngine.triggerManualSave(SAVE_NAME);

        const dispatchCalls = mockSafeEventDispatcher.dispatch.mock.calls;

        expect(dispatchCalls[0][0]).toBe(ENGINE_OPERATION_IN_PROGRESS_UI);
        expect(dispatchCalls[0][1]).toEqual({
          titleMessage: 'Saving...',
          inputDisabledMessage: `Saving game "${SAVE_NAME}"...`,
        });

        // 👇 MODIFIED EXPECTATION HERE
        expect(mockGamePersistenceService.saveGame).toHaveBeenCalledWith(
          SAVE_NAME,
          true,
          MOCK_ACTIVE_WORLD_FOR_SAVE
        );

        expect(dispatchCalls[1][0]).toBe(ENGINE_MESSAGE_DISPLAY_REQUESTED);
        expect(dispatchCalls[1][1]).toEqual({
          message: `Save operation encountered an unexpected error for "${SAVE_NAME}": ${unexpectedError.message}`,
          type: 'error',
        });

        expect(dispatchCalls[2][0]).toBe(ENGINE_READY_UI);
        expect(dispatchCalls[2][1]).toEqual({
          activeWorld: MOCK_ACTIVE_WORLD_FOR_SAVE,
          message: 'Save operation finished. Ready.',
        });

        expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(3);
        expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
          GAME_SAVED_ID,
          expect.anything()
        );
        expect(result).toEqual({
          success: false,
          error: `Unexpected error during save: ${unexpectedError.message}`,
        });
      });
    });
  });

  describe('loadGame', () => {
    const SAVE_ID = 'savegame-001.sav';
    const mockSaveData = {
      metadata: { gameTitle: 'My Loaded Game Adventure' },
    };
    /** @type {SaveGameStructure} */
    const typedMockSaveData = /** @type {SaveGameStructure} */ (mockSaveData);

    let prepareSpy, executeSpy, finalizeSpy, handleFailureSpy;

    beforeEach(() => {
      gameEngine = new GameEngine({ container: mockContainer }); // Ensure gameEngine is fresh
      // Spies are on the gameEngine instance created here
      prepareSpy = jest
        .spyOn(gameEngine, '_prepareForLoadGameSession')
        .mockResolvedValue(undefined);
      executeSpy = jest
        .spyOn(gameEngine, '_executeLoadAndRestore')
        .mockResolvedValue({
          success: true,
          data: typedMockSaveData,
        });
      finalizeSpy = jest
        .spyOn(gameEngine, '_finalizeLoadSuccess')
        .mockResolvedValue({
          success: true,
          data: typedMockSaveData,
        });
      handleFailureSpy = jest
        .spyOn(gameEngine, '_handleLoadFailure')
        .mockImplementation(async (error, saveId) => {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Processed: ${errorMsg}`,
            data: null,
          };
        });
      mockLogger.info.mockClear(); // Clear logs for cleaner test assertions
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockSafeEventDispatcher.dispatch.mockClear();
    });

    it('should successfully orchestrate loading a game and call helpers in order', async () => {
      const result = await gameEngine.loadGame(SAVE_ID);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `GameEngine: loadGame called for identifier: ${SAVE_ID}`
      );
      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(finalizeSpy).toHaveBeenCalledWith(typedMockSaveData, SAVE_ID);
      expect(handleFailureSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: typedMockSaveData });
    });

    it('should use _handleLoadFailure if _executeLoadAndRestore returns success: false', async () => {
      const restoreErrorMsg = 'Restore operation failed';
      executeSpy.mockResolvedValue({
        success: false,
        error: restoreErrorMsg,
        data: null,
      });
      // Redefine handleFailureSpy for this specific test to check its input accurately
      handleFailureSpy.mockImplementation(async (error, saveId) => {
        return { success: false, error: String(error), data: null };
      });

      const result = await gameEngine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`
      );
      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(handleFailureSpy).toHaveBeenCalledWith(restoreErrorMsg, SAVE_ID); // Check it's called with the error string
      expect(result).toEqual({
        success: false,
        error: restoreErrorMsg,
        data: null,
      });
    });

    it('should use _handleLoadFailure if _executeLoadAndRestore returns success: true but no data', async () => {
      executeSpy.mockResolvedValue({ success: true, data: null }); // No data
      const expectedError =
        'Restored data was missing or load operation failed.';
      // Redefine handleFailureSpy for this specific test
      handleFailureSpy.mockImplementation(async (error, saveId) => {
        return { success: false, error: String(error), data: null };
      });

      const result = await gameEngine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`
      );
      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(handleFailureSpy).toHaveBeenCalledWith(expectedError, SAVE_ID);
      expect(result).toEqual({
        success: false,
        error: expectedError,
        data: null,
      });
    });

    it('should handle GamePersistenceService unavailability (guard clause) and dispatch UI event directly', async () => {
      const originalResolve = mockContainer.resolve;
      mockContainer.resolve = jest.fn((token) => {
        if (token === tokens.GamePersistenceService) return null;
        return originalResolve(token);
      });

      const localGameEngine = new GameEngine({ container: mockContainer }); // GPS is null

      mockSafeEventDispatcher.dispatch.mockClear();
      mockLogger.error.mockClear();

      const rawErrorMsg =
        'GamePersistenceService is not available. Cannot load game.';
      const result = await localGameEngine.loadGame(SAVE_ID);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine.loadGame: ${rawErrorMsg}`
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: rawErrorMsg,
          errorTitle: 'Load Failed',
        }
      );
      expect(result).toEqual({
        success: false,
        error: rawErrorMsg,
        data: null,
      });

      mockContainer.resolve = originalResolve; // Restore
    });

    it('should use _handleLoadFailure when _prepareForLoadGameSession throws an error', async () => {
      const prepareError = new Error('Prepare failed');
      prepareSpy.mockRejectedValue(prepareError);

      const result = await gameEngine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${prepareError.message || String(prepareError)}`,
        prepareError
      );
      expect(executeSpy).not.toHaveBeenCalled();
      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(handleFailureSpy).toHaveBeenCalledWith(prepareError, SAVE_ID);
      expect(result).toEqual({
        success: false,
        error: `Processed: ${prepareError.message}`,
        data: null,
      });
    });

    it('should use _handleLoadFailure when _executeLoadAndRestore throws an error', async () => {
      const executeError = new Error('Execute failed');
      executeSpy.mockRejectedValue(executeError);

      const result = await gameEngine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${executeError.message || String(executeError)}`,
        executeError
      );
      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(handleFailureSpy).toHaveBeenCalledWith(executeError, SAVE_ID);
      expect(result).toEqual({
        success: false,
        error: `Processed: ${executeError.message}`,
        data: null,
      });
    });

    it('should use _handleLoadFailure when _finalizeLoadSuccess throws an error', async () => {
      const finalizeError = new Error('Finalize failed');
      finalizeSpy.mockRejectedValue(finalizeError); // _executeLoadAndRestore is fine
      executeSpy.mockResolvedValue({ success: true, data: typedMockSaveData });

      const result = await gameEngine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(finalizeSpy).toHaveBeenCalledWith(typedMockSaveData, SAVE_ID);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${finalizeError.message || String(finalizeError)}`,
        finalizeError
      );
      expect(handleFailureSpy).toHaveBeenCalledWith(finalizeError, SAVE_ID);
      expect(result).toEqual({
        success: false,
        error: `Processed: ${finalizeError.message}`,
        data: null,
      });
    });
  });

  describe('showSaveGameUI', () => {
    beforeEach(async () => {
      gameEngine = new GameEngine({ container: mockContainer });
      // Start the game to ensure this.#isEngineInitialized is true for isSavingAllowed check
      mockInitializationService.runInitializationSequence.mockResolvedValue({
        success: true,
      });
      await gameEngine.startNewGame(MOCK_WORLD_NAME);
      mockSafeEventDispatcher.dispatch.mockClear();
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockGamePersistenceService.isSavingAllowed.mockClear();
    });

    it('should dispatch REQUEST_SHOW_SAVE_GAME_UI if saving is allowed and log intent', () => {
      mockGamePersistenceService.isSavingAllowed.mockReturnValue(true);
      gameEngine.showSaveGameUI(); // Method is now sync

      expect(mockLogger.info).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: Dispatching request to show Save Game UI.'
      );
      expect(mockGamePersistenceService.isSavingAllowed).toHaveBeenCalledWith(
        true
      ); // engine is initialized
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        REQUEST_SHOW_SAVE_GAME_UI,
        {}
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should dispatch CANNOT_SAVE_GAME_INFO if saving is not allowed and log reason', () => {
      mockGamePersistenceService.isSavingAllowed.mockReturnValue(false);
      gameEngine.showSaveGameUI(); // Method is now sync

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: Saving is not currently allowed.'
      );
      expect(mockGamePersistenceService.isSavingAllowed).toHaveBeenCalledWith(
        true
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        CANNOT_SAVE_GAME_INFO
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should dispatch ENGINE_MESSAGE_DISPLAY_REQUESTED if GamePersistenceService is unavailable and log error', () => {
      const originalResolve = mockContainer.resolve;
      mockContainer.resolve = jest.fn((token) => {
        if (token === tokens.GamePersistenceService) return null;
        // Provide other dependencies for GameEngine constructor to avoid cascading errors
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IEntityManager) return mockEntityManager;
        if (token === tokens.ITurnManager) return mockTurnManager;
        if (token === tokens.PlaytimeTracker) return mockPlaytimeTracker;
        if (token === tokens.ISafeEventDispatcher)
          return mockSafeEventDispatcher;
        // IInitializationService not needed here as we don't start the game for this specific localGameEngine
        throw new Error(
          `showSaveGameUI GPS Unavailability: Unmocked token: ${token?.toString()}`
        );
      });

      // Create a new engine instance where GPS will be null
      // No need to start this specific instance as the check is upfront in showSaveGameUI
      const localGameEngine = new GameEngine({ container: mockContainer });

      mockSafeEventDispatcher.dispatch.mockClear(); // Clear any dispatches from constructor
      mockLogger.error.mockClear(); // Clear any error logs from constructor

      localGameEngine.showSaveGameUI(); // Method is now sync

      expect(mockLogger.error).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: GamePersistenceService is unavailable. Cannot show Save Game UI.'
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_MESSAGE_DISPLAY_REQUESTED,
        {
          message:
            'Cannot open save menu: GamePersistenceService is unavailable.',
          type: 'error',
        }
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockGamePersistenceService.isSavingAllowed).not.toHaveBeenCalled(); // Should not be called if service is null

      mockContainer.resolve = originalResolve; // Restore
    });
  });

  describe('showLoadGameUI', () => {
    beforeEach(() => {
      gameEngine = new GameEngine({ container: mockContainer });
      mockSafeEventDispatcher.dispatch.mockClear();
      mockLogger.info.mockClear();
      mockLogger.error.mockClear();
    });

    it('should dispatch REQUEST_SHOW_LOAD_GAME_UI and log intent if persistence service is available', () => {
      gameEngine.showLoadGameUI(); // Method is now sync

      expect(mockLogger.info).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        REQUEST_SHOW_LOAD_GAME_UI,
        {}
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should dispatch ENGINE_MESSAGE_DISPLAY_REQUESTED if GamePersistenceService is unavailable and log error', () => {
      const originalResolve = mockContainer.resolve;
      mockContainer.resolve = jest.fn((token) => {
        if (token === tokens.GamePersistenceService) return null;
        // Provide other dependencies for GameEngine constructor
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IEntityManager) return mockEntityManager;
        if (token === tokens.ITurnManager) return mockTurnManager;
        if (token === tokens.PlaytimeTracker) return mockPlaytimeTracker;
        if (token === tokens.ISafeEventDispatcher)
          return mockSafeEventDispatcher;
        throw new Error(
          `showLoadGameUI GPS Unavailability: Unmocked token: ${token?.toString()}`
        );
      });
      const localGameEngine = new GameEngine({ container: mockContainer }); // GPS is null

      mockSafeEventDispatcher.dispatch.mockClear(); // Clear from constructor
      mockLogger.error.mockClear(); // Clear from constructor

      localGameEngine.showLoadGameUI(); // Method is now sync

      expect(mockLogger.error).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.'
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_MESSAGE_DISPLAY_REQUESTED,
        {
          message:
            'Cannot open load menu: GamePersistenceService is unavailable.',
          type: 'error',
        }
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      mockContainer.resolve = originalResolve; // Restore
    });
  });

  describe('getEngineStatus', () => {
    beforeEach(() => {
      // Create gameEngine for these tests
      gameEngine = new GameEngine({ container: mockContainer });
    });

    it('should return initial status correctly after construction', () => {
      const status = gameEngine.getEngineStatus();
      expect(status).toEqual({
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });
    });

    it('should return correct status after starting a game', async () => {
      mockInitializationService.runInitializationSequence.mockResolvedValue({
        success: true,
      });
      await gameEngine.startNewGame(MOCK_WORLD_NAME);
      const status = gameEngine.getEngineStatus();
      expect(status).toEqual({
        isInitialized: true,
        isLoopRunning: true,
        activeWorld: MOCK_WORLD_NAME,
      });
    });

    it('should return correct status after stopping a game', async () => {
      mockInitializationService.runInitializationSequence.mockResolvedValue({
        success: true,
      });
      await gameEngine.startNewGame(MOCK_WORLD_NAME);
      await gameEngine.stop();
      const status = gameEngine.getEngineStatus();
      expect(status).toEqual({
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });
    });
  });
});
