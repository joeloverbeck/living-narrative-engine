// tests/engine/startNewGame.test.js
import { beforeEach, describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import '../../common/engine/engineTestTypedefs.js';

import {
  ENGINE_INITIALIZING_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_STOPPED_UI,
} from '../../../src/constants/eventIds.js';

describeEngineSuite('GameEngine', (ctx) => {
  let testBed;
  let gameEngine; // Instance of GameEngine

  const MOCK_WORLD_NAME = 'TestWorld';

  beforeEach(() => {
    testBed = ctx.bed;
  });

  describe('startNewGame', () => {
    beforeEach(() => {
      gameEngine = ctx.engine; // Standard instance for these tests
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
});
