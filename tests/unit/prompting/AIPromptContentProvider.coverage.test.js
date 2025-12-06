/**
 * @file Additional unit tests for AIPromptContentProvider to improve coverage
 * Specifically targets uncovered lines identified in coverage report
 */

import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import {
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_ACTION_COMMAND,
  DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW,
  PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS,
  PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE,
} from '../../../src/constants/textDefaults.js';
import {
  jest,
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
} from '@jest/globals';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/interfaces/IPromptStaticContentService.js').IPromptStaticContentService} IPromptStaticContentService */
/** @typedef {import('../../../src/interfaces/IPerceptionLogFormatter.js').IPerceptionLogFormatter} IPerceptionLogFormatter */
/** @typedef {import('../../../src/interfaces/IGameStateValidationServiceForPrompting.js').IGameStateValidationServiceForPrompting} IGameStateValidationServiceForPrompting */
/** @typedef {import('../../../src/interfaces/IActionCategorizationService.js').IActionCategorizationService} IActionCategorizationService */
/** @typedef {import('../../../src/turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */

/**
 * @returns {jest.Mocked<ILogger>}
 */
const mockLoggerFn = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('AIPromptContentProvider - Coverage Improvements', () => {
  /** @type {AIPromptContentProvider} */
  let provider;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<IPromptStaticContentService>} */
  let mockPromptStaticContentService;
  /** @type {jest.Mocked<IPerceptionLogFormatter>} */
  let mockPerceptionLogFormatter;
  /** @type {jest.Mocked<IGameStateValidationServiceForPrompting>} */
  let mockGameStateValidationService;
  /** @type {jest.Mocked<any>} */
  let mockCharacterDataXmlBuilder;
  /** @type {jest.Mocked<IActionCategorizationService>} */
  let mockActionCategorizationService;

  beforeEach(() => {
    mockLogger = mockLoggerFn();

    mockPromptStaticContentService = {
      getCoreTaskDescriptionText: jest.fn().mockReturnValue('Task'),
      getCharacterPortrayalGuidelines: jest.fn().mockReturnValue('Guidelines'),
      getNc21ContentPolicyText: jest.fn().mockReturnValue('Policy'),
      getFinalLlmInstructionText: jest.fn().mockReturnValue('Instructions'),
    };

    mockPerceptionLogFormatter = {
      formatPerceptionLogEntries: jest.fn().mockReturnValue([]),
      format: jest.fn().mockReturnValue('formatted perception'),
    };

    mockGameStateValidationService = {
      validateGameStateForPrompting: jest.fn(),
      validate: jest.fn(),
    };

    // Setup mock for CharacterDataXmlBuilder
    mockCharacterDataXmlBuilder = {
      buildCharacterDataXml: jest
        .fn()
        .mockReturnValue('<character_data>Formatted persona</character_data>'),
    };

    mockActionCategorizationService = {
      extractNamespace: jest.fn().mockReturnValue('default'),
      groupActionsByNamespace: jest.fn().mockReturnValue(new Map()),
      formatNamespaceDisplayName: jest.fn().mockImplementation((ns) => ns),
      shouldUseGrouping: jest.fn().mockReturnValue(false),
      getSortedNamespaces: jest.fn().mockReturnValue([]),
    };

    const mockModActionMetadataProvider = {
      getMetadataForMod: jest.fn().mockReturnValue(null),
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCharacterPersonaContent edge cases', () => {
    test('should use fallback when CharacterDataXmlBuilder returns empty string', () => {
      // Arrange
      mockCharacterDataXmlBuilder.buildCharacterDataXml.mockReturnValue('');
      const gameState = {
        actorPromptData: {
          name: 'TestCharacter',
          description: 'Test description', // Need non-minimal details to reach builder
        },
      };

      // Act
      const result = provider.getCharacterPersonaContent(gameState);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AIPromptContentProvider: CharacterDataXmlBuilder returned empty result. Using fallback.'
      );
      expect(result).toBe(PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS);
    });

    test('should use fallback when CharacterDataXmlBuilder returns whitespace-only string', () => {
      // Arrange
      mockCharacterDataXmlBuilder.buildCharacterDataXml.mockReturnValue(
        '   \n\t  '
      );
      const gameState = {
        actorPromptData: {
          name: 'TestCharacter',
          personality: 'Test personality', // Need non-minimal details to reach builder
        },
      };

      // Act
      const result = provider.getCharacterPersonaContent(gameState);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AIPromptContentProvider: CharacterDataXmlBuilder returned empty result. Using fallback.'
      );
      expect(result).toBe(PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS);
    });

    test('should handle error in CharacterDataXmlBuilder and use fallback', () => {
      // Arrange
      const testError = new Error('Builder error');
      mockCharacterDataXmlBuilder.buildCharacterDataXml.mockImplementation(
        () => {
          throw testError;
        }
      );
      const gameState = {
        actorPromptData: {
          name: 'TestCharacter',
          profile: 'Test profile', // Need non-minimal details to reach builder
        },
      };

      // Act
      const result = provider.getCharacterPersonaContent(gameState);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AIPromptContentProvider: Error formatting character persona with CharacterDataXmlBuilder.',
        testError
      );
      expect(result).toBe(
        `YOU ARE TestCharacter.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.`
      );
    });

    test('should use default name in fallback when name is missing', () => {
      // Arrange
      const testError = new Error('Builder error');
      mockCharacterDataXmlBuilder.buildCharacterDataXml.mockImplementation(
        () => {
          throw testError;
        }
      );
      const gameState = {
        actorPromptData: {
          description: 'Some description', // No name but has other details to avoid minimal check
        },
      };

      // Act
      const result = provider.getCharacterPersonaContent(gameState);

      // Assert
      expect(result).toBe(
        `YOU ARE ${DEFAULT_FALLBACK_CHARACTER_NAME}.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.`
      );
    });
  });

  describe('_formatCategorizedActions error handling', () => {
    test('should handle empty grouped result and fallback to flat format (lines 658-676)', () => {
      // Arrange
      const actions = [
        { index: 1, commandString: 'action1', description: 'desc1' },
        { index: 2, commandString: 'action2', description: 'desc2' },
      ];

      // Mock groupActionsByNamespace to return empty Map
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        new Map()
      );

      // Act
      const result = provider._formatCategorizedActions(actions);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AIPromptContentProvider: Grouping returned empty result, falling back to flat format'
      );
      expect(result).toContain('[Index: 1]');
      expect(result).toContain('[Index: 2]');
    });

    test('should catch and handle errors in categorization with fallback (lines 705-715)', () => {
      // Arrange
      const actions = [
        { index: 1, commandString: 'action1', description: 'desc1' },
      ];

      const testError = new Error('Categorization failed');
      mockActionCategorizationService.groupActionsByNamespace.mockImplementation(
        () => {
          throw testError;
        }
      );

      // Act
      const result = provider._formatCategorizedActions(actions);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AIPromptContentProvider: Error in categorized formatting, falling back to flat format',
        expect.objectContaining({
          error: 'Categorization failed',
          actionCount: 1,
        })
      );
      expect(result).toContain('[Index: 1]');
    });

    test('should handle performance timing and logging in successful categorization (lines 659-704)', () => {
      // Arrange
      const actions = [
        { index: 1, commandString: 'action1', description: 'desc1' },
        { index: 2, commandString: 'action2', description: 'desc2' },
      ];

      const mockGrouped = new Map([
        ['namespace1', [actions[0]]],
        ['namespace2', [actions[1]]],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        mockGrouped
      );

      // Mock performance.now to track timing
      const mockPerformance = jest.spyOn(performance, 'now');
      mockPerformance.mockReturnValueOnce(1000).mockReturnValueOnce(1050);

      // Act
      const result = provider._formatCategorizedActions(actions);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AIPromptContentProvider: Formatting categorized actions',
        { actionCount: 2 }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AIPromptContentProvider: Categorized formatting completed',
        expect.objectContaining({
          duration: '50.00ms',
          namespaceCount: 2,
          totalActions: 2,
        })
      );
      expect(result).toContain('## Available Actions');
      expect(result).toContain('### namespace1 Actions');
      expect(result).toContain('### namespace2 Actions');

      mockPerformance.mockRestore();
    });
  });

  describe('_formatSingleAction edge cases', () => {
    test('should handle null action and log warning (lines 751-754)', () => {
      // Act
      const result = provider._formatSingleAction(null);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AIPromptContentProvider: Attempted to format null/undefined action'
      );
      expect(result).toBe('');
    });

    test('should handle undefined action and log warning (lines 751-754)', () => {
      // Act
      const result = provider._formatSingleAction(undefined);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AIPromptContentProvider: Attempted to format null/undefined action'
      );
      expect(result).toBe('');
    });
  });

  describe('getAvailableActionsInfoContent categorization logic', () => {
    test('should use categorization when service indicates it should (lines 792-799)', () => {
      // Arrange
      const actions = [
        { index: 1, commandString: 'action1', description: 'desc1' },
        { index: 2, commandString: 'action2', description: 'desc2' },
      ];
      const gameState = { availableActions: actions };

      // Mock shouldUseGrouping to return true
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(true);

      // Mock groupActionsByNamespace to return categorized actions
      const mockGrouped = new Map([
        ['namespace1', [actions[0]]],
        ['namespace2', [actions[1]]],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        mockGrouped
      );

      // Act
      const result = provider.getAvailableActionsInfoContent(gameState);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AIPromptContentProvider: Using categorized formatting',
        { actionCount: 2 }
      );
      expect(result).toContain('## Available Actions');
      expect(result).toContain('### namespace1 Actions');
    });

    test('should handle critical error with ultimate fallback (lines 811-831)', () => {
      // Arrange
      const actions = [
        { index: 1, commandString: 'cmd1', description: 'desc1' },
        { index: 2, commandString: null, description: null },
      ];
      const gameState = { availableActions: actions };

      // Mock to throw error
      const testError = new Error('Critical failure');
      mockActionCategorizationService.shouldUseGrouping.mockImplementation(
        () => {
          throw testError;
        }
      );

      // Act
      const result = provider.getAvailableActionsInfoContent(gameState);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AIPromptContentProvider: Critical error in action formatting, using fallback',
        expect.objectContaining({
          error: 'Critical failure',
          actionCount: 2,
        })
      );

      // Check fallback formatting is used
      expect(result).toContain('[Index: 1] Command: "cmd1"');
      expect(result).toContain(
        `[Index: 2] Command: "${DEFAULT_FALLBACK_ACTION_COMMAND}"`
      );
      expect(result).toContain(DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW);
    });

    test('should handle actions with missing properties in ultimate fallback (lines 823-828)', () => {
      // Arrange
      const actions = [
        { index: 1 }, // Missing commandString and description
        { index: 2, commandString: 'cmd2' }, // Missing description
        { index: 3, description: 'desc3' }, // Missing commandString
      ];
      const gameState = { availableActions: actions };

      // Force error path
      mockActionCategorizationService.shouldUseGrouping.mockImplementation(
        () => {
          throw new Error('Force fallback');
        }
      );

      // Act
      const result = provider.getAvailableActionsInfoContent(gameState);

      // Assert
      expect(result).toContain(
        `[Index: 1] Command: "${DEFAULT_FALLBACK_ACTION_COMMAND}"`
      );
      expect(result).toContain(DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW);
      expect(result).toContain('[Index: 2] Command: "cmd2"');
      expect(result).toContain(
        `[Index: 3] Command: "${DEFAULT_FALLBACK_ACTION_COMMAND}"`
      );
    });
  });

  describe('performance and logging', () => {
    test('should measure and log performance for categorized formatting', () => {
      // Arrange
      const actions = [
        { index: 1, commandString: 'test', description: 'test action' },
      ];

      const mockGrouped = new Map([['test', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        mockGrouped
      );

      // Mock performance timing
      const performanceSpy = jest.spyOn(performance, 'now');
      performanceSpy.mockReturnValueOnce(100).mockReturnValueOnce(125.5);

      // Act
      provider._formatCategorizedActions(actions);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AIPromptContentProvider: Categorized formatting completed',
        expect.objectContaining({
          duration: '25.50ms',
          namespaceCount: 1,
          totalActions: 1,
        })
      );

      performanceSpy.mockRestore();
    });
  });
});
