import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeProvider = (logger) => {
  const promptStaticContentService = {
    getCoreTaskDescriptionText: () => '',
    getCharacterPortrayalGuidelines: () => '',
    getNc21ContentPolicyText: () => '',
    getFinalLlmInstructionText: () => '',
    getMoodUpdateInstructionText: () => '',
    getMoodUpdateTaskDefinitionText: () => '',
    getMoodUpdatePortrayalGuidelines: () => '',
  };
  const perceptionLogFormatter = { format: () => [] };
  const gameStateValidationService = {
    validate: () => ({ isValid: true, errorContent: null }),
  };
  const actionCategorizationService = {
    extractNamespace: jest.fn(),
    shouldUseGrouping: jest.fn(() => false),
    groupActionsByNamespace: jest.fn(() => new Map()),
    getSortedNamespaces: jest.fn(() => []),
    formatNamespaceDisplayName: jest.fn((namespace) => namespace),
  };
  const characterDataXmlBuilder = {
    buildCharacterDataXml: jest.fn(() => '<character_data />'),
  };
  const modActionMetadataProvider = {
    getMetadataForMod: jest.fn(() => null),
  };
  const chanceTextTranslator = {
    translateForLlm: jest.fn((text) => text),
  };

  return new AIPromptContentProvider({
    logger,
    promptStaticContentService,
    perceptionLogFormatter,
    gameStateValidationService,
    actionCategorizationService,
    characterDataXmlBuilder,
    modActionMetadataProvider,
    chanceTextTranslator,
  });
};

const makeBaseDto = (components) => ({
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
});

describe('AIPromptContentProvider cognitive ledger extraction', () => {
  let provider;
  let logger;

  beforeEach(() => {
    logger = makeLogger();
    provider = makeProvider(logger);
  });

  test('_extractCognitiveLedger returns null when component missing', () => {
    expect(provider._extractCognitiveLedger({})).toBeNull();
  });

  test('_extractCognitiveLedger returns data when component present', () => {
    const result = provider._extractCognitiveLedger({
      'core:cognitive_ledger': {
        settled_conclusions: ['We are safe'],
        open_questions: ['Where is the key?'],
      },
    });

    expect(result).toEqual({
      settled_conclusions: ['We are safe'],
      open_questions: ['Where is the key?'],
    });
  });

  test('_extractCognitiveLedger handles missing settled_conclusions', () => {
    const result = provider._extractCognitiveLedger({
      'core:cognitive_ledger': { open_questions: ['What now?'] },
    });

    expect(result).toEqual({
      settled_conclusions: [],
      open_questions: ['What now?'],
    });
  });

  test('_extractCognitiveLedger handles missing open_questions', () => {
    const result = provider._extractCognitiveLedger({
      'core:cognitive_ledger': { settled_conclusions: ['Known'] },
    });

    expect(result).toEqual({
      settled_conclusions: ['Known'],
      open_questions: [],
    });
  });

  test('getPromptData includes cognitiveLedger', async () => {
    const gameStateDto = makeBaseDto({
      'core:cognitive_ledger': {
        settled_conclusions: ['Resolved'],
        open_questions: ['Open question'],
      },
    });

    const result = await provider.getPromptData(gameStateDto, logger);

    expect(result.cognitiveLedger).toEqual({
      settled_conclusions: ['Resolved'],
      open_questions: ['Open question'],
    });
  });

  test('getMoodUpdatePromptData includes cognitiveLedger', async () => {
    const gameStateDto = makeBaseDto({
      'core:cognitive_ledger': {
        settled_conclusions: ['Resolved'],
        open_questions: ['Open question'],
      },
    });

    const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

    expect(result.cognitiveLedger).toEqual({
      settled_conclusions: ['Resolved'],
      open_questions: ['Open question'],
    });
  });
});
