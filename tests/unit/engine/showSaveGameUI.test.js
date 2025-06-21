// tests/engine/showSaveGameUI.test.js
import { beforeEach, describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createGameEngineTestBed,
  describeGameEngineSuite,
} from '../../common/engine/gameEngineTestBed.js';
import '../../common/engine/engineTestTypedefs.js';
import {
  REQUEST_SHOW_SAVE_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../../../src/constants/eventIds.js';

describeGameEngineSuite('GameEngine', (getBed) => {
  let testBed;
  let gameEngine; // Instance of GameEngine

  const MOCK_WORLD_NAME = 'TestWorld';

  beforeEach(() => {
    testBed = getBed();
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

    it.each([
      [
        'GamePersistenceService',
        tokens.GamePersistenceService,
        'GameEngine.showSaveGameUI: GamePersistenceService is unavailable. Cannot show Save Game UI.',
      ],
    ])(
      'should log error if %s is unavailable when showing save UI',
      async (_name, token, expectedMsg) => {
        const localBed = createGameEngineTestBed({ [token]: null });
        const localGameEngine = localBed.engine;
        localBed.resetMocks();

        localGameEngine.showSaveGameUI();

        expect(localBed.mocks.logger.error).toHaveBeenCalledWith(expectedMsg);
        expect(
          localBed.mocks.safeEventDispatcher.dispatch
        ).not.toHaveBeenCalled();
        expect(
          localBed.mocks.gamePersistenceService.isSavingAllowed
        ).not.toHaveBeenCalled();

        await localBed.cleanup();
      }
    );
  });
});
