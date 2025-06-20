import { describe, it, expect, jest } from '@jest/globals';
import {
  expectDispatchSequence,
  buildSaveDispatches,
  DEFAULT_ACTIVE_WORLD_FOR_SAVE,
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

    it('throws when sequences differ', () => {
      const mock = jest.fn();
      mock('eventA', { a: 1 });
      expect(() =>
        expectDispatchSequence(mock, ['eventA', { a: 2 }])
      ).toThrow();
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
});
