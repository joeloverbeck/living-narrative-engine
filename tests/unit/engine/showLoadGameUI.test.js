// tests/engine/showLoadGameUI.test.js
import { describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { runUnavailableServiceSuite } from '../../common/engine/gameEngineHelpers.js';
import { expectShowLoadGameUIDispatch } from '../../common/engine/dispatchTestUtils.js';
import { GAME_PERSISTENCE_LOAD_UI_UNAVAILABLE } from '../../common/engine/unavailableMessages.js';

describeEngineSuite('GameEngine', (ctx) => {
  describe('showLoadGameUI', () => {
    it('should dispatch REQUEST_SHOW_LOAD_GAME_UI and log intent if persistence service is available', () => {
      ctx.engine.showLoadGameUI(); // Method is now sync

      expect(ctx.bed.mocks.logger.debug).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
      );
      expectShowLoadGameUIDispatch(ctx.bed.mocks.safeEventDispatcher.dispatch);
    });

    runUnavailableServiceSuite(
      [[tokens.GamePersistenceService, GAME_PERSISTENCE_LOAD_UI_UNAVAILABLE]],
      (bed, engine) => {
        engine.showLoadGameUI();
        return [bed.mocks.logger.error, bed.mocks.safeEventDispatcher.dispatch];
      }
    )('should log error if %s is unavailable when showing load UI');
  });
});
