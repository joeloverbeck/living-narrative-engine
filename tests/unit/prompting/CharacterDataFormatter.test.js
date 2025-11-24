/**
 * @file Unit tests for CharacterDataFormatter
 * @description Tests all character data formatting methods and edge cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CharacterDataFormatter } from '../../../src/prompting/CharacterDataFormatter.js';

describe('CharacterDataFormatter', () => {
  let formatter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    formatter = new CharacterDataFormatter({ logger: mockLogger });
  });

  describe('formatPhysicalDescription', () => {
    it('should format object-based description with markdown headers', () => {
      const characterData = {
        description: {
          hair: 'long, blonde, wavy',
          eyes: 'amber, almond',
          wearing: 'black dress',
        },
      };

      const result = formatter.formatPhysicalDescription(characterData);

      expect(result).toContain('## Your Description');
      expect(result).toContain('**Hair**: long, blonde, wavy');
      expect(result).toContain('**Eyes**: amber, almond');
      expect(result).toContain('**Wearing**: black dress');
    });

    it('should parse structured text-based description', () => {
      const characterData = {
        description:
          'Hair: long, blonde, wavy; Eyes: amber, almond; Wearing: black dress',
      };

      const result = formatter.formatPhysicalDescription(characterData);

      expect(result).toContain('## Your Description');
      expect(result).toContain('**Hair**: long, blonde, wavy');
      expect(result).toContain('**Eyes**: amber, almond');
      expect(result).toContain('**Wearing**: black dress');
    });

    it('should handle unstructured description text as fallback', () => {
      const characterData = {
        description: 'A tall person with distinctive features',
      };

      const result = formatter.formatPhysicalDescription(characterData);

      expect(result).toContain('## Your Description');
      expect(result).toContain(
        '**Description**: A tall person with distinctive features'
      );
    });

    it('should return empty string for missing description', () => {
      const result = formatter.formatPhysicalDescription({});
      expect(result).toBe('');
    });

    it('should handle newline-separated attributes', () => {
      const characterData = {
        description: 'Hair: blonde\nEyes: blue\nHeight: tall',
      };

      const result = formatter.formatPhysicalDescription(characterData);

      expect(result).toContain('**Hair**: blonde');
      expect(result).toContain('**Eyes**: blue');
      expect(result).toContain('**Height**: tall');
    });

    describe('apparent age formatting', () => {
      it('should display apparent age first when present with bestGuess', () => {
        const characterData = {
          description: 'Hair: blonde; Eyes: blue',
          apparentAge: {
            minAge: 25,
            maxAge: 30,
            bestGuess: 28,
          },
        };

        const result = formatter.formatPhysicalDescription(characterData);

        expect(result).toBe(
          '## Your Description\n' +
            '**Apparent age**: around 28 years old\n\n' +
            '**Hair**: blonde\n' +
            '**Eyes**: blue\n'
        );
      });

      it('should display apparent age with range when no bestGuess', () => {
        const characterData = {
          description: 'A tall person with distinctive features',
          apparentAge: {
            minAge: 30,
            maxAge: 35,
          },
        };

        const result = formatter.formatPhysicalDescription(characterData);

        expect(result).toContain(
          '**Apparent age**: between 30 and 35 years old'
        );
        expect(result).toContain(
          '**Description**: A tall person with distinctive features'
        );
      });

      it('should display exact age when minAge equals maxAge', () => {
        const characterData = {
          description: { hair: 'gray', eyes: 'brown' },
          apparentAge: {
            minAge: 65,
            maxAge: 65,
          },
        };

        const result = formatter.formatPhysicalDescription(characterData);

        expect(result).toContain('**Apparent age**: 65 years old');
        expect(result).toContain('**Hair**: gray');
        expect(result).toContain('**Eyes**: brown');
      });

      it('should not display apparent age when not present', () => {
        const characterData = {
          description: 'Hair: black; Eyes: green',
        };

        const result = formatter.formatPhysicalDescription(characterData);

        expect(result).not.toContain('**Apparent age**');
        expect(result).toContain('**Hair**: black');
        expect(result).toContain('**Eyes**: green');
      });

      it('should handle apparent age with object description', () => {
        const characterData = {
          description: {
            build: 'athletic',
            skin: 'sun-kissed bronze',
          },
          apparentAge: {
            minAge: 20,
            maxAge: 25,
            bestGuess: 23,
          },
        };

        const result = formatter.formatPhysicalDescription(characterData);

        expect(result).toBe(
          '## Your Description\n' +
            '**Apparent age**: around 23 years old\n\n' +
            '**Build**: athletic\n' +
            '**Skin**: sun-kissed bronze\n'
        );
      });
    });
  });

  describe('formatPersonalitySection', () => {
    it('should format personality with markdown header', () => {
      const personalityText =
        'I am confident and outgoing, with a love for adventure.';

      const result = formatter.formatPersonalitySection(personalityText);

      expect(result).toContain('## Your Personality');
      expect(result).toContain(
        'I am confident and outgoing, with a love for adventure.'
      );
    });

    it('should return empty string for null personality', () => {
      const result = formatter.formatPersonalitySection(null);
      expect(result).toBe('');
    });

    it('should return empty string for empty personality', () => {
      const result = formatter.formatPersonalitySection('');
      expect(result).toBe('');
    });

    it('should trim whitespace from personality text', () => {
      const personalityText = '  I am confident and outgoing.  ';

      const result = formatter.formatPersonalitySection(personalityText);

      expect(result).toContain('I am confident and outgoing.');
      expect(result).not.toMatch(/ {2}I am confident/);
    });
  });

  describe('formatProfileSection', () => {
    it('should format profile with markdown header', () => {
      const profileText =
        'Born in a small town, I moved to the city to pursue my dreams.';

      const result = formatter.formatProfileSection(profileText);

      expect(result).toContain('## Your Profile');
      expect(result).toContain(
        'Born in a small town, I moved to the city to pursue my dreams.'
      );
    });

    it('should return empty string for null profile', () => {
      const result = formatter.formatProfileSection(null);
      expect(result).toBe('');
    });

    it('should return empty string for empty profile', () => {
      const result = formatter.formatProfileSection('');
      expect(result).toBe('');
    });

    it('should trim whitespace-only profile text and return empty string', () => {
      const result = formatter.formatProfileSection('   ');

      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDataFormatter: Empty profile text after trimming'
      );
    });
  });

  describe('formatSpeechPatterns', () => {
    it('should format array of speech patterns as markdown list', () => {
      const speechPatterns = [
        'I speak with authority and confidence',
        'I use metaphors frequently',
        'I pause dramatically before important points',
      ];

      const result = formatter.formatSpeechPatterns(speechPatterns);

      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- I speak with authority and confidence');
      expect(result).toContain('- I use metaphors frequently');
      expect(result).toContain(
        '- I pause dramatically before important points'
      );
      expect(result).toContain('</speech_patterns>');
    });

    it('should handle string-based speech patterns', () => {
      const speechPatterns = '- I speak with authority\n- I use metaphors';

      const result = formatter.formatSpeechPatterns(speechPatterns);

      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- I speak with authority');
      expect(result).toContain('- I use metaphors');
      expect(result).toContain('</speech_patterns>');
    });

    it('should return empty string for null speech patterns', () => {
      const result = formatter.formatSpeechPatterns(null);
      expect(result).toBe('');
    });

    it('should filter out empty patterns from array', () => {
      const speechPatterns = [
        'I speak with authority',
        '',
        null,
        'I use metaphors',
      ];

      const result = formatter.formatSpeechPatterns(speechPatterns);

      expect(result).toContain('- I speak with authority');
      expect(result).toContain('- I use metaphors');
      // Empty strings and nulls are filtered out during pattern extraction
      const bulletMatches = result.match(/- \s*\n/g);
      expect(bulletMatches).toBeNull(); // No empty bullets
    });

    describe('format detection', () => {
      it('should use legacy format for array of strings', () => {
        const speechPatterns = ['pattern1', 'pattern2'];

        const result = formatter.formatSpeechPatterns(speechPatterns);

        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('- pattern1');
        expect(result).toContain('- pattern2');
      });

      it('should use structured format for array of objects', () => {
        const speechPatterns = [
          {
            type: 'metaphor',
            examples: ['Like treating leather - patience is key.'],
          },
        ];

        const result = formatter.formatSpeechPatterns(speechPatterns);

        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('1. **metaphor**');
      });

      it('should detect mixed format and log warning', () => {
        const speechPatterns = [
          'Simple string pattern',
          {
            type: 'metaphor',
            examples: ['Complex structured pattern'],
          },
        ];

        formatter.formatSpeechPatterns(speechPatterns);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Mixed speech pattern formats detected. Consider consolidating to structured format.'
        );
      });

      it('should return empty for empty array', () => {
        const speechPatterns = [];

        const result = formatter.formatSpeechPatterns(speechPatterns);

        expect(result).toBe('');
      });

      it('should extract and format text-based patterns', () => {
        const speechPatterns = '- Pattern one\n- Pattern two';

        const result = formatter.formatSpeechPatterns(speechPatterns);

        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('- Pattern one');
        expect(result).toContain('- Pattern two');
      });

      it('should use XML format for string patterns', () => {
        const speechPatterns = ['pattern1', 'pattern2'];

        const result = formatter.formatSpeechPatterns(speechPatterns);

        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('- pattern1');
        expect(result).toContain('- pattern2');
        expect(result).toContain('</speech_patterns>');
      });

      it('should filter null patterns without crashing', () => {
        const speechPatterns = [null, 'pattern1', null];

        const result = formatter.formatSpeechPatterns(speechPatterns);

        expect(result).toContain('- pattern1');
        expect(result).toContain('<speech_patterns>');
      });

      it('should filter undefined patterns without crashing', () => {
        const speechPatterns = [undefined, 'pattern1', undefined];

        const result = formatter.formatSpeechPatterns(speechPatterns);

        expect(result).toContain('- pattern1');
        expect(result).toContain('<speech_patterns>');
      });

      it('should not modify input array during detection', () => {
        const speechPatterns = ['pattern1', 'pattern2'];
        const originalLength = speechPatterns.length;

        formatter.formatSpeechPatterns(speechPatterns);

        expect(speechPatterns.length).toBe(originalLength);
        expect(speechPatterns[0]).toBe('pattern1');
        expect(speechPatterns[1]).toBe('pattern2');
      });
    });
  });

  describe('formatOptionalSection', () => {
    it('should format likes section with proper header', () => {
      const content = 'I love sunny days and good books.';

      const result = formatter.formatOptionalSection('Likes', content);

      expect(result).toContain('## Your Likes');
      expect(result).toContain('I love sunny days and good books.');
    });

    it('should format dislikes section with proper header', () => {
      const content = 'I dislike rudeness and rainy weather.';

      const result = formatter.formatOptionalSection('Dislikes', content);

      expect(result).toContain('## Your Dislikes');
      expect(result).toContain('I dislike rudeness and rainy weather.');
    });

    it('should format secrets section with proper header', () => {
      const content = 'I have a secret talent for painting.';

      const result = formatter.formatOptionalSection('Secrets', content);

      expect(result).toContain('## Your Secrets');
      expect(result).toContain('I have a secret talent for painting.');
    });

    it('should format fears section with proper header', () => {
      const content = 'I fear heights and public speaking.';

      const result = formatter.formatOptionalSection('Fears', content);

      expect(result).toContain('## Your Fears');
      expect(result).toContain('I fear heights and public speaking.');
    });

    it('should format strengths section with proper header', () => {
      const content = 'I am excellent at problem-solving and leadership.';

      const result = formatter.formatOptionalSection('Strengths', content);

      expect(result).toContain('## Your Strengths');
      expect(result).toContain(
        'I am excellent at problem-solving and leadership.'
      );
    });

    it('should format weaknesses section with proper header', () => {
      const content =
        'I struggle with patience and tend to be overly critical.';

      const result = formatter.formatOptionalSection('Weaknesses', content);

      expect(result).toContain('## Your Weaknesses');
      expect(result).toContain(
        'I struggle with patience and tend to be overly critical.'
      );
    });

    it('should return empty string for null content', () => {
      const result = formatter.formatOptionalSection('Likes', null);
      expect(result).toBe('');
    });

    it('should return empty string for empty content', () => {
      const result = formatter.formatOptionalSection('Likes', '');
      expect(result).toBe('');
    });

    it('should trim whitespace-only optional section content and return empty string', () => {
      const result = formatter.formatOptionalSection('Likes', '    ');

      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDataFormatter: Empty content for Likes section after trimming'
      );
    });
  });

  describe('formatCharacterPersona', () => {
    it('should format complete character persona with all sections', () => {
      const characterData = {
        name: 'Elara the Bard',
        description: {
          hair: 'long, auburn',
          eyes: 'green, sparkling',
          wearing: 'traveler robes',
        },
        personality: 'I am charismatic and love to tell stories.',
        profile: 'Born in the mountains, I travel the world sharing tales.',
        likes: 'Music, stories, and warm fires.',
        dislikes: 'Silence and cold weather.',
        strengths: 'Leadership, storytelling, and inspiring others.',
        weaknesses: 'Impatience and perfectionism.',
        secrets: 'I can speak to animals.',
        fears: 'Being forgotten.',
        speechPatterns: [
          'I often speak in rhymes',
          'I use grand gestures when telling stories',
        ],
      };

      const result = formatter.formatCharacterPersona(characterData);

      // Check identity header
      expect(result).toContain('YOU ARE Elara the Bard.');
      expect(result).toContain(
        'This is your identity. All thoughts, actions, and words must stem from this core truth.'
      );

      // Check all sections are present
      expect(result).toContain('## Your Description');
      expect(result).toContain('**Hair**: long, auburn');
      expect(result).toContain('## Your Personality');
      expect(result).toContain('I am charismatic and love to tell stories.');
      expect(result).toContain('## Your Profile');
      expect(result).toContain('Born in the mountains');
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Music, stories, and warm fires.');
      expect(result).toContain('## Your Dislikes');
      expect(result).toContain('Silence and cold weather.');
      expect(result).toContain('## Your Strengths');
      expect(result).toContain(
        'Leadership, storytelling, and inspiring others.'
      );
      expect(result).toContain('## Your Weaknesses');
      expect(result).toContain('Impatience and perfectionism.');
      expect(result).toContain('## Your Secrets');
      expect(result).toContain('I can speak to animals.');
      expect(result).toContain('## Your Fears');
      expect(result).toContain('Being forgotten.');
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- I often speak in rhymes');
      expect(result).toContain('</speech_patterns>');
    });

    it('should format character with minimal data', () => {
      const characterData = {
        name: 'Simple Character',
        personality: 'I am straightforward.',
      };

      const result = formatter.formatCharacterPersona(characterData);

      expect(result).toContain('YOU ARE Simple Character.');
      expect(result).toContain('## Your Personality');
      expect(result).toContain('I am straightforward.');
      expect(result).not.toContain('## Your Description');
      expect(result).not.toContain('## Your Likes');
    });

    it('should handle missing name gracefully', () => {
      const characterData = {
        personality: 'I am mysterious.',
      };

      const result = formatter.formatCharacterPersona(characterData);

      expect(result).toContain('## Your Personality');
      expect(result).toContain('I am mysterious.');
      expect(result).toContain('YOU ARE Unnamed Character.'); // Now uses fallback name
    });

    it('should return empty string for null character data', () => {
      const result = formatter.formatCharacterPersona(null);
      expect(result).toBe('');
    });

    it('should return empty string for invalid character data', () => {
      const result = formatter.formatCharacterPersona('invalid');
      expect(result).toBe('');
    });

    it('should handle complex description parsing', () => {
      const characterData = {
        name: 'Complex Character',
        description:
          'Hair: jet black, shoulder length; Eyes: piercing blue; Clothing: worn leather armor | silver pendant | travel-stained cloak',
      };

      const result = formatter.formatCharacterPersona(characterData);

      expect(result).toContain('**Hair**: jet black, shoulder length');
      expect(result).toContain('**Eyes**: piercing blue');
      expect(result).toContain(
        '**Clothing**: worn leather armor | silver pendant | travel-stained cloak'
      );
    });

    it('should properly space sections', () => {
      const characterData = {
        name: 'Test Character',
        personality: 'Confident.',
        profile: 'Experienced.',
      };

      const result = formatter.formatCharacterPersona(characterData);

      // Check that sections are properly separated with newlines
      expect(result).toMatch(
        /## Your Personality\nConfident\.\n\n## Your Profile/
      );
    });

    it('should include psychological sections when data is present', () => {
      const characterData = {
        name: 'Psychological Character',
        personality: 'Complex and introspective.',
        profile: 'A character with deep psychological development.',
        motivations: 'I seek to understand the nature of existence.',
        internalTensions: 'I desire connection but fear intimacy.',
        coreDilemmas: 'Is it better to be loved or to be right?',
        likes: 'Philosophy and quiet moments.',
      };

      const result = formatter.formatCharacterPersona(characterData);

      // Check identity header
      expect(result).toContain('YOU ARE Psychological Character.');
      
      // Check all psychological sections are present and in correct order
      expect(result).toContain('## Your Personality');
      expect(result).toContain('Complex and introspective.');
      
      expect(result).toContain('## Your Profile');
      expect(result).toContain('A character with deep psychological development.');
      
      expect(result).toContain('## Your Core Motivations');
      expect(result).toContain('I seek to understand the nature of existence.');
      
      expect(result).toContain('## Your Internal Tensions');
      expect(result).toContain('I desire connection but fear intimacy.');
      
      expect(result).toContain('## Your Core Dilemmas');
      expect(result).toContain('Is it better to be loved or to be right?');
      
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Philosophy and quiet moments.');

      // Check proper ordering: psychological sections should come after profile, before likes
      const profileIndex = result.indexOf('## Your Profile');
      const motivationsIndex = result.indexOf('## Your Core Motivations');
      const tensionsIndex = result.indexOf('## Your Internal Tensions');
      const dilemmasIndex = result.indexOf('## Your Core Dilemmas');
      const likesIndex = result.indexOf('## Your Likes');

      expect(profileIndex).toBeLessThan(motivationsIndex);
      expect(motivationsIndex).toBeLessThan(tensionsIndex);
      expect(tensionsIndex).toBeLessThan(dilemmasIndex);
      expect(dilemmasIndex).toBeLessThan(likesIndex);
    });

    it('should handle partial psychological data gracefully', () => {
      const characterData = {
        name: 'Partial Psych Character',
        personality: 'Partially developed.',
        motivations: 'I have one clear motivation.',
        // internalTensions and coreDilemmas missing
        likes: 'Simple pleasures.',
      };

      const result = formatter.formatCharacterPersona(characterData);

      expect(result).toContain('YOU ARE Partial Psych Character.');
      expect(result).toContain('## Your Core Motivations');
      expect(result).toContain('I have one clear motivation.');
      expect(result).not.toContain('## Your Internal Tensions');
      expect(result).not.toContain('## Your Core Dilemmas');
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Simple pleasures.');
    });

    it('should work without psychological data (backward compatibility)', () => {
      const characterData = {
        name: 'Traditional Character',
        personality: 'Simple and straightforward.',
        likes: 'Traditional things.',
      };

      const result = formatter.formatCharacterPersona(characterData);

      expect(result).toContain('YOU ARE Traditional Character.');
      expect(result).toContain('## Your Personality');
      expect(result).toContain('Simple and straightforward.');
      expect(result).not.toContain('## Your Core Motivations');
      expect(result).not.toContain('## Your Internal Tensions');
      expect(result).not.toContain('## Your Core Dilemmas');
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Traditional things.');
    });
  });

  describe('formatMotivationsSection', () => {
    it('should format valid motivations text', () => {
      const input = 'I seek power because I fear being powerless.';
      const expected = `## Your Core Motivations
I seek power because I fear being powerless.
`;

      const result = formatter.formatMotivationsSection(input);
      expect(result).toBe(expected);
    });

    it('should return empty string for null input', () => {
      const result = formatter.formatMotivationsSection(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = formatter.formatMotivationsSection(undefined);
      expect(result).toBe('');
    });

    it('should handle empty string', () => {
      const result = formatter.formatMotivationsSection('');
      expect(result).toBe('');
    });

    it('should handle whitespace-only string', () => {
      const result = formatter.formatMotivationsSection('   \n\t   ');
      expect(result).toBe('');
    });

    it('should trim whitespace from valid input', () => {
      const input = '  I am driven by a need for approval.  ';
      const expected = `## Your Core Motivations
I am driven by a need for approval.
`;

      const result = formatter.formatMotivationsSection(input);
      expect(result).toBe(expected);
    });

    it('should handle non-string input', () => {
      const result = formatter.formatMotivationsSection(123);
      expect(result).toBe('');
    });

    it('should log debug information for valid input', () => {
      const input = 'Test motivation';
      formatter.formatMotivationsSection(input);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDataFormatter: Formatted motivations section',
        { textLength: 15 }
      );
    });
  });

  describe('formatInternalTensionsSection', () => {
    it('should format valid tensions text', () => {
      const input = 'I want to be loved but fear vulnerability.';
      const expected = `## Your Internal Tensions
I want to be loved but fear vulnerability.
`;

      const result = formatter.formatInternalTensionsSection(input);
      expect(result).toBe(expected);
    });

    it('should return empty string for null input', () => {
      const result = formatter.formatInternalTensionsSection(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = formatter.formatInternalTensionsSection(undefined);
      expect(result).toBe('');
    });

    it('should handle empty string', () => {
      const result = formatter.formatInternalTensionsSection('');
      expect(result).toBe('');
    });

    it('should handle whitespace-only string', () => {
      const result = formatter.formatInternalTensionsSection('   \n\t   ');
      expect(result).toBe('');
    });

    it('should trim whitespace from valid input', () => {
      const input = '  My desire for freedom conflicts with my need for security.  ';
      const expected = `## Your Internal Tensions
My desire for freedom conflicts with my need for security.
`;

      const result = formatter.formatInternalTensionsSection(input);
      expect(result).toBe(expected);
    });

    it('should handle non-string input', () => {
      const result = formatter.formatInternalTensionsSection({});
      expect(result).toBe('');
    });

    it('should log debug information for valid input', () => {
      const input = 'Test tension';
      formatter.formatInternalTensionsSection(input);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDataFormatter: Formatted internal tensions section',
        { textLength: 12 }
      );
    });
  });

  describe('formatCoreDilemmasSection', () => {
    it('should format valid dilemmas text', () => {
      const input = 'Should I prioritize duty or happiness?';
      const expected = `## Your Core Dilemmas
Should I prioritize duty or happiness?
`;

      const result = formatter.formatCoreDilemmasSection(input);
      expect(result).toBe(expected);
    });

    it('should return empty string for null input', () => {
      const result = formatter.formatCoreDilemmasSection(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = formatter.formatCoreDilemmasSection(undefined);
      expect(result).toBe('');
    });

    it('should handle empty string', () => {
      const result = formatter.formatCoreDilemmasSection('');
      expect(result).toBe('');
    });

    it('should handle whitespace-only string', () => {
      const result = formatter.formatCoreDilemmasSection('   \n\t   ');
      expect(result).toBe('');
    });

    it('should trim whitespace from valid input', () => {
      const input = '  What is the meaning of true strength?  ';
      const expected = `## Your Core Dilemmas
What is the meaning of true strength?
`;

      const result = formatter.formatCoreDilemmasSection(input);
      expect(result).toBe(expected);
    });

    it('should handle non-string input', () => {
      const result = formatter.formatCoreDilemmasSection([]);
      expect(result).toBe('');
    });

    it('should log debug information for valid input', () => {
      const input = 'Test dilemma';
      formatter.formatCoreDilemmasSection(input);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDataFormatter: Formatted core dilemmas section',
        { textLength: 12 }
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should include apparent age in formatCharacterPersona when present', () => {
      const characterData = {
        name: 'Test Character',
        description: 'Hair: brown; Eyes: green',
        personality: 'Friendly',
        apparentAge: {
          minAge: 25,
          maxAge: 30,
          bestGuess: 28,
        },
      };

      const result = formatter.formatCharacterPersona(characterData);

      expect(result).toContain('YOU ARE Test Character.');
      expect(result).toContain('## Your Description');
      expect(result).toContain('**Apparent age**: around 28 years old');
      expect(result).toContain('**Hair**: brown');
      expect(result).toContain('**Eyes**: green');
      expect(result).toContain('## Your Personality');
      expect(result).toContain('Friendly');
    });

    it('should handle empty object gracefully', () => {
      const result = formatter.formatCharacterPersona({});
      // Empty object will still get the identity header with fallback name
      expect(result).toContain('YOU ARE Unnamed Character.');
      expect(result).toContain(
        'This is your identity. All thoughts, actions, and words must stem from this core truth.'
      );
    });

    it('should handle undefined values in description object', () => {
      const characterData = {
        description: {
          hair: 'blonde',
          eyes: undefined,
          height: null,
          clothing: 'dress',
        },
      };

      const result = formatter.formatPhysicalDescription(characterData);

      expect(result).toContain('**Hair**: blonde');
      expect(result).toContain('**Clothing**: dress');
      expect(result).not.toContain('**Eyes**:');
      expect(result).not.toContain('**Height**:');
    });

    it('should handle whitespace-only content', () => {
      const result = formatter.formatPersonalitySection('   \n\t   ');
      expect(result).toBe('');
    });

    it('should handle mixed valid and invalid speech patterns', () => {
      const speechPatterns = [
        'Valid pattern',
        123, // invalid type
        null,
        'Another valid pattern',
        undefined,
      ];

      const result = formatter.formatSpeechPatterns(speechPatterns);

      expect(result).toContain('- Valid pattern');
      expect(result).toContain('- Another valid pattern');
      expect(result).not.toContain('123');
    });
  });

  describe('XML formatted speech patterns', () => {
    describe('structured format (object patterns)', () => {
      it('should render object patterns with <speech_patterns> tags', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['Like treating leather - patience is key.'],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('</speech_patterns>');
      });

      it('should display pattern type as bold markdown', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['Example 1'],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('**metaphor**');
      });

      it('should show contexts line when contexts array has values', () => {
        const patterns = [
          {
            type: 'catchphrase',
            contexts: ['when greeting', 'when excited'],
            examples: ['Example 1'],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('Contexts: when greeting, when excited');
      });

      it('should not show contexts line when contexts array is empty', () => {
        const patterns = [
          {
            type: 'catchphrase',
            contexts: [],
            examples: ['Example 1'],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).not.toContain('Contexts:');
      });

      it('should not show contexts line when contexts is missing', () => {
        const patterns = [
          {
            type: 'catchphrase',
            examples: ['Example 1'],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).not.toContain('Contexts:');
      });

      it('should display examples with proper indentation and quotes', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['First example', 'Second example'],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('Examples:');
        expect(result).toContain('   - "First example"');
        expect(result).toContain('   - "Second example"');
      });

      it('should number multiple pattern groups correctly', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['Example 1'],
          },
          {
            type: 'idiom',
            examples: ['Example 2'],
          },
          {
            type: 'catchphrase',
            examples: ['Example 3'],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('1. **metaphor**');
        expect(result).toContain('2. **idiom**');
        expect(result).toContain('3. **catchphrase**');
      });

      it('should include usage guidance at top', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['Example 1'],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain(
          "<!-- Use these patterns naturally in conversation. Don't force every pattern into every response. -->"
        );
      });

      it('should preserve whitespace in examples', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['  Example with spaces  '],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('"  Example with spaces  "');
      });
    });

    describe('legacy format (string patterns)', () => {
      it('should render string patterns with <speech_patterns> tags', () => {
        const patterns = ['Simple string pattern'];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('</speech_patterns>');
      });

      it('should prefix each pattern with bullet point', () => {
        const patterns = ['Pattern one', 'Pattern two'];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('- Pattern one');
        expect(result).toContain('- Pattern two');
      });

      it('should include usage guidance at top', () => {
        const patterns = ['Pattern one'];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain(
          "<!-- Use these patterns naturally in conversation. Don't force every pattern into every response. -->"
        );
      });

      it('should preserve original string content exactly', () => {
        const patterns = ['I speak with authority and confidence'];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('- I speak with authority and confidence');
      });
    });

    describe('mixed format (object + string patterns)', () => {
      it('should render object patterns first with structured format', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['Structured example'],
          },
          'Simple string pattern',
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        const structuredIndex = result.indexOf('1. **metaphor**');
        const additionalIndex = result.indexOf('Additional Patterns:');

        expect(structuredIndex).toBeGreaterThan(-1);
        expect(additionalIndex).toBeGreaterThan(-1);
        expect(structuredIndex).toBeLessThan(additionalIndex);
      });

      it('should add "Additional Patterns" section for string patterns', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['Structured example'],
          },
          'Simple string pattern',
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('Additional Patterns:');
      });

      it('should use bullet format for string patterns', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['Structured example'],
          },
          'Simple string one',
          'Simple string two',
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('- Simple string one');
        expect(result).toContain('- Simple string two');
      });

      it('should use single <speech_patterns> wrapper for both', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['Structured example'],
          },
          'Simple string pattern',
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        const openingTags = (result.match(/<speech_patterns>/g) || []).length;
        const closingTags = (result.match(/<\/speech_patterns>/g) || []).length;

        expect(openingTags).toBe(1);
        expect(closingTags).toBe(1);
      });

      it('should include usage guidance once at top', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['Structured example'],
          },
          'Simple string pattern',
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        const guidanceCount = (
          result.match(
            /<!-- Use these patterns naturally in conversation/g
          ) || []
        ).length;

        expect(guidanceCount).toBe(1);
      });

      it('should preserve order: structured then legacy', () => {
        const patterns = [
          'String first',
          {
            type: 'metaphor',
            examples: ['Object second'],
          },
          'String third',
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        const metaphorIndex = result.indexOf('1. **metaphor**');
        const additionalIndex = result.indexOf('Additional Patterns:');

        expect(metaphorIndex).toBeLessThan(additionalIndex);
        expect(result).toContain('- String first');
        expect(result).toContain('- String third');
      });
    });

    describe('edge cases', () => {
      it('should return empty string for empty patterns array', () => {
        const patterns = [];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toBe('');
      });

      it('should return empty string for null patterns', () => {
        const result = formatter.formatSpeechPatterns(null);

        expect(result).toBe('');
      });

      it('should not show contexts line when contexts array is empty', () => {
        const patterns = [
          {
            type: 'catchphrase',
            contexts: [],
            examples: ['Example 1'],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).not.toContain('Contexts:');
      });

      it('should preserve whitespace in examples', () => {
        const patterns = [
          {
            type: 'metaphor',
            examples: ['  Example with spaces  '],
          },
        ];

        const result = formatter.formatSpeechPatterns(patterns);

        expect(result).toContain('"  Example with spaces  "');
      });
    });

    describe('backward compatibility', () => {
      it('should still work with existing string-only tests', () => {
        const speechPatterns = [
          'I speak with authority and confidence',
          'I use metaphors frequently',
          'I pause dramatically before important points',
        ];

        const result = formatter.formatSpeechPatterns(speechPatterns);

        // Old behavior expected XML format with bullets
        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('- I speak with authority and confidence');
        expect(result).toContain('- I use metaphors frequently');
        expect(result).toContain(
          '- I pause dramatically before important points'
        );
        expect(result).toContain('</speech_patterns>');
      });

      it('should handle entity object parameter (new behavior)', () => {
        const mockEntity = {
          getComponent: jest.fn().mockReturnValue({
            patterns: [
              {
                type: 'metaphor',
                examples: ['Like treating leather - patience is key.'],
              },
            ],
          }),
        };

        const result = formatter.formatSpeechPatterns(mockEntity);

        expect(mockEntity.getComponent).toHaveBeenCalledWith(
          'core:speech_patterns'
        );
        expect(result).toContain('<speech_patterns>');
        expect(result).toContain('1. **metaphor**');
      });

      it('should handle entity object with empty patterns', () => {
        const mockEntity = {
          getComponent: jest.fn().mockReturnValue({
            patterns: [],
          }),
        };

        const result = formatter.formatSpeechPatterns(mockEntity);

        expect(result).toBe('');
      });

      it('should handle entity object with null component', () => {
        const mockEntity = {
          getComponent: jest.fn().mockReturnValue(null),
        };

        const result = formatter.formatSpeechPatterns(mockEntity);

        expect(result).toBe('');
      });
    });
  });
});
