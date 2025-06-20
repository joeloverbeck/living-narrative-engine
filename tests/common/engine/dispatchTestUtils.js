/**
 * @file Utility functions for testing dispatch call sequences.
 * @see tests/common/engine/dispatchTestUtils.js
 */

import { expect } from '@jest/globals';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
  GAME_SAVED_ID,
} from '../../../src/constants/eventIds.js';

/**
 * Default world used for save dispatch helper.
 *
 * @type {string}
 */
export const DEFAULT_ACTIVE_WORLD_FOR_SAVE = 'TestWorldForSaving';

/**
 * Compares dispatch mock calls with an expected array of
 * [eventId, payload] pairs.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {Array<[string, any]>} expected - Expected calls.
 * @returns {void}
 */
export function expectDispatchCalls(mock, expected) {
  expect(mock.mock.calls).toEqual(expected);
}

/**
 * Asserts that dispatch calls match the provided event sequence.
 * Usage: expectDispatchSequence(mock, [id, payload], [id, payload], ...)
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {...Array} events - Sequence of [eventId, payload] pairs.
 * @returns {void}
 */
export function expectDispatchSequence(mock, ...events) {
  expect(mock.mock.calls).toEqual(events);
}

/**
 * Builds the dispatch sequence emitted during a manual save.
 * When `filePath` is omitted, the GAME_SAVED_ID event is excluded, mimicking
 * a failure scenario.
 *
 * @param {string} saveName - Name of the save file.
 * @param {string} [filePath] - Optional saved file path.
 * @returns {Array<[string, any]>} Dispatch call sequence.
 */
export function buildSaveDispatches(saveName, filePath) {
  const sequence = [
    [
      ENGINE_OPERATION_IN_PROGRESS_UI,
      {
        titleMessage: 'Saving...',
        inputDisabledMessage: `Saving game "${saveName}"...`,
      },
    ],
  ];

  if (filePath) {
    sequence.push([
      GAME_SAVED_ID,
      { saveName, path: filePath, type: 'manual' },
    ]);
  }

  sequence.push([
    ENGINE_READY_UI,
    {
      activeWorld: DEFAULT_ACTIVE_WORLD_FOR_SAVE,
      message: 'Save operation finished. Ready.',
    },
  ]);

  return sequence;
}

/**
 * Asserts that an engine's status matches the expected values.
 *
 * @param {{ getEngineStatus: () => any }} engine - Engine instance with a
 *   `getEngineStatus` method.
 * @param {object} expectedStatus - Expected status object.
 * @returns {void}
 */
export function expectEngineStatus(engine, expectedStatus) {
  expect(engine.getEngineStatus()).toEqual(expectedStatus);
}

export default {
  expectDispatchCalls,
  expectDispatchSequence,
  buildSaveDispatches,
  expectEngineStatus,
};
