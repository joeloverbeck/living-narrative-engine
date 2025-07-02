// tests/services/ThoughtPersistenceHook.test.js

import { persistThoughts } from '../../../src/ai/thoughtPersistenceHook.js';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { describe, test, expect, jest } from '@jest/globals';

describe('ThoughtPersistenceHook.processTurnAction', () => {
  test('logs STM-001 and returns early when thoughts field is absent', () => {
    const mockedLogger = { warn: jest.fn() };
    const fakeActor = {}; // actorEntity not used in this case
    const dispatcher = { dispatch: jest.fn() };

    expect(() => {
      persistThoughts({}, fakeActor, mockedLogger, dispatcher);
    }).not.toThrow();

    expect(mockedLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockedLogger.warn).toHaveBeenCalledWith('STM-001 Missing thoughts');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          "ThoughtPersistenceHook: 'thoughts' field is missing or blank; skipping persist",
        details: { actorId: 'UNKNOWN_ACTOR' },
      })
    );
  });

  test('logs STM-001 and returns early when thoughts field is empty or whitespace', () => {
    const mockedLogger = { warn: jest.fn() };
    const fakeActor = {};
    const dispatcher = { dispatch: jest.fn() };

    expect(() => {
      persistThoughts({ thoughts: '   ' }, fakeActor, mockedLogger, dispatcher);
    }).not.toThrow();

    expect(mockedLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockedLogger.warn).toHaveBeenCalledWith('STM-001 Missing thoughts');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          "ThoughtPersistenceHook: 'thoughts' field is missing or blank; skipping persist",
        details: { actorId: 'UNKNOWN_ACTOR' },
      })
    );
  });

  test('logs STM-002 and returns early when memory component is absent', () => {
    const mockedLogger = { warn: jest.fn() };
    const fakeActor = { components: {} };

    expect(() => {
      persistThoughts(
        { thoughts: 'Anything' },
        fakeActor,
        mockedLogger,
        undefined
      );
    }).not.toThrow();

    expect(mockedLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockedLogger.warn).toHaveBeenCalledWith('STM-002 Missing component');
  });

  test('adds a thought to short-term memory when none exist', () => {
    const fakeActor = {
      components: {
        'core:short_term_memory': {
          thoughts: [],
          maxEntries: 5,
        },
      },
    };
    const mockedLogger = { warn: jest.fn() };

    expect(() => {
      persistThoughts(
        { thoughts: 'Test Thought' },
        fakeActor,
        mockedLogger,
        undefined
      );
    }).not.toThrow();

    const mem = fakeActor.components['core:short_term_memory'];
    expect(mem.thoughts.length).toBe(1);
    expect(mem.thoughts[0].text).toBe('Test Thought');
    expect(typeof mem.thoughts[0].timestamp).toBe('string');
  });

  test('ignores duplicate thought (case-insensitive, trimmed) and does not add', () => {
    // Prepare an existing thought
    const existingTimestamp = new Date(
      '2025-06-01T12:00:00.000Z'
    ).toISOString();
    const fakeActor = {
      components: {
        'core:short_term_memory': {
          thoughts: [{ text: 'duplicate', timestamp: existingTimestamp }],
          maxEntries: 5,
        },
      },
    };
    const mockedLogger = { warn: jest.fn() };

    // Call with a duplicate in different case and with trailing space
    expect(() => {
      persistThoughts(
        { thoughts: 'Duplicate ' },
        fakeActor,
        mockedLogger,
        undefined
      );
    }).not.toThrow();

    const mem = fakeActor.components['core:short_term_memory'];
    // Should remain exactly one entry, the original
    expect(mem.thoughts.length).toBe(1);
    expect(mem.thoughts[0].text).toBe('duplicate');
    expect(mem.thoughts[0].timestamp).toBe(existingTimestamp);
  });

  test('respects maxEntries by trimming oldest thoughts when limit exceeded', () => {
    // Use the real ShortTermMemoryService to test trimming behavior
    const initialThoughts = [];
    const fakeActor = {
      components: {
        'core:short_term_memory': {
          thoughts: initialThoughts,
          maxEntries: 2,
        },
      },
    };
    const mockedLogger = { warn: jest.fn() };

    // First thought
    persistThoughts({ thoughts: 'First' }, fakeActor, mockedLogger, undefined);
    // Second thought
    persistThoughts({ thoughts: 'Second' }, fakeActor, mockedLogger, undefined);
    // Third thought—should trim the first
    persistThoughts({ thoughts: 'Third' }, fakeActor, mockedLogger, undefined);

    const mem = fakeActor.components['core:short_term_memory'];
    expect(mem.thoughts.length).toBe(2);
    expect(mem.thoughts[0].text).toBe('Second');
    expect(mem.thoughts[1].text).toBe('Third');
  });

  test('invokes ShortTermMemoryService.addThought with correct arguments', () => {
    // Spy on the service class and its addThought method
    const addThoughtSpy = jest.spyOn(
      ShortTermMemoryService.prototype,
      'addThought'
    );
    const fakeActor = {
      components: {
        'core:short_term_memory': {
          thoughts: [],
          maxEntries: 3,
        },
      },
    };
    const mockedLogger = { warn: jest.fn() };

    persistThoughts(
      { thoughts: 'Inspect' },
      fakeActor,
      mockedLogger,
      undefined
    );

    expect(addThoughtSpy).toHaveBeenCalledTimes(1);

    const [passedMem, passedText, passedDate] = addThoughtSpy.mock.calls[0];
    expect(passedMem).toBe(fakeActor.components['core:short_term_memory']);
    expect(passedText).toBe('Inspect');
    expect(passedDate instanceof Date).toBe(true);

    addThoughtSpy.mockRestore();
  });

  test('allows injecting service and now provider', () => {
    const fakeMem = { thoughts: [], maxEntries: 2 };
    const fakeActor = { components: { 'core:short_term_memory': fakeMem } };
    const mockedLogger = { warn: jest.fn() };
    const stmService = { addThought: jest.fn(() => ({ mem: fakeMem })) };
    const fakeNow = new Date('2027-01-01T00:00:00Z');

    persistThoughts(
      { thoughts: 'Hi' },
      fakeActor,
      mockedLogger,
      undefined,
      stmService,
      fakeNow
    );

    expect(stmService.addThought).toHaveBeenCalledWith(fakeMem, 'Hi', fakeNow);
  });
});
