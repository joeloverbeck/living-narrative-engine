// tests/engine/triggerManualSave.test.js
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createGameEngineTestBed,
  describeGameEngineSuite,
} from '../../common/engine/gameEngineTestBed.js';
import {
  expectDispatchSequence,
  buildSaveDispatches,
  DEFAULT_ACTIVE_WORLD_FOR_SAVE,
} from '../../common/engine/dispatchTestUtils.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../src/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../../src/interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../../../src/interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */
/** @typedef {import('../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../../src/interfaces/IInitializationService.js').IInitializationService} IInitializationService */
/** @typedef {import('../../../src/interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

describeGameEngineSuite('GameEngine', (getBed) => {
  let testBed;
  let gameEngine; // Instance of GameEngine

  beforeEach(() => {
    testBed = getBed();
  });
  describe('triggerManualSave', () => {
    const SAVE_NAME = 'MySaveFile';
    const MOCK_ACTIVE_WORLD_FOR_SAVE = DEFAULT_ACTIVE_WORLD_FOR_SAVE;

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

      it.each([
        [
          'GamePersistenceService',
          tokens.GamePersistenceService,
          'GamePersistenceService is not available. Cannot save game.',
        ],
      ])(
        'should dispatch error if %s is unavailable',
        async (_name, token, expectedMsg) => {
          const localBed = createGameEngineTestBed({ [token]: null });

          localBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
            {
              success: true,
            }
          );
          await localBed.engine.startNewGame(MOCK_ACTIVE_WORLD_FOR_SAVE);

          localBed.resetMocks();

          const result = await localBed.engine.triggerManualSave(SAVE_NAME);

          expect(localBed.mocks.logger.error).toHaveBeenCalledWith(
            `GameEngine.triggerManualSave: ${expectedMsg}`
          );
          expect(
            localBed.mocks.safeEventDispatcher.dispatch
          ).not.toHaveBeenCalled();
          expect(result).toEqual({ success: false, error: expectedMsg });

          await localBed.cleanup();
        }
      );

      it('should successfully save, dispatch all UI events in order, and return success result', async () => {
        const saveResultData = { success: true, filePath: 'path/to/my.sav' };
        testBed.mocks.gamePersistenceService.saveGame.mockResolvedValue(
          saveResultData
        );

        const result = await gameEngine.triggerManualSave(SAVE_NAME);

        expectDispatchSequence(
          testBed.mocks.safeEventDispatcher.dispatch,
          ...buildSaveDispatches(SAVE_NAME, saveResultData.filePath)
        );

        expect(
          testBed.mocks.gamePersistenceService.saveGame
        ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);
        expect(result).toEqual(saveResultData);
      });

      it('should handle save failure from persistence service, dispatch UI events, and return failure result', async () => {
        const saveFailureData = {
          success: false,
          error: 'Disk is critically full',
        };
        testBed.mocks.gamePersistenceService.saveGame.mockResolvedValue(
          saveFailureData
        );

        const result = await gameEngine.triggerManualSave(SAVE_NAME);

        expectDispatchSequence(
          testBed.mocks.safeEventDispatcher.dispatch,
          ...buildSaveDispatches(SAVE_NAME)
        );

        expect(
          testBed.mocks.gamePersistenceService.saveGame
        ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);
        expect(result).toEqual(saveFailureData);
      });

      it('should handle unexpected error during saveGame call, dispatch UI events, and return failure result', async () => {
        const unexpectedError = new Error('Network connection failed');
        testBed.mocks.gamePersistenceService.saveGame.mockRejectedValue(
          unexpectedError
        );

        const result = await gameEngine.triggerManualSave(SAVE_NAME);

        expectDispatchSequence(
          testBed.mocks.safeEventDispatcher.dispatch,
          ...buildSaveDispatches(SAVE_NAME)
        );

        expect(
          testBed.mocks.gamePersistenceService.saveGame
        ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);
        expect(result).toEqual({
          success: false,
          error: `Unexpected error during save: ${unexpectedError.message}`,
        });
      });
    });
  });
});
