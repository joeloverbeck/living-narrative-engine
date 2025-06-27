/**
 * @file Utility assertions for TurnManager dispatches.
 * @see tests/common/turns/turnManagerTestUtils.js
 */

import { expect } from '@jest/globals';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_ENDED_ID,
  TURN_STARTED_ID,
  TURN_PROCESSING_STARTED,
} from '../../../src/constants/eventIds.js';
import { flushPromisesAndTimers } from '../jestHelpers.js';

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
 * Asserts that start-of-turn events were dispatched for the given actor.
 *
 * @description Asserts that dispatches were made for both the start of a turn
 *   and the beginning of its processing lifecycle.
 * @param {import('@jest/globals').Mock} dispatchMock - Mocked dispatch function.
 * @param {string} actorId - ID of the actor whose turn started.
 * @param {string} actorType - Type of the actor (e.g., "ai" or "player").
 * @returns {void}
 */
export function expectTurnStartedEvents(dispatchMock, actorId, actorType) {
  expect(dispatchMock).toHaveBeenCalledWith(TURN_STARTED_ID, {
    entityId: actorId,
    entityType: actorType,
    entity: expect.any(Object), // Entity object is now included
  });
  expect(dispatchMock).toHaveBeenCalledWith(TURN_PROCESSING_STARTED, {
    entityId: actorId,
    actorType,
  });
}

/**
 * Triggers a TURN_ENDED event for the given actor and flushes pending timers.
 *
 * @param {import('./turnManagerTestBed.js').TurnManagerTestBed} bed - Test bed instance.
 * @param {string} entityId - Actor entity id that ended the turn.
 * @param {boolean} [success] - Whether the turn was successful.
 * @returns {Promise<void>} Resolves when pending promises and timers are flushed.
 */
export async function triggerTurnEndedAndFlush(bed, entityId, success = true) {
  bed.trigger(TURN_ENDED_ID, { entityId, success });
  await flushPromisesAndTimers();
}
