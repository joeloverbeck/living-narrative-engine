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
