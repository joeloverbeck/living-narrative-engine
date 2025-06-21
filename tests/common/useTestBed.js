/**
 * @file Helper to access the active TestBed within a suite.
 */
/* eslint-env jest */
/* global beforeEach */

/**
 * Creates a getter for the active TestBed using beforeEach.
 *
 * @description Stores the TestBed returned by {@code getBed} in a local
 * variable before each test and returns a function providing that instance.
 * @param {() => any} getBed - Function returning the TestBed from the suite.
 * @returns {() => any} Function that returns the current TestBed.
 */
export function useTestBed(getBed) {
  /** @type {any} */
  let bed;
  beforeEach(() => {
    bed = getBed();
  });
  return () => bed;
}

export default useTestBed;
