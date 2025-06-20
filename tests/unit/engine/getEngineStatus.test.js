// tests/engine/getEngineStatus.test.js
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
