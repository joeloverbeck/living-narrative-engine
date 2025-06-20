// tests/prompting/AIPromptContentProvider.includeNotesGoals.test.js

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

describe('AIPromptContentProvider.getPromptData', () => {
  let dummyLogger;
  let dummyPromptStaticContentService;
  let dummyPerceptionLogFormatter;
  let dummyGameStateValidationService;
  let provider;

  beforeEach(() => {
    dummyLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    dummyPromptStaticContentService = {
      getCoreTaskDescriptionText: () => 'TASK_DEF',
      getCharacterPortrayalGuidelines: () => 'PORTRAY_GUIDE',
      getNc21ContentPolicyText: () => 'POLICY_TEXT',
      getFinalLlmInstructionText: () => 'FINAL_INSTR',
    };

    dummyPerceptionLogFormatter = {
      format: (raw) =>
        Array.isArray(raw) ? raw.map((e) => ({ content: e })) : [],
    };

    dummyGameStateValidationService = {
      validate: (dto) => ({ isValid: true, errorContent: null }),
    };

    provider = new AIPromptContentProvider({
      logger: dummyLogger,
      promptStaticContentService: dummyPromptStaticContentService,
      perceptionLogFormatter: dummyPerceptionLogFormatter,
      gameStateValidationService: dummyGameStateValidationService,
    });
  });

  test('returns empty notesArray and goalsArray when components are absent', async () => {
    const gameStateDto = {
      actorState: { components: {} },
      actorPromptData: { name: 'TestCharacter' },
      perceptionLog: [],
      currentLocation: {
        name: 'TestLocation',
        description: 'A place',
        exits: [],
        characters: [],
      },
      availableActions: [],
      currentUserInput: '',
    };

    const result = await provider.getPromptData(gameStateDto, dummyLogger);

    expect(result.notesArray).toEqual([]);
    expect(result.goalsArray).toEqual([]);
  });

  test('populates notesArray and goalsArray when valid arrays are present', async () => {
    const gameStateDto = {
      actorState: {
        components: {
          'core:notes': {
            notes: [
              { text: 'First note', timestamp: '2025-06-05T09:00:00Z' },
              { text: 'Second note', timestamp: '2025-06-05T10:00:00Z' },
            ],
          },
          'core:goals': {
            goals: [
              { text: 'First goal', timestamp: '2025-06-05T08:30:00Z' },
              { text: 'Second goal', timestamp: '2025-06-05T08:45:00Z' },
            ],
          },
        },
      },
      actorPromptData: { name: 'TestCharacter' },
      perceptionLog: [],
      currentLocation: {
        name: 'TestLocation',
        description: 'A place',
        exits: [],
        characters: [],
      },
      availableActions: [],
      currentUserInput: '',
    };

    const result = await provider.getPromptData(gameStateDto, dummyLogger);

    expect(result.notesArray).toEqual([
      { text: 'First note', timestamp: '2025-06-05T09:00:00Z' },
      { text: 'Second note', timestamp: '2025-06-05T10:00:00Z' },
    ]);

    expect(result.goalsArray).toEqual([
      { text: 'First goal', timestamp: '2025-06-05T08:30:00Z' },
      { text: 'Second goal', timestamp: '2025-06-05T08:45:00Z' },
    ]);
  });

  test('returns empty notesArray when notes property is not an array', async () => {
    const gameStateDto = {
      actorState: {
        components: {
          'core:notes': {
            notes: 'not-an-array',
          },
        },
      },
      actorPromptData: { name: 'TestCharacter' },
      perceptionLog: [],
      currentLocation: {
        name: 'TestLocation',
        description: 'A place',
        exits: [],
        characters: [],
      },
      availableActions: [],
      currentUserInput: '',
    };

    const result = await provider.getPromptData(gameStateDto, dummyLogger);
    expect(result.notesArray).toEqual([]);
    expect(result.goalsArray).toEqual([]); // goals is also absent
  });

  test('returns empty goalsArray when goals property is not an array', async () => {
    const gameStateDto = {
      actorState: {
        components: {
          'core:goals': {
            goals: { text: 'bad', timestamp: '2025-06-05T07:00:00Z' },
          },
        },
      },
      actorPromptData: { name: 'TestCharacter' },
      perceptionLog: [],
      currentLocation: {
        name: 'TestLocation',
        description: 'A place',
        exits: [],
        characters: [],
      },
      availableActions: [],
      currentUserInput: '',
    };

    const result = await provider.getPromptData(gameStateDto, dummyLogger);
    expect(result.goalsArray).toEqual([]);
    expect(result.notesArray).toEqual([]); // notes is absent
  });

  test('does not throw when actorPromptData is missing (uses fallbacks)', async () => {
    const gameStateDto = {
      actorState: { components: {} },
      // actorPromptData omitted on purpose
      perceptionLog: [],
      currentLocation: {
        name: 'TestLocation',
        description: 'A place',
        exits: [],
        characters: [],
      },
      availableActions: [],
      currentUserInput: '',
    };

    await expect(
      provider.getPromptData(gameStateDto, dummyLogger)
    ).resolves.toHaveProperty('notesArray', []);
    await expect(
      provider.getPromptData(gameStateDto, dummyLogger)
    ).resolves.toHaveProperty('goalsArray', []);
  });

  test('throws when validation service returns invalid result', async () => {
    dummyGameStateValidationService.validate = () => ({
      isValid: false,
      errorContent: 'Missing critical data',
    });

    const invalidGameStateDto = {
      actorState: { components: {} },
      actorPromptData: { name: 'TestCharacter' },
      perceptionLog: [],
      currentLocation: {
        name: 'TestLocation',
        description: 'A place',
        exits: [],
        characters: [],
      },
      availableActions: [],
      currentUserInput: '',
    };

    await expect(
      provider.getPromptData(invalidGameStateDto, dummyLogger)
    ).rejects.toThrow('Missing critical data');
  });
});
