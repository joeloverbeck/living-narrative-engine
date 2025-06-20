// tests/engine/showLoadGameUI.test.js
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
});
