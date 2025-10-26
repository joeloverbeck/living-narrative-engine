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
      it('should dispatch REQUEST_SHOW_SAVE_GAME_UI if saving is allowed and log intent', async () => {
        context.bed
          .getGamePersistenceService()
          .isSavingAllowed.mockReturnValue(true);
        await context.engine.showSaveGameUI();

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

      it('should log warning if dispatcher reports failure', async () => {
        context.bed
          .getGamePersistenceService()
          .isSavingAllowed.mockReturnValue(true);
        context.bed
          .getSafeEventDispatcher()
          .dispatch.mockResolvedValueOnce(false);

        await context.engine.showSaveGameUI();

        expect(context.bed.getLogger().debug).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: Dispatching request to show Save Game UI.'
        );
        expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: SafeEventDispatcher reported failure when dispatching Save Game UI request.'
        );
        expectShowSaveGameUIDispatch(
          context.bed.getSafeEventDispatcher().dispatch
        );
      });

      it('should log error if dispatcher throws while requesting Save Game UI', async () => {
        context.bed
          .getGamePersistenceService()
          .isSavingAllowed.mockReturnValue(true);
        const dispatchError = new Error('dispatch failed');
        context.bed
          .getSafeEventDispatcher()
          .dispatch.mockRejectedValueOnce(dispatchError);

        await context.engine.showSaveGameUI();

        expect(context.bed.getLogger().error).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: SafeEventDispatcher threw when dispatching Save Game UI request.',
          dispatchError
        );
        expectShowSaveGameUIDispatch(
          context.bed.getSafeEventDispatcher().dispatch
        );
      });

      it('should surface save UI information when allowance check throws', async () => {
        const allowanceError = new Error('allowance failure');
        context.bed
          .getGamePersistenceService()
          .isSavingAllowed.mockImplementation(() => {
            throw allowanceError;
          });

        await expect(context.engine.showSaveGameUI()).resolves.toBeUndefined();

        expect(
          context.bed.getGamePersistenceService().isSavingAllowed
        ).toHaveBeenCalledWith(true);
        expect(context.bed.getLogger().error).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: GamePersistenceService threw when checking if saving is allowed.',
          allowanceError
        );
        expect(
          context.bed.getSafeEventDispatcher().dispatch
        ).toHaveBeenCalledWith(CANNOT_SAVE_GAME_INFO);
        expect(context.bed.getLogger().warn).not.toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: Saving is not currently allowed.'
        );
      });

      it('should dispatch CANNOT_SAVE_GAME_INFO if saving is not allowed and log reason', async () => {
        context.bed
          .getGamePersistenceService()
          .isSavingAllowed.mockReturnValue(false);
        await context.engine.showSaveGameUI();

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

      it('should log warning when dispatcher fails to emit CANNOT_SAVE_GAME_INFO', async () => {
        context.bed
          .getGamePersistenceService()
          .isSavingAllowed.mockReturnValue(false);
        context.bed
          .getSafeEventDispatcher()
          .dispatch.mockResolvedValueOnce(false);

        await context.engine.showSaveGameUI();

        expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: Saving is not currently allowed.'
        );
        expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: SafeEventDispatcher reported failure when dispatching CANNOT_SAVE_GAME_INFO.'
        );
      });

      it('should log error when dispatcher throws while dispatching CANNOT_SAVE_GAME_INFO', async () => {
        context.bed
          .getGamePersistenceService()
          .isSavingAllowed.mockReturnValue(false);
        const dispatchError = new Error('info dispatch failed');
        context.bed
          .getSafeEventDispatcher()
          .dispatch.mockRejectedValueOnce(dispatchError);

        await context.engine.showSaveGameUI();

        expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: Saving is not currently allowed.'
        );
        expect(context.bed.getLogger().error).toHaveBeenCalledWith(
          'GameEngine.showSaveGameUI: SafeEventDispatcher threw when dispatching CANNOT_SAVE_GAME_INFO.',
          dispatchError
        );
        expect(
          context.bed.getSafeEventDispatcher().dispatch
        ).toHaveBeenCalledWith(CANNOT_SAVE_GAME_INFO);
      });

      generateServiceUnavailableTests(
        [[tokens.GamePersistenceService, GAME_PERSISTENCE_SAVE_UI_UNAVAILABLE]],
        async (bed, engine) => {
          await engine.showSaveGameUI();
          // eslint-disable-next-line jest/no-standalone-expect
          expect(
            bed.getGamePersistenceService().isSavingAllowed
          ).not.toHaveBeenCalled();
          // eslint-disable-next-line jest/no-standalone-expect
          expect(bed.getSafeEventDispatcher().dispatch).toHaveBeenCalledWith(
            CANNOT_SAVE_GAME_INFO
          );
          return [bed.getLogger().error, bed.getSafeEventDispatcher().dispatch];
        },
        { extraAssertions: 2, expectNoDispatches: false }
      )('should log error if %s is unavailable when showing save UI');
    });
  },
  DEFAULT_TEST_WORLD
);
