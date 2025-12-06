import { describe, expect, it, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService additional coverage', () => {
  describe('addThought', () => {
    it('throws when mem is not an object', () => {
      const service = new ShortTermMemoryService();

      expect(() => service.addThought(null, 'thought')).toThrow(TypeError);
      expect(() => service.addThought(null, 'thought')).toThrow(
        'mem must be an object conforming to core:short_term_memory schema'
      );
    });

    it('returns early when text becomes empty after trimming', () => {
      const service = new ShortTermMemoryService();
      const mem = { thoughts: [], maxEntries: 5 };

      const result = service.addThought(mem, '   ');

      expect(result).toEqual({ mem, wasAdded: false });
      expect(mem.thoughts).toHaveLength(0);
    });

    it('prevents duplicates even when prior entries require trimming or case normalisation', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [
          { text: 123, timestamp: 'old' },
          { text: '  Existing Thought  ', timestamp: 'old2' },
        ],
        maxEntries: 5,
      };

      const result = service.addThought(mem, 'existing thought');

      expect(result).toEqual({ mem, wasAdded: false });
      expect(mem.thoughts).toHaveLength(2);
    });

    it('appends new entries, honours timestamp provider, and trims to configured capacity', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [
          { text: 'first', timestamp: 't1' },
          { text: 'second', timestamp: 't2' },
        ],
        maxEntries: 2,
      };
      const now = {
        toISOString: jest.fn().mockReturnValue('2024-01-02T03:04:05.000Z'),
      };

      const result = service.addThought(mem, 'new idea', now);

      expect(result.wasAdded).toBe(true);
      expect(result.entry).toEqual({
        text: 'new idea',
        timestamp: '2024-01-02T03:04:05.000Z',
      });
      expect(mem.thoughts).toEqual([
        { text: 'second', timestamp: 't2' },
        { text: 'new idea', timestamp: '2024-01-02T03:04:05.000Z' },
      ]);
      expect(now.toISOString).toHaveBeenCalledTimes(1);
    });

    it('falls back to default capacity when mem.maxEntries is not a positive integer', () => {
      const service = new ShortTermMemoryService({ defaultMaxEntries: 3 });
      const mem = {
        thoughts: [
          { text: 'first', timestamp: 't1' },
          { text: 'second', timestamp: 't2' },
          { text: 'third', timestamp: 't3' },
        ],
        maxEntries: 'not-a-number',
      };

      const result = service.addThought(mem, 'fourth');

      expect(result.wasAdded).toBe(true);
      expect(mem.thoughts).toHaveLength(3);
      expect(mem.thoughts.at(0)?.text).toBe('second');
      expect(mem.thoughts.at(-1)?.text).toBe('fourth');
    });

    it('initialises thoughts array when missing', () => {
      const service = new ShortTermMemoryService();
      const mem = { maxEntries: 1 };

      const result = service.addThought(mem, 42, { toISOString: () => 'now' });

      expect(Array.isArray(mem.thoughts)).toBe(true);
      expect(mem.thoughts).toEqual([{ text: 42, timestamp: 'now' }]);
      expect(result).toEqual({
        mem,
        wasAdded: true,
        entry: { text: 42, timestamp: 'now' },
      });
    });
  });

  describe('emitThoughtAdded', () => {
    it('dispatches events when a compatible dispatcher is configured', () => {
      const dispatch = jest.fn();
      const service = new ShortTermMemoryService({
        eventDispatcher: { dispatch },
      });

      service.emitThoughtAdded(
        'entity-1',
        'remember this',
        '2024-01-02T03:04:05.000Z'
      );

      expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
        entityId: 'entity-1',
        text: 'remember this',
        timestamp: '2024-01-02T03:04:05.000Z',
      });
    });

    it('silently ignores missing or incompatible dispatchers', () => {
      const service = new ShortTermMemoryService({ eventDispatcher: {} });

      expect(() =>
        service.emitThoughtAdded('entity', 'text', 'timestamp')
      ).not.toThrow();
    });
  });
});
