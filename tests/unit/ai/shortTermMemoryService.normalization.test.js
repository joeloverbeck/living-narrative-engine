import { describe, it, expect, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService storage normalisation and dispatch integration', () => {
  it('throws informative errors for non-object memory containers', () => {
    const service = new ShortTermMemoryService();

    expect(() => service.addThought('not-an-object', 'idea')).toThrow(
      TypeError
    );
    expect(() => service.addThought('not-an-object', 'idea')).toThrow(
      'mem must be an object conforming to core:short_term_memory schema'
    );

    const symbolMem = Symbol('memory');
    expect(() => service.addThought(symbolMem, 'second idea')).toThrow(
      TypeError
    );
    expect(() => service.addThought(symbolMem, 'second idea')).toThrow(
      'mem must be an object conforming to core:short_term_memory schema'
    );
  });

  it('normalises non-array storage and applies default capacity limits', () => {
    const service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
    const mem = {
      entityId: 'actor-7',
      thoughts: new Set([
        { text: 'Legacy entry', timestamp: '2024-06-30T22:59:00.000Z' },
      ]),
      maxEntries: null,
    };

    const firstTimestamp = new Date('2024-07-01T09:00:00.000Z');
    const secondTimestamp = new Date('2024-07-01T09:01:00.000Z');
    const thirdTimestamp = new Date('2024-07-01T09:02:00.000Z');

    const firstResult = service.addThought(mem, 'First entry', firstTimestamp);
    expect(firstResult.wasAdded).toBe(true);
    expect(Array.isArray(mem.thoughts)).toBe(true);
    expect(mem.thoughts).toHaveLength(1);
    expect(mem.thoughts[0]).toEqual({
      text: 'First entry',
      timestamp: firstTimestamp.toISOString(),
    });

    const secondResult = service.addThought(
      mem,
      'Second entry',
      secondTimestamp
    );
    expect(secondResult.wasAdded).toBe(true);
    expect(mem.thoughts).toHaveLength(2);

    const thirdResult = service.addThought(
      mem,
      ' Third entry ',
      thirdTimestamp
    );
    expect(thirdResult.wasAdded).toBe(true);
    expect(mem.thoughts).toEqual([
      { text: 'Second entry', timestamp: secondTimestamp.toISOString() },
      { text: ' Third entry ', timestamp: thirdTimestamp.toISOString() },
    ]);
    expect(thirdResult.entry).toEqual(mem.thoughts[1]);
  });

  it('ignores additions that collapse to an empty string after trimming', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      entityId: 'actor-blank',
      thoughts: [
        { text: 'Existing entry', timestamp: '2024-07-01T08:00:00.000Z' },
      ],
      maxEntries: 4,
    };

    const snapshot = [...mem.thoughts];

    const result = service.addThought(mem, '   \n\t  ');

    expect(result).toEqual({ mem, wasAdded: false });
    expect(mem.thoughts).toEqual(snapshot);
  });

  it('skips non-string history entries and prevents duplicate additions', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      entityId: 'actor-dup',
      thoughts: [
        { text: 42, timestamp: '2024-07-01T08:05:00.000Z' },
        { text: ' Original Thought ', timestamp: '2024-07-01T08:10:00.000Z' },
      ],
      maxEntries: 5,
    };

    const duplicate = service.addThought(mem, 'original thought');

    expect(duplicate).toEqual({ mem, wasAdded: false });
    expect(mem.thoughts).toHaveLength(2);
    expect(mem.thoughts[0].text).toBe(42);
  });

  it('creates the thoughts array when it is initially missing', () => {
    const service = new ShortTermMemoryService();
    const mem = { entityId: 'actor-init', maxEntries: 3 };
    const now = new Date('2024-07-01T09:05:00.000Z');

    const result = service.addThought(mem, 'Fresh start', now);

    expect(result).toEqual({
      mem,
      wasAdded: true,
      entry: { text: 'Fresh start', timestamp: now.toISOString() },
    });
    expect(Array.isArray(mem.thoughts)).toBe(true);
    expect(mem.thoughts).toEqual([result.entry]);
  });

  it('supports late-bound dispatchers and reuses addThought results for event emission', () => {
    const service = new ShortTermMemoryService();
    const mem = { entityId: 'actor-9', thoughts: [], maxEntries: 5 };
    const now = new Date('2024-07-01T09:03:00.000Z');

    const { entry, wasAdded } = service.addThought(mem, 'Persist me', now);
    expect(wasAdded).toBe(true);
    expect(mem.thoughts).toEqual([
      { text: 'Persist me', timestamp: now.toISOString() },
    ]);

    expect(() =>
      service.emitThoughtAdded(mem.entityId, entry.text, entry.timestamp)
    ).not.toThrow();

    const dispatch = jest.fn();
    service.eventDispatcher = { dispatch };

    service.emitThoughtAdded(mem.entityId, entry.text, entry.timestamp);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
      entityId: mem.entityId,
      text: entry.text,
      timestamp: entry.timestamp,
    });

    const duplicateResult = service.addThought(
      mem,
      '  persist me  ',
      new Date('2024-07-01T09:04:00.000Z')
    );
    expect(duplicateResult.wasAdded).toBe(false);
    expect(mem.thoughts).toHaveLength(1);
  });
});
