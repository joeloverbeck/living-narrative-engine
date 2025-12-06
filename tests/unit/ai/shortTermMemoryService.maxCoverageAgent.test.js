/**
 * @file Additional edge-case coverage for ShortTermMemoryService.
 */

import { describe, expect, it, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService additional edge coverage', () => {
  it('throws a descriptive TypeError when memory container is invalid', () => {
    const service = new ShortTermMemoryService();

    expect(() => service.addThought(null, 'idea')).toThrow(
      'mem must be an object conforming to core:short_term_memory schema'
    );
    expect(() => service.addThought(42, 'idea')).toThrow(
      'mem must be an object conforming to core:short_term_memory schema'
    );
  });

  it('ignores thoughts that collapse to an empty string after trimming', () => {
    const service = new ShortTermMemoryService();
    const mem = { entityId: 'actor:1', thoughts: [], maxEntries: 3 };

    const result = service.addThought(mem, '    ');

    expect(result).toEqual({ mem, wasAdded: false });
    expect(mem.thoughts).toHaveLength(0);
  });

  it('initialises storage when thoughts are missing and records deterministic timestamps', () => {
    const service = new ShortTermMemoryService();
    const mem = { entityId: 'actor:2', maxEntries: 5 };
    const now = new Date('2025-06-03T12:00:00.000Z');

    const { entry, wasAdded } = service.addThought(mem, 'First note', now);

    expect(wasAdded).toBe(true);
    expect(Array.isArray(mem.thoughts)).toBe(true);
    expect(mem.thoughts).toHaveLength(1);
    expect(entry).toMatchObject({
      text: 'First note',
      timestamp: '2025-06-03T12:00:00.000Z',
    });
  });

  it('skips non-string existing entries and falls back to the default capacity when maxEntries is invalid', () => {
    const service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
    const mem = {
      entityId: 'actor:3',
      thoughts: [
        { text: 'Retain me', timestamp: '2025-06-03T09:00:00.000Z' },
        { text: 12345, timestamp: '2025-06-03T09:05:00.000Z' },
      ],
      maxEntries: 0,
    };
    const now = new Date('2025-06-03T09:10:00.000Z');

    const { entry, wasAdded } = service.addThought(mem, 'Fresh idea', now);

    expect(wasAdded).toBe(true);
    expect(entry.text).toBe('Fresh idea');
    expect(mem.thoughts).toHaveLength(2);
    expect(mem.thoughts[0].text).toBe(12345);
    expect(mem.thoughts[1]).toMatchObject({
      text: 'Fresh idea',
      timestamp: '2025-06-03T09:10:00.000Z',
    });
  });

  it('prevents duplicate thoughts irrespective of whitespace and casing', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      entityId: 'actor:4',
      thoughts: [
        { text: 'A Unique Idea', timestamp: '2025-06-03T07:00:00.000Z' },
      ],
      maxEntries: 5,
    };

    const result = service.addThought(
      mem,
      '   a unique idea   ',
      new Date('2025-06-03T07:05:00.000Z')
    );

    expect(result).toEqual({ mem, wasAdded: false });
    expect(mem.thoughts).toHaveLength(1);
  });

  it('gracefully skips event emission when no dispatcher is configured', () => {
    const service = new ShortTermMemoryService();

    expect(() =>
      service.emitThoughtAdded(
        'actor:4',
        'Nothing happens',
        '2025-06-03T12:00:00.000Z'
      )
    ).not.toThrow();
  });

  it('does not attempt to dispatch when dispatcher lacks a callable function', () => {
    const service = new ShortTermMemoryService({
      eventDispatcher: { dispatch: 'nope' },
    });

    expect(() =>
      service.emitThoughtAdded(
        'actor:5',
        'Still ignored',
        '2025-06-03T12:30:00.000Z'
      )
    ).not.toThrow();
  });

  it('emits ThoughtAdded when a dispatcher is supplied', () => {
    const dispatch = jest.fn();
    const service = new ShortTermMemoryService({
      eventDispatcher: { dispatch },
    });

    service.emitThoughtAdded(
      'actor:6',
      'New memory logged',
      '2025-06-03T13:45:00.000Z'
    );

    expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
      entityId: 'actor:6',
      text: 'New memory logged',
      timestamp: '2025-06-03T13:45:00.000Z',
    });
  });
});
