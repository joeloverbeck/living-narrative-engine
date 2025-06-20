// tests/engine/stop.test.js
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
});
