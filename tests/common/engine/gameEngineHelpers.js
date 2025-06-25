/**
 * @file Helper functions for ad-hoc GameEngine test beds.
 * @see tests/common/engine/gameEngineHelpers.js
 */

import { expect, jest, it } from '@jest/globals';
import { expectNoDispatch } from './dispatchTestUtils.js';
import { GameEngineTestBed } from './gameEngineTestBed.js';
import { DEFAULT_TEST_WORLD } from '../constants.js';

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
  if (typeof overrides === 'function') {
    testFn = overrides;
    overrides = {};
  }
  const bed = new GameEngineTestBed(overrides);
  if (typeof bed.resetMocks === 'function') {
    bed.resetMocks();
  }
  try {
    await testFn(bed, bed.engine);
  } finally {
    await bed.cleanup();
  }
}

/**
 * Executes a callback with an initialized {@link GameEngineTestBed} instance.
 *
 * @description Creates a temporary test bed, initializes the underlying
 *   engine using {@link GameEngineTestBed.initAndReset}, then runs the provided
 *   callback. Cleanup always occurs after execution.
 * @param {{ overrides?: Record<string, any>, initArg?: string }} [options] -
 *   Overrides and world used for initialization.
 * @param {(bed: GameEngineTestBed,
 *   engine: import('../../../src/engine/gameEngine.js').default) =>
 *   (Promise<void>|void)} testFn - Function invoked with the bed and engine.
 * @returns {Promise<void>} Resolves when the callback completes.
 */
export async function withInitializedGameEngineBed(options = {}, testFn) {
  if (typeof options === 'function') {
    testFn = options;
    options = {};
  }
  const { overrides = {}, initArg = DEFAULT_TEST_WORLD } = options;
  const bed = new GameEngineTestBed(overrides);
  await bed.initAndReset(initArg);
  if (typeof bed.resetMocks === 'function') {
    bed.resetMocks();
  }
  try {
    await testFn(bed, bed.engine);
  } finally {
    await bed.cleanup();
  }
}

/**
 * Executes a callback with a running {@link GameEngineTestBed} instance.
 *
 * @description Creates a temporary test bed, starts the engine using
 *   {@link GameEngineTestBed.startAndReset}, then runs the provided callback.
 *   Cleanup always occurs after execution.
 * @param {{ overrides?: Record<string, any>, initArg?: string }} [options] -
 *   Overrides and world used for initialization.
 * @param {(bed: GameEngineTestBed,
 *   engine: import('../../../src/engine/gameEngine.js').default) =>
 *   (Promise<void>|void)} testFn - Function invoked with the bed and engine.
 * @returns {Promise<void>} Resolves when the callback completes.
 */
export async function withRunningGameEngineBed(options = {}, testFn) {
  if (typeof options === 'function') {
    testFn = options;
    options = {};
  }
  const { overrides = {}, initArg = DEFAULT_TEST_WORLD } = options;
  const bed = new GameEngineTestBed(overrides);
  await bed.startAndReset(initArg);
  if (typeof bed.resetMocks === 'function') {
    bed.resetMocks();
  }
  try {
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
        expectNoDispatch(dispatchMock);
      });
    },
  ]);
}

/**
 * Creates a helper for asserting behavior when a required service token cannot
 * be resolved.
 *
 * @description Each generated test temporarily overrides one of the provided
 *   DI tokens to `null`. Optionally the engine can be started first by passing
 *   the `preInit` flag on the case tuple. The supplied `invokeFn` performs the
 *   operation under test and must return the logger and dispatch mocks used for
 *   assertions. `generateServiceUnavailableTests` verifies the expected log
 *   output and that no dispatches occurred, then delegates to the returned
 *   function to run any extra assertions.
 * @param {Array<[string, string, { preInit?: boolean }]>} cases - List of
 *   `[token, expectedMessage, options]` tuples describing the service token to
 *   null out, the message that should be logged, and whether the engine should
 *   be initialized beforehand.
 * @param {(bed: GameEngineTestBed,
 *   engine: import('../../../src/engine/gameEngine.js').default,
 *   expectedMessage: string) =>
 *   Promise<[import('@jest/globals').Mock, import('@jest/globals').Mock]> |
 *   [import('@jest/globals').Mock, import('@jest/globals').Mock]} invokeFn -
 *   Function invoked during each test case. It should perform the call under
 *   test and return the logger and dispatch mocks to validate.
 * @param {{ extraAssertions?: number }} [options] - Additional options.
 *   Use `extraAssertions` to specify the number of assertions performed
 *   inside {@code invokeFn}.
 * @returns {(title: string) => void} Callback that runs the generated `it.each`
 *   suite when provided a test title.
 */
export function generateServiceUnavailableTests(
  cases,
  invokeFn,
  { extraAssertions = 0 } = {}
) {
  const eachFn = it.each(runUnavailableServiceTest(cases, invokeFn));
  return (title) =>
    eachFn(title, async (_token, fn) => {
      expect.assertions(2 + extraAssertions);
      await fn();
    });
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

/**
 * Mocks a successful initialization sequence on the provided test bed.
 *
 * @description Sets `initializationService.runInitializationSequence` to resolve
 *   `{ success: true }`.
 * @param {GameEngineTestBed} bed - Test bed containing the initialization service
 *   mock.
 * @returns {void}
 */
export function mockInitializationSuccess(bed) {
  bed.getInitializationService().runInitializationSequence.mockResolvedValue({
    success: true,
  });
}
