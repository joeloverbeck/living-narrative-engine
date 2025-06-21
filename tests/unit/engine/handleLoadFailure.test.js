// tests/engine/handleLoadFailure.test.js
import { describe, it, expect } from '@jest/globals';
import { ENGINE_OPERATION_FAILED_UI } from '../../../src/constants/eventIds.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  withGameEngineBed,
  runUnavailableServiceTest,
} from '../../common/engine/gameEngineHelpers.js';
import '../../common/engine/engineTestTypedefs.js';

describe('GameEngine', () => {
  describe('_handleLoadFailure', () => {
    it('dispatches failure UI event and returns failure result', async () => {
      await withGameEngineBed({}, async (bed, engine) => {
        const err = new Error('bad');
        const result = await engine._handleLoadFailure(err, 'save-001');
        expect(bed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
          ENGINE_OPERATION_FAILED_UI,
          {
            errorMessage: `Failed to load game: ${err.message}`,
            errorTitle: 'Load Failed',
          }
        );
        expect(result).toEqual({
          success: false,
          error: err.message,
          data: null,
        });
      });
    });

    it.each(
      runUnavailableServiceTest(
        [
          [
            tokens.ISafeEventDispatcher,
            'GameEngine._handleLoadFailure: ISafeEventDispatcher not available, cannot dispatch UI failure event.',
          ],
        ],
        async (bed, engine) => {
          const err = new Error('oops');
          const result = await engine._handleLoadFailure(err, 'save-002');
          expect(result).toEqual({
            success: false,
            error: err.message,
            data: null,
          });
          return [
            bed.mocks.logger.error,
            bed.mocks.safeEventDispatcher.dispatch,
          ];
        }
      )
    )('logs error if %s is unavailable', async (_token, fn) => {
      expect.assertions(3);
      await fn();
    });
  });
});
