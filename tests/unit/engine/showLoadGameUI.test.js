// tests/engine/showLoadGameUI.test.js
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createGameEngineTestBed,
  describeGameEngineSuite,
} from '../../common/engine/gameEngineTestBed.js';
import { REQUEST_SHOW_LOAD_GAME_UI } from '../../../src/constants/eventIds.js';

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

    it.each([
      [
        'GamePersistenceService',
        tokens.GamePersistenceService,
        'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.',
      ],
    ])(
      'should log error if %s is unavailable when showing load UI',
      async (_name, token, expectedMsg) => {
        const localBed = createGameEngineTestBed({ [token]: null });
        const localGameEngine = localBed.engine;
        localBed.resetMocks();

        localGameEngine.showLoadGameUI();

        expect(localBed.mocks.logger.error).toHaveBeenCalledWith(expectedMsg);
        expect(
          localBed.mocks.safeEventDispatcher.dispatch
        ).not.toHaveBeenCalled();

        await localBed.cleanup();
      }
    );
  });
});
