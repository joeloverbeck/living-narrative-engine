// tests/engine/loadGame.test.js
import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  expectDispatchSequence,
  expectEngineRunning,
  expectEngineStopped,
  expectNoDispatch,
} from '../../common/engine/dispatchTestUtils.js';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_FAILED_UI,
} from '../../../src/constants/eventIds.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { generateServiceUnavailableTests } from '../../common/engine/gameEngineHelpers.js';
import {
  DEFAULT_SAVE_ID,
  ENGINE_READY_MESSAGE,
} from '../../common/constants.js';
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
        [
          ENGINE_OPERATION_IN_PROGRESS_UI,
          {
            titleMessage: `Loading ${SAVE_ID}...`,
            inputDisabledMessage: `Loading game from ${SAVE_ID}...`,
          },
        ],
        [
          ENGINE_READY_UI,
          {
            activeWorld: typedMockSaveData.metadata.gameTitle,
            message: ENGINE_READY_MESSAGE,
          },
        ]
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
          [
            ENGINE_OPERATION_IN_PROGRESS_UI,
            {
              titleMessage: `Loading ${SAVE_ID}...`,
              inputDisabledMessage: `Loading game from ${SAVE_ID}...`,
            },
          ],
          [
            ENGINE_OPERATION_FAILED_UI,
            {
              errorMessage: `Failed to load game: ${errorMsg}`,
              errorTitle: 'Load Failed',
            },
          ]
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
          [
            ENGINE_OPERATION_IN_PROGRESS_UI,
            {
              titleMessage: `Loading ${SAVE_ID}...`,
              inputDisabledMessage: `Loading game from ${SAVE_ID}...`,
            },
          ],
          [
            ENGINE_OPERATION_FAILED_UI,
            {
              errorMessage: `Failed to load game: ${errorObj.message}`,
              errorTitle: 'Load Failed',
            },
          ]
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
          [
            ENGINE_OPERATION_IN_PROGRESS_UI,
            {
              titleMessage: `Loading ${SAVE_ID}...`,
              inputDisabledMessage: `Loading game from ${SAVE_ID}...`,
            },
          ],
          [
            ENGINE_READY_UI,
            {
              activeWorld: typedMockSaveData.metadata.gameTitle,
              message: ENGINE_READY_MESSAGE,
            },
          ],
          [
            ENGINE_OPERATION_FAILED_UI,
            {
              errorMessage: `Failed to load game: ${errorObj.message}`,
              errorTitle: 'Load Failed',
            },
          ]
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
  });
});
