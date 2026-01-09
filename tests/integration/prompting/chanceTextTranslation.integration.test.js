import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { ChanceTextTranslator } from '../../../src/prompting/ChanceTextTranslator.js';

function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function createMockStaticContentService() {
  return {
    getCoreTaskDescriptionText: jest.fn().mockReturnValue(''),
    getCharacterPortrayalGuidelines: jest.fn().mockReturnValue(''),
    getNc21ContentPolicyText: jest.fn().mockReturnValue(''),
    getFinalLlmInstructionText: jest.fn().mockReturnValue(''),
    getMoodUpdateInstructionText: jest.fn().mockReturnValue(''),
  };
}

function extractFirstActionLine(content) {
  return content
    .split('\n')
    .find((line) => line.includes('Command:'));
}

describe('Chance Text Translation Integration', () => {
  let mockLogger;
  let aiPromptContentProvider;

  beforeEach(() => {
    mockLogger = createMockLogger();
    const chanceTextTranslator = new ChanceTextTranslator({ logger: mockLogger });

    aiPromptContentProvider = new AIPromptContentProvider({
      logger: mockLogger,
      promptStaticContentService: createMockStaticContentService(),
      perceptionLogFormatter: { format: jest.fn() },
      gameStateValidationService: { validate: jest.fn() },
      actionCategorizationService: {
        extractNamespace: jest.fn(),
        shouldUseGrouping: jest.fn().mockReturnValue(false),
        groupActionsByNamespace: jest.fn(),
        getSortedNamespaces: jest.fn().mockReturnValue([]),
        formatNamespaceDisplayName: jest.fn(),
      },
      characterDataXmlBuilder: {
        buildCharacterDataXml: jest.fn().mockReturnValue('<character/>'),
      },
      modActionMetadataProvider: { getMetadataForMod: jest.fn() },
      chanceTextTranslator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Prompt Formatting Pipeline', () => {
    it('shows numeric chance in source commandString', () => {
      const action = {
        index: 0,
        actionId: 'test:attack',
        commandString: 'attack Goblin (55% chance)',
        description: 'Attack the goblin with your weapon',
      };

      const content = aiPromptContentProvider.getAvailableActionsInfoContent({
        availableActions: [action],
      });
      const actionLine = extractFirstActionLine(content);

      expect(action.commandString).toBe('attack Goblin (55% chance)');
      expect(actionLine).toContain('(decent chance)');
      expect(actionLine).not.toContain('(55% chance)');
    });

    it('preserves modifier tags in LLM prompt format', () => {
      const action = {
        index: 1,
        actionId: 'test:flanking_attack',
        commandString: 'attack Goblin (75% chance) [flanking] [backstab]',
        description: 'Attack from behind for bonus damage',
      };

      const content = aiPromptContentProvider.getAvailableActionsInfoContent({
        availableActions: [action],
      });
      const actionLine = extractFirstActionLine(content);

      expect(actionLine).toContain('(very good chance) [flanking] [backstab]');
    });
  });

  describe('UI vs LLM Output Divergence', () => {
    it('produces different output for UI vs LLM', () => {
      const action = {
        index: 2,
        actionId: 'test:ambush',
        commandString: 'ambush target (55% chance)',
        description: 'Surprise the target before they react',
      };

      const content = aiPromptContentProvider.getAvailableActionsInfoContent({
        availableActions: [action],
      });
      const actionLine = extractFirstActionLine(content);

      expect(action.commandString).toBe('ambush target (55% chance)');
      expect(actionLine).toContain('(decent chance)');
      expect(actionLine).not.toContain(action.commandString);
    });

    it('does not mutate the original action object', () => {
      const action = {
        index: 3,
        actionId: 'test:guard',
        commandString: 'guard ally (45% chance)',
        description: 'Move into position to protect them',
      };

      aiPromptContentProvider.getAvailableActionsInfoContent({
        availableActions: [action],
      });

      expect(action.commandString).toBe('guard ally (45% chance)');
    });
  });

  describe('Edge Cases', () => {
    it('handles action without chance template', () => {
      const action = {
        index: 4,
        actionId: 'test:walk',
        commandString: 'walk to tavern',
        description: 'Walk to the local tavern',
      };

      const content = aiPromptContentProvider.getAvailableActionsInfoContent({
        availableActions: [action],
      });
      const actionLine = extractFirstActionLine(content);

      expect(actionLine).toContain('Command: "walk to tavern"');
    });

    it('handles 0% chance actions', () => {
      const action = {
        index: 5,
        actionId: 'test:fail',
        commandString: 'defy gravity (0% chance)',
        description: 'Attempt the impossible',
      };

      const content = aiPromptContentProvider.getAvailableActionsInfoContent({
        availableActions: [action],
      });
      const actionLine = extractFirstActionLine(content);

      expect(actionLine).toContain('(impossible)');
    });

    it('handles 100% chance actions', () => {
      const action = {
        index: 6,
        actionId: 'test:success',
        commandString: 'open door (100% chance)',
        description: 'Open the unlocked door',
      };

      const content = aiPromptContentProvider.getAvailableActionsInfoContent({
        availableActions: [action],
      });
      const actionLine = extractFirstActionLine(content);

      expect(actionLine).toContain('(certain)');
    });

    it('handles multiple chance patterns in one command', () => {
      const action = {
        index: 7,
        actionId: 'test:multi_target',
        commandString: 'strike A (55% chance) or strike B (75% chance)',
        description: 'Choose which target to strike',
      };

      const content = aiPromptContentProvider.getAvailableActionsInfoContent({
        availableActions: [action],
      });
      const actionLine = extractFirstActionLine(content);

      expect(actionLine).toContain('strike A (decent chance) or strike B (very good chance)');
    });
  });

  describe('Regression: Existing Functionality', () => {
    it('preserves action index and description formatting', () => {
      const action = {
        index: 8,
        actionId: 'test:index',
        commandString: 'raise shield (65% chance)',
        description: 'Raise your shield',
      };

      const content = aiPromptContentProvider.getAvailableActionsInfoContent({
        availableActions: [action],
      });
      const actionLine = extractFirstActionLine(content);

      expect(actionLine).toContain('[Index: 8]');
      expect(actionLine).toContain('Description: Raise your shield.');
    });
  });
});
