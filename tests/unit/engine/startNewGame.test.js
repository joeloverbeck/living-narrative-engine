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
import { expectEngineStatus } from '../../common/engine/dispatchTestUtils.js';

describeEngineSuite('GameEngine', (ctx) => {
  const MOCK_WORLD_NAME = 'TestWorld';

  describe('startNewGame', () => {
    beforeEach(() => {
      ctx.bed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
    });

    it('should successfully start a new game', async () => {
      await ctx.engine.startNewGame(MOCK_WORLD_NAME);

      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_INITIALIZING_UI,
        { worldName: MOCK_WORLD_NAME },
        { allowSchemaNotFound: true }
      );
      expect(ctx.bed.mocks.entityManager.clearAll).toHaveBeenCalled();
      expect(ctx.bed.mocks.playtimeTracker.reset).toHaveBeenCalled();
      expect(ctx.bed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IInitializationService
      );
      expect(
        ctx.bed.mocks.initializationService.runInitializationSequence
      ).toHaveBeenCalledWith(MOCK_WORLD_NAME);
      expect(ctx.bed.mocks.playtimeTracker.startSession).toHaveBeenCalled();
      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        {
          activeWorld: MOCK_WORLD_NAME,
          message: 'Enter command...',
        }
      );
      expect(ctx.bed.mocks.turnManager.start).toHaveBeenCalled();

      expectEngineStatus(ctx.engine, {
        isInitialized: true,
        isLoopRunning: true,
        activeWorld: MOCK_WORLD_NAME,
      });
    });

    it('should stop an existing game if already initialized, with correct event payloads from stop()', async () => {
      ctx.bed.mocks.initializationService.runInitializationSequence.mockResolvedValueOnce(
        { success: true }
      );
      await ctx.bed.startAndReset('InitialWorld');

      ctx.bed.mocks.initializationService.runInitializationSequence.mockResolvedValueOnce(
        { success: true }
      );
      await ctx.engine.startNewGame(MOCK_WORLD_NAME);

      expect(ctx.bed.mocks.logger.warn).toHaveBeenCalledWith(
        'GameEngine._prepareForNewGameSession: Engine already initialized. Stopping existing game before starting new.'
      );
      expect(
        ctx.bed.mocks.playtimeTracker.endSessionAndAccumulate
      ).toHaveBeenCalledTimes(1);
      expect(ctx.bed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);
      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        { inputDisabledMessage: 'Game stopped. Engine is inactive.' }
      );
      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        {
          activeWorld: MOCK_WORLD_NAME,
          message: 'Enter command...',
        }
      );
      expectEngineStatus(ctx.engine, {
        isInitialized: true,
        isLoopRunning: true,
        activeWorld: MOCK_WORLD_NAME,
      });
    });

    it('should handle InitializationService failure', async () => {
      const initError = new Error('Initialization failed via service');
      ctx.bed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: false,
          error: initError,
        }
      );

      await expect(ctx.engine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(
        initError
      );

      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `Failed to start new game: ${initError.message}`,
          errorTitle: 'Initialization Error',
        }
      );
      expectEngineStatus(ctx.engine, {
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });
    });

    it('should handle general errors during start-up and dispatch failure event', async () => {
      ctx.bed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
      const startupError = new Error('TurnManager failed to start');
      ctx.bed.mocks.playtimeTracker.startSession.mockImplementation(() => {}); // Make sure this doesn't throw
      ctx.bed.mocks.turnManager.start.mockRejectedValue(startupError); // TurnManager fails to start

      await expect(ctx.engine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(
        startupError
      );

      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `Failed to start new game: ${startupError.message}`, // Error from TurnManager
          errorTitle: 'Initialization Error',
        }
      );
      expectEngineStatus(ctx.engine, {
        isInitialized: false, // Should be reset by _handleNewGameFailure
        isLoopRunning: false,
        activeWorld: null,
      });
    });
  });
});
