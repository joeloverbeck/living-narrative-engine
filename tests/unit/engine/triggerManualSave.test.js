// tests/engine/triggerManualSave.test.js
import { describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  describeEngineSuite,
  describeInitializedEngineSuite,
} from '../../common/engine/gameEngineTestBed.js';
import { runUnavailableServiceSuite } from '../../common/engine/gameEngineHelpers.js';
import {
  expectDispatchSequence,
  buildSaveDispatches,
  expectNoDispatch,
} from '../../common/engine/dispatchTestUtils.js';
import {
  DEFAULT_ACTIVE_WORLD_FOR_SAVE,
  DEFAULT_SAVE_NAME,
} from '../../common/constants.js';
import {
  GAME_PERSISTENCE_TRIGGER_SAVE_UNAVAILABLE,
  GAME_PERSISTENCE_SAVE_RESULT_UNAVAILABLE,
} from '../../common/engine/unavailableMessages.js';

describeEngineSuite('GameEngine', (ctx) => {
  describe('triggerManualSave', () => {
    const SAVE_NAME = DEFAULT_SAVE_NAME;
    const MOCK_ACTIVE_WORLD_FOR_SAVE = DEFAULT_ACTIVE_WORLD_FOR_SAVE;

    it('should dispatch error and not attempt save if engine is not initialized', async () => {
      const result = await ctx.engine.triggerManualSave(SAVE_NAME);
      const expectedErrorMsg =
        'Game engine is not initialized. Cannot save game.';

      expectNoDispatch(ctx.bed.mocks.safeEventDispatcher.dispatch);
      expect(
        ctx.bed.mocks.gamePersistenceService.saveGame
      ).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: expectedErrorMsg });
    });

    describeInitializedEngineSuite(
      'when engine is initialized',
      (ctx) => {
        runUnavailableServiceSuite(
          [
            [
              tokens.GamePersistenceService,
              GAME_PERSISTENCE_TRIGGER_SAVE_UNAVAILABLE,
              { preInit: true },
            ],
          ],
          async (bed, engine) => {
            const result = await engine.triggerManualSave(SAVE_NAME);

            expectNoDispatch(bed.mocks.safeEventDispatcher.dispatch);
            // eslint-disable-next-line jest/no-standalone-expect
            expect(result).toEqual({
              success: false,
              error: GAME_PERSISTENCE_SAVE_RESULT_UNAVAILABLE,
            });
            return [
              bed.mocks.logger.error,
              bed.mocks.safeEventDispatcher.dispatch,
            ];
          },
          2
        )('should dispatch error if %s is unavailable');

        it('should successfully save, dispatch all UI events in order, and return success result', async () => {
          const saveResultData = { success: true, filePath: 'path/to/my.sav' };
          ctx.bed.mocks.gamePersistenceService.saveGame.mockResolvedValue(
            saveResultData
          );

          const result = await ctx.engine.triggerManualSave(SAVE_NAME);

          expectDispatchSequence(
            ctx.bed.mocks.safeEventDispatcher.dispatch,
            ...buildSaveDispatches(SAVE_NAME, saveResultData.filePath)
          );

          expect(
            ctx.bed.mocks.gamePersistenceService.saveGame
          ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);
          expect(result).toEqual(saveResultData);
        });

        it.each([
          [
            'service returns failure',
            { success: false, error: 'Disk is critically full' },
          ],
          ['service rejects', new Error('Network connection failed')],
        ])(
          'should handle %s, dispatch UI events, and return failure result',
          async (_caseName, failureValue) => {
            if (failureValue instanceof Error) {
              ctx.bed.mocks.gamePersistenceService.saveGame.mockRejectedValue(
                failureValue
              );
            } else {
              ctx.bed.mocks.gamePersistenceService.saveGame.mockResolvedValue(
                failureValue
              );
            }

            const result = await ctx.engine.triggerManualSave(SAVE_NAME);

            expectDispatchSequence(
              ctx.bed.mocks.safeEventDispatcher.dispatch,
              ...buildSaveDispatches(SAVE_NAME)
            );

            expect(
              ctx.bed.mocks.gamePersistenceService.saveGame
            ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);

            const expectedResult =
              failureValue instanceof Error
                ? {
                    success: false,
                    error: `Unexpected error during save: ${failureValue.message}`,
                  }
                : failureValue;
            expect(result).toEqual(expectedResult);
          }
        );
      },
      MOCK_ACTIVE_WORLD_FOR_SAVE
    );
  });
});
