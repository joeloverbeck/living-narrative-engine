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
import { mockInitializationSuccess } from '../../common/engine/gameEngineHelpers.js';

describeEngineSuite('GameEngine', (context) => {
  describe('startNewGame', () => {
    beforeEach(() => {
      mockInitializationSuccess(context.bed);
    });

    it('should successfully start a new game', async () => {
      await context.engine.startNewGame(DEFAULT_TEST_WORLD);
      expectStartSuccess(context.bed, context.engine, DEFAULT_TEST_WORLD);
    });

    it('should stop an existing game if already initialized, with correct event payloads from stop()', async () => {
      await context.bed.startAndReset('InitialWorld');
      await context.engine.startNewGame(DEFAULT_TEST_WORLD);

      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Engine already initialized. Stopping existing game before starting new.'
        )
      );
      expect(
        context.bed.getPlaytimeTracker().endSessionAndAccumulate
      ).toHaveBeenCalledTimes(1);
      expect(context.bed.getTurnManager().stop).toHaveBeenCalledTimes(1);
      expectDispatchSequence(
        context.bed.getSafeEventDispatcher().dispatch,
        ...buildStopDispatches(),
        ...buildStartDispatches(DEFAULT_TEST_WORLD)
      );
      expectEngineRunning(context.engine, DEFAULT_TEST_WORLD);
    });

    it('should handle InitializationService failure', async () => {
      const initError = new Error('Initialization failed via service');
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({
          success: false,
          error: initError,
        });

      await expect(
        context.engine.startNewGame(DEFAULT_TEST_WORLD)
      ).rejects.toThrow(initError);

      expect(
        context.bed.getSafeEventDispatcher().dispatch
      ).toHaveBeenCalledWith(ENGINE_OPERATION_FAILED_UI, {
        errorMessage: `Failed to start new game: ${initError.message}`,
        errorTitle: 'Initialization Error',
      });
      expectEngineStopped(context.engine);
    });

    it('should handle general errors during start-up and dispatch failure event', async () => {
      const startupError = new Error('TurnManager failed to start');
      context.bed
        .getPlaytimeTracker()
        .startSession.mockImplementation(() => {}); // Make sure this doesn't throw
      context.bed.getTurnManager().start.mockRejectedValue(startupError); // TurnManager fails to start

      await expect(
        context.engine.startNewGame(DEFAULT_TEST_WORLD)
      ).rejects.toThrow(startupError);

      expect(
        context.bed.getSafeEventDispatcher().dispatch
      ).toHaveBeenCalledWith(ENGINE_OPERATION_FAILED_UI, {
        errorMessage: `Failed to start new game: ${startupError.message}`, // Error from TurnManager
        errorTitle: 'Initialization Error',
      });
      expectEngineStopped(context.engine);
    });

    it.each([null, ''])(
      'should reject invalid world names: %p',
      async (badName) => {
        const expectedMessage =
          'GameEngine.startNewGame: worldName must be a non-empty string.';

        await expect(context.engine.startNewGame(badName)).rejects.toThrow(
          expectedMessage
        );

        expect(context.bed.getLogger().error).toHaveBeenCalledWith(
          expectedMessage
        );
        expectEngineStopped(context.engine);
      }
    );
  });
});
