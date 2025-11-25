// tests/prompting/AIPromptContentProvider.notes.test.js
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

describe('AIPromptContentProvider.getPromptData → notesArray', () => {
  // Minimal stub implementations for dependencies
  const makeLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  const stubPromptStaticContentService = {
    getCoreTaskDescriptionText: () => 'core-task',
    getCharacterPortrayalGuidelines: () => 'portrayal',
    getNc21ContentPolicyText: () => 'content-policy',
    getFinalLlmInstructionText: () => 'final-instructions',
  };

  // perceptionLogFormatter just returns the array it was given
  const stubPerceptionLogFormatter = {
    format: (logArray) =>
      logArray.map((entry) => ({ content: entry.descriptionText || '' })),
  };

  // gameStateValidationService always returns valid
  const stubGameStateValidationService = {
    validate: (dto) => ({ isValid: true, errorContent: null }),
  };

  const stubActionCategorizationService = {
    extractNamespace: jest.fn(),
    shouldUseGrouping: jest.fn(() => false),
    groupActionsByNamespace: jest.fn(() => new Map()),
    getSortedNamespaces: jest.fn(() => []),
    formatNamespaceDisplayName: jest.fn((namespace) => namespace),
  };

  const stubCharacterDataXmlBuilder = {
    buildCharacterDataXml: jest.fn(() => '<character_data>Mock XML</character_data>'),
  };

  let provider;
  let logger;

  beforeEach(() => {
    logger = makeLogger();
    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: stubPromptStaticContentService,
      perceptionLogFormatter: stubPerceptionLogFormatter,
      gameStateValidationService: stubGameStateValidationService,
      actionCategorizationService: stubActionCategorizationService,
      characterDataXmlBuilder: stubCharacterDataXmlBuilder,
    });
  });

  test('when core:notes is absent → notesArray is []', async () => {
    const gameStateDto = {
      actorState: {
        components: {
          // no 'core:notes' property
        },
      },
      actorPromptData: { name: 'Alice' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Home',
        description: 'A humble abode',
        exits: [],
        characters: [],
      },
      availableActions: [],
    };

    const result = await provider.getPromptData(gameStateDto, logger);
    expect(Array.isArray(result.notesArray)).toBe(true);
    expect(result.notesArray).toEqual([]);
  });

  test('when core:notes.notes is not an array → notesArray is []', async () => {
    const gameStateDto = {
      actorState: {
        components: {
          'core:notes': { notes: 'not-an-array' },
        },
      },
      actorPromptData: { name: 'Bob' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Town',
        description: 'A small village',
        exits: [],
        characters: [],
      },
      availableActions: [],
    };

    const result = await provider.getPromptData(gameStateDto, logger);
    expect(result.notesArray).toEqual([]);
  });

  test('when core:notes.notes is an empty array → notesArray is []', async () => {
    const gameStateDto = {
      actorState: {
        components: {
          'core:notes': { notes: [] },
        },
      },
      actorPromptData: { name: 'Carol' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Forest',
        description: 'Leafy and green',
        exits: [],
        characters: [],
      },
      availableActions: [],
    };

    const result = await provider.getPromptData(gameStateDto, logger);
    expect(result.notesArray).toEqual([]);
  });

  test('when core:notes.notes has valid entries → notesArray is populated correctly', async () => {
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 3600000).toISOString();
    const gameStateDto = {
      actorState: {
        components: {
          'core:notes': {
            notes: [
              { text: 'First note', timestamp: earlier },
              { text: 'Second note', timestamp: now },
            ],
          },
        },
      },
      actorPromptData: { name: 'Dave' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Castle',
        description: 'Cold stone walls',
        exits: [],
        characters: [],
      },
      availableActions: [],
    };

    const result = await provider.getPromptData(gameStateDto, logger);
    expect(result.notesArray).toEqual([
      { text: 'First note', timestamp: earlier },
      { text: 'Second note', timestamp: now },
    ]);
  });

  test('when core:notes.notes has malformed entries → filter them out', async () => {
    const validTime = new Date().toISOString();
    const gameStateDto = {
      actorState: {
        components: {
          'core:notes': {
            notes: [
              { text: 'Valid note', timestamp: validTime },
              { text: '', timestamp: validTime }, // empty text - should be filtered
              { text: 'No timestamp' }, // missing timestamp - valid per schema
              { text: null, timestamp: validTime }, // null text - should be filtered
            ],
          },
        },
      },
      actorPromptData: { name: 'Eve' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Tower',
        description: 'High up',
        exits: [],
        characters: [],
      },
      availableActions: [],
    };

    const result = await provider.getPromptData(gameStateDto, logger);
    expect(result.notesArray).toEqual([
      { text: 'Valid note', timestamp: validTime },
      { text: 'No timestamp' },
    ]);
  });

  test('when core:notes.notes has structured notes with subject → includes all valid fields EXCEPT tags', async () => {
    const now = new Date().toISOString();
    const gameStateDto = {
      actorState: {
        components: {
          'core:notes': {
            notes: [
              {
                text: 'John seems nervous',
                subject: 'John',
                context: 'tavern conversation',
                tags: ['emotion', 'observation'],
                timestamp: now,
              },
              {
                text: 'Market prices are rising',
                subject: 'Market',
                // no context, tags, or timestamp - still valid
              },
            ],
          },
        },
      },
      actorPromptData: { name: 'Observer' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Tavern',
        description: 'A cozy place',
        exits: [],
        characters: [],
      },
      availableActions: [],
    };

    const result = await provider.getPromptData(gameStateDto, logger);
    expect(result.notesArray).toEqual([
      {
        text: 'John seems nervous',
        subject: 'John',
        context: 'tavern conversation',
        // tags should NOT be included in the output
        timestamp: now,
      },
      {
        text: 'Market prices are rising',
        subject: 'Market',
      },
    ]);
  });

  test('when core:notes.notes has tags in input data → tags are explicitly excluded from output', async () => {
    const now = new Date().toISOString();
    const gameStateDto = {
      actorState: {
        components: {
          'core:notes': {
            notes: [
              {
                text: 'Note with all fields',
                subject: 'TestSubject',
                subjectType: 'character',
                context: 'testing context',
                tags: ['tag1', 'tag2', 'tag3'], // Tags should be ignored
                timestamp: now,
              },
              {
                text: 'Note with just tags',
                tags: ['another', 'set', 'of', 'tags'], // Tags should be ignored
              },
            ],
          },
        },
      },
      actorPromptData: { name: 'TagTester' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'TestArea',
        description: 'Testing tags exclusion',
        exits: [],
        characters: [],
      },
      availableActions: [],
    };

    const result = await provider.getPromptData(gameStateDto, logger);

    // Verify that the output contains the notes but WITHOUT tags
    expect(result.notesArray).toHaveLength(2);
    expect(result.notesArray[0]).toEqual({
      text: 'Note with all fields',
      subject: 'TestSubject',
      subjectType: 'character',
      context: 'testing context',
      timestamp: now,
      // NO tags property should exist
    });
    expect(result.notesArray[1]).toEqual({
      text: 'Note with just tags',
      // NO tags property should exist
    });

    // Explicitly verify no tags property exists in any note
    result.notesArray.forEach((note) => {
      expect(note).not.toHaveProperty('tags');
    });
  });

  test('when core:notes.notes has structured notes missing required fields → filters them out', async () => {
    const gameStateDto = {
      actorState: {
        components: {
          'core:notes': {
            notes: [
              {
                text: 'Valid structured note',
                subject: 'ValidSubject',
              },
              {
                // missing text
                subject: 'InvalidNote1',
              },
              {
                text: 'Missing subject',
                // missing subject for structured note
              },
              {
                text: '',
                subject: 'EmptyText',
              },
            ],
          },
        },
      },
      actorPromptData: { name: 'Tester' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Lab',
        description: 'Testing area',
        exits: [],
        characters: [],
      },
      availableActions: [],
    };

    const result = await provider.getPromptData(gameStateDto, logger);
    expect(result.notesArray).toEqual([
      {
        text: 'Valid structured note',
        subject: 'ValidSubject',
      },
      {
        text: 'Missing subject',
      },
    ]);
  });
});
