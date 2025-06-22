// tests/engine/triggerManualSave.test.js
import { describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  describeEngineSuite,
  describeInitializedEngineSuite,
} from '../../common/engine/gameEngineTestBed.js';
import {
  runUnavailableServiceSuite,
  withGameEngineBed,
} from '../../common/engine/gameEngineHelpers.js';
import '../../common/engine/engineTestTypedefs.js';
import {
  expectDispatchSequence,
  buildSaveDispatches,
} from '../../common/engine/dispatchTestUtils.js';
import { DEFAULT_ACTIVE_WORLD_FOR_SAVE } from '../../common/constants.js';

describeEngineSuite('GameEngine', () => {
  describe('triggerManualSave', () => {
    const SAVE_NAME = 'MySaveFile';
    const MOCK_ACTIVE_WORLD_FOR_SAVE = DEFAULT_ACTIVE_WORLD_FOR_SAVE;

    it('should dispatch error and not attempt save if engine is not initialized', async () => {
      await withGameEngineBed({}, async (bed, engine) => {
        bed.resetMocks();
        const result = await engine.triggerManualSave(SAVE_NAME);
        const expectedErrorMsg =
          'Game engine is not initialized. Cannot save game.';

        expect(bed.mocks.safeEventDispatcher.dispatch).not.toHaveBeenCalled();
        expect(
          bed.mocks.gamePersistenceService.saveGame
        ).not.toHaveBeenCalled();
        expect(result).toEqual({ success: false, error: expectedErrorMsg });
      });
    });

    describeInitializedEngineSuite(
      'when engine is initialized',
      (ctx) => {
        runUnavailableServiceSuite(
          [
            [
              tokens.GamePersistenceService,
              'GameEngine.triggerManualSave: GamePersistenceService is not available. Cannot save game.',
              { preInit: true },
            ],
          ],
          async (bed, engine) => {
            const result = await engine.triggerManualSave(SAVE_NAME);
            // eslint-disable-next-line jest/no-standalone-expect
            expect(
              bed.mocks.safeEventDispatcher.dispatch
            ).not.toHaveBeenCalled();
            // eslint-disable-next-line jest/no-standalone-expect
            expect(result).toEqual({
              success: false,
              error:
                'GamePersistenceService is not available. Cannot save game.',
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

        it('should handle save failure from persistence service, dispatch UI events, and return failure result', async () => {
          const saveFailureData = {
            success: false,
            error: 'Disk is critically full',
          };
          ctx.bed.mocks.gamePersistenceService.saveGame.mockResolvedValue(
            saveFailureData
          );

          const result = await ctx.engine.triggerManualSave(SAVE_NAME);

          expectDispatchSequence(
            ctx.bed.mocks.safeEventDispatcher.dispatch,
            ...buildSaveDispatches(SAVE_NAME)
          );

          expect(
            ctx.bed.mocks.gamePersistenceService.saveGame
          ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);
          expect(result).toEqual(saveFailureData);
        });

        it('should handle unexpected error during saveGame call, dispatch UI events, and return failure result', async () => {
          const unexpectedError = new Error('Network connection failed');
          ctx.bed.mocks.gamePersistenceService.saveGame.mockRejectedValue(
            unexpectedError
          );

          const result = await ctx.engine.triggerManualSave(SAVE_NAME);

          expectDispatchSequence(
            ctx.bed.mocks.safeEventDispatcher.dispatch,
            ...buildSaveDispatches(SAVE_NAME)
          );

          expect(
            ctx.bed.mocks.gamePersistenceService.saveGame
          ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);
          expect(result).toEqual({
            success: false,
            error: `Unexpected error during save: ${unexpectedError.message}`,
          });
        });
      },
      MOCK_ACTIVE_WORLD_FOR_SAVE
    );
  });
});
