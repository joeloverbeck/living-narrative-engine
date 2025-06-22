// tests/engine/stop.test.js
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": [
  "expect",
  "expectStopSuccess",
  "expectDispatchSequence",
  "expectEngineRunning",
  "expectEngineStopped"
] }] */
import {
  describeEngineSuite,
  describeInitializedEngineSuite,
} from '../../common/engine/gameEngineTestBed.js';
import { runUnavailableServiceSuite } from '../../common/engine/gameEngineHelpers.js';
import { ENGINE_STOPPED_UI } from '../../../src/constants/eventIds.js';
import {
  expectDispatchSequence,
  buildStopDispatches,
  expectStopSuccess,
  expectEngineRunning,
  expectEngineStopped,
} from '../../common/engine/dispatchTestUtils.js';
import { DEFAULT_TEST_WORLD } from '../../common/constants.js';

describeEngineSuite('GameEngine', (ctx) => {
  describe('stop', () => {
    beforeEach(() => {
      // Ensure engine is fresh for each 'stop' test
    });

    describeInitializedEngineSuite(
      'when engine is initialized',
      (ctx) => {
        it('should successfully stop a running game, with correct logging, events, and state changes', async () => {
          await ctx.engine.stop();
          expectStopSuccess(ctx.bed, ctx.engine);
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

            // eslint-disable-next-line jest/no-standalone-expect
            expect(bed.mocks.logger.warn).toHaveBeenCalledWith(expectedMsg);
            expectDispatchSequence(
              bed.mocks.safeEventDispatcher.dispatch,
              ...buildStopDispatches()
            );
            // eslint-disable-next-line jest/no-standalone-expect
            expect(bed.mocks.turnManager.stop).toHaveBeenCalledTimes(1);
            const dummyDispatch = jest.fn();
            return [bed.mocks.logger.warn, dummyDispatch];
          },
          4
        )(
          'should log warning for %s if it is not available during stop, after a successful start'
        );
      },
      DEFAULT_TEST_WORLD
    );

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
  });
});
