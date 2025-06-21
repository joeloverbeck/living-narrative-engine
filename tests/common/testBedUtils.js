/**
 * @file Utility functions for working with generic TestBeds.
 */

/**
 * Executes a callback with a temporary test bed instance.
 *
 * @param {new (overrides?: any) => { cleanup: () => Promise<void> }} TestBedCtor -
 *   Constructor for the test bed.
 * @param {object} [overrides] - Optional overrides passed to the constructor.
 * @param {(bed: any) => (Promise<void>|void)} callback - Function run with the test bed.
 * @returns {Promise<void>} Resolves when the callback completes.
 */
export async function withTestBed(TestBedCtor, overrides = {}, callback) {
  const bed = new TestBedCtor(overrides);
  try {
    await callback(bed);
  } finally {
    await bed.cleanup();
  }
}

export default withTestBed;
