/**
 * @file Utility functions for testing dispatch call sequences.
 * @see tests/common/engine/dispatchTestUtils.js
 */

import { expect } from '@jest/globals';

/**
 * @description Compares dispatch mock calls with an expected array of
 * [eventId, payload] pairs.
 * @param {jest.Mock} mock - Mocked dispatch function.
 * @param {Array<[string, any]>} expected - Expected calls.
 * @returns {void}
 */
export function expectDispatchCalls(mock, expected) {
  expect(mock.mock.calls).toEqual(expected);
}

export default {
  expectDispatchCalls,
};
