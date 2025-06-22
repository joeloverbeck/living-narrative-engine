/**
 * @file Generic helper for executing callbacks with temporary test beds.
 */

/**
 * Executes a callback with a temporary test bed instance.
 *
 * @description Instantiates the provided `TestBedCtor` with optional overrides,
 * optionally runs `initFn` against the bed, then runs `callback` inside a
 * `try/finally` block ensuring `cleanup` is always called. If the bed exposes a
 * `resetMocks` method it is invoked after initialization.
 * @template {new (overrides: any) => any} T
 * @param {T} TestBedCtor - Test bed constructor.
 * @param {ConstructorParameters<T>[0]} [overrides] - Optional overrides passed to
 *   the constructor.
 * @param {(bed: InstanceType<T>) => (Promise<void>|void)} callback - Function to
 *   execute with the bed.
 * @param {(bed: InstanceType<T>) => (Promise<void>|void)} [initFn] - Optional
 *   initialization function.
 * @returns {Promise<void>} Resolves when the callback completes.
 */
export async function withTestBed(
  TestBedCtor,
  overrides = {},
  callback,
  initFn
) {
  const bed = new TestBedCtor(overrides);
  if (initFn) {
    await initFn(bed);
  }
  if (typeof bed.resetMocks === 'function') {
    bed.resetMocks();
  }
  try {
    await callback(bed);
  } finally {
    await bed.cleanup();
  }
}

export default withTestBed;

/**
 * Executes a function and automatically resets mocks on the provided bed.
 *
 * @description Runs the given `callback` in a `try/finally` block. If the
 *   `bed` exposes a `resetMocks` method, it will be called in the `finally`
 *   block after the callback completes.
 * @param {{ resetMocks?: () => void }} bed - Test bed instance.
 * @param {(bed: any) => (Promise<void>|void)} callback - Function executed with
 *   the bed instance.
 * @returns {Promise<void>} Resolves once the callback and reset logic finish.
 */
export async function runWithReset(bed, callback) {
  try {
    await callback(bed);
  } finally {
    if (typeof bed.resetMocks === 'function') {
      bed.resetMocks();
    }
  }
}
