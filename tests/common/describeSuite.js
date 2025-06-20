/**
 * @file Provides a generic helper for defining test suites with automatic
 * TestBed setup and teardown.
 */

/**
 * @description Defines a test suite using the given TestBed constructor.
 * Instantiates the TestBed before each test and cleans it up after each test.
 * A getter for the active TestBed is passed to the supplied suite function.
 * @param {string} title - Title of the describe block.
 * @param {new (...args: any[]) => {cleanup: () => Promise<void>}} TestBedCtor -
 *   Constructor for the test bed.
 * @param {(getBed: () => any) => void} suiteFn - Function containing the tests.
 *   Receives a getter returning the current test bed.
 * @param {...any} args - Arguments forwarded to the TestBed constructor.
 * @returns {void}
 */
export function describeSuite(title, TestBedCtor, suiteFn, ...args) {
  describe(title, () => {
    /** @type {any} */
    let testBed;
    beforeEach(() => {
      testBed = new TestBedCtor(...args);
    });
    afterEach(async () => {
      await testBed.cleanup();
    });
    suiteFn(() => testBed);
  });
}
