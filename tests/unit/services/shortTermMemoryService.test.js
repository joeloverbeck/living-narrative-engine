/**
 * tests/services/shortTermMemoryService.test.js
 *
 * Unit-test suite for ShortTermMemoryService.addThought().
 * Scenarios covered (see ticket):
 *  – append unique thought
 *  – ignore duplicate (case/whitespace)
 *  – trim when exceeding maxEntries
 *  – timestamp formatting & ordering with custom “now”
 *  – ThoughtAdded domain-event emission
 *
 * Jest is expected as the test runner.
 */

import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/; // quick ISO-8601 sanity check

describe('ShortTermMemoryService.addThought – core logic', () => {
  /** @type {ShortTermMemoryService} */
  let service;

  beforeEach(() => {
    // No dispatcher for pure-logic tests
    service = new ShortTermMemoryService({ defaultMaxEntries: 50 });
  });

  test('appends a unique thought with correct timestamp', () => {
    const fixedNow = new Date('2025-06-03T10:00:00.000Z');

    const mem = { entityId: 'actor:42', thoughts: [], maxEntries: 2 };

    const {
      mem: result,
      wasAdded,
      entry,
    } = service.addThought(mem, 'First Thought', fixedNow);

    expect(result).toBe(mem); // same object, mutated in-place
    expect(wasAdded).toBe(true);
    expect(result.thoughts).toHaveLength(1);
    expect(entry.text).toBe('First Thought');
    expect(entry.timestamp).toBe('2025-06-03T10:00:00.000Z');
    expect(ISO_REGEX.test(entry.timestamp)).toBe(true);
  });

  test('ignores duplicate thought (case-/whitespace-insensitive)', () => {
    const mem = {
      entityId: 'actor:99',
      thoughts: [
        { text: 'hello world', timestamp: '2025-06-03T09:00:00.000Z' },
      ],
      maxEntries: 10,
    };

    const { mem: result, wasAdded } = service.addThought(
      mem,
      '   HeLLo WoRLd   ',
      new Date('2025-06-03T09:05:00.000Z')
    );

    expect(wasAdded).toBe(false);
    expect(result.thoughts).toHaveLength(1); // still only the original entry
    expect(result.thoughts[0].text).toBe('hello world'); // unchanged
  });

  test('trims oldest thoughts when exceeding maxEntries', () => {
    const mem = {
      entityId: 'actor:7',
      thoughts: [
        { text: 'T1', timestamp: '2025-06-03T08:00:00.000Z' },
        { text: 'T2', timestamp: '2025-06-03T08:05:00.000Z' },
      ],
      maxEntries: 2,
    };

    service.addThought(mem, 'T3', new Date('2025-06-03T08:10:00.000Z'));

    expect(mem.thoughts).toHaveLength(2);
    expect(mem.thoughts.map((t) => t.text)).toEqual(['T2', 'T3']); // T1 shifted out
  });

  test('records supplied “now” exactly and keeps ISO format', () => {
    const customNow = new Date('2025-01-01T12:00:00Z');
    const mem = { entityId: 'actor:abc', thoughts: [], maxEntries: 5 };

    service.addThought(mem, 'New Thought', customNow);

    expect(mem.thoughts).toHaveLength(1);
    expect(mem.thoughts[0].timestamp).toBe('2025-01-01T12:00:00.000Z'); // millisecond precision
  });
});

describe('ShortTermMemoryService – ThoughtAdded domain event', () => {
  const fixedDate = new Date('2025-06-03T10:00:00.000Z');

  /** @type {import("jest").Mock} */
  let dispatchSpy;
  /** @type {{dispatch: Function}} */
  let stubDispatcher;
  /** @type {ShortTermMemoryService} */
  let service;
  /** @type {object} */
  let mem;

  beforeEach(() => {
    dispatchSpy = jest.fn().mockResolvedValue(true);
    stubDispatcher = { dispatch: dispatchSpy };
    service = new ShortTermMemoryService({
      eventDispatcher: stubDispatcher,
      defaultMaxEntries: 10,
    });

    mem = {
      entityId: 'actor:123',
      thoughts: [],
      maxEntries: 10,
    };
  });

  test('emits ThoughtAdded once for a unique thought', () => {
    const { wasAdded, entry } = service.addThought(
      mem,
      'Hello World',
      fixedDate
    );
    if (wasAdded) {
      service.emitThoughtAdded(mem.entityId, 'Hello World', entry.timestamp);
    }

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith('ThoughtAdded', {
      entityId: 'actor:123',
      text: 'Hello World',
      timestamp: fixedDate.toISOString(),
    });
  });

  test('does NOT emit ThoughtAdded for a duplicate thought', () => {
    const first = service.addThought(mem, 'Hello World', fixedDate);
    if (first.wasAdded) {
      service.emitThoughtAdded(
        mem.entityId,
        'Hello World',
        first.entry.timestamp
      );
    }

    dispatchSpy.mockClear(); // reset call count
    const second = service.addThought(
      mem,
      '  hello WORLD  ',
      new Date('2025-06-03T10:01:00.000Z')
    );
    if (second.wasAdded) {
      service.emitThoughtAdded(
        mem.entityId,
        '  hello WORLD  ',
        second.entry.timestamp
      );
    }

    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
