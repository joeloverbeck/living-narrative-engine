// tests/engine/showLoadGameUI.test.js
import { beforeEach, describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createGameEngineTestBed,
  describeEngineSuite,
} from '../../common/engine/gameEngineTestBed.js';
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

    it.each([
      [
        'GamePersistenceService',
        tokens.GamePersistenceService,
        'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.',
      ],
    ])(
      'should log error if %s is unavailable when showing load UI',
      async (_name, token, expectedMsg) => {
        const localBed = createGameEngineTestBed({ [token]: null });
        const localGameEngine = localBed.engine;
        localBed.resetMocks();

        localGameEngine.showLoadGameUI();

        expect(localBed.mocks.logger.error).toHaveBeenCalledWith(expectedMsg);
        expect(
          localBed.mocks.safeEventDispatcher.dispatch
        ).not.toHaveBeenCalled();

        await localBed.cleanup();
      }
    );
  });
});
