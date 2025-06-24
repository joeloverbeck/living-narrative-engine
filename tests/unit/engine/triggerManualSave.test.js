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

      expectNoDispatch(context.bed.mocks.safeEventDispatcher.dispatch);
      expect(
        context.bed.mocks.gamePersistenceService.saveGame
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
          context.bed.mocks.gamePersistenceService.saveGame.mockResolvedValue(
            saveResultData
          );

          const result = await context.engine.triggerManualSave(SAVE_NAME);

          expectDispatchSequence(
            context.bed.mocks.safeEventDispatcher.dispatch,
            ...buildSaveDispatches(SAVE_NAME, saveResultData.filePath)
          );

          expect(
            context.bed.mocks.gamePersistenceService.saveGame
          ).toHaveBeenCalledWith(SAVE_NAME, true, MOCK_ACTIVE_WORLD_FOR_SAVE);
          expect(result).toEqual(saveResultData);
        });

        it('should return validation error when save name is empty', async () => {
          // The persistence layer rejects empty save names. The engine should
          // forward that failure result without modification.
          const error = new PersistenceError(
            PersistenceErrorCodes.INVALID_SAVE_NAME,
            'Invalid save name provided. Please enter a valid name.'
          );
          context.bed.mocks.gamePersistenceService.saveGame.mockResolvedValue({
            success: false,
            error,
          });

          const result = await context.engine.triggerManualSave('');

          expectDispatchSequence(
            context.bed.mocks.safeEventDispatcher.dispatch,
            ...buildSaveDispatches('')
          );

          expect(
            context.bed.mocks.gamePersistenceService.saveGame
          ).toHaveBeenCalledWith('', true, MOCK_ACTIVE_WORLD_FOR_SAVE);
          expect(result.success).toBe(false);
          expect(result.error).toBe(error);
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
              context.bed.mocks.gamePersistenceService.saveGame.mockRejectedValue(
                failureValue
              );
            } else {
              context.bed.mocks.gamePersistenceService.saveGame.mockResolvedValue(
                failureValue
              );
            }

            const result = await context.engine.triggerManualSave(SAVE_NAME);

            expectDispatchSequence(
              context.bed.mocks.safeEventDispatcher.dispatch,
              ...buildSaveDispatches(SAVE_NAME)
            );

            expect(
              context.bed.mocks.gamePersistenceService.saveGame
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
