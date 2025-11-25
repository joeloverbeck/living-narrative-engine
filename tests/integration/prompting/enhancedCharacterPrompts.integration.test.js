/**
 * @file Integration tests for enhanced character prompts with psychological components
 * @description Tests the complete flow from data extraction through prompt generation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { ActorDataExtractor } from '../../../src/turns/services/actorDataExtractor.js';
import { CharacterDataFormatter } from '../../../src/prompting/CharacterDataFormatter.js';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  MOTIVATIONS_COMPONENT_ID,
  INTERNAL_TENSIONS_COMPONENT_ID,
  DILEMMAS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Enhanced Character Prompts Integration', () => {
  let testBed;
  let extractor;
  let formatter;
  let promptProvider;
  let mockLogger;

  beforeAll(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    mockLogger = testBed.mockLogger;

    // Initialize services with dependencies from the container
    const anatomyDescriptionService = {
      generateBodyDescription: jest.fn().mockReturnValue(''),
      generateDetailedDescription: jest.fn().mockReturnValue(''),
    };
    
    const entityFinder = {
      findEntity: jest.fn(),
      findEntitiesByComponentType: jest.fn().mockReturnValue([]),
    };

    extractor = new ActorDataExtractor({
      anatomyDescriptionService,
      entityFinder,
    });

    formatter = new CharacterDataFormatter({
      logger: mockLogger,
    });

    // Mock the prompt static content service for testing
    const promptStaticContentService = {
      getCoreTaskDescriptionText: jest.fn().mockReturnValue('TASK'),
      getCharacterPortrayalGuidelines: jest.fn().mockReturnValue('GUIDE'),
      getNc21ContentPolicyText: jest.fn().mockReturnValue('POLICY'),
      getFinalLlmInstructionText: jest.fn().mockReturnValue('FINAL'),
    };

    const characterDataXmlBuilder = {
      buildCharacterDataXml: jest.fn((actorPromptData) => {
        const name = actorPromptData?.name || 'Unknown';
        // Build XML with all psychological components for testing
        let xml = `<character_data>\n<identity>\nYOU ARE ${name}.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.\n</identity>`;
        if (actorPromptData?.description) {
          xml += `\n<description>\n## Your Description\n${typeof actorPromptData.description === 'string' ? actorPromptData.description : 'A complex individual'}\n</description>`;
        }
        if (actorPromptData?.personality) {
          xml += `\n<personality>\n## Your Personality\n${actorPromptData.personality}\n</personality>`;
        }
        if (actorPromptData?.profile) {
          xml += `\n<profile>\n## Your Profile\n${actorPromptData.profile}\n</profile>`;
        }
        if (actorPromptData?.motivations) {
          xml += `\n<motivations>\n## Your Core Motivations\n${actorPromptData.motivations}\n</motivations>`;
        }
        if (actorPromptData?.internalTensions) {
          xml += `\n<internal_tensions>\n## Your Internal Tensions\n${actorPromptData.internalTensions}\n</internal_tensions>`;
        }
        if (actorPromptData?.coreDilemmas) {
          xml += `\n<dilemmas>\n## Your Core Dilemmas\n${actorPromptData.coreDilemmas}\n</dilemmas>`;
        }
        if (actorPromptData?.likes) {
          xml += `\n<likes>\n## Your Likes\n${actorPromptData.likes}\n</likes>`;
        }
        if (actorPromptData?.dislikes) {
          xml += `\n<dislikes>\n## Your Dislikes\n${actorPromptData.dislikes}\n</dislikes>`;
        }
        xml += '\n</character_data>';
        return xml;
      }),
    };

    promptProvider = new AIPromptContentProvider({
      logger: mockLogger,
      promptStaticContentService,
      characterDataXmlBuilder,
      perceptionLogFormatter: { format: jest.fn().mockReturnValue([]) },
      gameStateValidationService: {
        validate: jest.fn().mockReturnValue({ isValid: true, errorContent: null }),
      },
      actionCategorizationService: {
        extractNamespace: jest.fn((actionId) => actionId.split(':')[0] || 'unknown'),
        shouldUseGrouping: jest.fn(() => false),
        groupActionsByNamespace: jest.fn(() => new Map()),
        getSortedNamespaces: jest.fn(() => []),
        formatNamespaceDisplayName: jest.fn((namespace) => namespace.toUpperCase()),
      },
    });
  });

  afterAll(() => {
    testBed.cleanup();
  });

  describe('End-to-End Prompt Generation', () => {
    it('should generate complete prompt with all psychological components', () => {
      // Arrange
      const actorState = {
        'core:name': { text: 'Complete Character' },
        'core:description': { text: 'A complex individual' },
        'core:personality': { text: 'Thoughtful and introspective' },
        'core:profile': { text: 'Years of experience have shaped me' },
        'core:motivations': {
          text: 'I seek to understand the nature of existence itself.',
        },
        'core:internal_tensions': {
          text: 'I crave certainty but know that doubt drives discovery.',
        },
        'core:dilemmas': {
          text: 'Can truth exist without consciousness to perceive it?',
        },
        'core:likes': { text: 'Philosophy and quiet contemplation' },
        'core:dislikes': { text: 'Shallow conversations' },
      };

      // Act
      const extractedData = extractor.extractPromptData(actorState);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert - verify extracted data has correct keys
      expect(extractedData.name).toBe('Complete Character');
      expect(extractedData.motivations).toBe('I seek to understand the nature of existence itself.');
      expect(extractedData.internalTensions).toBe('I crave certainty but know that doubt drives discovery.');
      expect(extractedData.coreDilemmas).toBe('Can truth exist without consciousness to perceive it?');

      // Assert - verify formatted persona contains all sections
      expect(formattedPersona).toContain('YOU ARE Complete Character');
      expect(formattedPersona).toContain('## Your Description');
      expect(formattedPersona).toContain('A complex individual');
      expect(formattedPersona).toContain('## Your Core Motivations');
      expect(formattedPersona).toContain('I seek to understand the nature of existence itself.');
      expect(formattedPersona).toContain('## Your Internal Tensions');
      expect(formattedPersona).toContain('I crave certainty but know that doubt drives discovery.');
      expect(formattedPersona).toContain('## Your Core Dilemmas');
      expect(formattedPersona).toContain('Can truth exist without consciousness to perceive it?');

      // Verify section order
      const descIndex = formattedPersona.indexOf('## Your Description');
      const profileIndex = formattedPersona.indexOf('## Your Profile');
      const motivIndex = formattedPersona.indexOf('## Your Core Motivations');
      const tensionsIndex = formattedPersona.indexOf('## Your Internal Tensions');
      const dilemmasIndex = formattedPersona.indexOf('## Your Core Dilemmas');
      const likesIndex = formattedPersona.indexOf('## Your Likes');

      expect(profileIndex).toBeGreaterThan(descIndex);
      expect(motivIndex).toBeGreaterThan(profileIndex);
      expect(tensionsIndex).toBeGreaterThan(motivIndex);
      expect(dilemmasIndex).toBeGreaterThan(tensionsIndex);
      expect(likesIndex).toBeGreaterThan(dilemmasIndex);
    });

    it('should handle partial psychological components in prompt', () => {
      // Arrange
      const partialActor = {
        'core:name': { text: 'Partial Character' },
        'core:description': { text: 'A simpler character' },
        'core:motivations': {
          text: 'I just want to survive another day.',
        },
        // No internal tensions
        'core:dilemmas': {
          text: 'Is survival enough?',
        },
      };

      // Act
      const extractedData = extractor.extractPromptData(partialActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain('## Your Core Motivations');
      expect(formattedPersona).not.toContain('## Your Internal Tensions');
      expect(formattedPersona).toContain('## Your Core Dilemmas');
      expect(formattedPersona).toContain('I just want to survive another day.');
      expect(formattedPersona).toContain('Is survival enough?');
    });

    it('should maintain backward compatibility for legacy characters', () => {
      // Arrange
      const legacyActor = {
        'core:name': { text: 'Legacy Character' },
        'core:description': { text: 'An old-style character' },
        'core:personality': { text: 'Traditional traits' },
        'core:profile': { text: 'Standard background' },
        'core:likes': { text: 'Simple pleasures' },
        'core:dislikes': { text: 'Complications' },
      };

      // Act
      const extractedData = extractor.extractPromptData(legacyActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain('YOU ARE Legacy Character');
      expect(formattedPersona).toContain('## Your Description');
      expect(formattedPersona).toContain('## Your Personality');
      expect(formattedPersona).not.toContain('## Your Core Motivations');
      expect(formattedPersona).not.toContain('## Your Internal Tensions');
      expect(formattedPersona).not.toContain('## Your Core Dilemmas');

      // Should still be valid prompt
      expect(formattedPersona.length).toBeGreaterThan(100);
      expect(formattedPersona.split('##').length).toBeGreaterThan(3);
    });

    it('should generate prompt through AIPromptContentProvider', () => {
      // Arrange
      const gameState = {
        actorPromptData: {
          name: 'AI Test Character',
          description: 'Test description',
          personality: 'Test personality',
          motivations: 'I am driven by curiosity.',
          internalTensions: 'I struggle between safety and exploration.',
          coreDilemmas: 'Should I take the risk?',
        },
        actorState: { components: {} },
      };

      // Act
      const result = promptProvider.getCharacterPersonaContent(gameState);

      // Assert
      expect(result).toContain('YOU ARE AI Test Character');
      expect(result).toContain('## Your Core Motivations\nI am driven by curiosity.');
      expect(result).toContain('## Your Internal Tensions\nI struggle between safety and exploration.');
      expect(result).toContain('## Your Core Dilemmas\nShould I take the risk?');
    });
  });

  describe('Data Flow Validation', () => {
    it('should preserve text formatting through entire pipeline', () => {
      // Arrange
      const formattedActor = {
        'core:name': { text: 'Formatted Character' },
        'core:motivations': {
          text: '**Bold** motivations with _italic_ emphasis and\n- bullet points\n- for clarity',
        },
        'core:internal_tensions': {
          text: 'Tensions with "quotes" and special chars: & < >',
        },
        'core:dilemmas': {
          text: 'Questions? More questions? Even more questions???',
        },
      };

      // Act
      const extractedData = extractor.extractPromptData(formattedActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain('**Bold**');
      expect(formattedPersona).toContain('_italic_');
      expect(formattedPersona).toContain('- bullet points');
      expect(formattedPersona).toContain('"quotes"');
      expect(formattedPersona).toContain('&');
      expect(formattedPersona).toContain('???');
    });

    it('should handle very long component text', () => {
      // Arrange
      const longText = 'This is a very long motivation. '.repeat(100);
      const longActor = {
        'core:name': { text: 'Long Character' },
        'core:motivations': { text: longText },
      };

      // Act
      const extractedData = extractor.extractPromptData(longActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain(longText.trim());
      expect(formattedPersona.length).toBeGreaterThan(3000);
    });

    it('should handle multiline text in psychological components', () => {
      // Arrange
      const multilineActor = {
        'core:name': { text: 'Multiline Character' },
        'core:motivations': {
          text: `First line of motivation.
Second line of motivation.
Third line of motivation.`,
        },
        'core:internal_tensions': {
          text: `Tension point one.
Tension point two.
Tension point three.`,
        },
        'core:dilemmas': {
          text: `Question one?
Question two?
Question three?`,
        },
      };

      // Act
      const extractedData = extractor.extractPromptData(multilineActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain('First line of motivation.');
      expect(formattedPersona).toContain('Second line of motivation.');
      expect(formattedPersona).toContain('Third line of motivation.');
      expect(formattedPersona).toContain('Tension point one.');
      expect(formattedPersona).toContain('Question one?');
    });

    it('should handle unicode and emoji in psychological components', () => {
      // Arrange
      const unicodeActor = {
        'core:name': { text: 'Unicode Character' },
        'core:motivations': {
          text: 'I seek enlightenment 🧘‍♂️ and wisdom 📚',
        },
        'core:internal_tensions': {
          text: 'Torn between East → West, traditional ⇄ modern',
        },
        'core:dilemmas': {
          text: '¿Should I embrace change? ¡Perhaps!',
        },
      };

      // Act
      const extractedData = extractor.extractPromptData(unicodeActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain('🧘‍♂️');
      expect(formattedPersona).toContain('📚');
      expect(formattedPersona).toContain('→');
      expect(formattedPersona).toContain('⇄');
      expect(formattedPersona).toContain('¿');
      expect(formattedPersona).toContain('¡');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed component data gracefully', () => {
      // Arrange
      const malformedActor = {
        'core:name': { text: 'Malformed Character' },
        'core:motivations': null,
        'core:internal_tensions': {},
        'core:dilemmas': { text: null },
      };

      // Act & Assert
      expect(() => {
        const extractedData = extractor.extractPromptData(malformedActor);
        const formattedPersona = formatter.formatCharacterPersona(extractedData);
        expect(formattedPersona).toBeDefined();
        expect(formattedPersona).not.toContain('## Your Core Motivations');
        expect(formattedPersona).not.toContain('## Your Internal Tensions');
        expect(formattedPersona).not.toContain('## Your Core Dilemmas');
      }).not.toThrow();
    });

    it('should handle missing psychological components gracefully', () => {
      // Arrange
      const minimalActor = {
        'core:name': { text: 'Minimal Character' },
        'core:description': { text: 'Just a description' },
      };

      // Act
      const extractedData = extractor.extractPromptData(minimalActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toBeDefined();
      expect(formattedPersona).toContain('YOU ARE Minimal Character');
      expect(formattedPersona).toContain('## Your Description');
      expect(formattedPersona).not.toContain('## Your Core Motivations');
      expect(formattedPersona).not.toContain('## Your Internal Tensions');
      expect(formattedPersona).not.toContain('## Your Core Dilemmas');
    });

    it('should handle empty text values in psychological components', () => {
      // Arrange
      const emptyTextActor = {
        'core:name': { text: 'Empty Text Character' },
        'core:motivations': { text: '' },
        'core:internal_tensions': { text: '   ' }, // Only whitespace
        'core:dilemmas': { text: '\n\n' }, // Only newlines
      };

      // Act
      const extractedData = extractor.extractPromptData(emptyTextActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toBeDefined();
      expect(formattedPersona).not.toContain('## Your Core Motivations');
      expect(formattedPersona).not.toContain('## Your Internal Tensions');
      expect(formattedPersona).not.toContain('## Your Core Dilemmas');
    });
  });

  describe('Complex Character Scenarios', () => {
    it('should handle character with all components including psychological ones', () => {
      // Arrange
      const complexCharacter = {
        'core:name': { text: 'Complex Character' },
        'core:description': { text: 'A fully-realized individual' },
        'core:personality': { text: 'Multi-faceted personality' },
        'core:profile': { text: 'Rich backstory' },
        'core:motivations': { text: 'Deep psychological drivers' },
        'core:internal_tensions': { text: 'Inner conflicts' },
        'core:dilemmas': { text: 'Philosophical questions?' },
        'core:likes': { text: 'Many interests' },
        'core:dislikes': { text: 'Several aversions' },
        'core:secrets': { text: 'Hidden truths' },
        'core:fears': { text: 'Deep-seated anxieties' },
        'core:strengths': { text: 'Key abilities' },
        'core:weaknesses': { text: 'Notable limitations' },
      };

      // Act
      const extractedData = extractor.extractPromptData(complexCharacter);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert - verify all sections are present
      const expectedSections = [
        '## Your Description',
        '## Your Personality',
        '## Your Profile',
        '## Your Core Motivations',
        '## Your Internal Tensions',
        '## Your Core Dilemmas',
        '## Your Likes',
        '## Your Dislikes',
        '## Your Secrets',
        '## Your Fears',
        '## Your Strengths',
        '## Your Weaknesses',
      ];

      expectedSections.forEach(section => {
        expect(formattedPersona).toContain(section);
      });
    });

    it('should generate consistent prompts for the same character data', () => {
      // Arrange
      const characterData = {
        'core:name': { text: 'Consistent Character' },
        'core:motivations': { text: 'Same motivation' },
        'core:internal_tensions': { text: 'Same tension' },
        'core:dilemmas': { text: 'Same question?' },
      };

      // Act - generate prompt multiple times
      const prompt1 = formatter.formatCharacterPersona(
        extractor.extractPromptData(characterData)
      );
      const prompt2 = formatter.formatCharacterPersona(
        extractor.extractPromptData(characterData)
      );
      const prompt3 = formatter.formatCharacterPersona(
        extractor.extractPromptData(characterData)
      );

      // Assert - all prompts should be identical
      expect(prompt1).toBe(prompt2);
      expect(prompt2).toBe(prompt3);
    });
  });
});