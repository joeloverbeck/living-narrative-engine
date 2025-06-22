// tests/engine/loadGame.test.js
import { beforeEach, describe, expect, it } from '@jest/globals';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import {
  runUnavailableServiceSuite,
  setupLoadGameSpies,
} from '../../common/engine/gameEngineHelpers.js';
import { DEFAULT_SAVE_ID } from '../../common/constants.js';

describeEngineSuite('GameEngine', (ctx) => {
  describe('loadGame', () => {
    const SAVE_ID = DEFAULT_SAVE_ID;
    const mockSaveData = {
      metadata: { gameTitle: 'My Loaded Game Adventure' },
    };
    /** @type {SaveGameStructure} */
    const typedMockSaveData = /** @type {SaveGameStructure} */ (mockSaveData);

    let prepareSpy, executeSpy, finalizeSpy, handleFailureSpy;

    beforeEach(() => {
      ({ prepareSpy, executeSpy, finalizeSpy, handleFailureSpy } =
        setupLoadGameSpies(ctx.engine));
      prepareSpy.mockResolvedValue(undefined);
      executeSpy.mockResolvedValue({
        success: true,
        data: typedMockSaveData,
      });
      finalizeSpy.mockResolvedValue({
        success: true,
        data: typedMockSaveData,
      });
      handleFailureSpy.mockImplementation(async (error) => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Processed: ${errorMsg}`,
          data: null,
        };
      });
    });

    it('should successfully orchestrate loading a game and call helpers in order', async () => {
      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(ctx.bed.mocks.logger.debug).toHaveBeenCalledWith(
        `GameEngine: loadGame called for identifier: ${SAVE_ID}`
      );
      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(finalizeSpy).toHaveBeenCalledWith(typedMockSaveData, SAVE_ID);
      expect(handleFailureSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: typedMockSaveData });
    });

    const failureCases = [
      {
        desc: '_executeLoadAndRestore returns {success:false}',
        setup: () => {
          const errorMsg = 'Restore operation failed';
          executeSpy.mockResolvedValue({
            success: false,
            error: errorMsg,
            data: null,
          });
          handleFailureSpy.mockImplementation(async (error) => ({
            success: false,
            error: String(error),
            data: null,
          }));
          return {
            errorArg: errorMsg,
            loggerMethod: 'warn',
            loggerArgs: [
              `GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`,
            ],
            expectedResult: { success: false, error: errorMsg, data: null },
          };
        },
      },
      {
        desc: '_executeLoadAndRestore returns {success:true,data:null}',
        setup: () => {
          const errorMsg =
            'Restored data was missing or load operation failed.';
          executeSpy.mockResolvedValue({ success: true, data: null });
          handleFailureSpy.mockImplementation(async (error) => ({
            success: false,
            error: String(error),
            data: null,
          }));
          return {
            errorArg: errorMsg,
            loggerMethod: 'warn',
            loggerArgs: [
              `GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`,
            ],
            expectedResult: { success: false, error: errorMsg, data: null },
          };
        },
      },
      {
        desc: '_prepareForLoadGameSession throws',
        setup: () => {
          const errorObj = new Error('Prepare failed');
          prepareSpy.mockRejectedValue(errorObj);
          return {
            errorArg: errorObj,
            loggerMethod: 'error',
            loggerArgs: [
              `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${errorObj.message || String(errorObj)}`,
              errorObj,
            ],
            expectedResult: {
              success: false,
              error: `Processed: ${errorObj.message}`,
              data: null,
            },
          };
        },
      },
      {
        desc: '_executeLoadAndRestore throws',
        setup: () => {
          const errorObj = new Error('Execute failed');
          executeSpy.mockRejectedValue(errorObj);
          return {
            errorArg: errorObj,
            loggerMethod: 'error',
            loggerArgs: [
              `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${errorObj.message || String(errorObj)}`,
              errorObj,
            ],
            expectedResult: {
              success: false,
              error: `Processed: ${errorObj.message}`,
              data: null,
            },
          };
        },
      },
      {
        desc: '_finalizeLoadSuccess throws',
        setup: () => {
          const errorObj = new Error('Finalize failed');
          finalizeSpy.mockRejectedValue(errorObj);
          executeSpy.mockResolvedValue({
            success: true,
            data: typedMockSaveData,
          });
          return {
            errorArg: errorObj,
            loggerMethod: 'error',
            loggerArgs: [
              `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${errorObj.message || String(errorObj)}`,
              errorObj,
            ],
            expectedResult: {
              success: false,
              error: `Processed: ${errorObj.message}`,
              data: null,
            },
          };
        },
      },
    ];

    it.each(failureCases)(
      'should use _handleLoadFailure when %s',
      async ({ setup }) => {
        const { errorArg, loggerMethod, loggerArgs, expectedResult } = setup();

        const result = await ctx.engine.loadGame(SAVE_ID);

        expect(handleFailureSpy).toHaveBeenCalledWith(errorArg, SAVE_ID);
        expect(ctx.bed.mocks.logger[loggerMethod]).toHaveBeenCalledWith(
          ...loggerArgs
        );
        expect(result).toEqual(expectedResult);
      }
    );

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

        // eslint-disable-next-line jest/no-standalone-expect
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
