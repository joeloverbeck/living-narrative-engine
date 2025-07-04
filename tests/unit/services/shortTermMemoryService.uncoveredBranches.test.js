import { describe, it, expect, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

/**
 * Additional coverage for ShortTermMemoryService.
 */
describe('ShortTermMemoryService uncovered branches', () => {
  it('uses current time when now parameter omitted', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-06-01T00:00:00Z'));
    const service = new ShortTermMemoryService();
    const mem = { entityId: 'actor:1', thoughts: [], maxEntries: 5 };
    const { entry } = service.addThought(mem, 'hello');
    expect(entry.timestamp).toBe('2025-06-01T00:00:00.000Z');
    jest.useRealTimers();
  });

  it('does nothing when eventDispatcher lacks dispatch method', () => {
    const service = new ShortTermMemoryService({ eventDispatcher: {} });
    expect(() => service.emitThoughtAdded('id', 'text', 't')).not.toThrow();
  });

  it('trims multiple entries when capacity exceeded by more than one', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      entityId: 'actor:2',
      thoughts: [
        { text: 'a', timestamp: '2025-06-03T10:00:00.000Z' },
        { text: 'b', timestamp: '2025-06-03T10:01:00.000Z' },
        { text: 'c', timestamp: '2025-06-03T10:02:00.000Z' },
        { text: 'd', timestamp: '2025-06-03T10:03:00.000Z' },
      ],
      maxEntries: 2,
    };
    service.addThought(mem, 'e', new Date('2025-06-03T10:04:00.000Z'));
    expect(mem.thoughts.map((t) => t.text)).toEqual(['d', 'e']);
  });
});
