// tests/engine/loadGame.test.js
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
import {
  expectDispatchSequence,
  buildSaveDispatches,
  DEFAULT_ACTIVE_WORLD_FOR_SAVE,
} from '../../common/engine/dispatchTestUtils.js';
import {
  ENGINE_INITIALIZING_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_STOPPED_UI,
  REQUEST_SHOW_SAVE_GAME_UI,
  REQUEST_SHOW_LOAD_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../../../src/constants/eventIds.js';

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
      expectDispatchSequence(localBed.mocks.safeEventDispatcher.dispatch, [
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: rawErrorMsg,
          errorTitle: 'Load Failed',
        },
      ]);
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
});
