/**
 * @file Helper functions for ad-hoc GameEngine test beds.
 * @see tests/common/engine/gameEngineHelpers.js
 */

import { expect } from '@jest/globals';
import {
  createGameEngineTestBed,
  GameEngineTestBed,
} from './gameEngineTestBed.js';

/**
 * Executes a callback with a temporary {@link GameEngineTestBed} instance.
 *
 * @param {Record<string, any>} [overrides] - Optional dependency overrides.
 * @param {(bed: import('./gameEngineTestBed.js').GameEngineTestBed,
 *   engine: import('../../../src/engine/gameEngine.js').default) =>
 *   (Promise<void>|void)} testFn - Function invoked with the bed and engine.
 * @returns {Promise<void>} Resolves when the callback completes.
 */
export async function withGameEngineBed(overrides = {}, testFn) {
  const bed = createGameEngineTestBed(overrides);
  try {
    bed.resetMocks();
    await testFn(bed, bed.engine);
  } finally {
    await bed.cleanup();
  }
}

/**
 * Builds test functions for scenarios where required services are unavailable.
 *
 * @description Generates `[token, testFn]` tuples for use with `it.each`. Each
 * test initializes a temporary {@link GameEngineTestBed} with the specified
 * token overridden to `null`, optionally starts the engine, executes the
 * provided callback, and asserts that the returned logger mock was called with
 * the expected message while the dispatch mock was not.
 * @param {Array<[string, string, { preInit?: boolean }]>} cases - Array of
 *   `[token, message, options]` tuples.
 * @param {(bed: GameEngineTestBed,
 *   engine: import('../../../src/engine/gameEngine.js').default) =>
 *   [import('@jest/globals').Mock, import('@jest/globals').Mock]} invokeFn -
 *   Callback performing the invocation and returning logger/dispatch mocks.
 * @returns {Array<[string, () => Promise<void>]>} Generated test cases.
 */
export function runUnavailableServiceTest(cases, invokeFn) {
  return cases.map(([token, expectedMessage, opts = {}]) => [
    token,
    async () => {
      await withGameEngineBed({ [token]: null }, async (bed, engine) => {
        if (opts.preInit) {
          await bed.startAndReset('TestWorld');
        }
        const [loggerMock, dispatchMock] = invokeFn(bed, engine);
        expect(loggerMock).toHaveBeenCalledWith(expectedMessage);
        expect(dispatchMock).not.toHaveBeenCalled();
      });
    },
  ]);
}
