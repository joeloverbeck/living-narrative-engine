import { describe, it, expect, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService additional coverage', () => {
  describe('addThought validation', () => {
    it('throws a helpful TypeError when mem is missing or not an object', () => {
      const service = new ShortTermMemoryService();

      expect(() => service.addThought(null, 'test')).toThrow(TypeError);
      expect(() => service.addThought(undefined, 'test')).toThrow(
        'mem must be an object conforming to core:short_term_memory schema'
      );
      expect(() => service.addThought(42, 'test')).toThrow(TypeError);
    });

    it('returns early without mutation when text is blank', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        entityId: 'actor:1',
        thoughts: [{ text: 'existing', timestamp: '2025-01-01T00:00:00.000Z' }],
        maxEntries: 4,
      };

      const result = service.addThought(mem, '   \n\t  ');

      expect(result).toEqual({ mem, wasAdded: false });
      expect(mem.thoughts).toHaveLength(1);
      expect(mem.thoughts[0].text).toBe('existing');
    });
  });

  describe('addThought duplicate and capacity handling', () => {
    it('skips entries with non-string text when checking duplicates', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        entityId: 'actor:2',
        thoughts: [
          { text: 123, timestamp: '2025-01-01T00:00:00.000Z' },
          { text: 'alpha', timestamp: '2025-01-01T00:01:00.000Z' },
        ],
        maxEntries: 5,
      };

      const { wasAdded } = service.addThought(mem, '  Alpha  ');

      expect(wasAdded).toBe(false);
      expect(mem.thoughts).toHaveLength(2);
    });

    it('creates an array for thoughts and enforces the default maxEntries fallback', () => {
      const service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
      const mem = { entityId: 'actor:3', thoughts: undefined, maxEntries: -1 };

      const first = service.addThought(
        mem,
        'first',
        new Date('2025-06-03T10:00:00.000Z')
      );
      const second = service.addThought(
        mem,
        'second',
        new Date('2025-06-03T10:01:00.000Z')
      );
      const third = service.addThought(
        mem,
        'third',
        new Date('2025-06-03T10:02:00.000Z')
      );

      expect(first.wasAdded).toBe(true);
      expect(second.wasAdded).toBe(true);
      expect(third.wasAdded).toBe(true);
      expect(mem.thoughts).toHaveLength(2);
      expect(mem.thoughts.map((entry) => entry.text)).toEqual([
        'second',
        'third',
      ]);
    });
  });

  describe('emitThoughtAdded behaviour', () => {
    it('dispatches ThoughtAdded events when a dispatcher is provided', () => {
      const dispatch = jest.fn();
      const service = new ShortTermMemoryService({
        eventDispatcher: { dispatch },
      });

      service.emitThoughtAdded('actor:4', 'hello', '2025-06-03T10:00:00.000Z');

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
        entityId: 'actor:4',
        text: 'hello',
        timestamp: '2025-06-03T10:00:00.000Z',
      });
    });

    it('does nothing when the dispatcher is missing or invalid', () => {
      const invalidDispatchers = [
        null,
        undefined,
        {},
        { dispatch: 'not-a-function' },
      ];
      const service = new ShortTermMemoryService();

      for (const dispatcher of invalidDispatchers) {
        service.eventDispatcher = dispatcher;
        expect(() =>
          service.emitThoughtAdded(
            'actor:5',
            'ignored',
            '2025-06-03T10:00:00.000Z'
          )
        ).not.toThrow();
      }
    });
  });
});
