// tests/engine/stop.test.js
import { beforeEach, describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createGameEngineTestBed,
  describeEngineSuite,
} from '../../common/engine/gameEngineTestBed.js';
import '../../common/engine/engineTestTypedefs.js';
import { ENGINE_STOPPED_UI } from '../../../src/constants/eventIds.js';
import { expectEngineStatus } from '../../common/engine/dispatchTestUtils.js';

describeEngineSuite('GameEngine', (ctx) => {
  const MOCK_WORLD_NAME = 'TestWorld';

  describe('stop', () => {
    beforeEach(() => {
      // Ensure engine is fresh for each 'stop' test
    });

    it('should successfully stop a running game, with correct logging, events, and state changes', async () => {
      ctx.bed.mocks.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
      await ctx.bed.startAndReset(MOCK_WORLD_NAME); // Start the game first and clear mocks

      await ctx.engine.stop();

      expect(
        ctx.bed.mocks.playtimeTracker.endSessionAndAccumulate
      ).toHaveBeenCalledTimes(1);
      expect(ctx.bed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);

      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        { inputDisabledMessage: 'Game stopped. Engine is inactive.' }
      );

      expectEngineStatus(ctx.engine, {
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });

      expect(ctx.bed.mocks.logger.warn).not.toHaveBeenCalled();
    });

    it('should do nothing and log if engine is already stopped', async () => {
      // ctx.engine is fresh, so not initialized
      expectEngineStatus(ctx.engine, {
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });

      ctx.bed.resetMocks();

      await ctx.engine.stop();

      expect(
        ctx.bed.mocks.playtimeTracker.endSessionAndAccumulate
      ).not.toHaveBeenCalled();
      expect(ctx.bed.mocks.turnManager.stop).not.toHaveBeenCalled();
      expect(
        ctx.bed.mocks.safeEventDispatcher.dispatch
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
        await localBed.startAndReset(MOCK_WORLD_NAME);

        expectEngineStatus(localEngine, {
          isInitialized: true,
          isLoopRunning: true,
          activeWorld: MOCK_WORLD_NAME,
        });

        await localEngine.stop();

        expect(localBed.mocks.logger.warn).toHaveBeenCalledWith(expectedMsg);
        expect(localBed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);

        await localBed.cleanup();
      }
    );
  });
});
