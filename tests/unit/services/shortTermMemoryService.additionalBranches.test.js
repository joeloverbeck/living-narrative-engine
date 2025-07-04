import { describe, it, expect } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService additional branch coverage', () => {
  it('returns wasAdded=false when text is only whitespace', () => {
    const service = new ShortTermMemoryService();
    const mem = { entityId: 'actor:1', thoughts: [], maxEntries: 5 };

    const { wasAdded } = service.addThought(mem, '   ');

    expect(wasAdded).toBe(false);
    expect(mem.thoughts).toHaveLength(0);
  });

  it('initializes thoughts array when missing', () => {
    const service = new ShortTermMemoryService();
    const mem = { entityId: 'actor:2', maxEntries: 5 };

    const { wasAdded } = service.addThought(mem, 'hello');

    expect(wasAdded).toBe(true);
    expect(Array.isArray(mem.thoughts)).toBe(true);
    expect(mem.thoughts).toHaveLength(1);
  });

  it('ignores non-string existing texts and adds new thought', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      entityId: 'actor:3',
      thoughts: [{ text: 123 }],
      maxEntries: 5,
    };

    const { wasAdded } = service.addThought(mem, 'unique');

    expect(wasAdded).toBe(true);
    expect(mem.thoughts).toHaveLength(2);
    expect(mem.thoughts[1].text).toBe('unique');
  });

  it('replaces non-array thoughts with an array', () => {
    const service = new ShortTermMemoryService();
    const mem = { entityId: 'actor:4', thoughts: 'oops', maxEntries: 5 };

    service.addThought(mem, 'fixed');

    expect(Array.isArray(mem.thoughts)).toBe(true);
    expect(mem.thoughts).toHaveLength(1);
    expect(mem.thoughts[0].text).toBe('fixed');
  });
});
