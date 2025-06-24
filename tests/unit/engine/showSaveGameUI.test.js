// tests/engine/showSaveGameUI.test.js
import { describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeInitializedEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { generateServiceUnavailableTests } from '../../common/engine/gameEngineHelpers.js';
import { CANNOT_SAVE_GAME_INFO } from '../../../src/constants/eventIds.js';
import { expectShowSaveGameUIDispatch } from '../../common/engine/dispatchTestUtils.js';
import { DEFAULT_TEST_WORLD } from '../../common/constants.js';
import { GAME_PERSISTENCE_SAVE_UI_UNAVAILABLE } from '../../common/engine/unavailableMessages.js';

describeInitializedEngineSuite(
  'GameEngine',
  (context) => {
    describe('showSaveGameUI', () => {
      it('should dispatch REQUEST_SHOW_SAVE_GAME_UI if saving is allowed and log intent', () => {
        context.bed
          .getGamePersistenceService()
          .isSavingAllowed.mockReturnValue(true);
        context.engine.showSaveGameUI(); // Method is now sync

        expect(context.bed.getLogger().debug).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: Dispatching request to show Save Game UI.'
        );
        expect(
          context.bed.getGamePersistenceService().isSavingAllowed
        ).toHaveBeenCalledWith(true); // engine is initialized
        expectShowSaveGameUIDispatch(
          context.bed.getSafeEventDispatcher().dispatch
        );
      });

      it('should dispatch CANNOT_SAVE_GAME_INFO if saving is not allowed and log reason', () => {
        context.bed
          .getGamePersistenceService()
          .isSavingAllowed.mockReturnValue(false);
        context.engine.showSaveGameUI(); // Method is now sync

        expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: Saving is not currently allowed.'
        );
        expect(
          context.bed.getGamePersistenceService().isSavingAllowed
        ).toHaveBeenCalledWith(true);
        expect(
          context.bed.getSafeEventDispatcher().dispatch
        ).toHaveBeenCalledWith(CANNOT_SAVE_GAME_INFO);
        expect(
          context.bed.getSafeEventDispatcher().dispatch
        ).toHaveBeenCalledTimes(1);
      });

      generateServiceUnavailableTests(
        [[tokens.GamePersistenceService, GAME_PERSISTENCE_SAVE_UI_UNAVAILABLE]],
        (bed, engine) => {
          engine.showSaveGameUI();
          // eslint-disable-next-line jest/no-standalone-expect
          expect(
            bed.getGamePersistenceService().isSavingAllowed
          ).not.toHaveBeenCalled();
          return [bed.getLogger().error, bed.getSafeEventDispatcher().dispatch];
        },
        { extraAssertions: 1 }
      )('should log error if %s is unavailable when showing save UI');
    });
  },
  DEFAULT_TEST_WORLD
);
