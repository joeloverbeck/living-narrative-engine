// tests/engine/triggerManualSave.test.js
import { describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  describeEngineSuite,
  describeInitializedEngineSuite,
} from '../../common/engine/gameEngineTestBed.js';
import { generateServiceUnavailableTests } from '../../common/engine/gameEngineHelpers.js';
import {
  expectDispatchSequence,
  buildSaveDispatches,
  buildFailedSaveDispatches,
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
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';

describeEngineSuite('GameEngine', (context) => {
  describe('triggerManualSave', () => {
    const SAVE_NAME = DEFAULT_SAVE_NAME;
    const MOCK_ACTIVE_WORLD_FOR_SAVE = DEFAULT_ACTIVE_WORLD_FOR_SAVE;

    it('should dispatch error and not attempt save if engine is not initialized', async () => {
      const result = await context.engine.triggerManualSave(SAVE_NAME);
      const expectedErrorMsg =
        'Game engine is not initialized. Cannot save game.';

      expectNoDispatch(context.bed.getSafeEventDispatcher().dispatch);
      expect(
        context.bed.getGamePersistenceService().saveGame
      ).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: expectedErrorMsg });
    });

    describeInitializedEngineSuite(
      'when engine is initialized',
      (context) => {
        generateServiceUnavailableTests(
          [
            [
              tokens.GamePersistenceService,
              GAME_PERSISTENCE_TRIGGER_SAVE_UNAVAILABLE,
              { preInit: true },
            ],
          ],
          async (bed, engine) => {
            const result = await engine.triggerManualSave(SAVE_NAME);

            expectNoDispatch(bed.getSafeEventDispatcher().dispatch);
            // eslint-disable-next-line jest/no-standalone-expect
            expect(result).toEqual({
              success: false,
              error: GAME_PERSISTENCE_SAVE_RESULT_UNAVAILABLE,
            });
            return [
              bed.getLogger().error,
              bed.getSafeEventDispatcher().dispatch,
            ];
          },
          { extraAssertions: 2 }
        )('should dispatch error if %s is unavailable');

        it('should successfully save, dispatch all UI events in order, and return success result', async () => {
          const saveResultData = { success: true, filePath: 'path/to/my.sav' };
          context.bed
            .getGamePersistenceService()
            .saveGame.mockResolvedValue(saveResultData);

          const result = await context.engine.triggerManualSave(SAVE_NAME);

          expectDispatchSequence(
            context.bed.getSafeEventDispatcher().dispatch,
            ...buildSaveDispatches(SAVE_NAME, saveResultData.filePath)
          );

          expect(
            context.bed.getGamePersistenceService().saveGame
          ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);
          expect(result).toEqual(saveResultData);
        });

        it('should log the detailed message when persistence returns a custom error object', async () => {
          const error = new PersistenceError(
            PersistenceErrorCodes.INVALID_SAVE_NAME,
            'Invalid save name provided. Please enter a valid name.'
          );
          context.bed.getGamePersistenceService().saveGame.mockResolvedValue({
            success: false,
            error,
          });

          await context.engine.triggerManualSave(SAVE_NAME);

          const errorLogCall = context.bed
            .getLogger()
            .error.mock.calls.find(([message]) =>
              message.includes('Reported error:')
            );

          expect(errorLogCall).toBeDefined();
          expect(errorLogCall[0]).toContain(
            'Reported error: Invalid save name provided. Please enter a valid name.'
          );
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
              context.bed
                .getGamePersistenceService()
                .saveGame.mockRejectedValue(failureValue);
            } else {
              context.bed
                .getGamePersistenceService()
                .saveGame.mockResolvedValue(failureValue);
            }

            const result = await context.engine.triggerManualSave(SAVE_NAME);

            const expectedErrorMessage =
              failureValue instanceof Error
                ? `Unexpected error during save: ${failureValue.message}`
                : failureValue.error;

            expectDispatchSequence(
              context.bed.getSafeEventDispatcher().dispatch,
              ...buildFailedSaveDispatches(SAVE_NAME, expectedErrorMessage)
            );

            expect(
              context.bed.getGamePersistenceService().saveGame
            ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);

            const expectedResult =
              failureValue instanceof Error
                ? {
                    success: false,
                    error: expectedErrorMessage,
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
