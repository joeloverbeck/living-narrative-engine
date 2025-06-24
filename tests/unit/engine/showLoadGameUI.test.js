// tests/engine/showLoadGameUI.test.js
import { describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { generateServiceUnavailableTests } from '../../common/engine/gameEngineHelpers.js';
import { expectShowLoadGameUIDispatch } from '../../common/engine/dispatchTestUtils.js';
import { GAME_PERSISTENCE_LOAD_UI_UNAVAILABLE } from '../../common/engine/unavailableMessages.js';

describeEngineSuite('GameEngine', (context) => {
  describe('showLoadGameUI', () => {
    it('should dispatch REQUEST_SHOW_LOAD_GAME_UI and log intent if persistence service is available', () => {
      context.engine.showLoadGameUI(); // Method is now sync

      expect(context.bed.getLogger().debug).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
      );
      expectShowLoadGameUIDispatch(
        context.bed.getSafeEventDispatcher().dispatch
      );
    });

    generateServiceUnavailableTests(
      [[tokens.GamePersistenceService, GAME_PERSISTENCE_LOAD_UI_UNAVAILABLE]],
      (bed, engine) => {
        engine.showLoadGameUI();
        return [bed.getLogger().error, bed.getSafeEventDispatcher().dispatch];
      },
      {}
    )('should log error if %s is unavailable when showing load UI');
  });
});
