// tests/unit/turns/states/awaitingActorDecisionState.notes.test.js
// -----------------------------------------------------------------------------
// Focused test suite to ensure core:action_decided event handles both string
// and object notes formats correctly
// -----------------------------------------------------------------------------

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';
import { ACTION_DECIDED_ID } from '../../../../src/constants/eventIds.js';
import * as safeDispatchEventModule from '../../../../src/utils/safeDispatchEvent.js';

describe('AwaitingActorDecisionState - notes format handling', () => {
  let state;
  let logger;
  let mockDispatcher;
  let mockContext;
  let mockActor;
  let safeDispatchEventSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    mockActor = {
      id: 'test-actor-1',
      isAi: true,
    };

    mockContext = {
      getLogger: () => logger,
      getSafeEventDispatcher: () => mockDispatcher,
    };

    state = new AwaitingActorDecisionState({ getLogger: () => logger });

    // Spy on safeDispatchEvent to capture the actual payload
    safeDispatchEventSpy = jest.spyOn(safeDispatchEventModule, 'safeDispatchEvent');
  });

  afterEach(() => {
    safeDispatchEventSpy.mockRestore();
  });

  test('✓ should dispatch event with legacy string array notes', async () => {
    const extractedData = {
      thoughts: 'Thinking about the situation',
      speech: 'Hello there',
      notes: ['Note 1', 'Note 2', 'Note 3'],
    };

    await state._emitActionDecided(mockContext, mockActor, extractedData);

    expect(safeDispatchEventSpy).toHaveBeenCalledWith(
      mockDispatcher,
      ACTION_DECIDED_ID,
      {
        actorId: 'test-actor-1',
        actorType: 'ai',
        extractedData: {
          thoughts: 'Thinking about the situation',
          speech: 'Hello there',
          notes: ['Note 1', 'Note 2', 'Note 3'],
        },
      },
      logger
    );

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  test('✓ should dispatch event with new object format notes', async () => {
    const extractedData = {
      thoughts: 'Analyzing the player',
      notes: [
        {
          text: 'Player seems nervous',
          subject: 'player-1',
          context: 'dialogue interaction',
          tags: ['behavior', 'observation'],
        },
        {
          text: 'Location has hidden treasure',
          subject: 'cave-entrance',
          context: 'exploration',
          tags: ['location', 'secret'],
        },
      ],
    };

    await state._emitActionDecided(mockContext, mockActor, extractedData);

    expect(safeDispatchEventSpy).toHaveBeenCalledWith(
      mockDispatcher,
      ACTION_DECIDED_ID,
      {
        actorId: 'test-actor-1',
        actorType: 'ai',
        extractedData: {
          thoughts: 'Analyzing the player',
          notes: [
            {
              text: 'Player seems nervous',
              subject: 'player-1',
              context: 'dialogue interaction',
              tags: ['behavior', 'observation'],
            },
            {
              text: 'Location has hidden treasure',
              subject: 'cave-entrance',
              context: 'exploration',
              tags: ['location', 'secret'],
            },
          ],
        },
      },
      logger
    );

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  test('✓ should dispatch event with mixed string and object notes', async () => {
    const extractedData = {
      thoughts: 'Mixed format test',
      notes: [
        'Simple string note',
        {
          text: 'Structured note about NPC',
          subject: 'npc-merchant',
        },
        'Another string note',
        {
          text: 'Another structured note',
          subject: 'quest-item',
          tags: ['important'],
        },
      ],
    };

    await state._emitActionDecided(mockContext, mockActor, extractedData);

    expect(safeDispatchEventSpy).toHaveBeenCalledWith(
      mockDispatcher,
      ACTION_DECIDED_ID,
      {
        actorId: 'test-actor-1',
        actorType: 'ai',
        extractedData: {
          thoughts: 'Mixed format test',
          notes: [
            'Simple string note',
            {
              text: 'Structured note about NPC',
              subject: 'npc-merchant',
            },
            'Another string note',
            {
              text: 'Another structured note',
              subject: 'quest-item',
              tags: ['important'],
            },
          ],
        },
      },
      logger
    );
  });

  test('✓ should dispatch event with minimal object notes (no optional fields)', async () => {
    const extractedData = {
      notes: [
        {
          text: 'Minimal note 1',
          subject: 'subject-1',
        },
        {
          text: 'Minimal note 2',
          subject: 'subject-2',
        },
      ],
    };

    await state._emitActionDecided(mockContext, mockActor, extractedData);

    expect(safeDispatchEventSpy).toHaveBeenCalledWith(
      mockDispatcher,
      ACTION_DECIDED_ID,
      {
        actorId: 'test-actor-1',
        actorType: 'ai',
        extractedData: {
          thoughts: '', // Default empty string
          notes: [
            {
              text: 'Minimal note 1',
              subject: 'subject-1',
            },
            {
              text: 'Minimal note 2',
              subject: 'subject-2',
            },
          ],
        },
      },
      logger
    );
  });

  test('✓ should handle empty notes array', async () => {
    const extractedData = {
      thoughts: 'No notes this time',
      notes: [],
    };

    await state._emitActionDecided(mockContext, mockActor, extractedData);

    expect(safeDispatchEventSpy).toHaveBeenCalledWith(
      mockDispatcher,
      ACTION_DECIDED_ID,
      {
        actorId: 'test-actor-1',
        actorType: 'ai',
        extractedData: {
          thoughts: 'No notes this time',
          notes: [],
        },
      },
      logger
    );
  });

  test('✓ should handle undefined notes (default to empty array)', async () => {
    const extractedData = {
      thoughts: 'Notes field omitted',
      // notes field is undefined
    };

    await state._emitActionDecided(mockContext, mockActor, extractedData);

    expect(safeDispatchEventSpy).toHaveBeenCalledWith(
      mockDispatcher,
      ACTION_DECIDED_ID,
      {
        actorId: 'test-actor-1',
        actorType: 'ai',
        extractedData: {
          thoughts: 'Notes field omitted',
          notes: [], // Should default to empty array
        },
      },
      logger
    );
  });

  test('✓ should handle human actors correctly', async () => {
    const humanActor = {
      id: 'player-1',
      isAi: false,
    };

    const extractedData = {
      thoughts: 'Player thoughts',
      notes: [
        {
          text: 'Player made a note',
          subject: 'game-state',
        },
      ],
    };

    await state._emitActionDecided(mockContext, humanActor, extractedData);

    expect(safeDispatchEventSpy).toHaveBeenCalledWith(
      mockDispatcher,
      ACTION_DECIDED_ID,
      {
        actorId: 'player-1',
        actorType: 'human',
        extractedData: {
          thoughts: 'Player thoughts',
          notes: [
            {
              text: 'Player made a note',
              subject: 'game-state',
            },
          ],
        },
      },
      logger
    );
  });

  test('✓ should preserve complex object note structure exactly', async () => {
    const extractedData = {
      notes: [
        {
          text: 'Complex note with all fields',
          subject: 'test-entity',
          context: 'test scenario with special characters: "quotes" & symbols',
          tags: ['tag-1', 'tag-2', 'tag with spaces'],
        },
      ],
    };

    await state._emitActionDecided(mockContext, mockActor, extractedData);

    const callArgs = safeDispatchEventSpy.mock.calls[0];
    const payload = callArgs[2];

    // Verify the note structure is preserved exactly
    expect(payload.extractedData.notes[0]).toEqual({
      text: 'Complex note with all fields',
      subject: 'test-entity',
      context: 'test scenario with special characters: "quotes" & symbols',
      tags: ['tag-1', 'tag-2', 'tag with spaces'],
    });
  });

  test('✗ should log error when dispatch fails', async () => {
    const dispatchError = new Error('Dispatch failed');
    mockDispatcher.dispatch = jest.fn().mockRejectedValue(dispatchError);

    const extractedData = {
      notes: [
        {
          text: 'This will fail',
          subject: 'error-test',
        },
      ],
    };

    await state._emitActionDecided(mockContext, mockActor, extractedData);

    expect(logger.error).toHaveBeenCalledWith(
      `Failed to dispatch ${ACTION_DECIDED_ID}`,
      dispatchError
    );
  });
});