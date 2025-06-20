/**
 * @file Helper utilities for GameEngine save-related tests.
 */

import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  GAME_SAVED_ID,
  ENGINE_READY_UI,
} from '../../../src/constants/eventIds.js';

/**
 * Builds the expected dispatch call sequence for a manual save operation.
 *
 * @param {string} saveName - Save file name.
 * @param {{success: boolean, filePath?: string}} result - Result from saveGame or placeholder for error.
 * @param {string} activeWorld - Currently active world name.
 * @returns {Array<[string, any]>} The expected dispatch call array.
 */
export function buildSaveDispatches(saveName, result, activeWorld) {
  const calls = [
    [
      ENGINE_OPERATION_IN_PROGRESS_UI,
      {
        titleMessage: 'Saving...',
        inputDisabledMessage: `Saving game "${saveName}"...`,
      },
    ],
  ];

  if (result.success) {
    calls.push([
      GAME_SAVED_ID,
      {
        saveName,
        path: result.filePath,
        type: 'manual',
      },
    ]);
  }

  calls.push([
    ENGINE_READY_UI,
    {
      activeWorld,
      message: 'Save operation finished. Ready.',
    },
  ]);

  return calls;
}

export default {
  buildSaveDispatches,
};
