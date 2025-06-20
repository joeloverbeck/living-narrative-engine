// tests/prompting/AIPromptContentProvider.promptData.test.js

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

describe('AIPromptContentProvider.getPromptData basic scenarios', () => {
  let provider;
  let logger;

  beforeEach(() => {
    // Minimal logger stub
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Minimal stub for static‐content, perception‐formatter, and validation
    const promptStaticContentService = {
      getCoreTaskDescriptionText: () => '',
      getCharacterPortrayalGuidelines: () => '',
      getNc21ContentPolicyText: () => '',
      getFinalLlmInstructionText: () => '',
    };
    const perceptionLogFormatter = { format: () => [] };
    const gameStateValidationService = {
      validate: () => ({ isValid: true, errorContent: null }),
    };

    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService,
      perceptionLogFormatter,
      gameStateValidationService,
    });
  });

  // Helper to build the minimal gameStateDto
  /**
   *
   * @param components
   */
  function makeBaseDto(components) {
    return {
      actorState: { components },
      actorPromptData: { name: 'TestActor' },
      perceptionLog: [],
      currentLocation: {
        name: 'room',
        description: 'desc',
        exits: [],
        characters: [],
      },
      availableActions: [],
      currentUserInput: '',
    };
  }

  test('returns empty arrays when neither core:notes nor core:goals exist', async () => {
    const gameStateDto = makeBaseDto({});
    const result = await provider.getPromptData(gameStateDto, logger);

    expect(Array.isArray(result.notesArray)).toBe(true);
    expect(Array.isArray(result.goalsArray)).toBe(true);
    expect(result.notesArray).toEqual([]);
    expect(result.goalsArray).toEqual([]);
  });

  test('maps notesArray correctly when core:notes exists; goalsArray remains []', async () => {
    const gameStateDto = makeBaseDto({
      'core:notes': {
        notes: [
          { text: 'N1', timestamp: '2025-06-01T00:00:00Z' },
          { text: 'N2', timestamp: '2025-06-02T12:30:00Z' },
        ],
      },
      // no core:goals
    });

    const result = await provider.getPromptData(gameStateDto, logger);

    expect(result.notesArray).toEqual([
      { text: 'N1', timestamp: '2025-06-01T00:00:00Z' },
      { text: 'N2', timestamp: '2025-06-02T12:30:00Z' },
    ]);
    expect(result.goalsArray).toEqual([]);
  });

  test('maps both notesArray and goalsArray exactly when both components exist', async () => {
    const gameStateDto = makeBaseDto({
      'core:notes': {
        notes: [
          { text: 'NoteA', timestamp: '2025-06-05T09:00:00Z' },
          { text: 'NoteB', timestamp: '2025-06-05T10:00:00Z' },
        ],
      },
      'core:goals': {
        goals: [
          { text: 'GoalA', timestamp: '2025-05-01T00:00:00Z' },
          { text: 'GoalB', timestamp: '2025-05-02T14:15:00Z' },
        ],
      },
    });

    const result = await provider.getPromptData(gameStateDto, logger);

    expect(result.notesArray).toEqual([
      { text: 'NoteA', timestamp: '2025-06-05T09:00:00Z' },
      { text: 'NoteB', timestamp: '2025-06-05T10:00:00Z' },
    ]);
    expect(result.goalsArray).toEqual([
      { text: 'GoalA', timestamp: '2025-05-01T00:00:00Z' },
      { text: 'GoalB', timestamp: '2025-05-02T14:15:00Z' },
    ]);
  });

  test('defaults both arrays to [] when notes or goals property is not an array (no throws)', async () => {
    const gameStateDto = makeBaseDto({
      'core:notes': { notes: null },
      'core:goals': { goals: 'foo' },
    });

    const result = await provider.getPromptData(gameStateDto, logger);

    expect(result.notesArray).toEqual([]);
    expect(result.goalsArray).toEqual([]);
  });
});
