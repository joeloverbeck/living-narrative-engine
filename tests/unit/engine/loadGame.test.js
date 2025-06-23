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
import { runUnavailableServiceSuite } from '../../common/engine/gameEngineHelpers.js';
import { DEFAULT_SAVE_ID } from '../../common/constants.js';

describeEngineSuite('GameEngine', (ctx) => {
  describe('loadGame', () => {
    const SAVE_ID = DEFAULT_SAVE_ID;
    const mockSaveData = {
      metadata: { gameTitle: 'My Loaded Game Adventure' },
    };
    /** @type {SaveGameStructure} */
    const typedMockSaveData = /** @type {SaveGameStructure} */ (mockSaveData);

    beforeEach(() => {
      ctx.bed.resetMocks();
      ctx.bed.mocks.gamePersistenceService.loadAndRestoreGame.mockResolvedValue(
        {
          success: true,
          data: typedMockSaveData,
        }
      );
    });

    it('should load and finalize a game successfully', async () => {
      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(
        ctx.bed.mocks.gamePersistenceService.loadAndRestoreGame
      ).toHaveBeenCalledWith(SAVE_ID);
      expectDispatchSequence(
        ctx.bed.mocks.safeEventDispatcher.dispatch,
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
            message: 'Enter command...',
          },
        ]
      );
      expect(ctx.bed.mocks.turnManager.start).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: typedMockSaveData });
      expectEngineRunning(ctx.engine, typedMockSaveData.metadata.gameTitle);
    });

    it('should handle failure reported by the persistence service', async () => {
      const errorMsg = 'Restore operation failed';
      ctx.bed.mocks.gamePersistenceService.loadAndRestoreGame.mockResolvedValue(
        {
          success: false,
          error: errorMsg,
          data: null,
        }
      );

      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(ctx.bed.mocks.logger.warn).toHaveBeenCalledWith(
        `GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`
      );
      expectDispatchSequence(
        ctx.bed.mocks.safeEventDispatcher.dispatch,
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
      expectEngineStopped(ctx.engine);
    });

    it('should handle errors thrown by the persistence service', async () => {
      const errorObj = new Error('Execute failed');
      ctx.bed.mocks.gamePersistenceService.loadAndRestoreGame.mockRejectedValue(
        errorObj
      );

      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(ctx.bed.mocks.logger.error).toHaveBeenCalledWith(
        `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${errorObj.message}`,
        errorObj
      );
      expectDispatchSequence(
        ctx.bed.mocks.safeEventDispatcher.dispatch,
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
      expectEngineStopped(ctx.engine);
    });

    it('should handle errors during finalization', async () => {
      const errorObj = new Error('Finalize failed');
      ctx.bed.mocks.turnManager.start.mockRejectedValue(errorObj);

      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(ctx.bed.mocks.logger.error).toHaveBeenCalledWith(
        `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${errorObj.message}`,
        errorObj
      );
      expectDispatchSequence(
        ctx.bed.mocks.safeEventDispatcher.dispatch,
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
            message: 'Enter command...',
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
      expectEngineStopped(ctx.engine);
    });

    runUnavailableServiceSuite(
      [
        [
          tokens.GamePersistenceService,
          'GameEngine.loadGame: GamePersistenceService is not available. Cannot load game.',
          { preInit: true },
        ],
      ],
      async (bed, engine, expectedMsg) => {
        const result = await engine.loadGame(SAVE_ID);

         
        expectNoDispatch(bed.mocks.safeEventDispatcher.dispatch);
        // eslint-disable-next-line jest/no-standalone-expect
        expect(result).toEqual({
          success: false,
          error: expectedMsg,
          data: null,
        });
        return [bed.mocks.logger.error, bed.mocks.safeEventDispatcher.dispatch];
      },
      2
    )(
      'should handle %s unavailability (guard clause) and dispatch UI event directly'
    );
  });
});
