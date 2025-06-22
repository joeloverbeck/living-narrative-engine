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

/**
 * Generates a helper that executes callbacks with a temporary test bed.
 *
 * @description Returns a function mirroring {@link withTestBed} but mapping
 *   the created bed instance to arguments expected by the callback. The mapping
 *   is performed via {@code mapFn}, allowing helpers to expose specific
 *   services from the bed.
 * @template {new (overrides: any) => any} T
 * @param {T} TestBedCtor - Constructor used to create the test bed.
 * @param {(bed: InstanceType<T>) => any[]} mapFn - Maps the bed to callback
 *   arguments.
 * @returns {(overrides: ConstructorParameters<T>[0],
 *   callback: (...args: any[]) => (Promise<void>|void)) => Promise<void>} Helper
 *   invoking {@link withTestBed}.
 */
export function createWithBed(TestBedCtor, mapFn) {
  return async function withBed(overrides = {}, callback) {
    if (typeof overrides === 'function') {
      callback = overrides;
      overrides = {};
    }
    await withTestBed(TestBedCtor, overrides, (bed) => callback(...mapFn(bed)));
  };
}

/**
 * Generates a helper that initializes a test bed before invoking the callback.
 *
 * @description Similar to {@link createWithBed} but automatically calls a
 *   specified initialization method on the bed. Optional parameters mirror those
 *   of the original helper, defaulting the initialization argument when omitted.
 * @template {new (overrides: any) => any} T
 * @param {T} TestBedCtor - Constructor used to create the test bed.
 * @param {keyof InstanceType<T>} initMethod - Name of the initialization method
 *   on the bed.
 * @param {any} defaultArg - Default argument passed to the initialization
 *   method.
 * @param {(bed: InstanceType<T>) => any[]} mapFn - Maps the bed to callback
 *   arguments.
 * @returns {(overrides?: ConstructorParameters<T>[0], arg?: any,
 *   callback?: (...args: any[]) => (Promise<void>|void)) => Promise<void>} Helper
 *   invoking {@link withTestBed} with initialization.
 */
export function createInitializedBed(
  TestBedCtor,
  initMethod,
  defaultArg,
  mapFn
) {
  return async function withInitializedBed(overrides, arg, callback) {
    if (typeof overrides === 'function') {
      callback = overrides;
      overrides = {};
      arg = defaultArg;
    } else if (typeof arg === 'function') {
      callback = arg;
      arg = defaultArg;
      overrides = overrides || {};
    } else {
      overrides = overrides || {};
      arg = arg !== undefined ? arg : defaultArg;
    }

    await withTestBed(
      TestBedCtor,
      overrides,
      (bed) => callback(...mapFn(bed)),
      (bed) => bed[initMethod](arg)
    );
  };
}

export default withTestBed;
