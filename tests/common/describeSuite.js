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

/**
 * @description Generates a helper for defining suites that automatically
 *   instantiate and clean up a given TestBed.
 * @param {new (...args: any[]) => {cleanup: () => Promise<void>}} TestBedCtor -
 *   Constructor for the TestBed.
 * @param {object} [defaultOptions] - Default options forwarded to
 *   {@link describeSuiteWithHooks}.
 * @param {(bed: any) => void} [defaultOptions.beforeEachHook] - Default hook
 *   executed after bed creation.
 * @param {(bed: any) => void} [defaultOptions.afterEachHook] - Default hook
 *   executed after bed cleanup.
 * @param {any[]} [defaultOptions.args] - Default arguments for the TestBed
 *   constructor.
 * @returns {(title: string, suiteFn: (getBed: () => any) => void, overrides?: any) => void}
 *   Suite function that wraps {@link describeSuiteWithHooks}.
 */
export function createDescribeTestBedSuite(TestBedCtor, defaultOptions = {}) {
  return function (title, suiteFn, overrides) {
    const options = {
      ...defaultOptions,
      args: overrides ? [overrides] : defaultOptions.args,
    };
    describeSuiteWithHooks(title, TestBedCtor, suiteFn, options);
  };
}

/**
 * @description Generates a suite helper exposing a specific service from a
 *   TestBed instance. Internally uses {@link createDescribeTestBedSuite}.
 * @param {new (...args: any[]) => {cleanup: () => Promise<void>}} TestBedCtor -
 *   Constructor for the TestBed.
 * @param {string} serviceProp - Property on the TestBed representing the service.
 * @param {object} [defaultOptions] - Default options forwarded to
 *   {@link createDescribeTestBedSuite}.
 * @param {(bed: any) => void} [defaultOptions.beforeEachHook] - Hook executed
 *   after bed creation.
 * @param {(bed: any) => void} [defaultOptions.afterEachHook] - Hook executed
 *   after bed cleanup.
 * @param {any[]} [defaultOptions.args] - Arguments forwarded to the TestBed
 *   constructor.
 * @returns {(title: string,
 *   suiteFn: (context: { bed: any, [serviceProp: string]: any }) => void,
 *   overrides?: any) => void} Suite creator.
 */
export function createDescribeServiceSuite(
  TestBedCtor,
  serviceProp,
  defaultOptions = {}
) {
  const describeBedSuite = createDescribeTestBedSuite(
    TestBedCtor,
    defaultOptions
  );
  return function (title, suiteFn, overrides) {
    describeBedSuite(
      title,
      (getBed) => {
        /** @type {any} */
        let bed;
        /** @type {any} */
        let service;
        beforeEach(() => {
          bed = getBed();
          service = bed[serviceProp];
        });
        suiteFn({
          get bed() {
            return bed;
          },
          get [serviceProp]() {
            return service;
          },
        });
      },
      overrides
    );
  };
}
