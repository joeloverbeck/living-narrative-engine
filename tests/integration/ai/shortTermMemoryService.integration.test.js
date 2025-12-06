import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService integration', () => {
  /** @type {ShortTermMemoryService} */
  let service;

  beforeEach(() => {
    service = new ShortTermMemoryService();
  });

  it('throws when the provided memory object is not valid', () => {
    expect(() => service.addThought(null, 'idea')).toThrow(TypeError);
    expect(() => service.addThought(undefined, 'idea')).toThrow(
      'mem must be an object conforming to core:short_term_memory schema'
    );
  });

  it('ignores blank inputs after trimming', () => {
    const mem = {
      thoughts: [{ text: 'keep me', timestamp: '2024-01-01T00:00:00.000Z' }],
      maxEntries: 3,
      entityId: 'npc-1',
    };

    const result = service.addThought(mem, '   ');

    expect(result.wasAdded).toBe(false);
    expect(result.mem).toBe(mem);
    expect(mem.thoughts).toHaveLength(1);
  });

  it('prevents duplicates ignoring whitespace and case, even when previous entries are not strings', () => {
    const mem = {
      thoughts: [
        { text: 42, timestamp: '2024-02-02T00:00:00.000Z' },
        { text: 'Remember This', timestamp: '2024-02-02T01:00:00.000Z' },
      ],
      maxEntries: 5,
      entityId: 'npc-2',
    };

    const result = service.addThought(mem, '  remember this  ');

    expect(result.wasAdded).toBe(false);
    expect(mem.thoughts).toHaveLength(2);
  });

  it('initialises the thoughts array when missing and records the supplied timestamp', () => {
    const now = new Date('2024-03-03T12:00:00.000Z');
    const mem = {
      entityId: 'npc-3',
      maxEntries: 1,
    };

    const result = service.addThought(mem, 'Fresh idea', now);

    expect(result.wasAdded).toBe(true);
    expect(Array.isArray(mem.thoughts)).toBe(true);
    expect(mem.thoughts).toHaveLength(1);
    expect(mem.thoughts[0]).toEqual({
      text: 'Fresh idea',
      timestamp: now.toISOString(),
    });
    expect(result.entry).toBe(mem.thoughts[0]);
  });

  it('trims oldest thoughts when exceeding mem.maxEntries', () => {
    const mem = {
      entityId: 'npc-4',
      maxEntries: 2,
      thoughts: [
        { text: 'oldest', timestamp: '2024-01-01T10:00:00.000Z' },
        { text: 'newer', timestamp: '2024-01-01T11:00:00.000Z' },
      ],
    };
    const now = new Date('2024-04-04T15:00:00.000Z');

    const result = service.addThought(mem, 'latest', now);

    expect(result.wasAdded).toBe(true);
    expect(mem.thoughts).toHaveLength(2);
    expect(mem.thoughts[0]).toEqual({
      text: 'newer',
      timestamp: '2024-01-01T11:00:00.000Z',
    });
    expect(mem.thoughts[1]).toEqual({
      text: 'latest',
      timestamp: now.toISOString(),
    });
  });

  it('falls back to defaultMaxEntries when mem.maxEntries is invalid', () => {
    service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
    const mem = {
      entityId: 'npc-5',
      maxEntries: 0,
      thoughts: [
        { text: 'first', timestamp: '2024-05-05T08:00:00.000Z' },
        { text: 'second', timestamp: '2024-05-05T09:00:00.000Z' },
      ],
    };
    const now = new Date('2024-05-05T10:00:00.000Z');

    const result = service.addThought(mem, 'third', now);

    expect(result.wasAdded).toBe(true);
    expect(mem.thoughts).toHaveLength(2);
    expect(mem.thoughts[0].text).toBe('second');
    expect(mem.thoughts[1]).toEqual({
      text: 'third',
      timestamp: now.toISOString(),
    });
  });

  it('dispatches ThoughtAdded events when a dispatcher is provided', () => {
    const dispatch = jest.fn();
    service = new ShortTermMemoryService({ eventDispatcher: { dispatch } });

    service.emitThoughtAdded('npc-6', 'memory', '2024-06-06T06:00:00.000Z');

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
      entityId: 'npc-6',
      text: 'memory',
      timestamp: '2024-06-06T06:00:00.000Z',
    });
  });

  it('is resilient when no dispatcher or dispatch function is available', () => {
    const silentService = new ShortTermMemoryService();
    const incompleteDispatcherService = new ShortTermMemoryService({
      eventDispatcher: {},
    });

    expect(() =>
      silentService.emitThoughtAdded('npc', 'text', '2024-07-07T07:00:00.000Z')
    ).not.toThrow();
    expect(() =>
      incompleteDispatcherService.emitThoughtAdded(
        'npc',
        'text',
        '2024-07-07T07:00:00.000Z'
      )
    ).not.toThrow();
  });
});
