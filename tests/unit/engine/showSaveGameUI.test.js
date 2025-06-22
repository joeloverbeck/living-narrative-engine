// tests/engine/showSaveGameUI.test.js
import { describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeInitializedEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { runUnavailableServiceSuite } from '../../common/engine/gameEngineHelpers.js';
import {
  REQUEST_SHOW_SAVE_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../../../src/constants/eventIds.js';
import { DEFAULT_TEST_WORLD } from '../../common/constants.js';

describeInitializedEngineSuite(
  'GameEngine',
  (ctx) => {
    describe('showSaveGameUI', () => {
      it('should dispatch REQUEST_SHOW_SAVE_GAME_UI if saving is allowed and log intent', () => {
        ctx.bed.mocks.gamePersistenceService.isSavingAllowed.mockReturnValue(
          true
        );
        ctx.engine.showSaveGameUI(); // Method is now sync

        expect(ctx.bed.mocks.logger.debug).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: Dispatching request to show Save Game UI.'
        );
        expect(
          ctx.bed.mocks.gamePersistenceService.isSavingAllowed
        ).toHaveBeenCalledWith(true); // engine is initialized
        expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
          REQUEST_SHOW_SAVE_GAME_UI,
          {}
        );
        expect(
          ctx.bed.mocks.safeEventDispatcher.dispatch
        ).toHaveBeenCalledTimes(1);
      });

      it('should dispatch CANNOT_SAVE_GAME_INFO if saving is not allowed and log reason', () => {
        ctx.bed.mocks.gamePersistenceService.isSavingAllowed.mockReturnValue(
          false
        );
        ctx.engine.showSaveGameUI(); // Method is now sync

        expect(ctx.bed.mocks.logger.warn).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: Saving is not currently allowed.'
        );
        expect(
          ctx.bed.mocks.gamePersistenceService.isSavingAllowed
        ).toHaveBeenCalledWith(true);
        expect(ctx.bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
          CANNOT_SAVE_GAME_INFO
        );
        expect(
          ctx.bed.mocks.safeEventDispatcher.dispatch
        ).toHaveBeenCalledTimes(1);
      });

      runUnavailableServiceSuite(
        [
          [
            tokens.GamePersistenceService,
            'GameEngine.showSaveGameUI: GamePersistenceService is unavailable. Cannot show Save Game UI.',
          ],
        ],
        (bed, engine) => {
          engine.showSaveGameUI();
          expect(
            bed.mocks.gamePersistenceService.isSavingAllowed
          ).not.toHaveBeenCalled();
          return [
            bed.mocks.logger.error,
            bed.mocks.safeEventDispatcher.dispatch,
          ];
        },
        1
      )('should log error if %s is unavailable when showing save UI');
    });
  },
  DEFAULT_TEST_WORLD
);
