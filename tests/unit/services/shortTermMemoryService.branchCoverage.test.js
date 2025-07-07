import { describe, it, expect, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService additional branch coverage', () => {
  it('detects duplicate thoughts and skips addition', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      entityId: 'actor:dup',
      thoughts: [{ text: 'duplicate', timestamp: '2025-06-01T00:00:00.000Z' }],
      maxEntries: 3,
    };
    const { wasAdded } = service.addThought(mem, '  DUPLICATE  ');
    expect(wasAdded).toBe(false);
    expect(mem.thoughts).toHaveLength(1);
  });

  it('emits ThoughtAdded event when dispatcher available', () => {
    const dispatchSpy = jest.fn();
    const service = new ShortTermMemoryService({
      eventDispatcher: { dispatch: dispatchSpy },
    });
    service.emitThoughtAdded('actor:1', 'hello', '2025-06-01T00:00:00.000Z');
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith('ThoughtAdded', {
      entityId: 'actor:1',
      text: 'hello',
      timestamp: '2025-06-01T00:00:00.000Z',
    });
  });
});
