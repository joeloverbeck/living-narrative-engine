// tests/engine/showLoadGameUI.test.js
import { beforeEach, describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { runUnavailableServiceTest } from '../../common/engine/gameEngineHelpers.js';
import '../../common/engine/engineTestTypedefs.js';
import { REQUEST_SHOW_LOAD_GAME_UI } from '../../../src/constants/eventIds.js';

describeEngineSuite('GameEngine', (ctx) => {
  describe('showLoadGameUI', () => {
    beforeEach(() => {
      ctx.bed.resetMocks();
    });

    it('should dispatch REQUEST_SHOW_LOAD_GAME_UI and log intent if persistence service is available', () => {
      ctx.engine.showLoadGameUI(); // Method is now sync

      expect(ctx.bed.mocks.logger.debug).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
      );
      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        REQUEST_SHOW_LOAD_GAME_UI,
        {}
      );
      expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledTimes(
        1
      );
    });

    it.each(
      runUnavailableServiceTest(
        [
          [
            tokens.GamePersistenceService,
            'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.',
          ],
        ],
        (bed, engine) => {
          engine.showLoadGameUI();
          return [
            bed.mocks.logger.error,
            bed.mocks.safeEventDispatcher.dispatch,
          ];
        }
      )
    )(
      'should log error if %s is unavailable when showing load UI',
      async (_token, fn) => {
        expect.assertions(2);
        await fn();
      }
    );
  });
});
