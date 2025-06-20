// tests/engine/showSaveGameUI.test.js
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
});
