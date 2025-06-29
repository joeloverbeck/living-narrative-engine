import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

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
  format: (entries) => entries.map((e) => ({ content: e.descriptionText })),
});

const makeDummyGameStateValidationService = () => ({
  validate: () => ({ isValid: true, errorContent: null }),
});

describe('AIPromptContentProvider helper methods', () => {
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

  test('_extractCommonValues pulls expected fields', () => {
    const dto = {
      actorPromptData: { name: 'Hero' },
      currentUserInput: 'Hi',
      perceptionLog: [{ descriptionText: 'event' }],
      currentLocation: {
        name: 'Town',
        description: 'desc',
        exits: [],
        characters: [],
      },
      actorState: { components: {} },
    };

    const result = provider._extractCommonValues(dto);
    expect(result.characterName).toBe('Hero');
    expect(result.currentUserInput).toBe('Hi');
    expect(result.locationName).toBe('Town');
    expect(result.perceptionLogArray).toEqual([{ content: 'event' }]);
    expect(result.componentsMap).toBe(dto.actorState.components);
  });

  test('_extractMemoryComponents returns arrays from componentsMap', () => {
    const componentsMap = {
      'core:short_term_memory': { thoughts: [{ text: 't1' }] },
      'core:notes': {
        notes: [
          { text: 'n1', timestamp: 't1' },
          { text: '', timestamp: 't2' },
        ],
      },
      'core:goals': {
        goals: [
          { text: 'g1', timestamp: 't3' },
          { text: '', timestamp: '' },
        ],
      },
    };

    const res = provider._extractMemoryComponents(componentsMap);
    expect(res.thoughtsArray).toEqual(['t1']);
    expect(res.notesArray).toEqual([{ text: 'n1', timestamp: 't1' }]);
    expect(res.goalsArray).toEqual([{ text: 'g1', timestamp: 't3' }]);
  });

  test('_buildPromptData merges base values and arrays', () => {
    const base = { a: 1 };
    const pd = provider._buildPromptData(
      base,
      ['t'],
      [{ text: 'n', timestamp: 't' }],
      [{ text: 'g', timestamp: 't' }]
    );
    expect(pd).toEqual({
      a: 1,
      thoughtsArray: ['t'],
      notesArray: [{ text: 'n', timestamp: 't' }],
      goalsArray: [{ text: 'g', timestamp: 't' }],
    });
  });

  test('_validateOrThrow throws when validation fails', () => {
    provider.validateGameStateForPrompting = jest.fn(() => ({
      isValid: false,
      errorContent: 'bad',
    }));
    expect(() => provider._validateOrThrow({}, logger)).toThrow('bad');
  });
});
