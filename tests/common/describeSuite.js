/**
 * @file Provides a generic helper for defining test suites with automatic
 * TestBed setup and teardown.
 */
/* eslint-env jest */
/* global beforeEach, afterEach, describe */

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

/**
 * @description Defines a test suite with optional hooks executed after
 * TestBed creation and before cleanup.
 * @param {string} title - Suite title for the describe block.
 * @param {new (...args: any[]) => {cleanup: () => Promise<void>}} TestBedCtor -
 *   Constructor for the test bed.
 * @param {(getBed: () => any) => void} suiteFn - Function containing the tests.
 *   Receives a getter returning the current test bed.
 * @param {object} [options] - Optional hook configuration.
 * @param {(bed: any) => void} [options.beforeEachHook] - Hook executed after the
 *   bed is instantiated but before each test.
 * @param {(bed: any) => void} [options.afterEachHook] - Hook executed after the
 *   bed cleanup runs.
 * @param {any[]} [options.args] - Arguments forwarded to the TestBed
 *   constructor.
 * @returns {void}
 */
export function describeSuiteWithHooks(
  title,
  TestBedCtor,
  suiteFn,
  { beforeEachHook, afterEachHook, args = [] } = {}
) {
  describe(title, () => {
    /** @type {any} */
    let bed;
    beforeEach(() => {
      bed = new TestBedCtor(...args);
      if (beforeEachHook) beforeEachHook(bed);
    });
    afterEach(async () => {
      await bed.cleanup();
      if (afterEachHook) afterEachHook(bed);
    });
    suiteFn(() => bed);
  });
}
