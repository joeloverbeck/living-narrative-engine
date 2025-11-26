// tests/unit/prompting/AIPromptContentProvider.actionMetadata.test.js
// --- FILE START ---

/**
 * @file Unit tests for AIPromptContentProvider action metadata formatting.
 * Tests the integration of ModActionMetadataProvider with _formatCategorizedActions.
 * @see AIPromptContentProvider.js
 * @see ModActionMetadataProvider.js
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

describe('AIPromptContentProvider - Action Metadata Formatting', () => {
  let provider;
  let mockLogger;
  let mockPromptStaticContentService;
  let mockPerceptionLogFormatter;
  let mockGameStateValidationService;
  let mockActionCategorizationService;
  let mockCharacterDataXmlBuilder;
  let mockModActionMetadataProvider;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    mockPromptStaticContentService = {
      getCoreTaskDescriptionText: jest.fn().mockReturnValue(''),
      getNc21ContentPolicyText: jest.fn().mockReturnValue(''),
      getCharacterPortrayalGuidelines: jest.fn().mockReturnValue(''),
      getFinalLlmInstructionText: jest.fn().mockReturnValue(''),
    };

    mockPerceptionLogFormatter = {
      format: jest.fn().mockReturnValue([]),
    };

    mockGameStateValidationService = {
      validate: jest
        .fn()
        .mockReturnValue({ isValid: true, errorContent: null }),
    };

    mockActionCategorizationService = {
      extractNamespace: jest.fn(
        (actionId) => actionId.split(':')[0] || 'unknown'
      ),
      shouldUseGrouping: jest.fn(() => true),
      groupActionsByNamespace: jest.fn(),
      getSortedNamespaces: jest.fn(() => []),
      formatNamespaceDisplayName: jest.fn((ns) => ns.toUpperCase()),
    };

    mockCharacterDataXmlBuilder = {
      buildCharacterDataXml: jest.fn().mockReturnValue('<character/>'),
    };

    mockModActionMetadataProvider = {
      getMetadataForMod: jest.fn(),
    };

    provider = new AIPromptContentProvider({
      logger: mockLogger,
      promptStaticContentService: mockPromptStaticContentService,
      perceptionLogFormatter: mockPerceptionLogFormatter,
      gameStateValidationService: mockGameStateValidationService,
      actionCategorizationService: mockActionCategorizationService,
      characterDataXmlBuilder: mockCharacterDataXmlBuilder,
      modActionMetadataProvider: mockModActionMetadataProvider,
    });
  });

  describe('_formatCategorizedActions with metadata', () => {
    test('should include purpose and consider when in formatted output', () => {
      const actions = [
        {
          id: 'positioning:sit_down',
          command: 'sit down',
          description: 'Take a seat',
        },
      ];
      const groupedMap = new Map([['positioning', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'positioning',
        actionPurpose: 'Change body position and spatial relationships.',
        actionConsiderWhen: 'Getting closer or farther from someone.',
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('**Purpose:** Change body position');
      expect(result).toContain('**Consider when:** Getting closer');
    });

    test('should handle missing metadata gracefully (no Purpose/Consider lines)', () => {
      const actions = [{ id: 'core:wait', command: 'wait', description: 'Wait' }];
      const groupedMap = new Map([['core', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue(null);

      const result = provider._formatCategorizedActions(actions);

      expect(result).not.toContain('**Purpose:**');
      expect(result).not.toContain('**Consider when:**');
      expect(result).toContain('### CORE Actions');
    });

    test('should handle partial metadata (only purpose)', () => {
      const actions = [
        { id: 'items:pickup', command: 'pick up', description: 'Pick up item' },
      ];
      const groupedMap = new Map([['items', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'items',
        actionPurpose: 'Object manipulation.',
        actionConsiderWhen: undefined,
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('**Purpose:** Object manipulation.');
      expect(result).not.toContain('**Consider when:**');
    });

    test('should handle partial metadata (only consider when)', () => {
      const actions = [
        { id: 'affection:hug', command: 'hug', description: 'Hug someone' },
      ];
      const groupedMap = new Map([['affection', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'affection',
        actionPurpose: undefined,
        actionConsiderWhen: 'Showing tenderness.',
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).not.toContain('**Purpose:**');
      expect(result).toContain('**Consider when:** Showing tenderness.');
    });

    test('should maintain backward compatibility when provider returns null', () => {
      const actions = [
        {
          id: 'test:action1',
          commandString: 'action1',
          description: 'Test action',
          index: 0,
        },
        {
          id: 'test:action2',
          commandString: 'action2',
          description: 'Another test',
          index: 1,
        },
      ];
      const groupedMap = new Map([['test', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue(null);

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('### TEST Actions');
      expect(result).toContain('Command: "action1"');
      expect(result).toContain('Command: "action2"');
    });

    test('should include action count in header', () => {
      const actions = [
        { id: 'positioning:sit', command: 'sit', description: 'Sit' },
        { id: 'positioning:stand', command: 'stand', description: 'Stand' },
        { id: 'positioning:walk', command: 'walk', description: 'Walk' },
      ];
      const groupedMap = new Map([['positioning', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue(null);

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('(3 actions)');
    });

    test('should format multiple namespaces with different metadata states', () => {
      const positioningActions = [
        { id: 'positioning:sit', command: 'sit', description: 'Sit' },
      ];
      const coreActions = [
        { id: 'core:wait', command: 'wait', description: 'Wait' },
      ];
      const allActions = [...positioningActions, ...coreActions];

      const groupedMap = new Map([
        ['positioning', positioningActions],
        ['core', coreActions],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod
        .mockReturnValueOnce({
          modId: 'positioning',
          actionPurpose: 'Position yourself.',
          actionConsiderWhen: 'When moving.',
        })
        .mockReturnValueOnce(null);

      const result = provider._formatCategorizedActions(allActions);

      expect(result).toContain('**Purpose:** Position yourself.');
      expect(result).toContain('### CORE Actions');
      // Core section should not have Purpose/Consider lines
      const coreSection = result.split('### CORE')[1];
      expect(coreSection).not.toContain('**Purpose:**');
    });

    test('should handle empty actionPurpose string as missing', () => {
      const actions = [
        { id: 'test:action', command: 'test', description: 'Test' },
      ];
      const groupedMap = new Map([['test', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'test',
        actionPurpose: '',
        actionConsiderWhen: 'When testing.',
      });

      const result = provider._formatCategorizedActions(actions);

      // Empty string is falsy, so Purpose line should be absent
      expect(result).not.toContain('**Purpose:**');
      expect(result).toContain('**Consider when:** When testing.');
    });

    test('should handle empty actionConsiderWhen string as missing', () => {
      const actions = [
        { id: 'test:action', command: 'test', description: 'Test' },
      ];
      const groupedMap = new Map([['test', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'test',
        actionPurpose: 'Testing purpose.',
        actionConsiderWhen: '',
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('**Purpose:** Testing purpose.');
      // Empty string is falsy, so Consider when line should be absent
      expect(result).not.toContain('**Consider when:**');
    });
  });

  describe('constructor validation', () => {
    test('should throw when modActionMetadataProvider is missing', () => {
      expect(
        () =>
          new AIPromptContentProvider({
            logger: mockLogger,
            promptStaticContentService: mockPromptStaticContentService,
            perceptionLogFormatter: mockPerceptionLogFormatter,
            gameStateValidationService: mockGameStateValidationService,
            actionCategorizationService: mockActionCategorizationService,
            characterDataXmlBuilder: mockCharacterDataXmlBuilder,
            modActionMetadataProvider: null,
          })
      ).toThrow();
    });

    test('should throw when modActionMetadataProvider lacks required method', () => {
      expect(
        () =>
          new AIPromptContentProvider({
            logger: mockLogger,
            promptStaticContentService: mockPromptStaticContentService,
            perceptionLogFormatter: mockPerceptionLogFormatter,
            gameStateValidationService: mockGameStateValidationService,
            actionCategorizationService: mockActionCategorizationService,
            characterDataXmlBuilder: mockCharacterDataXmlBuilder,
            modActionMetadataProvider: {}, // Missing getMetadataForMod
          })
      ).toThrow();
    });
  });
});
