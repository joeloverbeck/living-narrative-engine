import { describe, it, expect, jest } from '@jest/globals';

import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService behaviour coverage', () => {
  describe('addThought', () => {
    it('throws a descriptive error when the memory reference is invalid', () => {
      const service = new ShortTermMemoryService();

      expect(() => service.addThought(null, 'thought')).toThrow(
        new TypeError(
          'mem must be an object conforming to core:short_term_memory schema'
        )
      );
    });

    it('ignores blank input after trimming without touching the thoughts array', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [{ text: 'existing', timestamp: '2024-01-01T00:00:00.000Z' }],
      };

      const result = service.addThought(mem, '    ');

      expect(result.wasAdded).toBe(false);
      expect(mem.thoughts).toHaveLength(1);
      expect(mem.thoughts[0].text).toBe('existing');
    });

    it('prevents duplicate thoughts even when casing and surrounding whitespace differ', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [
          {
            text: ' Remember The Mission ',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = service.addThought(mem, '\nremember the mission\t');

      expect(result.wasAdded).toBe(false);
      expect(mem.thoughts).toHaveLength(1);
    });

    it('creates a thoughts array when missing and uses the default capacity fallback', () => {
      const service = new ShortTermMemoryService({ defaultMaxEntries: 3 });
      const mem = { entityId: 'hero' };
      const now = new Date('2024-03-01T12:34:56.000Z');

      const result = service.addThought(mem, 'Chart a new course', now);

      expect(result.wasAdded).toBe(true);
      expect(result.entry).toEqual({
        text: 'Chart a new course',
        timestamp: now.toISOString(),
      });
      expect(mem.thoughts).toEqual([result.entry]);

      // Add enough entries to exceed the fallback capacity and ensure trimming occurs
      service.addThought(mem, 'Second thought', now);
      service.addThought(mem, 'Third thought', now);
      service.addThought(mem, 'Fourth thought', now);

      expect(mem.thoughts).toHaveLength(3);
      expect(mem.thoughts[0].text).toBe('Second thought');
    });

    it('respects the configured maxEntries value by discarding the oldest items first', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [
          { text: 'first', timestamp: '2024-01-01T00:00:00.000Z' },
          { text: 'second', timestamp: '2024-01-01T00:01:00.000Z' },
        ],
        maxEntries: 2,
      };

      const outcome = service.addThought(
        mem,
        'third',
        new Date('2024-01-01T00:02:00.000Z')
      );

      expect(outcome.wasAdded).toBe(true);
      expect(mem.thoughts).toHaveLength(2);
      expect(mem.thoughts.map((t) => t.text)).toEqual(['second', 'third']);
    });
  });

  describe('emitThoughtAdded', () => {
    it('dispatches the ThoughtAdded event when a functional dispatcher is available', () => {
      const dispatch = jest.fn();
      const service = new ShortTermMemoryService({
        eventDispatcher: { dispatch },
      });

      service.emitThoughtAdded(
        'actor-1',
        'A sudden idea',
        '2024-02-29T00:00:00.000Z'
      );

      expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
        entityId: 'actor-1',
        text: 'A sudden idea',
        timestamp: '2024-02-29T00:00:00.000Z',
      });
    });

    it('silently ignores emit requests when the dispatcher is absent or malformed', () => {
      const missingDispatcherService = new ShortTermMemoryService();
      const malformedDispatcherService = new ShortTermMemoryService({
        eventDispatcher: { dispatch: 'not a function' },
      });

      expect(() =>
        missingDispatcherService.emitThoughtAdded('entity', 'text', 'timestamp')
      ).not.toThrow();
      expect(() =>
        malformedDispatcherService.emitThoughtAdded(
          'entity',
          'text',
          'timestamp'
        )
      ).not.toThrow();
    });
  });
});
