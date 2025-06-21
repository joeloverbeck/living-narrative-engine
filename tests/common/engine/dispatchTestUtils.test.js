import { describe, it, expect, jest } from '@jest/globals';
import {
  expectDispatchSequence,
  buildSaveDispatches,
  DEFAULT_ACTIVE_WORLD_FOR_SAVE,
  expectEngineStatus,
  expectSingleDispatch,
} from './dispatchTestUtils.js';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
  GAME_SAVED_ID,
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
    it('verifies a single dispatch call', () => {
      const mock = jest.fn();
      const event = ['eventA', { a: 1 }];
      mock(...event);
      expect(() =>
        expectSingleDispatch(mock, 'eventA', { a: 1 })
      ).not.toThrow();
    });

    it('throws when the call does not match', () => {
      const mock = jest.fn();
      mock('eventA', { a: 1 });
      expect(() => expectSingleDispatch(mock, 'eventB', { b: 2 })).toThrow();
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
});
