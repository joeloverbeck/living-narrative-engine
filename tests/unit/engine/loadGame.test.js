// tests/engine/loadGame.test.js
import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  expectDispatchSequence,
  expectEngineRunning,
  expectEngineStopped,
  expectNoDispatch,
  buildLoadSuccessDispatches,
  buildLoadFailureDispatches,
  buildLoadFinalizeFailureDispatches,
} from '../../common/engine/dispatchTestUtils.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { generateServiceUnavailableTests } from '../../common/engine/gameEngineHelpers.js';
import { DEFAULT_SAVE_ID } from '../../common/constants.js';
import { GAME_PERSISTENCE_LOAD_GAME_UNAVAILABLE } from '../../common/engine/unavailableMessages.js';

describeEngineSuite('GameEngine', (context) => {
  describe('loadGame', () => {
    const SAVE_ID = DEFAULT_SAVE_ID;
    const mockSaveData = {
      metadata: { gameTitle: 'My Loaded Game Adventure' },
    };
    /** @type {SaveGameStructure} */
    const typedMockSaveData = /** @type {SaveGameStructure} */ (mockSaveData);

    beforeEach(() => {
      context.bed.resetMocks();
      context.bed
        .getGamePersistenceService()
        .loadAndRestoreGame.mockResolvedValue({
          success: true,
          data: typedMockSaveData,
        });
    });

    it('should load and finalize a game successfully', async () => {
      const result = await context.engine.loadGame(SAVE_ID);

      expect(
        context.bed.getGamePersistenceService().loadAndRestoreGame
      ).toHaveBeenCalledWith(SAVE_ID);
      expectDispatchSequence(
        context.bed.getSafeEventDispatcher().dispatch,
        ...buildLoadSuccessDispatches(
          SAVE_ID,
          typedMockSaveData.metadata.gameTitle
        )
      );
      expect(context.bed.getTurnManager().start).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: typedMockSaveData });
      expectEngineRunning(context.engine, typedMockSaveData.metadata.gameTitle);
    });

    describe('when the persistence service reports failure', () => {
      const errorMsg = 'Restore operation failed';

      beforeEach(() => {
        context.bed
          .getGamePersistenceService()
          .loadAndRestoreGame.mockResolvedValue({
            success: false,
            error: errorMsg,
            data: null,
          });
      });

      it('logs warning, dispatches failure UI and returns failure result', async () => {
        const result = await context.engine.loadGame(SAVE_ID);

        expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
          `GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`
        );
        expectDispatchSequence(
          context.bed.getSafeEventDispatcher().dispatch,
          ...buildLoadFailureDispatches(SAVE_ID, errorMsg)
        );
        expect(result).toEqual({ success: false, error: errorMsg, data: null });
        expectEngineStopped(context.engine);
      });
    });

    describe('when the persistence service throws an error', () => {
      const errorObj = new Error('Execute failed');

      beforeEach(() => {
        context.bed
          .getGamePersistenceService()
          .loadAndRestoreGame.mockRejectedValue(errorObj);
      });

      it('logs error, dispatches failure UI and returns failure result', async () => {
        const result = await context.engine.loadGame(SAVE_ID);

        expect(context.bed.getLogger().error).toHaveBeenCalledWith(
          `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${errorObj.message}`,
          errorObj
        );
        expectDispatchSequence(
          context.bed.getSafeEventDispatcher().dispatch,
          ...buildLoadFailureDispatches(SAVE_ID, errorObj.message)
        );
        expect(result).toEqual({
          success: false,
          error: errorObj.message,
          data: null,
        });
        expectEngineStopped(context.engine);
      });
    });

    describe('when finalization fails', () => {
      const errorObj = new Error('Finalize failed');

      beforeEach(() => {
        context.bed.getTurnManager().start.mockRejectedValue(errorObj);
      });

      it('logs error, dispatches failure UI and returns failure result', async () => {
        const result = await context.engine.loadGame(SAVE_ID);

        expect(context.bed.getLogger().error).toHaveBeenCalledWith(
          `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${errorObj.message}`,
          errorObj
        );
        expectDispatchSequence(
          context.bed.getSafeEventDispatcher().dispatch,
          ...buildLoadFinalizeFailureDispatches(
            SAVE_ID,
            typedMockSaveData.metadata.gameTitle,
            errorObj.message
          )
        );
        expect(result).toEqual({
          success: false,
          error: errorObj.message,
          data: null,
        });
        expectEngineStopped(context.engine);
      });
    });

    generateServiceUnavailableTests(
      [
        [
          tokens.GamePersistenceService,
          GAME_PERSISTENCE_LOAD_GAME_UNAVAILABLE,
          { preInit: true },
        ],
      ],
      async (bed, engine, expectedMsg) => {
        const result = await engine.loadGame(SAVE_ID);

        expectNoDispatch(bed.getSafeEventDispatcher().dispatch);
        // eslint-disable-next-line jest/no-standalone-expect
        expect(result).toEqual({
          success: false,
          error: expectedMsg,
          data: null,
        });
        return [bed.getLogger().error, bed.getSafeEventDispatcher().dispatch];
      },
      { extraAssertions: 2 }
    )(
      'should handle %s unavailability (guard clause) and dispatch UI event directly'
    );

    it.each([null, '', 0])(
      'should reject invalid save identifiers: %p',
      async (badId) => {
        const expectedMessage =
          'GameEngine.loadGame: saveIdentifier must be a non-empty string.';

        await expect(context.engine.loadGame(badId)).rejects.toThrow(
          expectedMessage
        );
        expect(context.bed.getLogger().error).toHaveBeenCalledWith(
          expectedMessage
        );
      }
    );
  });
});
