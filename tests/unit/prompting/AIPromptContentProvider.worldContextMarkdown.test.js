/**
 * @file Tests for AIPromptContentProvider markdown world context enhancement
 * @description Tests the markdown-structured world context formatting introduced in LLM prompt enhancement spec
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import {
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_LOCATION_NAME,
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
  PROMPT_FALLBACK_UNKNOWN_LOCATION,
  PROMPT_FALLBACK_NO_EXITS,
  PROMPT_FALLBACK_ALONE_IN_LOCATION,
} from '../../../src/constants/textDefaults.js';

/**
 * @returns {jest.Mocked<ILogger>}
 */
const mockLoggerFn = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * @returns {jest.Mocked<IPromptStaticContentService>}
 */
const mockPromptStaticContentServiceFn = () => ({
  getCoreTaskDescriptionText: jest.fn(),
  getCharacterPortrayalGuidelines: jest.fn(),
  getNc21ContentPolicyText: jest.fn(),
  getFinalLlmInstructionText: jest.fn(),
});

/**
 * @returns {jest.Mocked<IPerceptionLogFormatter>}
 */
const mockPerceptionLogFormatterFn = () => ({
  format: jest.fn(),
});

/**
 * @returns {jest.Mocked<IGameStateValidationServiceForPrompting>}
 */
const mockGameStateValidationServiceFn = () => ({
  validate: jest.fn(),
});

/**
 * @returns {jest.Mocked<IActionCategorizationService>}
 */
const mockActionCategorizationServiceFn = () => ({
  extractNamespace: jest.fn(),
  shouldUseGrouping: jest.fn(() => false),
  groupActionsByNamespace: jest.fn(() => new Map()),
  getSortedNamespaces: jest.fn(() => []),
  formatNamespaceDisplayName: jest.fn((namespace) => namespace),
});

/**
 * @returns {jest.Mocked<any>}
 */
const mockCharacterDataXmlBuilderFn = () => ({
  buildCharacterDataXml: jest.fn(
    () => '<character_data>Mock XML</character_data>'
  ),
});

/**
 * @returns {jest.Mocked<any>}
 */
const mockModActionMetadataProviderFn = () => ({
  getMetadataForMod: jest.fn(() => null),
});

