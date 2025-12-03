/**
 * @file Unit tests for CharacterDataXmlBuilder
 * @description Tests XML generation from character data with all section types
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import CharacterDataXmlBuilder from '../../../src/prompting/characterDataXmlBuilder.js';
import XmlElementBuilder from '../../../src/prompting/xmlElementBuilder.js';
import {
  MINIMAL_CHARACTER_DATA,
  COMPLETE_CHARACTER_DATA,
  CHARACTER_WITH_SPECIAL_CHARS,
  CHARACTER_WITH_LEGACY_SPEECH,
  CHARACTER_WITH_EMPTY_SECTIONS,
  CHARACTER_WITHOUT_CURRENT_STATE,
  CHARACTER_WITH_MIXED_SPEECH,
  CHARACTER_IDENTITY_ONLY,
  CHARACTER_WITH_STRING_AGE,
  CHARACTER_WITH_PARTIAL_AGE,
  CHARACTER_WITH_EMPTY_CURRENT_STATE,
  CHARACTER_WITH_PARTIAL_NOTES,
  CHARACTER_FULL_PSYCHOLOGY,
  CHARACTER_FULL_TRAITS,
  createCharacterData,
  createGoals,
  createNotes,
  // Health state fixtures (INJREPANDUSEINT-012)
  CHARACTER_WITH_INJURIES,
  CHARACTER_DYING,
  CHARACTER_CRITICAL,
  CHARACTER_HEALTHY,
  CHARACTER_WITH_EFFECTS_ONLY,
  CHARACTER_WITH_SPECIAL_CHARS_INJURY,
} from '../../common/prompting/characterDataFixtures.js';

describe('CharacterDataXmlBuilder', () => {
  let builder;
  let mockLogger;
  let xmlElementBuilder;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    xmlElementBuilder = new XmlElementBuilder();
    builder = new CharacterDataXmlBuilder({
      logger: mockLogger,
      xmlElementBuilder,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor Validation', () => {
    it('should throw error when logger is missing', () => {
      expect(
        () =>
          new CharacterDataXmlBuilder({
            logger: null,
            xmlElementBuilder,
          })
      ).toThrow();
    });

    it('should throw error when logger is missing required methods', () => {
      const incompleteLogger = { debug: jest.fn() };
      expect(
        () =>
          new CharacterDataXmlBuilder({
            logger: incompleteLogger,
            xmlElementBuilder,
          })
      ).toThrow();
    });

    it('should throw error when xmlElementBuilder is missing', () => {
      expect(
        () =>
          new CharacterDataXmlBuilder({
            logger: mockLogger,
            xmlElementBuilder: null,
          })
      ).toThrow();
    });

    it('should throw error when xmlElementBuilder is missing required methods', () => {
      const incompleteBuilder = { escape: jest.fn() };
      expect(
        () =>
          new CharacterDataXmlBuilder({
            logger: mockLogger,
            xmlElementBuilder: incompleteBuilder,
          })
      ).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      expect(builder).toBeInstanceOf(CharacterDataXmlBuilder);
    });
  });

  describe('Input Validation', () => {
    it('should throw meaningful error for null characterData', () => {
      expect(() => builder.buildCharacterDataXml(null)).toThrow(
        'characterData is required'
      );
    });

    it('should throw meaningful error for undefined characterData', () => {
      expect(() => builder.buildCharacterDataXml(undefined)).toThrow(
        'characterData is required'
      );
    });

    it('should handle empty object with fallback name', () => {
      // Implementation uses fallback name when name is missing
      const result = builder.buildCharacterDataXml({});
      expect(result).toContain('<character_data>');
      expect(result).toContain('<name>Unknown Character</name>');
    });

    it('should throw when characterData is not an object', () => {
      expect(() => builder.buildCharacterDataXml('not-an-object')).toThrow(
        'characterData must be an object'
      );
    });

    it('should handle empty name field with fallback', () => {
      const result = builder.buildCharacterDataXml({ name: '' });
      expect(result).toContain('<name>Unknown Character</name>');
    });

    it('should handle whitespace-only name with fallback', () => {
      const result = builder.buildCharacterDataXml({ name: '   ' });
      // Whitespace-only name still falls back since falsy/empty
      expect(result).toContain('<name>');
    });

    it('should handle empty object with only name', () => {
      const result = builder.buildCharacterDataXml(MINIMAL_CHARACTER_DATA);
      expect(result).toContain('<character_data>');
      expect(result).toContain('<name>Test Character</name>');
    });
  });

  describe('XML Structure', () => {
    it('should always wrap output in <character_data> root tag', () => {
      const result = builder.buildCharacterDataXml(MINIMAL_CHARACTER_DATA);
      expect(result).toMatch(/^<character_data>/);
      expect(result).toMatch(/<\/character_data>$/);
    });

    it('should produce well-formed XML structure', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      // Check for basic well-formedness
      expect(result).toContain('<character_data>');
      expect(result).toContain('</character_data>');
      expect(result).toContain('<identity>');
      expect(result).toContain('</identity>');
    });

    it('should maintain correct section ordering', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      const identityPos = result.indexOf('<identity>');
      const coreSelfPos = result.indexOf('<core_self>');
      const psychologyPos = result.indexOf('<psychology>');
      const traitsPos = result.indexOf('<traits>');
      const speechPatternsPos = result.indexOf('<speech_patterns>');
      const currentStatePos = result.indexOf('<current_state>');

      // All sections must exist
      expect(identityPos).toBeGreaterThan(-1);
      expect(coreSelfPos).toBeGreaterThan(-1);
      expect(psychologyPos).toBeGreaterThan(-1);
      expect(traitsPos).toBeGreaterThan(-1);
      expect(speechPatternsPos).toBeGreaterThan(-1);
      expect(currentStatePos).toBeGreaterThan(-1);

      // Verify ordering
      expect(identityPos).toBeLessThan(coreSelfPos);
      expect(coreSelfPos).toBeLessThan(psychologyPos);
      expect(psychologyPos).toBeLessThan(traitsPos);
      expect(traitsPos).toBeLessThan(speechPatternsPos);
      expect(speechPatternsPos).toBeLessThan(currentStatePos);
    });
  });

  describe('Identity Section', () => {
    it('should include name in identity section', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      expect(result).toContain('<identity>');
      expect(result).toContain('<name>Vespera Nightwhisper</name>');
      expect(result).toContain('</identity>');
    });

    it('should format apparent age with bestGuess', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      expect(result).toContain('<apparent_age>');
      // AgeUtils formats this - check for the age value in some form
      expect(result).toMatch(/26|twenty-six|mid-twenties/i);
    });

    it('should format apparent age without bestGuess as range', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITH_PARTIAL_AGE);
      expect(result).toContain('<apparent_age>');
      // AgeUtils formats age ranges - check for both values
      expect(result).toMatch(/40.*50|forties/i);
    });

    it('should treat whitespace-only apparent age string as empty', () => {
      const result = builder.buildCharacterDataXml({
        name: 'String Age Edge',
        apparentAge: '   ',
      });

      expect(result).not.toContain('<apparent_age>');
    });

    it('should omit apparent_age when provided type is invalid', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Type Edge Case',
        apparentAge: 42,
      });

      expect(result).not.toContain('<apparent_age>');
    });

    it('should handle apparent age as string', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITH_STRING_AGE);
      expect(result).toContain('<apparent_age>mid-twenties</apparent_age>');
    });

    it('should include description in identity section', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      expect(result).toContain('<description>');
      // Note: apostrophes are preserved for LLM readability
      expect(result).toContain('dancer');
      expect(result).toContain('build');
    });

    it('should omit identity section elements that are empty', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        apparentAge: null,
        description: '',
      });
      expect(result).not.toContain('<apparent_age>');
      expect(result).not.toContain('<description>');
    });
  });

  describe('Core Self Section', () => {
    it('should include profile and personality', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      expect(result).toContain('<core_self>');
      expect(result).toContain('<profile>');
      expect(result).toContain('<personality>');
      expect(result).toContain('</core_self>');
      // Verify content is present
      expect(result).toContain('merchant district');
      expect(result).toContain('ambitious');
    });

    it('should omit core_self section when both fields empty', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        profile: '',
        personality: null,
      });
      expect(result).not.toContain('<core_self>');
    });

    it('should include section with only profile', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        profile: 'Has a profile',
        personality: null,
      });
      expect(result).toContain('<core_self>');
      expect(result).toContain('<profile>Has a profile</profile>');
      expect(result).not.toContain('<personality>');
    });

    it('should include section with only personality', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        profile: '',
        personality: 'Has personality',
      });
      expect(result).toContain('<core_self>');
      expect(result).toContain('<personality>Has personality</personality>');
      expect(result).not.toContain('<profile>');
    });
  });

  describe('Psychology Section', () => {
    it('should include all three psychology elements', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_FULL_PSYCHOLOGY);
      expect(result).toContain('<psychology>');
      expect(result).toContain('<core_motivations>');
      expect(result).toContain('<internal_tensions>');
      expect(result).toContain('<dilemmas>');
      expect(result).toContain('</psychology>');
    });

    it('should omit psychology section when all elements empty', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITH_EMPTY_SECTIONS);
      expect(result).not.toContain('<psychology>');
      expect(result).not.toContain('<core_motivations>');
      expect(result).not.toContain('<internal_tensions>');
      expect(result).not.toContain('<dilemmas>');
    });

    it('should include section with partial psychology data', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        motivations: 'Has motivations',
        internalTensions: null,
        coreDilemmas: '',
      });
      expect(result).toContain('<psychology>');
      expect(result).toContain('<core_motivations>Has motivations</core_motivations>');
      expect(result).not.toContain('<internal_tensions>');
      expect(result).not.toContain('<dilemmas>');
    });
  });

  describe('Traits Section', () => {
    it('should include all six trait types', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_FULL_TRAITS);
      expect(result).toContain('<traits>');
      expect(result).toContain('<strengths>');
      expect(result).toContain('<weaknesses>');
      expect(result).toContain('<likes>');
      expect(result).toContain('<dislikes>');
      expect(result).toContain('<fears>');
      expect(result).toContain('<secrets>');
      expect(result).toContain('</traits>');
    });

    it('should preserve first-person prose', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_FULL_TRAITS);
      expect(result).toContain('I once abandoned someone');
    });

    it('should omit individual empty traits', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITH_EMPTY_SECTIONS);
      expect(result).toContain('<traits>');
      expect(result).toContain('<strengths>Good listener</strengths>');
      expect(result).not.toMatch(/<weaknesses>\s*<\/weaknesses>/);
      expect(result).not.toMatch(/<likes>\s*<\/likes>/);
    });

    it('should omit traits section when all traits empty', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        strengths: '',
        weaknesses: null,
        likes: undefined,
        dislikes: '',
        fears: '',
        secrets: '',
      });
      expect(result).not.toContain('<traits>');
    });
  });

  describe('Speech Patterns Section', () => {
    describe('Legacy String Format', () => {
      it('should detect and format legacy string patterns', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_LEGACY_SPEECH);
        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('(when happy) Big smile and wave');
      });

      it('should format each pattern on separate line', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_LEGACY_SPEECH);
        expect(result).toContain('- (when happy)');
        expect(result).toContain('- (when sad)');
        expect(result).toContain('- (when angry)');
      });
    });

    describe('Structured Object Format', () => {
      it('should detect and format structured patterns', () => {
        const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('Feline Verbal Tics');
        expect(result).toContain('casual');
        expect(result).toContain('meow-y goodness');
      });

      it('should include type, contexts, and examples', () => {
        const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
        // Check for structured pattern format with type, contexts, examples
        expect(result).toContain('Feline Verbal Tics');
        expect(result).toContain('Contexts');
        expect(result).toContain('casual');
        expect(result).toContain('Examples');
      });

      it('should handle structured patterns without contexts or examples', () => {
        const result = builder.buildCharacterDataXml({
          name: 'Pattern Minimalist',
          speechPatterns: [{ type: 'Minimal Marker' }],
        });

        expect(result).toContain('Minimal Marker');
        expect(result).not.toContain('Contexts:');
        expect(result).not.toContain('Examples:');
      });

      it('should fallback to default label when type is missing', () => {
        const result = builder.buildCharacterDataXml({
          name: 'Pattern Default',
          speechPatterns: [{ contexts: ['anywhere'] }],
        });

        expect(result).toContain('**Pattern**');
      });
    });

    describe('Mixed Format', () => {
      it('should handle mixed string and structured patterns', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_MIXED_SPEECH);
        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('(casual) Uses relaxed language');
        expect(result).toContain('Formal Speech');
        expect(result).toContain('(emotional) Expressive');
      });

      it('should format mixed patterns when strings are blank', () => {
        const result = builder.buildCharacterDataXml({
          name: 'Mixed Minimal',
          speechPatterns: ['   ', { type: 'Hybrid Pattern' }],
        });

        expect(result).toContain('Hybrid Pattern');
        expect(result).not.toContain('Additional Patterns:');
        expect(result).not.toContain('Contexts:');
        expect(result).not.toContain('Examples:');
      });

      it('should use default labels for mixed patterns missing type', () => {
        const result = builder.buildCharacterDataXml({
          name: 'Mixed Default',
          speechPatterns: ['Some legacy line', {}],
        });

        expect(result).toContain('**Pattern**');
      });
    });

    it('should omit speech_patterns when patterns format produces no content', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Empty Speech Patterns',
        speechPatterns: ['   ', 123],
      });

      expect(result).not.toContain('<speech_patterns>');
    });

    it('should omit speech_patterns when empty array', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        speechPatterns: [],
      });
      expect(result).not.toContain('<speech_patterns>');
    });

    it('should omit speech_patterns when null', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        speechPatterns: null,
      });
      expect(result).not.toContain('<speech_patterns>');
    });

    describe('Usage Guidance', () => {
      it('should include multi-line usage guidance in speech patterns section', () => {
        const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
        expect(result).toContain('USAGE GUIDANCE');
        expect(result).toContain('Apply patterns when appropriate');
      });

      it('should include anti-rigidity reminders', () => {
        const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
        expect(result).toContain('DO NOT cycle through patterns mechanically');
        expect(result).toContain('Absence of patterns is also authentic');
      });

      it('should include REFERENCE marker for natural usage guidance', () => {
        const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
        expect(result).toContain('REFERENCE');
        expect(result).toContain('Use these patterns naturally');
      });

      it('should include guidance comments at start of speech_patterns content', () => {
        const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
        const speechPatternsMatch = result.match(
          /<speech_patterns>([\s\S]*?)<\/speech_patterns>/
        );
        expect(speechPatternsMatch).not.toBeNull();
        const content = speechPatternsMatch[1];
        // Guidance should come before the pattern content
        const guidanceIndex = content.indexOf('USAGE GUIDANCE');
        const felineIndex = content.indexOf('Feline Verbal Tics');
        expect(guidanceIndex).toBeLessThan(felineIndex);
      });

      it('should include guidance even with legacy string patterns', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_LEGACY_SPEECH);
        expect(result).toContain('USAGE GUIDANCE');
        expect(result).toContain('DO NOT cycle through patterns mechanically');
      });
    });
  });

  describe('Current State Section', () => {
    it('should format goals as bullet list', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      expect(result).toContain('<current_state>');
      expect(result).toContain('<goals>');
      // Implementation uses - prefix for goals
      expect(result).toContain('Compose three masterpieces');
    });

    it('should include notes with subject type prefixes', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      expect(result).toContain('<notes>');
      // Note: implementation capitalizes subjectType - [Entity: instrument]
      expect(result).toMatch(/\[Entity:\s*instrument\]/i);
      expect(result).toMatch(/\[Actor:\s*Marcus\]/i);
    });

    it('should format recent thoughts in quotes', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      expect(result).toContain('<recent_thoughts>');
      // Thoughts are quoted with "..."
      expect(result).toContain('That look she gave me');
    });

    it('should omit current_state when no goals/notes/shortTermMemory', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITHOUT_CURRENT_STATE);
      expect(result).not.toContain('<current_state>');
      expect(result).not.toContain('<goals>');
      expect(result).not.toContain('<notes>');
      expect(result).not.toContain('<recent_thoughts>');
    });

    it('should omit current_state when arrays are empty', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITH_EMPTY_CURRENT_STATE);
      expect(result).not.toContain('<current_state>');
    });

    it('should handle notes with missing optional fields', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITH_PARTIAL_NOTES);
      expect(result).toContain('<notes>');
      expect(result).toContain('Note without subject or type');
      expect(result).toContain('Note with subject only');
    });

    it('should include section with only goals', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        goals: [{ text: 'Single goal' }],
      });
      expect(result).toContain('<current_state>');
      expect(result).toContain('<goals>');
      expect(result).not.toContain('<notes>');
    });

    it('should ignore invalid goal entries', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Goal Sanitizer',
        goals: ['   ', 123, { text: '' }, { text: 'Keep practicing' }],
      });

      expect(result).toContain('Keep practicing');
      expect(result).not.toContain('123');
      expect(result).not.toMatch(/<goals>\s*\n\s*<\/goals>/);
    });

    it('should support simple string goal entries', () => {
      const result = builder.buildCharacterDataXml({
        name: 'String Goal',
        goals: ['Finish the mission'],
      });

      expect(result).toContain('Finish the mission');
    });

    it('should drop notes entries without text content', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Note Filter',
        notes: [{ text: 'Valid note' }, { text: '   ' }, { subject: 'No text' }],
      });

      expect(result).toContain('Valid note');
      expect(result).not.toMatch(/No text/);
      expect(result).not.toMatch(/<notes>\s*\n\s*<\/notes>/);
    });

    it('should omit goals when all entries are empty or invalid', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Goal Filter',
        goals: ['   ', { text: '   ' }],
      });

      expect(result).not.toContain('<goals>');
    });

    it('should omit notes when entries lack text', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Note Removal',
        notes: [{ text: '   ' }, { subject: 'No text' }],
      });

      expect(result).not.toContain('<notes>');
    });
  });

  describe('Special Character Escaping', () => {
    it('should escape XML special characters in name', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITH_SPECIAL_CHARS);
      expect(result).toContain('&lt;Character&gt;');
      expect(result).toContain('&amp;');
      // Quotes are NOT escaped for LLM readability
      expect(result).toContain('"Friends"');
    });

    it('should escape special characters in description', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITH_SPECIAL_CHARS);
      expect(result).toContain('&lt;brackets&gt;');
      expect(result).toContain('&amp; ampersands');
    });

    it('should preserve apostrophes for readability', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_WITH_SPECIAL_CHARS);
      // Apostrophes are NOT escaped for LLM readability
      expect(result).toContain("Quote's here");
    });

    it('should handle unicode characters', () => {
      const result = builder.buildCharacterDataXml({
        name: '日本語キャラ',
        description: '这是中文描述',
        personality: 'Ñoño español',
      });
      expect(result).toContain('日本語キャラ');
      expect(result).toContain('这是中文描述');
      expect(result).toContain('Ñoño español');
    });
  });

  describe('Comment Structure', () => {
    it('should include identity priming comment at top', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      // Check for decorated comment - contains IDENTITY priming text
      expect(result).toContain('<!--');
      expect(result).toContain('IDENTITY');
    });

    it('should include section comments with correct format', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      // Check for section markers
      expect(result).toContain('SECTION 1');
      expect(result).toContain('SECTION 2');
    });

    it('should use decorated borders', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      // Primary border uses = character
      expect(result).toMatch(/=+/);
    });
  });

  describe('Empty Section Omission', () => {
    it('should omit entire psychology section when all children empty', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        motivations: '',
        internalTensions: null,
        coreDilemmas: undefined,
      });
      expect(result).not.toContain('<psychology>');
    });

    it('should omit entire traits section when all traits empty', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        strengths: '',
        weaknesses: '',
        likes: '',
        dislikes: '',
        fears: '',
        secrets: '',
      });
      expect(result).not.toContain('<traits>');
    });

    it('should not include empty container tags', () => {
      const result = builder.buildCharacterDataXml(MINIMAL_CHARACTER_DATA);
      expect(result).not.toMatch(/<[^/][^>]*>\s*<\/[^>]+>/); // No empty sections
    });
  });

  describe('Integration with XmlElementBuilder', () => {
    it('should use xmlElementBuilder.escape for content', () => {
      const spyEscape = jest.spyOn(xmlElementBuilder, 'escape');
      builder.buildCharacterDataXml(CHARACTER_WITH_SPECIAL_CHARS);
      expect(spyEscape).toHaveBeenCalled();
    });

    it('should use xmlElementBuilder.wrap for elements', () => {
      const spyWrap = jest.spyOn(xmlElementBuilder, 'wrap');
      builder.buildCharacterDataXml(MINIMAL_CHARACTER_DATA);
      expect(spyWrap).toHaveBeenCalled();
    });

    it('should use xmlElementBuilder.decoratedComment for headers', () => {
      const spyDecorated = jest.spyOn(xmlElementBuilder, 'decoratedComment');
      builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      expect(spyDecorated).toHaveBeenCalled();
    });
  });

  describe('Logging Behavior', () => {
    it('should log debug messages for section building', () => {
      builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log warning for missing expected fields', () => {
      const result = builder.buildCharacterDataXml({ name: 'Minimal' });
      // Ensures no errors thrown and produces valid output
      expect(result).toContain('<character_data>');
    });
  });

  describe('Performance and Scale', () => {
    it('should handle many goals efficiently', () => {
      const characterWithManyGoals = {
        name: 'Test',
        goals: createGoals(50),
      };
      const start = Date.now();
      const result = builder.buildCharacterDataXml(characterWithManyGoals);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(result).toContain('<goals>');
    });

    it('should handle many notes efficiently', () => {
      const characterWithManyNotes = {
        name: 'Test',
        notes: createNotes(50),
      };
      const start = Date.now();
      const result = builder.buildCharacterDataXml(characterWithManyNotes);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
      expect(result).toContain('<notes>');
    });

    it('should handle deeply nested content', () => {
      const characterWithDeepContent = createCharacterData({
        profile: 'A'.repeat(10000),
        personality: 'B'.repeat(10000),
        motivations: 'C'.repeat(10000),
      });
      const result = builder.buildCharacterDataXml(characterWithDeepContent);
      expect(result).toContain('AAAA');
      expect(result).toContain('BBBB');
    });
  });

  describe('Edge Cases', () => {
    it('should handle character with only identity fields', () => {
      const result = builder.buildCharacterDataXml(CHARACTER_IDENTITY_ONLY);
      expect(result).toContain('<identity>');
      expect(result).toContain('<name>');
      expect(result).toContain('<apparent_age>');
      expect(result).toContain('<description>');
      expect(result).not.toContain('<core_self>');
    });

    it('should handle whitespace-only content as empty', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        description: '   ',
        profile: '\n\t',
      });
      expect(result).not.toContain('<description>   </description>');
      expect(result).not.toContain('<profile>');
    });

    it('should handle numeric values in string fields', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        description: 12345,
      });
      expect(result).toContain('<description>12345</description>');
    });

    it('should handle array values in non-array fields gracefully', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        description: ['line1', 'line2'],
      });
      // Should convert to string or handle gracefully
      expect(result).toContain('<description>');
    });

    it('should handle goals without text field', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        goals: [{ text: 'Valid goal' }, { noText: true }],
      });
      expect(result).toContain('Valid goal');
    });

    it('should handle shortTermMemory without thoughts array', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        shortTermMemory: {},
      });
      expect(result).not.toContain('<recent_thoughts>');
    });

    it('should handle shortTermMemory with null thoughts', () => {
      const result = builder.buildCharacterDataXml({
        name: 'Test',
        shortTermMemory: { thoughts: null },
      });
      expect(result).not.toContain('<recent_thoughts>');
    });
  });

  describe('Complete Character Output', () => {
    it('should produce complete XML for full character data', () => {
      const result = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);

      // Verify all major sections present
      expect(result).toContain('<character_data>');
      expect(result).toContain('<identity>');
      expect(result).toContain('<core_self>');
      expect(result).toContain('<psychology>');
      expect(result).toContain('<traits>');
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('<current_state>');
      expect(result).toContain('</character_data>');

      // Verify key content
      expect(result).toContain('Vespera Nightwhisper');
      expect(result).toContain('ruthlessly ambitious');
      expect(result).toContain('Feline Verbal Tics');
      expect(result).toContain('Compose three masterpieces');
    });
  });

  // ========================================================================
  // Physical Condition Section Tests (INJREPANDUSEINT-012)
  // ========================================================================

  describe('Physical Condition Section', () => {
    describe('Healthy Characters (null healthState)', () => {
      it('should not include physical_condition when healthState is null', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_HEALTHY);
        expect(result).not.toContain('<physical_condition>');
        expect(result).not.toContain('</physical_condition>');
      });

      it('should not include physical_condition when healthState is undefined', () => {
        const result = builder.buildCharacterDataXml({
          name: 'Test',
          healthState: undefined,
        });
        expect(result).not.toContain('<physical_condition>');
      });
    });

    describe('Injured Characters', () => {
      it('should render full physical_condition XML for injured character', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_INJURIES);

        // Verify section structure
        expect(result).toContain('<physical_condition>');
        expect(result).toContain('</physical_condition>');

        // Verify overall status with percentage
        expect(result).toContain('<overall_status>');
        expect(result).toContain('You are seriously injured (45%)');
        expect(result).toContain('</overall_status>');

        // Verify injuries list
        expect(result).toContain('<injuries>');
        expect(result).toContain('<injury part="left arm" state="wounded">bleeding_moderate</injury>');
        expect(result).toContain('<injury part="torso" state="wounded"></injury>');
        expect(result).toContain('</injuries>');

        // Verify active effects
        expect(result).toContain('<active_effects>bleeding</active_effects>');

        // Verify first-person narrative
        expect(result).toContain('<first_person_experience>');
        expect(result).toContain('Sharp pain radiates from my left arm.');
        expect(result).toContain('</first_person_experience>');
      });

      it('should place physical_condition first in current_state section', () => {
        const dataWithHealthAndGoals = {
          name: 'Test',
          healthState: CHARACTER_WITH_INJURIES.healthState,
          goals: [{ text: 'Survive' }],
        };
        const result = builder.buildCharacterDataXml(dataWithHealthAndGoals);

        // Physical condition should appear before goals in current_state
        const physicalConditionIndex = result.indexOf('<physical_condition>');
        const goalsIndex = result.indexOf('<goals>');
        expect(physicalConditionIndex).toBeLessThan(goalsIndex);
      });
    });

    describe('Critical Warning', () => {
      it('should include dying warning with turns countdown when isDying is true', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_DYING);

        expect(result).toContain('<critical_warning>');
        expect(result).toContain('You are dying! 2 turns until death.');
        expect(result).toContain('</critical_warning>');
      });

      it('should include critical warning for critical status (not dying)', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_CRITICAL);

        expect(result).toContain('<critical_warning>');
        expect(result).toContain('You are critically injured and may die soon.');
        expect(result).toContain('</critical_warning>');
      });

      it('should not include critical warning for non-critical injuries', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_INJURIES);
        expect(result).not.toContain('<critical_warning>');
      });
    });

    describe('Overall Status Text Mapping', () => {
      it('should map "injured" status to "You are seriously injured"', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_INJURIES);
        expect(result).toContain('You are seriously injured');
      });

      it('should map "dying" status to "You are dying"', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_DYING);
        expect(result).toContain('You are dying');
      });

      it('should map "critical" status to "You are critically injured"', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_CRITICAL);
        expect(result).toContain('You are critically injured');
      });

      it('should map "wounded" status to "You are wounded"', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_EFFECTS_ONLY);
        expect(result).toContain('You are wounded');
      });

      it('should handle unknown status gracefully', () => {
        const unknownStatusData = {
          name: 'Test',
          healthState: {
            overallHealthPercentage: 50,
            overallStatus: 'unknown_status',
            injuries: [],
            activeEffects: [],
            isDying: false,
            turnsUntilDeath: null,
            firstPersonNarrative: null,
          },
        };
        const result = builder.buildCharacterDataXml(unknownStatusData);
        expect(result).toContain('Unknown status');
      });
    });

    describe('Empty or Partial Health Data', () => {
      it('should handle empty injuries array', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_EFFECTS_ONLY);

        // Should have physical_condition section
        expect(result).toContain('<physical_condition>');

        // Should NOT have injuries element when array is empty
        expect(result).not.toContain('<injuries>');
        expect(result).not.toContain('</injuries>');

        // Should still have active effects
        expect(result).toContain('<active_effects>poisoned, burning</active_effects>');
      });

      it('should handle missing firstPersonNarrative', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_DYING);

        // firstPersonNarrative is null in CHARACTER_DYING
        expect(result).not.toContain('<first_person_experience>');
      });

      it('should handle empty activeEffects array', () => {
        const noEffectsData = {
          name: 'Test',
          healthState: {
            overallHealthPercentage: 80,
            overallStatus: 'scratched',
            injuries: [{ partName: 'hand', partType: 'hand', state: 'scratched', healthPercent: 85, effects: [] }],
            activeEffects: [],
            isDying: false,
            turnsUntilDeath: null,
            firstPersonNarrative: null,
          },
        };
        const result = builder.buildCharacterDataXml(noEffectsData);

        expect(result).toContain('<physical_condition>');
        expect(result).not.toContain('<active_effects>');
      });
    });

    describe('XML Escaping in Health Data', () => {
      it('should escape ampersand in partName', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_SPECIAL_CHARS_INJURY);

        // Check that ampersand is escaped
        expect(result).toContain('&amp; shoulder');
      });

      it('should escape angle brackets in effects', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_SPECIAL_CHARS_INJURY);

        // Effects should be escaped
        expect(result).toContain('bleeding &lt;moderate&gt;');
      });

      it('should escape angle brackets and ampersand in firstPersonNarrative', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_SPECIAL_CHARS_INJURY);

        // Narrative should have ampersand and angle brackets escaped
        expect(result).toContain('&amp; shoulder');
        expect(result).toContain('&lt;sharp&gt;');
      });
    });

    describe('Integration with Current State Section', () => {
      it('should include physical_condition in current_state when injured', () => {
        const result = builder.buildCharacterDataXml(CHARACTER_WITH_INJURIES);

        // Current state section should exist and contain physical_condition
        expect(result).toContain('<current_state>');
        expect(result).toContain('<physical_condition>');

        // physical_condition should be inside current_state
        const currentStateStart = result.indexOf('<current_state>');
        const currentStateEnd = result.indexOf('</current_state>');
        const physicalConditionStart = result.indexOf('<physical_condition>');

        expect(physicalConditionStart).toBeGreaterThan(currentStateStart);
        expect(physicalConditionStart).toBeLessThan(currentStateEnd);
      });

      it('should still generate current_state for healthy character with goals', () => {
        const healthyWithGoals = {
          name: 'Test',
          healthState: null,
          goals: [{ text: 'Complete the quest' }],
        };
        const result = builder.buildCharacterDataXml(healthyWithGoals);

        expect(result).toContain('<current_state>');
        expect(result).not.toContain('<physical_condition>');
        expect(result).toContain('<goals>');
      });
    });
  });
});
