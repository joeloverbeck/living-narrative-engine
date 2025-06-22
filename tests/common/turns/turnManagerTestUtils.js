/**
 * @file Utility assertions for TurnManager dispatches.
 * @see tests/common/turns/turnManagerTestUtils.js
 */

import { expect } from '@jest/globals';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { flushPromisesAndTimers } from './turnManagerTestBed.js';

/**
 * Asserts that a SYSTEM_ERROR_OCCURRED dispatch was made with the standard
 * payload structure used across TurnManager tests.
 *
 * @param {import('@jest/globals').Mock} mockDispatch - Mocked dispatch function.
 * @param {string} message - Expected public error message.
 * @param {string} [rawMessage] - Expected raw error message in details.
 * @returns {void}
 */
export function expectSystemErrorDispatch(
  mockDispatch,
  message,
  rawMessage = message
) {
  expect(mockDispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
    message,
    details: {
      raw: rawMessage,
      stack: expect.any(String),
      timestamp: expect.any(String),
    },
  });
}

/**
 * Waits until the current actor matches the given id.
 *
 * @param {import('./turnManagerTestBed.js').TurnManagerTestBed} bed - Test bed instance.
 * @param {string} id - Expected actor id.
 * @param {number} [maxTicks] - Maximum timer flush iterations.
 * @returns {Promise<boolean>} Resolves true if actor found before timeout.
 */
export async function waitForCurrentActor(bed, id, maxTicks = 50) {
  for (let i = 0; i < maxTicks; i++) {
    if (bed.turnManager.getCurrentActor()?.id === id) {
      return true;
    }
    await flushPromisesAndTimers();
  }
  return false;
}