describe('AIPromptContentProvider - Markdown World Context Enhancement', () => {
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

  beforeEach(() => {
    mockLogger = mockLoggerFn();
    mockPromptStaticContentService = mockPromptStaticContentServiceFn();
    mockPerceptionLogFormatter = mockPerceptionLogFormatterFn();
    mockGameStateValidationService = mockGameStateValidationServiceFn();

    provider = new AIPromptContentProvider({
      logger: mockLogger,
      promptStaticContentService: mockPromptStaticContentService,
      perceptionLogFormatter: mockPerceptionLogFormatter,
      gameStateValidationService: mockGameStateValidationService,
      actionCategorizationService: mockActionCategorizationServiceFn(),
      characterDataXmlBuilder: mockCharacterDataXmlBuilderFn(),
      modActionMetadataProvider: mockModActionMetadataProviderFn(),
    });
  });

  describe('getWorldContextContent - Markdown Structure', () => {
    test('should format world context with markdown headers', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location for markdown formatting.',
          exits: [
            {
              direction: 'north',
              targetLocationName: 'Northern Room',
            },
            {
              direction: 'into the shop',
              targetLocationName: 'The Shop',
            },
          ],
          characters: [
            {
              name: 'John Doe',
              description: 'A friendly traveler.',
            },
          ],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      // Check for markdown structure
      expect(result).toContain('## Current Situation');
      expect(result).toContain('### Location');
      expect(result).toContain('### Description');
      expect(result).toContain('## Exits from Current Location');
      expect(result).toContain('## Other Characters Present');
      expect(result).toContain('### John Doe');

      // Check location formatting
      expect(result).toContain('Test Location');
      expect(result).toContain('A test location for markdown formatting.');

      // Check exits formatting with bold direction
      expect(result).toContain('- **Towards north** leads to Northern Room');
      expect(result).toContain('- **into the shop** leads to The Shop');

      // Check character formatting
      expect(result).toContain('- **Description**: A friendly traveler.');
    });

    test('should handle structured character descriptions with bullet points', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [],
          characters: [
            {
              name: 'Structured Character',
              description:
                'Hair: brown, straight; Eyes: blue, round; Height: tall',
            },
          ],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      // Should parse structured description into bullet points
      expect(result).toContain('### Structured Character');
      expect(result).toContain('- **Hair**: brown, straight');
      expect(result).toContain('- **Eyes**: blue, round');
      expect(result).toContain('- **Height**: tall');
    });

    test('should handle apparent age formatting for characters', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [],
          characters: [
            {
              name: 'Elena Rodriguez',
              description: 'A woman with sharp features and intense dark eyes.',
              apparentAge: {
                minAge: 30,
                maxAge: 35,
                bestGuess: 33,
              },
            },
            {
              name: 'Young Character',
              description: 'Hair: blonde; Eyes: green',
              apparentAge: {
                minAge: 18,
                maxAge: 18,
              },
            },
            {
              name: 'Older Character',
              description: 'A wise looking individual.',
              apparentAge: {
                minAge: 60,
                maxAge: 70,
              },
            },
          ],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      // Check Elena with bestGuess
      expect(result).toContain('### Elena Rodriguez');
      expect(result).toContain('- **Apparent age**: around 33 years old');
      expect(result).toContain(
        '- **Description**: A woman with sharp features and intense dark eyes.'
      );

      // Check Young Character with exact age
      expect(result).toContain('### Young Character');
      expect(result).toContain('- **Apparent age**: 18 years old');
      expect(result).toContain('- **Hair**: blonde');
      expect(result).toContain('- **Eyes**: green.');

      // Check Older Character with range
      expect(result).toContain('### Older Character');
      expect(result).toContain(
        '- **Apparent age**: between 60 and 70 years old'
      );
      expect(result).toContain('- **Description**: A wise looking individual.');
    });

    test('should annotate blocked exits with the blocker name', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [
            {
              direction: 'to segment B',
              targetLocationName: 'Segment B',
              blockerName: 'ancient iron grate',
              isBlocked: true,
            },
            {
              direction: 'to segment C',
              targetLocationName: 'Segment C',
              blockerName: 'open gate',
              isBlocked: false,
            },
            {
              direction: 'to segment D',
              targetLocationName: 'Segment D',
            },
          ],
          characters: [],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      expect(result).toContain(
        '- **to segment B** leads to Segment B (blocked by ancient iron grate)'
      );
      expect(result).toContain('- **to segment C** leads to Segment C');
      expect(result).toContain('- **to segment D** leads to Segment D');
      expect(result).not.toContain('blocked by open gate');
    });

    test('should handle characters without apparent age', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [],
          characters: [
            {
              name: 'Character Without Age',
              description: 'A mysterious figure.',
            },
          ],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      expect(result).toContain('### Character Without Age');
      expect(result).toContain('- **Description**: A mysterious figure.');
      expect(result).not.toContain('**Apparent age**');
    });

    test('should handle simple character descriptions as single bullet point', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [],
          characters: [
            {
              name: 'Simple Character',
              description: 'A simple character without structured attributes.',
            },
          ],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      expect(result).toContain('### Simple Character');
      expect(result).toContain(
        '- **Description**: A simple character without structured attributes.'
      );
    });

    test('should parse newline-delimited Wearing/Health/Inventory without commas', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [],
          characters: [
            {
              name: 'Scout',
              description:
                'Wearing: Cloak.\nHealth: Perfect health.\nInventory: Coin.',
            },
          ],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      expect(result).toContain('- **Wearing**: Cloak.');
      expect(result).toContain('- **Health**: Perfect health.');
      expect(result).toContain('- **Inventory**: Coin.');
    });

    test('should handle empty exits with fallback message', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [],
          characters: [],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      expect(result).toContain('## Exits from Current Location');
      expect(result).toContain(PROMPT_FALLBACK_NO_EXITS);
    });

    test('should handle empty characters with fallback message', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [],
          characters: [],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      expect(result).toContain('## Other Characters Present');
      expect(result).toContain(PROMPT_FALLBACK_ALONE_IN_LOCATION);
    });

    test('should handle missing currentLocation with fallback', () => {
      const mockGameState = {};

      const result = provider.getWorldContextContent(mockGameState);

      expect(result).toBe(PROMPT_FALLBACK_UNKNOWN_LOCATION);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AIPromptContentProvider: currentLocation is missing in getWorldContextContent. Using fallback.'
      );
    });

    test('should use fallback values for missing location data', () => {
      const mockGameState = {
        currentLocation: {
          // Missing name and description
          exits: [],
          characters: [],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      expect(result).toContain(DEFAULT_FALLBACK_LOCATION_NAME);
      expect(result).toContain(DEFAULT_FALLBACK_DESCRIPTION_RAW);
    });

    test('should format direction labels correctly', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [
            {
              direction: 'north',
              targetLocationName: 'North Room',
            },
            {
              direction: 'to the garden',
              targetLocationName: 'Garden',
            },
            {
              direction: 'into the house',
              targetLocationName: 'House',
            },
          ],
          characters: [],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      // Should add "Towards" prefix to simple directions
      expect(result).toContain('- **Towards north** leads to North Room');
      // Should preserve directions that start with "to " or "into "
      expect(result).toContain('- **to the garden** leads to Garden');
      expect(result).toContain('- **into the house** leads to House');
    });

    test('should handle missing character name and description with fallbacks', () => {
      const mockGameState = {
        currentLocation: {
          name: 'Test Location',
          description: 'A test location.',
          exits: [],
          characters: [
            {
              // Missing name and description
            },
          ],
        },
      };

      const result = provider.getWorldContextContent(mockGameState);

      expect(result).toContain(`### ${DEFAULT_FALLBACK_CHARACTER_NAME}`);
      expect(result).toContain(
        `- **Description**: ${DEFAULT_FALLBACK_DESCRIPTION_RAW}`
      );
    });
  });

  describe('_parseCharacterDescription helper', () => {
    test('should parse semicolon-separated attributes', () => {
      const description = 'Hair: brown; Eyes: blue; Height: tall';
      const result = provider._parseCharacterDescription(description);

      expect(result).toEqual([
        '- **Hair**: brown',
        '- **Eyes**: blue',
        '- **Height**: tall',
      ]);
    });

    test('should preserve pipes within attribute values (for clothing lists)', () => {
      const description = 'Hair: brown | Eyes: blue | Height: tall';
      const result = provider._parseCharacterDescription(description);

      // Pipes should be preserved within values, not used as delimiters
      expect(result).toEqual(['- **Hair**: brown | Eyes: blue | Height: tall']);
    });

    test('should parse newline-separated attributes', () => {
      const description =
        'Hair: medium, brown, straight\nEyes: brown, round\nWearing: white sneakers | blue shirt | black pants';
      const result = provider._parseCharacterDescription(description);

      expect(result).toEqual([
        '- **Hair**: medium, brown, straight',
        '- **Eyes**: brown, round',
        '- **Wearing**: white sneakers | blue shirt | black pants',
      ]);
    });

    test('should handle mixed content with key-value pairs and plain text', () => {
      const description = 'Hair: brown; A friendly person; Eyes: blue';
      const result = provider._parseCharacterDescription(description);

      expect(result).toEqual([
        '- **Hair**: brown',
        '- **Description**: A friendly person',
        '- **Eyes**: blue',
      ]);
    });

    test('should return single description item for unstructured text', () => {
      const description = 'A simple character description without structure';
      const result = provider._parseCharacterDescription(description);

      expect(result).toEqual([
        '- **Description**: A simple character description without structure',
      ]);
    });

    test('should capitalize first letter of attribute keys', () => {
      const description = 'hair: brown; eyes: blue';
      const result = provider._parseCharacterDescription(description);

      expect(result).toEqual(['- **Hair**: brown', '- **Eyes**: blue']);
    });

    test('should handle empty or invalid input gracefully', () => {
      expect(provider._parseCharacterDescription('')).toEqual([
        '- **Description**: ',
      ]);
      expect(provider._parseCharacterDescription('   ')).toEqual([
        '- **Description**:    ',
      ]);
    });
  });
});
