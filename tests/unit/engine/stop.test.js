// tests/engine/stop.test.js
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { runUnavailableServiceSuite } from '../../common/engine/gameEngineHelpers.js';
import { ENGINE_STOPPED_UI } from '../../../src/constants/eventIds.js';
import {
  expectDispatchSequence,
  buildStopDispatches,
  expectEngineRunning,
  expectEngineStopped,
} from '../../common/engine/dispatchTestUtils.js';
import { DEFAULT_TEST_WORLD } from '../../common/constants.js';

describeEngineSuite('GameEngine', (ctx) => {
  describe('stop', () => {
    beforeEach(() => {
      // Ensure engine is fresh for each 'stop' test
    });

    it('should successfully stop a running game, with correct logging, events, and state changes', async () => {
      await ctx.bed.startAndReset(DEFAULT_TEST_WORLD);

      await ctx.engine.stop();

      expect(
        ctx.bed.mocks.playtimeTracker.endSessionAndAccumulate
      ).toHaveBeenCalledTimes(1);
      expect(ctx.bed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);

      expectDispatchSequence(
        ctx.bed.mocks.safeEventDispatcher.dispatch,
        ...buildStopDispatches()
      );

      expectEngineStopped(ctx.engine);

      expect(ctx.bed.mocks.logger.warn).not.toHaveBeenCalled();
    });

    it('should do nothing and log if engine is already stopped', async () => {
      // ctx.engine is fresh, so not initialized
      expectEngineStopped(ctx.engine);

      await ctx.engine.stop();

      expect(
        ctx.bed.mocks.playtimeTracker.endSessionAndAccumulate
      ).not.toHaveBeenCalled();
      expect(ctx.bed.mocks.turnManager.stop).not.toHaveBeenCalled();
      expect(
        ctx.bed.mocks.safeEventDispatcher.dispatch
      ).not.toHaveBeenCalledWith(ENGINE_STOPPED_UI, expect.anything());
    });

    runUnavailableServiceSuite(
      [
        [
          tokens.PlaytimeTracker,
          'GameEngine.stop: PlaytimeTracker service not available, cannot end session.',
          { preInit: true },
        ],
      ],
      async (bed, engine, expectedMsg) => {
        expectEngineRunning(engine, DEFAULT_TEST_WORLD);

        await engine.stop();

        expect(bed.mocks.logger.warn).toHaveBeenCalledWith(expectedMsg);
        expectDispatchSequence(
          bed.mocks.safeEventDispatcher.dispatch,
          ...buildStopDispatches()
        );
        expect(bed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);
        const dummyDispatch = jest.fn();
        return [bed.mocks.logger.warn, dummyDispatch];
      },
      4
    )(
      'should log warning for %s if it is not available during stop, after a successful start'
    );
  });
});
