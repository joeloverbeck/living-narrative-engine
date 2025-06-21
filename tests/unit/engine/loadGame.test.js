// tests/engine/loadGame.test.js
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { runUnavailableServiceTest } from '../../common/engine/gameEngineHelpers.js';
import '../../common/engine/engineTestTypedefs.js';

describeEngineSuite('GameEngine', (ctx) => {
  describe('loadGame', () => {
    const SAVE_ID = 'savegame-001.sav';
    const mockSaveData = {
      metadata: { gameTitle: 'My Loaded Game Adventure' },
    };
    /** @type {SaveGameStructure} */
    const typedMockSaveData = /** @type {SaveGameStructure} */ (mockSaveData);

    let prepareSpy, executeSpy, finalizeSpy, handleFailureSpy;

    beforeEach(() => {
      // Spies are on the engine instance created here
      prepareSpy = jest
        .spyOn(ctx.engine, '_prepareForLoadGameSession')
        .mockResolvedValue(undefined);
      executeSpy = jest
        .spyOn(ctx.engine, '_executeLoadAndRestore')
        .mockResolvedValue({
          success: true,
          data: typedMockSaveData,
        });
      finalizeSpy = jest
        .spyOn(ctx.engine, '_finalizeLoadSuccess')
        .mockResolvedValue({
          success: true,
          data: typedMockSaveData,
        });
      handleFailureSpy = jest
        .spyOn(ctx.engine, '_handleLoadFailure')
        .mockImplementation(async (error) => {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Processed: ${errorMsg}`,
            data: null,
          };
        });
      ctx.bed.resetMocks();
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

    it('should use _handleLoadFailure if _executeLoadAndRestore returns success: false', async () => {
      const restoreErrorMsg = 'Restore operation failed';
      executeSpy.mockResolvedValue({
        success: false,
        error: restoreErrorMsg,
        data: null,
      });
      // Redefine handleFailureSpy for this specific test to check its input accurately
      handleFailureSpy.mockImplementation(async (error) => {
        return { success: false, error: String(error), data: null };
      });

      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(ctx.bed.mocks.logger.warn).toHaveBeenCalledWith(
        `GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`
      );
      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(handleFailureSpy).toHaveBeenCalledWith(restoreErrorMsg, SAVE_ID); // Check it's called with the error string
      expect(result).toEqual({
        success: false,
        error: restoreErrorMsg,
        data: null,
      });
    });

    it('should use _handleLoadFailure if _executeLoadAndRestore returns success: true but no data', async () => {
      executeSpy.mockResolvedValue({ success: true, data: null }); // No data
      const expectedError =
        'Restored data was missing or load operation failed.';
      // Redefine handleFailureSpy for this specific test
      handleFailureSpy.mockImplementation(async (error) => {
        return { success: false, error: String(error), data: null };
      });

      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(ctx.bed.mocks.logger.warn).toHaveBeenCalledWith(
        `GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`
      );
      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(handleFailureSpy).toHaveBeenCalledWith(expectedError, SAVE_ID);
      expect(result).toEqual({
        success: false,
        error: expectedError,
        data: null,
      });
    });

    it.each(
      runUnavailableServiceTest(
        [
          [
            tokens.GamePersistenceService,
            'GameEngine.loadGame: GamePersistenceService is not available. Cannot load game.',
            { preInit: true },
          ],
        ],
        async (bed, engine, expectedMsg) => {
          const result = await engine.loadGame(SAVE_ID);
          expect(bed.mocks.safeEventDispatcher.dispatch).not.toHaveBeenCalled();
          expect(result).toEqual({
            success: false,
            error: expectedMsg,
            data: null,
          });
          return [
            bed.mocks.logger.error,
            bed.mocks.safeEventDispatcher.dispatch,
          ];
        }
      )
    )(
      'should handle %s unavailability (guard clause) and dispatch UI event directly',
      async (_token, fn) => {
        expect.assertions(4);
        await fn();
      }
    );

    it('should use _handleLoadFailure when _prepareForLoadGameSession throws an error', async () => {
      const prepareError = new Error('Prepare failed');
      prepareSpy.mockRejectedValue(prepareError);

      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(ctx.bed.mocks.logger.error).toHaveBeenCalledWith(
        `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${prepareError.message || String(prepareError)}`,
        prepareError
      );
      expect(executeSpy).not.toHaveBeenCalled();
      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(handleFailureSpy).toHaveBeenCalledWith(prepareError, SAVE_ID);
      expect(result).toEqual({
        success: false,
        error: `Processed: ${prepareError.message}`,
        data: null,
      });
    });

    it('should use _handleLoadFailure when _executeLoadAndRestore throws an error', async () => {
      const executeError = new Error('Execute failed');
      executeSpy.mockRejectedValue(executeError);

      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(ctx.bed.mocks.logger.error).toHaveBeenCalledWith(
        `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${executeError.message || String(executeError)}`,
        executeError
      );
      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(handleFailureSpy).toHaveBeenCalledWith(executeError, SAVE_ID);
      expect(result).toEqual({
        success: false,
        error: `Processed: ${executeError.message}`,
        data: null,
      });
    });

    it('should use _handleLoadFailure when _finalizeLoadSuccess throws an error', async () => {
      const finalizeError = new Error('Finalize failed');
      finalizeSpy.mockRejectedValue(finalizeError); // _executeLoadAndRestore is fine
      executeSpy.mockResolvedValue({ success: true, data: typedMockSaveData });

      const result = await ctx.engine.loadGame(SAVE_ID);

      expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
      expect(finalizeSpy).toHaveBeenCalledWith(typedMockSaveData, SAVE_ID);
      expect(ctx.bed.mocks.logger.error).toHaveBeenCalledWith(
        `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${finalizeError.message || String(finalizeError)}`,
        finalizeError
      );
      expect(handleFailureSpy).toHaveBeenCalledWith(finalizeError, SAVE_ID);
      expect(result).toEqual({
        success: false,
        error: `Processed: ${finalizeError.message}`,
        data: null,
      });
    });
  });
});
