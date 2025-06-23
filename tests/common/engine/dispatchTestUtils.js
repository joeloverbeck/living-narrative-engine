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
  REQUEST_SHOW_LOAD_GAME_UI,
  REQUEST_SHOW_SAVE_GAME_UI,
} from '../../../src/constants/eventIds.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  DEFAULT_ACTIVE_WORLD_FOR_SAVE,
  ENGINE_READY_MESSAGE,
  ENGINE_STOPPED_MESSAGE,
  SAVE_OPERATION_FINISHED_MESSAGE,
} from '../constants.js';

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
      message: SAVE_OPERATION_FINISHED_MESSAGE,
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
    [ENGINE_STOPPED_UI, { inputDisabledMessage: ENGINE_STOPPED_MESSAGE }],
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
    [
      ENGINE_READY_UI,
      { activeWorld: worldName, message: ENGINE_READY_MESSAGE },
    ],
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
 * Asserts that the engine is running with the provided world.
 *
 * @param {{ getEngineStatus: () => any }} engine - Engine instance with a
 *   `getEngineStatus` method.
 * @param {string} world - Expected active world name.
 * @returns {void}
 */
export const expectEngineRunning = (engine, world) =>
  expectEngineStatus(engine, {
    isInitialized: true,
    isLoopRunning: true,
    activeWorld: world,
  });

/**
 * Asserts that the engine is fully stopped.
 *
 * @param {{ getEngineStatus: () => any }} engine - Engine instance with a
 *   `getEngineStatus` method.
 * @returns {void}
 */
export const expectEngineStopped = (engine) =>
  expectEngineStatus(engine, {
    isInitialized: false,
    isLoopRunning: false,
    activeWorld: null,
  });

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
 * Creates a helper function that asserts a single dispatch call with a payload
 * generated from provided arguments.
 *
 * @param {string} eventId - The expected dispatched event id.
 * @param {(...args: any[]) => any} payloadBuilder - Function that builds the
 *   payload from the asserter arguments.
 * @returns {(mock: import('@jest/globals').Mock, ...args: any[]) => void}
 *   Dispatch asserter function.
 */
export function createDispatchAsserter(eventId, payloadBuilder) {
  return (mock, ...args) => {
    const payload = payloadBuilder(...args);
    expectSingleDispatch(mock, eventId, payload);
  };
}

/**
 * Asserts that an ENTITY_CREATED dispatch with the correct payload occurred.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {import('../../../src/entities/entity.js').default} entity - Entity instance.
 * @param {boolean} wasReconstructed - Flag indicating reconstruction.
 * @returns {void}
 */
export const expectEntityCreatedDispatch = createDispatchAsserter(
  ENTITY_CREATED_ID,
  (entity, wasReconstructed) => ({
    instanceId: entity.id,
    definitionId: entity.definitionId,
    wasReconstructed,
    entity,
  })
);

/**
 * Asserts that an ENTITY_REMOVED dispatch with the correct payload occurred.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {import('../../../src/entities/entity.js').default} entity - Entity instance.
 * @returns {void}
 */
export const expectEntityRemovedDispatch = createDispatchAsserter(
  ENTITY_REMOVED_ID,
  (entity) => ({ entity })
);

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
export const expectComponentAddedDispatch = createDispatchAsserter(
  COMPONENT_ADDED_ID,
  (entity, componentTypeId, newData, oldData) => ({
    entity,
    componentTypeId,
    componentData: newData,
    oldComponentData: oldData,
  })
);

/**
 * Asserts that a COMPONENT_REMOVED dispatch with the expected payload occurred.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @param {import('../../../src/entities/entity.js').default} entity - Entity instance.
 * @param {string} componentTypeId - Component type identifier.
 * @param {object|null|undefined} oldData - Previous component data.
 * @returns {void}
 */
export const expectComponentRemovedDispatch = createDispatchAsserter(
  COMPONENT_REMOVED_ID,
  (entity, componentTypeId, oldData) => ({
    entity,
    componentTypeId,
    oldComponentData: oldData,
  })
);

/**
 * @description Asserts that the engine dispatched a request to show the Load Game UI.
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @returns {void}
 */
export const expectShowLoadGameUIDispatch = createDispatchAsserter(
  REQUEST_SHOW_LOAD_GAME_UI,
  () => ({})
);

/**
 * @description Asserts that the engine dispatched a request to show the Save Game UI.
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @returns {void}
 */
export const expectShowSaveGameUIDispatch = createDispatchAsserter(
  REQUEST_SHOW_SAVE_GAME_UI,
  () => ({})
);

/**
 * Asserts that a new game started successfully.
 *
 * @description Ensures core services were invoked and the engine is running
 * with the given world.
 * @param {import('./gameEngineTestBed.js').GameEngineTestBed} bed - Test bed.
 * @param {import('../../../src/engine/gameEngine.js').default} engine - Engine
 *   instance.
 * @param {string} world - World name.
 * @returns {void}
 */
export function expectStartSuccess(bed, engine, world) {
  expect(bed.mocks.entityManager.clearAll).toHaveBeenCalled();
  expect(bed.mocks.playtimeTracker.reset).toHaveBeenCalled();
  expect(bed.env.mockContainer.resolve).toHaveBeenCalledWith(
    tokens.IInitializationService
  );
  expect(
    bed.mocks.initializationService.runInitializationSequence
  ).toHaveBeenCalledWith(world);
  expect(bed.mocks.playtimeTracker.startSession).toHaveBeenCalled();
  expect(bed.mocks.turnManager.start).toHaveBeenCalled();
  expectDispatchSequence(
    bed.mocks.safeEventDispatcher.dispatch,
    buildStartDispatches(world)
  );
  expectEngineRunning(engine, world);
}

/**
 * Asserts that stopping the engine succeeded without warnings.
 *
 * @param {import('./gameEngineTestBed.js').GameEngineTestBed} bed - Test bed.
 * @param {import('../../../src/engine/gameEngine.js').default} engine - Engine
 *   instance.
 * @returns {void}
 */
export function expectStopSuccess(bed, engine) {
  expect(bed.mocks.playtimeTracker.endSessionAndAccumulate).toHaveBeenCalled();
  expect(bed.mocks.turnManager.stop).toHaveBeenCalled();
  expectDispatchSequence(
    bed.mocks.safeEventDispatcher.dispatch,
    ...buildStopDispatches()
  );
  expectEngineStopped(engine);
  expect(bed.mocks.logger.warn).not.toHaveBeenCalled();
}

/**
 * Asserts that the dispatch function was never called.
 *
 * @param {import('@jest/globals').Mock} mock - Mocked dispatch function.
 * @returns {void}
 */
export const expectNoDispatch = (mock) => expect(mock).not.toHaveBeenCalled();

export { expectDispatchSequence as expectDispatchCalls };
