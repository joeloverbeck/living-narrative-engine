import { describe, it, expect, jest } from '@jest/globals';
import {
  expectDispatchSequence,
  expectSingleDispatch,
  buildSaveDispatches,
  buildStopDispatches,
  buildStartDispatches,
  expectEngineStatus,
  expectEngineRunning,
  expectEngineStopped,
  expectEntityCreatedDispatch,
  expectEntityRemovedDispatch,
  expectComponentAddedDispatch,
  expectComponentRemovedDispatch,
  expectNoDispatch,
} from './dispatchTestUtils.js';
import { DEFAULT_ACTIVE_WORLD_FOR_SAVE } from '../constants.js';
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

describe('dispatchTestUtils', () => {
  describe('expectDispatchSequence', () => {
    it('verifies sequence equality', () => {
      const mock = jest.fn();
      const eventA = ['eventA', { a: 1 }];
      const eventB = ['eventB', { b: 2 }];
      mock(...eventA);
      mock(...eventB);
      expect(() => expectDispatchSequence(mock, eventA, eventB)).not.toThrow();
    });

    it('accepts a single array of events', () => {
      const mock = jest.fn();
      const events = [
        ['eventA', { a: 1 }],
        ['eventB', { b: 2 }],
      ];
      events.forEach((e) => mock(...e));

      expect(() => expectDispatchSequence(mock, events)).not.toThrow();
    });

    it('throws when sequences differ', () => {
      const mock = jest.fn();
      mock('eventA', { a: 1 });
      expect(() =>
        expectDispatchSequence(mock, ['eventA', { a: 2 }])
      ).toThrow();
    });
  });

  describe('expectSingleDispatch', () => {
    it('succeeds when single call matches', () => {
      const mock = jest.fn();
      mock('eventA', { a: 1 });
      expect(() =>
        expectSingleDispatch(mock, 'eventA', { a: 1 })
      ).not.toThrow();
    });

    it('throws when call differs', () => {
      const mock = jest.fn();
      mock('eventA', { a: 2 });
      expect(() => expectSingleDispatch(mock, 'eventA', { a: 1 })).toThrow();
    });
  });

  describe('expectNoDispatch', () => {
    it('passes when no calls were made', () => {
      const mock = jest.fn();
      expect(() => expectNoDispatch(mock)).not.toThrow();
    });

    it('throws when mock has calls', () => {
      const mock = jest.fn();
      mock('eventA', {});
      expect(() => expectNoDispatch(mock)).toThrow();
    });
  });

  describe('buildSaveDispatches', () => {
    it('builds success dispatch sequence with path', () => {
      const result = buildSaveDispatches('Save1', 'path/to.sav');
      expect(result).toEqual([
        [
          ENGINE_OPERATION_IN_PROGRESS_UI,
          {
            titleMessage: 'Saving...',
            inputDisabledMessage: 'Saving game "Save1"...',
          },
        ],
        [
          GAME_SAVED_ID,
          { saveName: 'Save1', path: 'path/to.sav', type: 'manual' },
        ],
        [
          ENGINE_READY_UI,
          {
            activeWorld: DEFAULT_ACTIVE_WORLD_FOR_SAVE,
            message: 'Save operation finished. Ready.',
          },
        ],
      ]);
    });

    it('omits GAME_SAVED_ID when path not provided', () => {
      const result = buildSaveDispatches('Save1');
      expect(result).toEqual([
        [
          ENGINE_OPERATION_IN_PROGRESS_UI,
          {
            titleMessage: 'Saving...',
            inputDisabledMessage: 'Saving game "Save1"...',
          },
        ],
        [
          ENGINE_READY_UI,
          {
            activeWorld: DEFAULT_ACTIVE_WORLD_FOR_SAVE,
            message: 'Save operation finished. Ready.',
          },
        ],
      ]);
    });
  });

  describe('buildStopDispatches', () => {
    it('returns expected stop dispatch sequence', () => {
      const result = buildStopDispatches();
      expect(result).toEqual([
        [
          ENGINE_STOPPED_UI,
          { inputDisabledMessage: 'Game stopped. Engine is inactive.' },
        ],
      ]);
    });
  });

  describe('buildStartDispatches', () => {
    it('returns initializing dispatch entry', () => {
      const result = buildStartDispatches('NewWorld');
      expect(result[0]).toEqual([
        ENGINE_INITIALIZING_UI,
        { worldName: 'NewWorld' },
        { allowSchemaNotFound: true },
      ]);
    });

    it('returns ready dispatch entry', () => {
      const result = buildStartDispatches('NewWorld');
      expect(result[1]).toEqual([
        ENGINE_READY_UI,
        { activeWorld: 'NewWorld', message: 'Enter command...' },
      ]);
    });
  });

  describe('expectEngineStatus', () => {
    it('verifies engine status equality', () => {
      const engine = { getEngineStatus: () => ({ ready: true }) };
      expect(() => expectEngineStatus(engine, { ready: true })).not.toThrow();
    });

    it('throws when statuses differ', () => {
      const engine = { getEngineStatus: () => ({ ready: false }) };
      expect(() => expectEngineStatus(engine, { ready: true })).toThrow();
    });
  });

  describe('expectEngineRunning and expectEngineStopped', () => {
    it('validates running helper', () => {
      const engine = {
        getEngineStatus: () => ({
          isInitialized: true,
          isLoopRunning: true,
          activeWorld: 'World',
        }),
      };
      expect(() => expectEngineRunning(engine, 'World')).not.toThrow();
    });

    it('throws when running expectations fail', () => {
      const engine = {
        getEngineStatus: () => ({
          isInitialized: false,
          isLoopRunning: true,
          activeWorld: 'World',
        }),
      };
      expect(() => expectEngineRunning(engine, 'World')).toThrow();
    });

    it('validates stopped helper', () => {
      const engine = {
        getEngineStatus: () => ({
          isInitialized: false,
          isLoopRunning: false,
          activeWorld: null,
        }),
      };
      expect(() => expectEngineStopped(engine)).not.toThrow();
    });

    it('throws when stopped expectations fail', () => {
      const engine = {
        getEngineStatus: () => ({
          isInitialized: true,
          isLoopRunning: true,
          activeWorld: 'World',
        }),
      };
      expect(() => expectEngineStopped(engine)).toThrow();
    });
  });

  describe('entity and component dispatch helpers', () => {
    it('validates ENTITY_CREATED helper', () => {
      const mock = jest.fn();
      const entity = { id: 'e1' };
      mock(ENTITY_CREATED_ID, { entity, wasReconstructed: false });

      expect(() =>
        expectEntityCreatedDispatch(mock, entity, false)
      ).not.toThrow();
    });

    it('throws on mismatched ENTITY_CREATED payload', () => {
      const mock = jest.fn();
      const entity = { id: 'e1' };
      mock(ENTITY_CREATED_ID, { entity, wasReconstructed: false });

      expect(() => expectEntityCreatedDispatch(mock, entity, true)).toThrow();
    });

    it('validates ENTITY_REMOVED helper', () => {
      const mock = jest.fn();
      const entity = { id: 'e1' };
      mock(ENTITY_REMOVED_ID, { entity });

      expect(() => expectEntityRemovedDispatch(mock, entity)).not.toThrow();
    });

    it('validates COMPONENT_ADDED helper', () => {
      const mock = jest.fn();
      const entity = { id: 'e1' };
      const newData = { a: 1 };
      mock(COMPONENT_ADDED_ID, {
        entity,
        componentTypeId: 'typeA',
        componentData: newData,
        oldComponentData: undefined,
      });

      expect(() =>
        expectComponentAddedDispatch(mock, entity, 'typeA', newData, undefined)
      ).not.toThrow();
    });

    it('validates COMPONENT_REMOVED helper', () => {
      const mock = jest.fn();
      const entity = { id: 'e1' };
      const oldData = { a: 1 };
      mock(COMPONENT_REMOVED_ID, {
        entity,
        componentTypeId: 'typeA',
        oldComponentData: oldData,
      });

      expect(() =>
        expectComponentRemovedDispatch(mock, entity, 'typeA', oldData)
      ).not.toThrow();
    });
  });
});
