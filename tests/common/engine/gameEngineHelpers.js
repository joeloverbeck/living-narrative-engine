/**
 * @file Helper functions for ad-hoc GameEngine test beds.
 * @see tests/common/engine/gameEngineHelpers.js
 */

import { expect, jest } from '@jest/globals';
import { GameEngineTestBed } from './gameEngineTestBed.js';
import { DEFAULT_TEST_WORLD } from '../constants.js';
import { withTestBed } from '../testBedHelpers.js';

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
  await withTestBed(GameEngineTestBed, overrides, (bed) =>
    testFn(bed, bed.engine)
  );
}

/**
 * Executes a callback with an initialized {@link GameEngineTestBed} instance.
 *
 * @description Creates a temporary test bed, initializes the underlying
 *   engine using {@link GameEngineTestBed.initAndReset}, then runs the provided
 *   callback. Cleanup always occurs after execution.
 * @param {Record<string, any>} [overrides] - Optional dependency overrides.
 * @param {string} [world] - Name of the world used for
 *   initialization.
 * @param {(bed: GameEngineTestBed,
 *   engine: import('../../../src/engine/gameEngine.js').default) =>
 *   (Promise<void>|void)} testFn - Function invoked with the bed and engine.
 * @returns {Promise<void>} Resolves when the callback completes.
 */
export async function withInitializedGameEngineBed(overrides, world, testFn) {
  if (typeof overrides === 'function') {
    testFn = overrides;
    overrides = {};
    world = DEFAULT_TEST_WORLD;
  } else if (typeof world === 'function') {
    testFn = world;
    world = DEFAULT_TEST_WORLD;
    overrides = overrides || {};
  } else {
    overrides = overrides || {};
    world = world || DEFAULT_TEST_WORLD;
  }
  await withTestBed(
    GameEngineTestBed,
    overrides,
    (bed) => testFn(bed, bed.engine),
    (bed) => bed.initAndReset(world)
  );
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
 *   engine: import('../../../src/engine/gameEngine.js').default,
 *   expectedMessage: string) =>
 *   Promise<[import('@jest/globals').Mock, import('@jest/globals').Mock]> |
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
          await bed.startAndReset(DEFAULT_TEST_WORLD);
        }
        const [loggerMock, dispatchMock] = await invokeFn(
          bed,
          engine,
          expectedMessage
        );
        expect(loggerMock).toHaveBeenCalledWith(expectedMessage);
        expect(dispatchMock).not.toHaveBeenCalled();
      });
    },
  ]);
}

/**
 * Attaches spies to GameEngine load helpers.
 *
 * @param {import('../../../src/engine/gameEngine.js').default} engine - Engine instance.
 * @returns {{
 *   prepareSpy: ReturnType<typeof jest.spyOn>,
 *   executeSpy: ReturnType<typeof jest.spyOn>,
 *   finalizeSpy: ReturnType<typeof jest.spyOn>,
 *   handleFailureSpy: ReturnType<typeof jest.spyOn>,
 * }} Object containing the created spies.
 */
export function setupLoadGameSpies(engine) {
  const prepareSpy = jest.spyOn(engine, '_prepareForLoadGameSession');
  const executeSpy = jest.spyOn(engine, '_executeLoadAndRestore');
  const finalizeSpy = jest.spyOn(engine, '_finalizeLoadSuccess');
  const handleFailureSpy = jest.spyOn(engine, '_handleLoadFailure');
  return { prepareSpy, executeSpy, finalizeSpy, handleFailureSpy };
}
