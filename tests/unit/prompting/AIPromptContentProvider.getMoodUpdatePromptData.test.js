// tests/unit/prompting/AIPromptContentProvider.getMoodUpdatePromptData.test.js

/**
 * @file Unit tests for AIPromptContentProvider.getMoodUpdatePromptData method.
 * Tests the mood-only prompt data assembly for Phase 1 of two-phase flow.
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

describe('AIPromptContentProvider.getMoodUpdatePromptData', () => {
  let provider;
  let logger;
  let promptStaticContentService;
  let perceptionLogFormatter;
  let gameStateValidationService;
  let actionCategorizationService;
  let characterDataXmlBuilder;
  let modActionMetadataProvider;
  let chanceTextTranslator;

  const MOOD_UPDATE_INSTRUCTION_TEXT = 'MOOD_UPDATE_ONLY_INSTRUCTIONS';
  const TASK_DEFINITION = 'TASK_DEF';
  const PORTRAYAL_GUIDELINES = 'PORTRAYAL_GUIDELINES';
  const CONTENT_POLICY = 'CONTENT_POLICY';

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    promptStaticContentService = {
      getCoreTaskDescriptionText: jest.fn(() => TASK_DEFINITION),
      getCharacterPortrayalGuidelines: jest.fn(() => PORTRAYAL_GUIDELINES),
      getNc21ContentPolicyText: jest.fn(() => CONTENT_POLICY),
      getFinalLlmInstructionText: jest.fn(() => 'FINAL_INSTRUCTIONS'),
      getMoodUpdateInstructionText: jest.fn(() => MOOD_UPDATE_INSTRUCTION_TEXT),
    };

    perceptionLogFormatter = {
      format: jest.fn(() => ['formatted_perception_1', 'formatted_perception_2']),
    };

    gameStateValidationService = {
      validate: jest.fn(() => ({ isValid: true, errorContent: null })),
    };

    actionCategorizationService = {
      extractNamespace: jest.fn(),
      shouldUseGrouping: jest.fn(() => false),
      groupActionsByNamespace: jest.fn(() => new Map()),
      getSortedNamespaces: jest.fn(() => []),
      formatNamespaceDisplayName: jest.fn((namespace) => namespace),
    };

    characterDataXmlBuilder = {
      buildCharacterDataXml: jest.fn(
        () => '<character_data>Mock XML</character_data>'
      ),
    };

    modActionMetadataProvider = {
      getMetadataForMod: jest.fn(() => null),
    };

    chanceTextTranslator = {
      translateForLlm: jest.fn((text) => text),
    };

    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService,
      perceptionLogFormatter,
      gameStateValidationService,
      actionCategorizationService,
      characterDataXmlBuilder,
      modActionMetadataProvider,
      chanceTextTranslator,
    });
  });

  /**
   * Helper to build a minimal valid gameStateDto
   *
   * @param {object} components - Actor components to include.
   * @returns {object} Game state DTO.
   */
  function makeBaseDto(components = {}) {
    return {
      actorState: { components },
      actorPromptData: { name: 'TestActor', personality: 'friendly' },
      perceptionLog: [{ entry: 'raw' }],
      currentLocation: {
        name: 'Test Room',
        description: 'A test room.',
        exits: [],
        characters: [],
      },
      availableActions: [],
      currentUserInput: 'test input',
    };
  }

  describe('PromptData structure', () => {
    test('returns object with expected PromptData keys', async () => {
      const gameStateDto = makeBaseDto({});
      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(result).toHaveProperty('taskDefinitionContent');
      expect(result).toHaveProperty('characterPersonaContent');
      expect(result).toHaveProperty('portrayalGuidelinesContent');
      expect(result).toHaveProperty('contentPolicyContent');
      expect(result).toHaveProperty('worldContextContent');
      expect(result).toHaveProperty('availableActionsInfoContent');
      expect(result).toHaveProperty('userInputContent');
      expect(result).toHaveProperty('finalInstructionsContent');
      expect(result).toHaveProperty('perceptionLogArray');
      expect(result).toHaveProperty('characterName');
      expect(result).toHaveProperty('locationName');
      expect(result).toHaveProperty('thoughtsArray');
      expect(result).toHaveProperty('notesArray');
      expect(result).toHaveProperty('goalsArray');
    });

    test('availableActionsInfoContent is empty string (no actions in mood prompt)', async () => {
      const gameStateDto = makeBaseDto({});
      // Even if we add actions to DTO, they should not appear in mood prompt
      gameStateDto.availableActions = [
        { index: 0, commandString: 'wait', description: 'Wait' },
      ];

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(result.availableActionsInfoContent).toBe('');
    });

    test('finalInstructionsContent uses mood-only instruction text', async () => {
      const gameStateDto = makeBaseDto({});

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(result.finalInstructionsContent).toBe(MOOD_UPDATE_INSTRUCTION_TEXT);
      expect(promptStaticContentService.getMoodUpdateInstructionText).toHaveBeenCalled();
    });
  });

  describe('content population', () => {
    test('perceptionLogArray is populated from game state', async () => {
      const gameStateDto = makeBaseDto({});

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(perceptionLogFormatter.format).toHaveBeenCalledWith([{ entry: 'raw' }]);
      expect(result.perceptionLogArray).toEqual([
        'formatted_perception_1',
        'formatted_perception_2',
      ]);
    });

    test('characterPersonaContent is populated', async () => {
      const gameStateDto = makeBaseDto({});

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(characterDataXmlBuilder.buildCharacterDataXml).toHaveBeenCalled();
      expect(result.characterPersonaContent).toContain('Mock XML');
    });

    test('worldContextContent is populated', async () => {
      const gameStateDto = makeBaseDto({});

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      // worldContextContent should include location info
      expect(result.worldContextContent).toContain('Test Room');
    });

    test('characterName is extracted from actorPromptData', async () => {
      const gameStateDto = makeBaseDto({});
      gameStateDto.actorPromptData.name = 'SpecificCharacter';

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(result.characterName).toBe('SpecificCharacter');
    });

    test('locationName is extracted from currentLocation', async () => {
      const gameStateDto = makeBaseDto({});
      gameStateDto.currentLocation.name = 'Special Location';

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(result.locationName).toBe('Special Location');
    });

    test('userInputContent is populated', async () => {
      const gameStateDto = makeBaseDto({});
      gameStateDto.currentUserInput = 'User command here';

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(result.userInputContent).toBe('User command here');
    });
  });

  describe('memory arrays inclusion', () => {
    test('thoughtsArray is populated from short-term memory', async () => {
      const gameStateDto = makeBaseDto({
        'core:short_term_memory': {
          thoughts: [
            { text: 'Thought 1', timestamp: '2025-01-01T00:00:00Z' },
            { text: 'Thought 2', timestamp: '2025-01-02T00:00:00Z' },
          ],
        },
      });

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(result.thoughtsArray).toEqual([
        { text: 'Thought 1', timestamp: '2025-01-01T00:00:00Z' },
        { text: 'Thought 2', timestamp: '2025-01-02T00:00:00Z' },
      ]);
    });

    test('notesArray is populated from core:notes', async () => {
      const gameStateDto = makeBaseDto({
        'core:notes': {
          notes: [
            { text: 'Note 1', subject: 'subj1', timestamp: '2025-01-01T00:00:00Z' },
            { text: 'Note 2', subject: 'subj2', timestamp: '2025-01-02T00:00:00Z' },
          ],
        },
      });

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(result.notesArray).toEqual([
        { text: 'Note 1', subject: 'subj1', timestamp: '2025-01-01T00:00:00Z' },
        { text: 'Note 2', subject: 'subj2', timestamp: '2025-01-02T00:00:00Z' },
      ]);
    });

    test('goalsArray is populated from core:goals', async () => {
      const gameStateDto = makeBaseDto({
        'core:goals': {
          goals: [
            { text: 'Goal 1', timestamp: '2025-01-01T00:00:00Z' },
            { text: 'Goal 2', timestamp: '2025-01-02T00:00:00Z' },
          ],
        },
      });

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      expect(result.goalsArray).toEqual([
        { text: 'Goal 1', timestamp: '2025-01-01T00:00:00Z' },
        { text: 'Goal 2', timestamp: '2025-01-02T00:00:00Z' },
      ]);
    });
  });

  describe('action-related content exclusion', () => {
    test('does NOT include action-specific content regardless of available actions', async () => {
      const gameStateDto = makeBaseDto({});
      gameStateDto.availableActions = [
        { index: 0, commandString: 'talk', description: 'Talk to someone' },
        { index: 1, commandString: 'move', description: 'Move somewhere' },
      ];

      const result = await provider.getMoodUpdatePromptData(gameStateDto, logger);

      // availableActionsInfoContent must be empty
      expect(result.availableActionsInfoContent).toBe('');

      // Should not have called action categorization for this method
      expect(actionCategorizationService.shouldUseGrouping).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    test('throws when game state validation fails', async () => {
      gameStateValidationService.validate.mockReturnValue({
        isValid: false,
        errorContent: 'Missing critical data',
      });

      const gameStateDto = makeBaseDto({});

      await expect(
        provider.getMoodUpdatePromptData(gameStateDto, logger)
      ).rejects.toThrow('Missing critical data');
    });
  });

  describe('comparison with getPromptData', () => {
    test('getMoodUpdatePromptData returns same PromptData type as getPromptData', async () => {
      const gameStateDto = makeBaseDto({
        'core:notes': { notes: [{ text: 'Note', subject: 'test' }] },
        'core:goals': { goals: [{ text: 'Goal' }] },
      });

      const moodResult = await provider.getMoodUpdatePromptData(gameStateDto, logger);
      const regularResult = await provider.getPromptData(gameStateDto, logger);

      // Both should have the same keys (though values may differ)
      const moodKeys = Object.keys(moodResult).sort();
      const regularKeys = Object.keys(regularResult).sort();
      expect(moodKeys).toEqual(regularKeys);
    });

    test('key difference: finalInstructionsContent is different between methods', async () => {
      const gameStateDto = makeBaseDto({});

      const moodResult = await provider.getMoodUpdatePromptData(gameStateDto, logger);
      const regularResult = await provider.getPromptData(gameStateDto, logger);

      // Mood method uses mood-specific instructions
      expect(moodResult.finalInstructionsContent).toBe(MOOD_UPDATE_INSTRUCTION_TEXT);

      // Regular method uses standard final instructions
      expect(regularResult.finalInstructionsContent).toBe('FINAL_INSTRUCTIONS');
    });

    test('key difference: availableActionsInfoContent is empty in mood method', async () => {
      const gameStateDto = makeBaseDto({});
      gameStateDto.availableActions = [
        { index: 0, commandString: 'test', description: 'Test action' },
      ];

      const moodResult = await provider.getMoodUpdatePromptData(gameStateDto, logger);
      const regularResult = await provider.getPromptData(gameStateDto, logger);

      expect(moodResult.availableActionsInfoContent).toBe('');
      expect(regularResult.availableActionsInfoContent).not.toBe('');
    });
  });
});
