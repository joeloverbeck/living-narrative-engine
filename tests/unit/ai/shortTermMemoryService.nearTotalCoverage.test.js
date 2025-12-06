import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService near-total coverage scenarios', () => {
  describe('constructor', () => {
    it('defaults eventDispatcher and defaultMaxEntries when no options supplied', () => {
      const service = new ShortTermMemoryService();

      expect(service.eventDispatcher).toBeNull();
      expect(service.defaultMaxEntries).toBe(50);
    });

    it('respects provided options', () => {
      const dispatcher = { dispatch: jest.fn() };
      const service = new ShortTermMemoryService({
        eventDispatcher: dispatcher,
        defaultMaxEntries: 7,
      });

      expect(service.eventDispatcher).toBe(dispatcher);
      expect(service.defaultMaxEntries).toBe(7);
    });
  });

  describe('addThought', () => {
    it('throws when mem is not an object', () => {
      const service = new ShortTermMemoryService();

      expect(() => service.addThought(null, 'hi')).toThrow(
        'mem must be an object conforming to core:short_term_memory schema'
      );
    });

    it('ignores blank or whitespace-only input', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [{ text: 'Existing', timestamp: '2024-01-01T00:00:00.000Z' }],
      };

      const result = service.addThought(mem, '   \t  ');

      expect(result).toEqual({ mem, wasAdded: false });
      expect(mem.thoughts).toHaveLength(1);
    });

    it('skips duplicates regardless of casing and surrounding whitespace', () => {
      const service = new ShortTermMemoryService();
      const mem = {
        thoughts: [
          { text: 12345, timestamp: '2024-01-01T00:00:00.000Z' },
          { text: 'First memory', timestamp: '2024-01-02T00:00:00.000Z' },
          {
            text: '   Duplicate Entry   ',
            timestamp: '2024-01-03T00:00:00.000Z',
          },
        ],
      };

      const result = service.addThought(mem, '\n duplicate entry');

      expect(result).toEqual({ mem, wasAdded: false });
      expect(mem.thoughts).toHaveLength(3);
    });

    it('creates thoughts array when missing and trims to maxEntries', () => {
      const now = new Date('2024-05-01T12:00:00.000Z');
      const service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
      const mem = { maxEntries: 3 };

      const first = service.addThought(mem, 'First thought', now);
      const second = service.addThought(mem, 'Second thought', now);
      const third = service.addThought(mem, 'Third thought', now);
      const fourth = service.addThought(mem, 'Fourth thought', now);

      expect(first.wasAdded).toBe(true);
      expect(second.wasAdded).toBe(true);
      expect(third.wasAdded).toBe(true);
      expect(fourth.wasAdded).toBe(true);
      expect(mem.thoughts).toHaveLength(3);
      expect(mem.thoughts.map((entry) => entry.text)).toEqual([
        'Second thought',
        'Third thought',
        'Fourth thought',
      ]);
      expect(first.entry.timestamp).toBe(now.toISOString());
      expect(first.entry.text).toBe('First thought');
    });

    it('uses defaultMaxEntries when mem.maxEntries is invalid', () => {
      const service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
      const mem = { thoughts: [] };

      service.addThought(mem, 'One');
      service.addThought(mem, 'Two');
      service.addThought(mem, 'Three');

      expect(mem.thoughts.map((entry) => entry.text)).toEqual(['Two', 'Three']);
    });
  });

  describe('emitThoughtAdded', () => {
    it('dispatches ThoughtAdded event when dispatcher is available', () => {
      const dispatch = jest.fn();
      const service = new ShortTermMemoryService({
        eventDispatcher: { dispatch },
      });

      service.emitThoughtAdded(
        'entity-123',
        'Remember this',
        '2024-04-01T10:00:00.000Z'
      );

      expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
        entityId: 'entity-123',
        text: 'Remember this',
        timestamp: '2024-04-01T10:00:00.000Z',
      });
    });

    it('silently ignores when dispatcher is missing or invalid', () => {
      const noDispatcher = new ShortTermMemoryService();
      const badDispatcher = new ShortTermMemoryService({ eventDispatcher: {} });

      expect(() =>
        noDispatcher.emitThoughtAdded('e1', 'text', '2024-04-01T10:00:00.000Z')
      ).not.toThrow();
      expect(() =>
        badDispatcher.emitThoughtAdded('e1', 'text', '2024-04-01T10:00:00.000Z')
      ).not.toThrow();
    });
  });
});
