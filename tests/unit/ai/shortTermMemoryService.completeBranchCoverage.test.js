import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService complete branch coverage', () => {
  describe('addThought', () => {
    it('throws a descriptive TypeError when mem is not an object', () => {
      const service = new ShortTermMemoryService();

      expect(() => service.addThought(null, 'thought')).toThrow(
        new TypeError(
          'mem must be an object conforming to core:short_term_memory schema'
        )
      );
    });

    it('skips additions when trimming removes all characters', () => {
      const service = new ShortTermMemoryService();
      const mem = { thoughts: [], maxEntries: 1, entityId: 'entity-1' };

      const result = service.addThought(mem, '   \n\t  ');

      expect(result).toEqual({ mem, wasAdded: false });
      expect(mem.thoughts).toHaveLength(0);
    });

    it('avoids duplicates regardless of casing or leading whitespace', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [{ text: 'Plan Ahead', timestamp: '2024-01-01T00:00:00.000Z' }],
        maxEntries: 5,
        entityId: 'entity-2',
      };

      const result = service.addThought(mem, '  plan ahead  ');

      expect(result).toEqual({ mem, wasAdded: false });
      expect(mem.thoughts).toHaveLength(1);
    });

    it('initialises storage, records timestamps, and enforces fallback capacity', () => {
      const service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
      const mem = { thoughts: null, maxEntries: 0, entityId: 'entity-3' };

      const firstTimestamp = new Date('2024-05-01T10:00:00Z');
      const secondTimestamp = new Date('2024-05-01T10:01:00Z');
      const thirdTimestamp = new Date('2024-05-01T10:02:00Z');

      const first = service.addThought(mem, 'First idea', firstTimestamp);
      const second = service.addThought(mem, 'Second idea', secondTimestamp);
      const third = service.addThought(mem, 'Third idea', thirdTimestamp);

      expect(first.wasAdded).toBe(true);
      expect(second.wasAdded).toBe(true);
      expect(third.wasAdded).toBe(true);

      expect(mem.thoughts).toHaveLength(2);
      expect(mem.thoughts[0]).toEqual({
        text: 'Second idea',
        timestamp: secondTimestamp.toISOString(),
      });
      expect(mem.thoughts[1]).toEqual({
        text: 'Third idea',
        timestamp: thirdTimestamp.toISOString(),
      });
      expect(third.entry).toEqual(mem.thoughts[1]);
    });

    it('honours numeric maxEntries and ignores non-string history entries when deduplicating', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [{ text: 42 }, { text: 'Existing idea', timestamp: '2024-03-01T00:00:00.000Z' }],
        maxEntries: 3,
        entityId: 'entity-5',
      };
      const timestamp = new Date('2024-03-01T01:00:00Z');

      const result = service.addThought(mem, 'Follow-up idea', timestamp);

      expect(result.wasAdded).toBe(true);
      expect(mem.thoughts).toHaveLength(3);
      expect(mem.thoughts[2]).toEqual({
        text: 'Follow-up idea',
        timestamp: timestamp.toISOString(),
      });
    });
  });

  describe('emitThoughtAdded', () => {
    it('dispatches the ThoughtAdded event when a dispatcher is available', () => {
      const dispatch = jest.fn();
      const service = new ShortTermMemoryService({ eventDispatcher: { dispatch } });

      service.emitThoughtAdded('entity-4', 'Remember this', '2024-06-01T12:00:00.000Z');

      expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
        entityId: 'entity-4',
        text: 'Remember this',
        timestamp: '2024-06-01T12:00:00.000Z',
      });
    });

    it('remains silent when the dispatcher or dispatch function is missing', () => {
      const serviceWithoutDispatcher = new ShortTermMemoryService();
      expect(() =>
        serviceWithoutDispatcher.emitThoughtAdded('entity', 'text', 'timestamp')
      ).not.toThrow();

      const serviceWithoutFunction = new ShortTermMemoryService({
        eventDispatcher: {},
      });

      expect(() =>
        serviceWithoutFunction.emitThoughtAdded('entity', 'text', 'timestamp')
      ).not.toThrow();
    });
  });
});
