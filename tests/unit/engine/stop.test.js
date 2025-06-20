// tests/engine/stop.test.js
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { createGameEngineTestBed } from '../../common/engine/gameEngineTestBed.js';
import { ENGINE_STOPPED_UI } from '../../../src/constants/eventIds.js';

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

    it.each([
      [
        'PlaytimeTracker',
        tokens.PlaytimeTracker,
        'GameEngine.stop: PlaytimeTracker service not available, cannot end session.',
      ],
    ])(
      'should log warning for %s if it is not available during stop, after a successful start',
      async (_name, token, expectedMsg) => {
        const localBed = createGameEngineTestBed({ [token]: null });
        const localEngine = localBed.engine;

        localBed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
          { success: true }
        );
        await localEngine.startNewGame(MOCK_WORLD_NAME);

        const statusAfterStart = localEngine.getEngineStatus();
        expect(statusAfterStart.isInitialized).toBe(true);
        expect(statusAfterStart.isLoopRunning).toBe(true);

        localBed.resetMocks();

        await localEngine.stop();

        expect(localBed.mocks.logger.warn).toHaveBeenCalledWith(expectedMsg);
        expect(localBed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);

        await localBed.cleanup();
      }
    );
  });
});
