/**
 * @file Utility functions for testing dispatch call sequences.
 * @see tests/common/engine/dispatchTestUtils.js
 */

import { expect } from '@jest/globals';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_INITIALIZING_UI,
  ENGINE_READY_UI,
  GAME_SAVED_ID,
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  ENGINE_STOPPED_UI,
} from '../../../src/constants/eventIds.js';
import { DEFAULT_ACTIVE_WORLD_FOR_SAVE } from '../constants.js';

/**
 * Asserts that dispatch calls match the provided event sequence.
 * Usage: expectDispatchSequence(mock, [id, payload], [id, payload], ...)
 * or expectDispatchSequence(mock, [[id, payload], [id, payload], ...])
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {...Array} events - Sequence of [eventId, payload] pairs or a single
 *   array of such pairs.
 * @returns {void}
 */
export function expectDispatchSequence(mock, ...events) {
  const expected =
    events.length === 1 &&
    Array.isArray(events[0]) &&
    Array.isArray(events[0][0])
      ? events[0]
      : events;

  expect(mock.mock.calls).toEqual(expected);
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
 * Builds the dispatch sequence emitted when the engine stops.
 *
 * @returns {Array<[string, any]>} Dispatch call sequence for engine stop.
 */
export function buildStopDispatches() {
  return [
    [
      ENGINE_STOPPED_UI,
      { inputDisabledMessage: 'Game stopped. Engine is inactive.' },
    ],
  ];
}

/**
 * Builds the dispatch sequence emitted when starting a new game.
 *
 * @param {string} worldName - Name of the world being initialized.
 * @returns {Array<[string, any]>} Dispatch call sequence for engine start.
 */
export function buildStartDispatches(worldName) {
  return [
    [ENGINE_INITIALIZING_UI, { worldName }, { allowSchemaNotFound: true }],
    [ENGINE_READY_UI, { activeWorld: worldName, message: 'Enter command...' }],
  ];
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

/**
 * Asserts a single dispatch call with the given id and payload.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {string} eventId - Expected dispatched event id.
 * @param {any} payload - Expected dispatched payload.
 * @returns {void}
 */
export function expectSingleDispatch(mock, eventId, payload) {
  expectDispatchSequence(mock, [[eventId, payload]]);
}

/**
 * Asserts that an ENTITY_CREATED dispatch with the correct payload occurred.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {import('../../../src/entities/entity.js').default} entity - Entity instance.
 * @param {boolean} wasReconstructed - Flag indicating reconstruction.
 * @returns {void}
 */
export function expectEntityCreatedDispatch(mock, entity, wasReconstructed) {
  expectSingleDispatch(mock, ENTITY_CREATED_ID, {
    entity,
    wasReconstructed,
  });
}

/**
 * Asserts that an ENTITY_REMOVED dispatch with the correct payload occurred.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {import('../../../src/entities/entity.js').default} entity - Entity instance.
 * @returns {void}
 */
export function expectEntityRemovedDispatch(mock, entity) {
  expectSingleDispatch(mock, ENTITY_REMOVED_ID, { entity });
}

/**
 * Asserts that a COMPONENT_ADDED dispatch with the expected payload occurred.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {import('../../../src/entities/entity.js').default} entity - Entity instance.
 * @param {string} componentTypeId - Component type identifier.
 * @param {object|null} newData - New component data.
 * @param {object|null|undefined} oldData - Previous component data.
 * @returns {void}
 */
export function expectComponentAddedDispatch(
  mock,
  entity,
  componentTypeId,
  newData,
  oldData
) {
  expectSingleDispatch(mock, COMPONENT_ADDED_ID, {
    entity,
    componentTypeId,
    componentData: newData,
    oldComponentData: oldData,
  });
}

/**
 * Asserts that a COMPONENT_REMOVED dispatch with the expected payload occurred.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {import('../../../src/entities/entity.js').default} entity - Entity instance.
 * @param {string} componentTypeId - Component type identifier.
 * @param {object|null|undefined} oldData - Previous component data.
 * @returns {void}
 */
export function expectComponentRemovedDispatch(
  mock,
  entity,
  componentTypeId,
  oldData
) {
  expectSingleDispatch(mock, COMPONENT_REMOVED_ID, {
    entity,
    componentTypeId,
    oldComponentData: oldData,
  });
}

export { expectDispatchSequence as expectDispatchCalls };

export default {
  expectDispatchSequence,
  buildSaveDispatches,
  buildStopDispatches,
  buildStartDispatches,
  expectEngineStatus,
  expectSingleDispatch,
  expectEntityCreatedDispatch,
  expectEntityRemovedDispatch,
  expectComponentAddedDispatch,
  expectComponentRemovedDispatch,
  expectDispatchCalls: expectDispatchSequence,
};
