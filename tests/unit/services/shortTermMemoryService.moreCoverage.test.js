import { describe, it, expect } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService maxEntries logic', () => {
  it('falls back to defaultMaxEntries when maxEntries is negative', () => {
    const service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
    const mem = {
      entityId: 'actor:neg',
      thoughts: [
        { text: 'a', timestamp: '2025-06-03T10:00:00.000Z' },
        { text: 'b', timestamp: '2025-06-03T10:01:00.000Z' },
        { text: 'c', timestamp: '2025-06-03T10:02:00.000Z' },
      ],
      maxEntries: -1,
    };
    service.addThought(mem, 'd', new Date('2025-06-03T10:03:00.000Z'));
    expect(mem.thoughts.map((t) => t.text)).toEqual(['c', 'd']);
  });

  it('falls back to defaultMaxEntries when maxEntries is not an integer', () => {
    const service = new ShortTermMemoryService({ defaultMaxEntries: 3 });
    const mem = {
      entityId: 'actor:str',
      thoughts: [
        { text: 'a', timestamp: '2025-06-03T10:00:00.000Z' },
        { text: 'b', timestamp: '2025-06-03T10:01:00.000Z' },
      ],
      maxEntries: 'foo',
    };
    service.addThought(mem, 'c', new Date('2025-06-03T10:02:00.000Z'));
    service.addThought(mem, 'd', new Date('2025-06-03T10:03:00.000Z'));
    expect(mem.thoughts.map((t) => t.text)).toEqual(['b', 'c', 'd']);
  });
});
