import { describe, expect, it, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

/**
 * Additional coverage for ShortTermMemoryService capacity management behaviours.
 */
describe('ShortTermMemoryService capacity management', () => {
  it('throws when provided memory container is not an object', () => {
    const service = new ShortTermMemoryService();

    expect(() => service.addThought(null, 'anything')).toThrow(TypeError);
    expect(() => service.addThought(undefined, 'anything')).toThrow(
      'mem must be an object conforming to core:short_term_memory schema'
    );
  });

  it('falls back to defaultMaxEntries when a non-integer maxEntries is provided', () => {
    const service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
    const mem = {
      thoughts: [
        { text: 'keep-1', timestamp: '2024-01-01T00:00:00.000Z' },
        { text: 'keep-2', timestamp: '2024-01-02T00:00:00.000Z' },
        { text: 'keep-3', timestamp: '2024-01-03T00:00:00.000Z' },
      ],
      // Using a string mimics data that failed validation before reaching the service.
      maxEntries: 'three',
    };
    const now = new Date('2024-01-04T00:00:00.000Z');

    const result = service.addThought(mem, 'fresh entry', now);

    expect(result).toEqual({
      mem,
      wasAdded: true,
      entry: { text: 'fresh entry', timestamp: now.toISOString() },
    });
    expect(mem.thoughts).toEqual([
      { text: 'keep-3', timestamp: '2024-01-03T00:00:00.000Z' },
      { text: 'fresh entry', timestamp: now.toISOString() },
    ]);
  });

  it('trims multiple oldest thoughts when the buffer exceeds capacity by more than one entry', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      thoughts: [
        { text: 't0', timestamp: '2024-01-01T00:00:00.000Z' },
        { text: 't1', timestamp: '2024-01-02T00:00:00.000Z' },
        { text: 't2', timestamp: '2024-01-03T00:00:00.000Z' },
      ],
      maxEntries: 1,
    };
    const now = new Date('2024-01-04T00:00:00.000Z');

    const result = service.addThought(mem, 'newest', now);

    expect(result).toEqual({
      mem,
      wasAdded: true,
      entry: { text: 'newest', timestamp: now.toISOString() },
    });
    expect(mem.thoughts).toEqual([
      { text: 'newest', timestamp: now.toISOString() },
    ]);
  });

  it('detects duplicates even when the new thought is supplied as a non-string value', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      thoughts: [
        { text: 42, timestamp: '2024-01-01T00:00:00.000Z' },
        { text: 'keep-me', timestamp: '2024-01-02T00:00:00.000Z' },
        { text: '123', timestamp: '2024-01-03T00:00:00.000Z' },
      ],
      maxEntries: 5,
    };
    const now = new Date('2024-01-05T00:00:00.000Z');

    const result = service.addThought(mem, 123, now);

    expect(result).toEqual({ mem, wasAdded: false });
    expect(mem.thoughts).toHaveLength(3);
  });

  it('returns early without modification when the supplied text trims to an empty string', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      thoughts: [
        { text: 'existing thought', timestamp: '2024-02-01T00:00:00.000Z' },
      ],
      maxEntries: 10,
    };
    const snapshot = [...mem.thoughts];

    const result = service.addThought(mem, '   \n\t  ');

    expect(result).toEqual({ mem, wasAdded: false });
    expect(mem.thoughts).toEqual(snapshot);
  });

  it('initialises the thoughts array when the memory object omits it', () => {
    const service = new ShortTermMemoryService();
    const mem = { maxEntries: 2 };
    const now = new Date('2024-02-10T10:00:00.000Z');

    const result = service.addThought(mem, 'brand new', now);

    expect(Array.isArray(mem.thoughts)).toBe(true);
    expect(mem.thoughts).toEqual([
      { text: 'brand new', timestamp: now.toISOString() },
    ]);
    expect(result).toEqual({
      mem,
      wasAdded: true,
      entry: { text: 'brand new', timestamp: now.toISOString() },
    });
  });

  it('forwards ThoughtAdded events when a dispatcher with a dispatch function is configured', () => {
    const dispatch = jest.fn();
    const service = new ShortTermMemoryService({
      eventDispatcher: { dispatch },
    });

    service.emitThoughtAdded(
      'actor-1',
      'remember this',
      '2024-01-06T00:00:00.000Z'
    );

    expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
      entityId: 'actor-1',
      text: 'remember this',
      timestamp: '2024-01-06T00:00:00.000Z',
    });
  });

  it('silently ignores emit requests when the dispatcher is missing or invalid', () => {
    const service = new ShortTermMemoryService();

    expect(() =>
      service.emitThoughtAdded('actor-2', 'ignored', '2024-01-07T00:00:00.000Z')
    ).not.toThrow();

    service.eventDispatcher = { dispatch: 'not-a-function' };

    expect(() =>
      service.emitThoughtAdded('actor-2', 'ignored', '2024-01-07T00:00:00.000Z')
    ).not.toThrow();
  });
});
