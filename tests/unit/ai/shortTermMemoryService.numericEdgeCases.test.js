import { describe, it, expect, jest } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';

describe('ShortTermMemoryService numeric and capacity edge cases', () => {
  it('preserves non-string payloads while still preventing duplicates once comparable string entries exist', () => {
    const service = new ShortTermMemoryService();
    const mem = { thoughts: [], maxEntries: 3 };
    const firstTimestamp = new Date('2024-04-01T10:00:00.000Z');

    const firstResult = service.addThought(mem, 404, firstTimestamp);

    expect(firstResult.wasAdded).toBe(true);
    expect(firstResult.entry).toEqual({
      text: 404,
      timestamp: firstTimestamp.toISOString(),
    });
    expect(mem.thoughts).toHaveLength(1);

    const duplicateMem = {
      thoughts: [
        { text: '  404  ', timestamp: '2024-04-01T09:59:00.000Z' },
        {
          text: { unexpected: 'value' },
          timestamp: '2024-04-01T09:58:00.000Z',
        },
      ],
      maxEntries: 3,
    };

    const duplicateResult = service.addThought(
      duplicateMem,
      404,
      new Date('2024-04-01T10:01:00.000Z')
    );

    expect(duplicateResult).toEqual({ mem: duplicateMem, wasAdded: false });
    expect(duplicateMem.thoughts).toHaveLength(2);
  });

  it('drops multiple oldest entries when new additions exceed the configured capacity by more than one slot', () => {
    const service = new ShortTermMemoryService();
    const mem = {
      thoughts: [
        { text: 't1', timestamp: '2024-01-01T00:00:00.000Z' },
        { text: 't2', timestamp: '2024-01-02T00:00:00.000Z' },
        { text: 't3', timestamp: '2024-01-03T00:00:00.000Z' },
        { text: 't4', timestamp: '2024-01-04T00:00:00.000Z' },
      ],
      maxEntries: 2,
    };

    const newTimestamp = new Date('2024-01-05T00:00:00.000Z');
    const result = service.addThought(mem, 'latest', newTimestamp);

    expect(result.wasAdded).toBe(true);
    expect(mem.thoughts).toEqual([
      { text: 't4', timestamp: '2024-01-04T00:00:00.000Z' },
      { text: 'latest', timestamp: newTimestamp.toISOString() },
    ]);
  });

  it('allows dispatcher injection after construction and ignores invalid dispatchers safely', () => {
    const service = new ShortTermMemoryService();

    expect(() =>
      service.emitThoughtAdded(
        'entity-before',
        'text',
        '2024-03-01T12:00:00.000Z'
      )
    ).not.toThrow();

    const dispatch = jest.fn();
    service.eventDispatcher = { dispatch };

    service.emitThoughtAdded(
      'entity-100',
      'remember this',
      '2024-03-01T12:01:00.000Z'
    );

    expect(dispatch).toHaveBeenCalledWith('ThoughtAdded', {
      entityId: 'entity-100',
      text: 'remember this',
      timestamp: '2024-03-01T12:01:00.000Z',
    });

    service.eventDispatcher = { dispatch: null };

    expect(() =>
      service.emitThoughtAdded(
        'entity-after',
        'noop',
        '2024-03-01T12:02:00.000Z'
      )
    ).not.toThrow();
  });
});
