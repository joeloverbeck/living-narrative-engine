// tests/engine/startNewGame.test.js
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": [
  "expect",
  "expectStartSuccess",
  "expectDispatchSequence",
  "expectEngineRunning",
  "expectEngineStopped"
] }] */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';

import { ENGINE_OPERATION_FAILED_UI } from '../../../src/constants/eventIds.js';
import {
  expectDispatchSequence,
  buildStopDispatches,
  buildStartDispatches,
  expectStartSuccess,
  expectEngineRunning,
  expectEngineStopped,
} from '../../common/engine/dispatchTestUtils.js';
import { DEFAULT_TEST_WORLD } from '../../common/constants.js';

/**
 * Mocks a successful initialization sequence on the provided test bed.
 *
 * @param {import('../../common/engine/gameEngineTestBed.js').GameEngineTestBed} bed - Test bed instance.
 * @returns {void}
 */
function mockInitSuccess(bed) {
  bed.mocks.initializationService.runInitializationSequence.mockResolvedValue({
    success: true,
  });
}

describeEngineSuite('GameEngine', (ctx) => {
  describe('startNewGame', () => {
    beforeEach(() => {
      mockInitSuccess(ctx.bed);
    });

    it('should successfully start a new game', async () => {
      await ctx.engine.startNewGame(DEFAULT_TEST_WORLD);
      expectStartSuccess(ctx.bed, ctx.engine, DEFAULT_TEST_WORLD);
    });

    it('should stop an existing game if already initialized, with correct event payloads from stop()', async () => {
      await ctx.bed.startAndReset('InitialWorld');
      await ctx.engine.startNewGame(DEFAULT_TEST_WORLD);

      expect(ctx.bed.mocks.logger.warn).toHaveBeenCalledWith(
        'GameEngine._prepareForNewGameSession: Engine already initialized. Stopping existing game before starting new.'
      );
      expect(
        ctx.bed.mocks.playtimeTracker.endSessionAndAccumulate
      ).toHaveBeenCalledTimes(1);
      expect(ctx.bed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);
      expectDispatchSequence(
        ctx.bed.mocks.safeEventDispatcher.dispatch,
        ...buildStopDispatches(),
        ...buildStartDispatches(DEFAULT_TEST_WORLD)
      );
      expectEngineRunning(ctx.engine, DEFAULT_TEST_WORLD);
    });

    it('should handle InitializationService failure', async () => {
      const initError = new Error('Initialization failed via service');
      ctx.bed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: false,
          error: initError,
        }
      );

      await expect(ctx.engine.startNewGame(DEFAULT_TEST_WORLD)).rejects.toThrow(
        initError
      );

      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `Failed to start new game: ${initError.message}`,
          errorTitle: 'Initialization Error',
        }
      );
      expectEngineStopped(ctx.engine);
    });

    it('should handle general errors during start-up and dispatch failure event', async () => {
      const startupError = new Error('TurnManager failed to start');
      ctx.bed.mocks.playtimeTracker.startSession.mockImplementation(() => {}); // Make sure this doesn't throw
      ctx.bed.mocks.turnManager.start.mockRejectedValue(startupError); // TurnManager fails to start

      await expect(ctx.engine.startNewGame(DEFAULT_TEST_WORLD)).rejects.toThrow(
        startupError
      );

      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `Failed to start new game: ${startupError.message}`, // Error from TurnManager
          errorTitle: 'Initialization Error',
        }
      );
      expectEngineStopped(ctx.engine);
    });
  });
});
