// tests/engine/showLoadGameUI.test.js
import { describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { generateServiceUnavailableTests } from '../../common/engine/gameEngineHelpers.js';
import { expectShowLoadGameUIDispatch } from '../../common/engine/dispatchTestUtils.js';
import { GAME_PERSISTENCE_LOAD_UI_UNAVAILABLE } from '../../common/engine/unavailableMessages.js';

describeEngineSuite('GameEngine', (context) => {
  describe('showLoadGameUI', () => {
    it('should dispatch REQUEST_SHOW_LOAD_GAME_UI and log intent if persistence service is available', async () => {
      await context.engine.showLoadGameUI();

      expect(context.bed.getLogger().debug).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
      );
      expectShowLoadGameUIDispatch(
        context.bed.getSafeEventDispatcher().dispatch
      );
    });

    it('should log warning if dispatcher reports failure', async () => {
      context.bed
        .getSafeEventDispatcher()
        .dispatch.mockResolvedValueOnce(false);

      await context.engine.showLoadGameUI();

      expect(context.bed.getLogger().debug).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
      );
      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: SafeEventDispatcher reported failure when dispatching Load Game UI request.'
      );
      expectShowLoadGameUIDispatch(
        context.bed.getSafeEventDispatcher().dispatch
      );
    });

    it('should log error if dispatcher throws while requesting Load Game UI', async () => {
      const dispatchError = new Error('load ui dispatch failed');
      context.bed
        .getSafeEventDispatcher()
        .dispatch.mockRejectedValueOnce(dispatchError);

      await context.engine.showLoadGameUI();

      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: SafeEventDispatcher threw when dispatching Load Game UI request.',
        dispatchError
      );
      expectShowLoadGameUIDispatch(
        context.bed.getSafeEventDispatcher().dispatch
      );
    });

    generateServiceUnavailableTests(
      [[tokens.GamePersistenceService, GAME_PERSISTENCE_LOAD_UI_UNAVAILABLE]],
      async (bed, engine) => {
        await engine.showLoadGameUI();
        return [bed.getLogger().error, bed.getSafeEventDispatcher().dispatch];
      },
      {}
    )('should log error if %s is unavailable when showing load UI');
  });
});
