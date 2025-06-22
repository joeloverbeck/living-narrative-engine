/**
 * @file Boilerplate helpers for generating test bed utilities.
 */

import { createDescribeTestBedSuite } from './describeSuite.js';

/**
 * Generates helpers for creating test beds and describe suites.
 *
 * @template {new (overrides: any) => any} T
 * @param {T} TestBedCtor - Constructor used to instantiate the test bed.
 * @param {object} [hooks] - Suite hooks forwarded to
 *   {@link createDescribeTestBedSuite}.
 * @returns {{
 *   createBed: (overrides?: ConstructorParameters<T>[0]) => InstanceType<T>,
 *   describeSuite: (title: string,
 *                   suiteFn: (getBed: () => InstanceType<T>) => void,
 *                   overrides?: ConstructorParameters<T>[0]) => void
 * }} Helper functions for the provided TestBed.
 */
export function createTestBedHelpers(TestBedCtor, hooks = {}) {
  const describeSuite = createDescribeTestBedSuite(TestBedCtor, hooks);
  const createBed = (overrides) => new TestBedCtor(overrides);
  return { createBed, describeSuite };
}

export default createTestBedHelpers;
