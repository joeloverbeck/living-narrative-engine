import { describe, it, expect } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService additional branches', () => {
  it('treats Infinity maxEntries as invalid and falls back to default', () => {
    const service = new ShortTermMemoryService({ defaultMaxEntries: 2 });
    const mem = { entityId: 'actor:1', thoughts: [], maxEntries: Infinity };

    service.addThought(mem, 'a', new Date('2025-06-01T00:00:00Z'));
    service.addThought(mem, 'b', new Date('2025-06-01T00:01:00Z'));
    service.addThought(mem, 'c', new Date('2025-06-01T00:02:00Z'));

    expect(mem.thoughts.map((t) => t.text)).toEqual(['b', 'c']);
  });
});
