import { AIPromptContentProvider } from '../../src/prompting/AIPromptContentProvider.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

// ---- Mocks / Stubs ---- //
const makeDummyLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeDummyPromptStaticContentService = () => ({
  getCoreTaskDescriptionText: () => 'task-content',
  getCharacterPortrayalGuidelines: (name) => `portray-${name}`,
  getNc21ContentPolicyText: () => 'policy-content',
  getFinalLlmInstructionText: () => 'instructions',
});

const makeDummyPerceptionLogFormatter = () => ({
  format: (entries) =>
    entries.map((e, i) => ({
      content: e.descriptionText || '',
      timestamp: e.timestamp || '',
      role: e.perceptionType || '',
      index: i,
    })),
});

const makeDummyGameStateValidationService = () => ({
  validate: (dto) => ({ isValid: true, errorContent: null }),
});

// ---- Test Suite ---- //
describe('AIPromptContentProvider.getPromptData → goalsArray behavior', () => {
  let provider;
  let logger;

  beforeEach(() => {
    logger = makeDummyLogger();
    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: makeDummyPromptStaticContentService(),
      perceptionLogFormatter: makeDummyPerceptionLogFormatter(),
      gameStateValidationService: makeDummyGameStateValidationService(),
    });
  });

  test('When core:goals is absent, promptData.goalsArray === []', async () => {
    const gameStateDto = {
      actorPromptData: { name: 'Hero' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Room',
        description: 'A small room.',
        exits: [],
        characters: [],
      },
      actorState: {
        components: {
          // Intentionally no "core:goals"
          'core:short_term_memory': { thoughts: [] },
          'core:notes': { notes: [] },
        },
      },
      availableActions: [],
    };

    const promptData = await provider.getPromptData(gameStateDto, logger);
    expect(Array.isArray(promptData.goalsArray)).toBe(true);
    expect(promptData.goalsArray).toEqual([]);
  });

  test('When core:goals contains valid array, promptData.goalsArray has correct shape', async () => {
    const sampleGoals = [
      { text: 'Find the key', timestamp: '2025-06-01T12:00:00Z' },
      { text: 'Open the door', timestamp: '2025-06-01T12:05:00Z' },
    ];
    const gameStateDto = {
      actorPromptData: { name: 'Rogue' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Hall',
        description: 'A long corridor.',
        exits: [],
        characters: [],
      },
      actorState: {
        components: {
          'core:short_term_memory': { thoughts: [] },
          'core:notes': { notes: [] },
          'core:goals': { goals: sampleGoals },
        },
      },
      availableActions: [],
    };

    const promptData = await provider.getPromptData(gameStateDto, logger);

    expect(Array.isArray(promptData.goalsArray)).toBe(true);
    expect(promptData.goalsArray).toHaveLength(2);
    expect(promptData.goalsArray[0]).toEqual({
      text: 'Find the key',
      timestamp: '2025-06-01T12:00:00Z',
    });
    expect(promptData.goalsArray[1]).toEqual({
      text: 'Open the door',
      timestamp: '2025-06-01T12:05:00Z',
    });
  });

  test('When core:goals.goals is not an array, promptData.goalsArray === []', async () => {
    const gameStateDto = {
      actorPromptData: { name: 'Mage' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Library',
        description: 'Rows of books.',
        exits: [],
        characters: [],
      },
      actorState: {
        components: {
          'core:short_term_memory': { thoughts: [] },
          'core:notes': { notes: [] },
          'core:goals': { goals: 'not-an-array' }, // Malformed
        },
      },
      availableActions: [],
    };

    const promptData = await provider.getPromptData(gameStateDto, logger);
    expect(Array.isArray(promptData.goalsArray)).toBe(true);
    expect(promptData.goalsArray).toEqual([]);
  });

  test('When some goals are missing text or timestamp, those get filtered out', async () => {
    const sampleGoals = [
      { text: 'Save the queen', timestamp: '2025-06-01T13:00:00Z' },
      { text: '', timestamp: '2025-06-01T13:05:00Z' },
      { text: 'Defeat the dragon', timestamp: '' },
      { text: 'Rescue the cat', timestamp: '2025-06-01T13:10:00Z' },
    ];
    const gameStateDto = {
      actorPromptData: { name: 'Paladin' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Courtyard',
        description: 'Open air.',
        exits: [],
        characters: [],
      },
      actorState: {
        components: {
          'core:short_term_memory': { thoughts: [] },
          'core:notes': { notes: [] },
          'core:goals': { goals: sampleGoals },
        },
      },
      availableActions: [],
    };

    const promptData = await provider.getPromptData(gameStateDto, logger);
    expect(Array.isArray(promptData.goalsArray)).toBe(true);
    // Only the two valid entries should remain
    expect(promptData.goalsArray).toHaveLength(2);
    expect(promptData.goalsArray).toEqual([
      { text: 'Save the queen', timestamp: '2025-06-01T13:00:00Z' },
      { text: 'Rescue the cat', timestamp: '2025-06-01T13:10:00Z' },
    ]);
  });
});
