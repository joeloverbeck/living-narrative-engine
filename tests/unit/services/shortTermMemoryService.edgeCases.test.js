import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService edge cases', () => {
  let service;

  beforeEach(() => {
    service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
  });

  it('throws TypeError when mem is not an object', () => {
    expect(() => service.addThought(null, 'x')).toThrow(TypeError);
    expect(() => service.addThought(undefined, 'x')).toThrow(
      'mem must be an object'
    );
  });

  it('uses defaultMaxEntries when mem.maxEntries is invalid', () => {
    const mem = {
      entityId: 'actor:1',
      thoughts: [
        { text: 'a', timestamp: '2025-06-03T10:00:00.000Z' },
        { text: 'b', timestamp: '2025-06-03T10:01:00.000Z' },
        { text: 'c', timestamp: '2025-06-03T10:02:00.000Z' },
      ],
      maxEntries: 0,
    };

    service.addThought(mem, 'd', new Date('2025-06-03T10:03:00.000Z'));

    expect(mem.thoughts).toEqual([
      { text: 'c', timestamp: '2025-06-03T10:02:00.000Z' },
      { text: 'd', timestamp: '2025-06-03T10:03:00.000Z' },
    ]);
  });

  it('emitThoughtAdded is no-op when dispatcher missing', () => {
    service = new ShortTermMemoryService();
    // Should not throw even if dispatcher is undefined
    expect(() => service.emitThoughtAdded('id', 'text', 't')).not.toThrow();
  });
});
