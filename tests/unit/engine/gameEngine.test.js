// tests/engine/gameEngine.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import GameEngine from '../../../src/engine/gameEngine.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { createGameEngineTestBed } from '../../common/engine/gameEngineTestBed.js';
import { expectDispatchCalls } from '../../common/engine/dispatchTestUtils.js';
import { buildSaveDispatches } from '../../common/engine/gameEngineSaveTestUtils.js';
import {
  GAME_SAVED_ID,
  // --- Import new UI Event IDs ---
  ENGINE_INITIALIZING_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_STOPPED_UI,
  REQUEST_SHOW_SAVE_GAME_UI,
  REQUEST_SHOW_LOAD_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../../../src/constants/eventIds.js';

// --- JSDoc Type Imports for Mocks ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../src/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../../src/interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../../../src/interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */
/** @typedef {import('../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../../src/interfaces/IInitializationService.js').IInitializationService} IInitializationService */
/** @typedef {import('../../../src/interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

describe('GameEngine', () => {
  let testBed;
  let gameEngine; // Instance of GameEngine

  const MOCK_WORLD_NAME = 'TestWorld';

  beforeEach(() => {
    testBed = createGameEngineTestBed();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should instantiate and resolve all core services successfully', () => {
      gameEngine = new GameEngine({ container: testBed.env.mockContainer }); // Instantiation for this test
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ILogger
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IEntityManager
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ITurnManager
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.GamePersistenceService
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.PlaytimeTracker
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('should throw an error if ILogger cannot be resolved', () => {
      testBed.withTokenOverride(tokens.ILogger, () => {
        throw new Error('Logger failed to resolve');
      });

      expect(
        () => new GameEngine({ container: testBed.env.mockContainer })
      ).toThrow('GameEngine requires a logger.');
      expect(console.error).toHaveBeenCalledWith(
        'GameEngine: CRITICAL - Logger not resolved.',
        expect.any(Error)
      );
    });

    it.each([
      ['IEntityManager', tokens.IEntityManager],
      ['ITurnManager', tokens.ITurnManager],
      ['GamePersistenceService', tokens.GamePersistenceService],
      ['PlaytimeTracker', tokens.PlaytimeTracker],
      ['ISafeEventDispatcher', tokens.ISafeEventDispatcher],
    ])('should throw an error if %s cannot be resolved', (_, failingToken) => {
      const resolutionError = new Error(`${String(failingToken)} failed`);
      testBed.withTokenOverride(failingToken, () => {
        throw resolutionError;
      });

      expect(() => testBed.env.createGameEngine()).toThrow(
        `GameEngine: Failed to resolve core services. ${resolutionError.message}`
      );

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        `GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${resolutionError.message}`,
        resolutionError
      );
    });
  });

  describe('startNewGame', () => {
    beforeEach(() => {
      gameEngine = testBed.engine; // Standard instance for these tests
      testBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
    });

    it('should successfully start a new game', async () => {
      await gameEngine.startNewGame(MOCK_WORLD_NAME);

      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_INITIALIZING_UI,
        { worldName: MOCK_WORLD_NAME },
        { allowSchemaNotFound: true }
      );
      expect(testBed.mocks.entityManager.clearAll).toHaveBeenCalled();
      expect(testBed.mocks.playtimeTracker.reset).toHaveBeenCalled();
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IInitializationService
      );
      expect(
        testBed.mocks.initializationService.runInitializationSequence
      ).toHaveBeenCalledWith(MOCK_WORLD_NAME);
      expect(testBed.mocks.playtimeTracker.startSession).toHaveBeenCalled();
      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        {
          activeWorld: MOCK_WORLD_NAME,
          message: 'Enter command...',
        }
      );
      expect(testBed.mocks.turnManager.start).toHaveBeenCalled();

      const status = gameEngine.getEngineStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.isLoopRunning).toBe(true);
      expect(status.activeWorld).toBe(MOCK_WORLD_NAME);
    });

    it('should stop an existing game if already initialized, with correct event payloads from stop()', async () => {
      testBed.mocks.initializationService.runInitializationSequence.mockResolvedValueOnce(
        { success: true }
      );
      await gameEngine.startNewGame('InitialWorld');

      testBed.resetMocks();

      testBed.mocks.initializationService.runInitializationSequence.mockResolvedValueOnce(
        { success: true }
      );
      await gameEngine.startNewGame(MOCK_WORLD_NAME);

      expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
        'GameEngine._prepareForNewGameSession: Engine already initialized. Stopping existing game before starting new.'
      );
      expect(
        testBed.mocks.playtimeTracker.endSessionAndAccumulate
      ).toHaveBeenCalledTimes(1);
      expect(testBed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);
      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        { inputDisabledMessage: 'Game stopped. Engine is inactive.' }
      );
      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
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
      testBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: false,
          error: initError,
        }
      );

      await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(
        initError
      );

      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
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
      testBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
      const startupError = new Error('TurnManager failed to start');
      testBed.mocks.playtimeTracker.startSession.mockImplementation(() => {}); // Make sure this doesn't throw
      testBed.mocks.turnManager.start.mockRejectedValue(startupError); // TurnManager fails to start

      await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(
        startupError
      );

      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
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
      gameEngine = testBed.engine;
    });

    it('should successfully stop a running game, with correct logging, events, and state changes', async () => {
      testBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
      await gameEngine.startNewGame(MOCK_WORLD_NAME); // Start the game first

      // Clear mocks to ensure we only check calls from stop()
      testBed.resetMocks();

      await gameEngine.stop();

      expect(
        testBed.mocks.playtimeTracker.endSessionAndAccumulate
      ).toHaveBeenCalledTimes(1);
      expect(testBed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);

      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        { inputDisabledMessage: 'Game stopped. Engine is inactive.' }
      );

      const status = gameEngine.getEngineStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.isLoopRunning).toBe(false);
      expect(status.activeWorld).toBeNull();

      expect(testBed.mocks.logger.warn).not.toHaveBeenCalled();
    });

    it('should do nothing and log if engine is already stopped', async () => {
      // gameEngine is fresh, so not initialized
      const initialStatus = gameEngine.getEngineStatus();
      expect(initialStatus.isInitialized).toBe(false);
      expect(initialStatus.isLoopRunning).toBe(false);

      testBed.resetMocks();

      await gameEngine.stop();

      expect(
        testBed.mocks.playtimeTracker.endSessionAndAccumulate
      ).not.toHaveBeenCalled();
      expect(testBed.mocks.turnManager.stop).not.toHaveBeenCalled();
      expect(
        testBed.mocks.safeEventDispatcher.dispatch
      ).not.toHaveBeenCalledWith(ENGINE_STOPPED_UI, expect.anything());
    });

    it('should log warning for PlaytimeTracker if it is not available during stop, after a successful start', async () => {
      const localBed = createGameEngineTestBed({
        [tokens.PlaytimeTracker]: null,
      });
      const localEngine = localBed.engine;

      localBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
      await localEngine.startNewGame(MOCK_WORLD_NAME); // Should start, but with warnings about PT

      const statusAfterStart = localEngine.getEngineStatus();
      expect(statusAfterStart.isInitialized).toBe(true);
      expect(statusAfterStart.isLoopRunning).toBe(true);

      localBed.resetMocks();
      // testBed.mocks.playtimeTracker.endSessionAndAccumulate should not be called as the instance is null

      await localEngine.stop();

      expect(localBed.mocks.logger.warn).toHaveBeenCalledWith(
        'GameEngine.stop: PlaytimeTracker service not available, cannot end session.'
      );
      // The actual testBed.mocks.playtimeTracker object's methods won't be called as this.#playtimeTracker is null.

      expect(localBed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);

      await localBed.cleanup();
    });
  });

  describe('triggerManualSave', () => {
    const SAVE_NAME = 'MySaveFile';
    const MOCK_ACTIVE_WORLD_FOR_SAVE = 'TestWorldForSaving';

    it('should dispatch error and not attempt save if engine is not initialized', async () => {
      const localBed = createGameEngineTestBed();
      const uninitializedGameEngine = localBed.engine;
      localBed.resetMocks();

      const result = await uninitializedGameEngine.triggerManualSave(SAVE_NAME);
      const expectedErrorMsg =
        'Game engine is not initialized. Cannot save game.';

      expect(
        localBed.mocks.safeEventDispatcher.dispatch
      ).not.toHaveBeenCalled();
      expect(
        localBed.mocks.gamePersistenceService.saveGame
      ).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: expectedErrorMsg });
      await localBed.cleanup();
    });

    describe('when engine is initialized', () => {
      beforeEach(async () => {
        await testBed.init(MOCK_ACTIVE_WORLD_FOR_SAVE);
        gameEngine = testBed.engine;
        testBed.resetMocks();
      });

      it('should dispatch error if GamePersistenceService is unavailable', async () => {
        const localBed = createGameEngineTestBed({
          [tokens.GamePersistenceService]: null,
        });

        localBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
          {
            success: true,
          }
        );
        await localBed.engine.startNewGame(MOCK_ACTIVE_WORLD_FOR_SAVE);

        localBed.resetMocks();

        const result = await localBed.engine.triggerManualSave(SAVE_NAME);
        const expectedErrorMsg =
          'GamePersistenceService is not available. Cannot save game.';

        expect(localBed.mocks.logger.error).toHaveBeenCalledWith(
          `GameEngine.triggerManualSave: ${expectedErrorMsg}`
        );
        expect(
          localBed.mocks.safeEventDispatcher.dispatch
        ).not.toHaveBeenCalled();
        expect(result).toEqual({ success: false, error: expectedErrorMsg });

        await localBed.cleanup();
      });

      it.each([
        {
          saveResult: { success: true, filePath: 'path/to/my.sav' },
          expectedCalls: buildSaveDispatches(
            SAVE_NAME,
            { success: true, filePath: 'path/to/my.sav' },
            MOCK_ACTIVE_WORLD_FOR_SAVE
          ),
        },
        {
          saveResult: { success: false, error: 'Disk is critically full' },
          expectedCalls: buildSaveDispatches(
            SAVE_NAME,
            { success: false },
            MOCK_ACTIVE_WORLD_FOR_SAVE
          ),
        },
        {
          saveResult: new Error('Network connection failed'),
          expectedCalls: buildSaveDispatches(
            SAVE_NAME,
            { success: false },
            MOCK_ACTIVE_WORLD_FOR_SAVE
          ),
        },
      ])(
        'handles manual save result %#',
        async ({ saveResult, expectedCalls }) => {
          if (saveResult instanceof Error) {
            testBed.mocks.gamePersistenceService.saveGame.mockRejectedValue(
              saveResult
            );
          } else {
            testBed.mocks.gamePersistenceService.saveGame.mockResolvedValue(
              saveResult
            );
          }

          const result = await gameEngine.triggerManualSave(SAVE_NAME);

          expectDispatchCalls(
            testBed.mocks.safeEventDispatcher.dispatch,
            expectedCalls
          );

          expect(
            testBed.mocks.gamePersistenceService.saveGame
          ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);

          if (saveResult instanceof Error) {
            expect(result).toEqual({
              success: false,
              error: `Unexpected error during save: ${saveResult.message}`,
            });
          } else {
            expect(result).toEqual(saveResult);
          }
        }
      );
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
      gameEngine = testBed.engine; // Ensure gameEngine is fresh
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
        .mockImplementation(async (error) => {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Processed: ${errorMsg}`,
            data: null,
          };
        });
      testBed.resetMocks();
    });

    it('should successfully orchestrate loading a game and call helpers in order', async () => {
      const result = await gameEngine.loadGame(SAVE_ID);

      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
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
      handleFailureSpy.mockImplementation(async (error) => {
        return { success: false, error: String(error), data: null };
      });

      const result = await gameEngine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
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
      handleFailureSpy.mockImplementation(async (error) => {
        return { success: false, error: String(error), data: null };
      });

      const result = await gameEngine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
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
      const localBed = createGameEngineTestBed({
        [tokens.GamePersistenceService]: null,
      });
      const localGameEngine = localBed.engine; // GPS is null

      localBed.resetMocks();

      const rawErrorMsg =
        'GamePersistenceService is not available. Cannot load game.';
      const result = await localGameEngine.loadGame(SAVE_ID);

      expect(localBed.mocks.logger.error).toHaveBeenCalledWith(
        `GameEngine.loadGame: ${rawErrorMsg}`
      );
      const expectedDispatches = [
        [
          ENGINE_OPERATION_FAILED_UI,
          {
            errorMessage: rawErrorMsg,
            errorTitle: 'Load Failed',
          },
        ],
      ];

      expectDispatchCalls(
        localBed.mocks.safeEventDispatcher.dispatch,
        expectedDispatches
      );
      expect(result).toEqual({
        success: false,
        error: rawErrorMsg,
        data: null,
      });

      await localBed.cleanup();
    });

    it('should use _handleLoadFailure when _prepareForLoadGameSession throws an error', async () => {
      const prepareError = new Error('Prepare failed');
      prepareSpy.mockRejectedValue(prepareError);

      const result = await gameEngine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
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
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
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
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
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
      gameEngine = testBed.engine;
      // Start the game to ensure this.#isEngineInitialized is true for isSavingAllowed check
      await testBed.init(MOCK_WORLD_NAME);
      testBed.resetMocks();
    });

    it('should dispatch REQUEST_SHOW_SAVE_GAME_UI if saving is allowed and log intent', () => {
      testBed.mocks.gamePersistenceService.isSavingAllowed.mockReturnValue(
        true
      );
      gameEngine.showSaveGameUI(); // Method is now sync

      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: Dispatching request to show Save Game UI.'
      );
      expect(
        testBed.mocks.gamePersistenceService.isSavingAllowed
      ).toHaveBeenCalledWith(true); // engine is initialized
      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        REQUEST_SHOW_SAVE_GAME_UI,
        {}
      );
      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledTimes(
        1
      );
    });

    it('should dispatch CANNOT_SAVE_GAME_INFO if saving is not allowed and log reason', () => {
      testBed.mocks.gamePersistenceService.isSavingAllowed.mockReturnValue(
        false
      );
      gameEngine.showSaveGameUI(); // Method is now sync

      expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: Saving is not currently allowed.'
      );
      expect(
        testBed.mocks.gamePersistenceService.isSavingAllowed
      ).toHaveBeenCalledWith(true);
      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        CANNOT_SAVE_GAME_INFO
      );
      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledTimes(
        1
      );
    });

    it('should log error if GamePersistenceService is unavailable when showing save UI', async () => {
      const localBed = createGameEngineTestBed({
        [tokens.GamePersistenceService]: null,
      });
      const localGameEngine = localBed.engine; // GPS will be null

      localBed.resetMocks(); // Clear any dispatches and logs from constructor

      localGameEngine.showSaveGameUI(); // Method is now sync

      expect(localBed.mocks.logger.error).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: GamePersistenceService is unavailable. Cannot show Save Game UI.'
      );
      expect(
        localBed.mocks.safeEventDispatcher.dispatch
      ).not.toHaveBeenCalled();
      expect(
        localBed.mocks.gamePersistenceService.isSavingAllowed
      ).not.toHaveBeenCalled(); // Should not be called if service is null

      await localBed.cleanup();
    });
  });

  describe('showLoadGameUI', () => {
    beforeEach(() => {
      gameEngine = testBed.engine;
      testBed.resetMocks();
    });

    it('should dispatch REQUEST_SHOW_LOAD_GAME_UI and log intent if persistence service is available', () => {
      gameEngine.showLoadGameUI(); // Method is now sync

      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
      );
      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        REQUEST_SHOW_LOAD_GAME_UI,
        {}
      );
      expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledTimes(
        1
      );
    });

    it('should log error if GamePersistenceService is unavailable when showing load UI', async () => {
      const localBed = createGameEngineTestBed({
        [tokens.GamePersistenceService]: null,
      });
      const localGameEngine = localBed.engine; // GPS is null

      localBed.resetMocks(); // Clear from constructor

      localGameEngine.showLoadGameUI(); // Method is now sync

      expect(localBed.mocks.logger.error).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.'
      );
      expect(
        localBed.mocks.safeEventDispatcher.dispatch
      ).not.toHaveBeenCalled();

      await localBed.cleanup();
    });
  });

  describe('getEngineStatus', () => {
    beforeEach(() => {
      // Create gameEngine for these tests
      gameEngine = testBed.engine;
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
      testBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
      await gameEngine.startNewGame(MOCK_WORLD_NAME);
      const status = gameEngine.getEngineStatus();
      expect(status).toEqual({
        isInitialized: true,
        isLoopRunning: true,
        activeWorld: MOCK_WORLD_NAME,
      });
    });

    it('should return correct status after stopping a game', async () => {
      testBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
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
