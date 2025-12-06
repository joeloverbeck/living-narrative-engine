import { describe, it, expect, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService', () => {
  describe('addThought', () => {
    it('throws a descriptive TypeError when mem is not an object', () => {
      const service = new ShortTermMemoryService();

      expect(() => service.addThought(null, 'hello')).toThrow(TypeError);
      expect(() => service.addThought(undefined, 'hello')).toThrow(
        'mem must be an object conforming to core:short_term_memory schema'
      );
    });

    it('returns early without mutating the thoughts array when the new text is blank', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [
          { text: 'Existing entry', timestamp: '2024-01-01T00:00:00.000Z' },
        ],
        maxEntries: 5,
      };
      const snapshot = mem.thoughts.slice();

      const result = service.addThought(mem, '   \n\t  ');

      expect(result).toEqual({ mem, wasAdded: false });
      expect(mem.thoughts).toEqual(snapshot);
    });

    it('avoids adding duplicate thoughts even when whitespace or casing differ', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [
          { text: 'First thought', timestamp: '2024-01-01T00:00:00.000Z' },
          {
            text: '   Duplicate Entry  ',
            timestamp: '2024-01-02T00:00:00.000Z',
          },
          { text: 12345, timestamp: '2024-01-03T00:00:00.000Z' },
        ],
        maxEntries: 5,
      };

      const result = service.addThought(mem, 'duplicate entry');

      expect(result).toEqual({ mem, wasAdded: false });
      expect(mem.thoughts).toHaveLength(3);
    });

    it('skips non-string entries when scanning for duplicates', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [
          { text: 42, timestamp: '2024-01-01T00:00:00.000Z' },
          { text: { nested: 'value' }, timestamp: '2024-01-02T00:00:00.000Z' },
        ],
        maxEntries: 5,
      };
      const now = new Date('2024-03-04T12:34:56.000Z');

      const result = service.addThought(mem, 'Fresh insight', now);

      expect(result).toEqual({
        mem,
        wasAdded: true,
        entry: { text: 'Fresh insight', timestamp: now.toISOString() },
      });
      expect(mem.thoughts).toHaveLength(3);
      expect(mem.thoughts[2]).toEqual(result.entry);
    });

    it('initialises the thoughts array when needed and records ISO timestamps', () => {
      const service = new ShortTermMemoryService();
      const mem = { maxEntries: 3 };
      const now = new Date('2024-02-20T10:20:30.000Z');

      const result = service.addThought(mem, 'A brand new idea', now);

      expect(result.wasAdded).toBe(true);
      expect(result.mem).toBe(mem);
      expect(result.entry).toEqual({
        text: 'A brand new idea',
        timestamp: now.toISOString(),
      });
      expect(mem.thoughts).toEqual([result.entry]);
    });

    it('respects the configured maxEntries by trimming the oldest thoughts', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [
          { text: 'oldest', timestamp: '2024-01-01T00:00:00.000Z' },
          { text: 'middle', timestamp: '2024-01-02T00:00:00.000Z' },
        ],
        maxEntries: 2,
      };
      const now = new Date('2024-01-03T00:00:00.000Z');

      const result = service.addThought(mem, 'newest', now);

      expect(result.wasAdded).toBe(true);
      expect(mem.thoughts).toEqual([
        { text: 'middle', timestamp: '2024-01-02T00:00:00.000Z' },
        { text: 'newest', timestamp: now.toISOString() },
      ]);
    });

    it('falls back to defaultMaxEntries when the memory specifies an invalid max', () => {
      const service = new ShortTermMemoryService({ defaultMaxEntries: 3 });
      const mem = {
        thoughts: [
          { text: 'keep-1', timestamp: '2024-01-01T00:00:00.000Z' },
          { text: 'keep-2', timestamp: '2024-01-02T00:00:00.000Z' },
          { text: 'keep-3', timestamp: '2024-01-03T00:00:00.000Z' },
        ],
        maxEntries: 0,
      };

      const result = service.addThought(
        mem,
        'keep-4',
        new Date('2024-01-04T00:00:00.000Z')
      );

      expect(result.wasAdded).toBe(true);
      expect(mem.thoughts.map((entry) => entry.text)).toEqual([
        'keep-2',
        'keep-3',
        'keep-4',
      ]);
    });
  });

  describe('emitThoughtAdded', () => {
    it('dispatches ThoughtAdded events when a dispatcher is provided', () => {
      const dispatch = jest.fn();
      const service = new ShortTermMemoryService({
        eventDispatcher: { dispatch },
      });

      service.emitThoughtAdded(
        'entity-42',
        'hello world',
        '2024-02-01T12:00:00.000Z'
      );

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
        entityId: 'entity-42',
        text: 'hello world',
        timestamp: '2024-02-01T12:00:00.000Z',
      });
    });

    it('silently ignores emit requests when no valid dispatcher exists', () => {
      const service = new ShortTermMemoryService();

      expect(() =>
        service.emitThoughtAdded(
          'entity-42',
          'text',
          '2024-02-01T12:00:00.000Z'
        )
      ).not.toThrow();

      service.eventDispatcher = { dispatch: 'not-a-function' };

      expect(() =>
        service.emitThoughtAdded(
          'entity-42',
          'text',
          '2024-02-01T12:00:00.000Z'
        )
      ).not.toThrow();
    });
  });
});
