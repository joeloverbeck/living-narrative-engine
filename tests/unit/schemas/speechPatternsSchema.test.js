import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, test, expect, beforeAll } from '@jest/globals';
import commonSchema from '../../../data/schemas/common.schema.json';

/**
 * @file Tests for the speech_patterns component schema validation
 * Tests backward compatibility with string format and new structured object format
 */

describe('speech_patterns schema validation', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema, commonSchema.$id);

    const componentPath = path.resolve(
      __dirname,
      '../../../data/mods/core/components/speech_patterns.component.json'
    );
    const component = JSON.parse(fs.readFileSync(componentPath, 'utf8'));
    const dataSchema = { ...component.dataSchema, $id: component.id };
    validate = ajv.compile(dataSchema);
  });

  describe('Legacy string format', () => {
    test('should accept array of strings', () => {
      const data = {
        patterns: ['pattern1', 'pattern2'],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept single string in array', () => {
      const data = {
        patterns: ['hello'],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept empty string in array', () => {
      const data = {
        patterns: [''],
      };
      expect(validate(data)).toBe(true);
    });
  });

  describe('New structured object format', () => {
    test('should accept object with type and examples', () => {
      const data = {
        patterns: [
          {
            type: 'metaphor',
            examples: ['Like treating leather - patience is key.'],
          },
        ],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept object with type, contexts, and examples', () => {
      const data = {
        patterns: [
          {
            type: 'catchphrase',
            contexts: ['greeting', 'farewell'],
            examples: ['See you around!', 'Catch you later!'],
          },
        ],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept object without contexts field', () => {
      const data = {
        patterns: [
          {
            type: 'idiom',
            examples: ['A bird in the hand is worth two in the bush.'],
          },
        ],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept object with empty contexts array', () => {
      const data = {
        patterns: [
          {
            type: 'proverb',
            contexts: [],
            examples: ['Actions speak louder than words.'],
          },
        ],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept object with multiple examples', () => {
      const data = {
        patterns: [
          {
            type: 'greeting',
            examples: ['Hello!', 'Hi there!', 'Good morning!'],
          },
        ],
      };
      expect(validate(data)).toBe(true);
    });

    test('should reject object missing type field', () => {
      const data = {
        patterns: [
          {
            examples: ['example'],
          },
        ],
      };
      expect(validate(data)).toBe(false);
    });

    test('should reject object missing examples field', () => {
      const data = {
        patterns: [
          {
            type: 'metaphor',
          },
        ],
      };
      expect(validate(data)).toBe(false);
    });

    test('should reject object with empty examples array', () => {
      const data = {
        patterns: [
          {
            type: 'idiom',
            examples: [],
          },
        ],
      };
      expect(validate(data)).toBe(false);
    });

    test('should reject object with empty type string', () => {
      const data = {
        patterns: [
          {
            type: '',
            examples: ['example'],
          },
        ],
      };
      expect(validate(data)).toBe(false);
    });

    test('should reject object with non-array contexts', () => {
      const data = {
        patterns: [
          {
            type: 'catchphrase',
            contexts: 'not-an-array',
            examples: ['example'],
          },
        ],
      };
      expect(validate(data)).toBe(false);
    });

    test('should reject object with additional properties', () => {
      const data = {
        patterns: [
          {
            type: 'idiom',
            examples: ['example'],
            extraField: 'not-allowed',
          },
        ],
      };
      expect(validate(data)).toBe(false);
    });

    test('should reject object with non-string type', () => {
      const data = {
        patterns: [
          {
            type: 123,
            examples: ['example'],
          },
        ],
      };
      expect(validate(data)).toBe(false);
    });

    test('should reject object with non-array examples', () => {
      const data = {
        patterns: [
          {
            type: 'idiom',
            examples: 'not-an-array',
          },
        ],
      };
      expect(validate(data)).toBe(false);
    });
  });

  describe('Mixed format arrays', () => {
    test('should accept mix of strings and objects', () => {
      const data = {
        patterns: [
          'Simple string pattern',
          {
            type: 'metaphor',
            examples: ['Complex structured pattern'],
          },
          'Another string',
        ],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept multiple objects in array', () => {
      const data = {
        patterns: [
          {
            type: 'greeting',
            examples: ['Hello!'],
          },
          {
            type: 'farewell',
            examples: ['Goodbye!'],
          },
        ],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept complex mix of all formats', () => {
      const data = {
        patterns: [
          'Legacy string pattern',
          {
            type: 'metaphor',
            contexts: ['teaching', 'explaining'],
            examples: ['Like treating leather - patience matters.'],
          },
          'Another legacy string',
          {
            type: 'catchphrase',
            examples: ['See you around!', 'Catch you later!'],
          },
        ],
      };
      expect(validate(data)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    test('should accept empty patterns array', () => {
      const data = {
        patterns: [],
      };
      expect(validate(data)).toBe(true);
    });

    test('should reject missing patterns field', () => {
      const data = {};
      expect(validate(data)).toBe(false);
    });

    test('should reject patterns as non-array', () => {
      const data = {
        patterns: 'not-an-array',
      };
      expect(validate(data)).toBe(false);
    });

    test('should reject additional properties at top level', () => {
      const data = {
        patterns: ['hello'],
        extraField: 'not-allowed',
      };
      expect(validate(data)).toBe(false);
    });

    test('should accept very long string patterns', () => {
      const longString = 'a'.repeat(10000);
      const data = {
        patterns: [longString],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept patterns with special characters', () => {
      const data = {
        patterns: [
          '"Quoted text"',
          'Text with\nnewlines',
          'Unicode: 你好',
          'Emoji: 😀',
        ],
      };
      expect(validate(data)).toBe(true);
    });
  });

  describe('Real-world usage examples', () => {
    test('should accept realistic character speech patterns', () => {
      const data = {
        patterns: [
          '"Like treating leather - you need the right pressure, proper care, attention to timing."',
          '"A good handjob is like good craftsmanship."',
          {
            type: 'metaphor',
            contexts: ['craftsmanship', 'work'],
            examples: [
              'The tannery marks you. Gets into your skin.',
              'Good ale, a clean shop, and the smell of fresh leather.',
            ],
          },
          'NOTE: Character speaks matter-of-factly about intimate topics.',
        ],
      };
      expect(validate(data)).toBe(true);
    });

    test('should accept structured patterns with detailed context', () => {
      const data = {
        patterns: [
          {
            type: 'catchphrase',
            contexts: ['frustration', 'disappointment'],
            examples: ['Well, that went sideways.', 'Not according to plan.'],
          },
          {
            type: 'idiom',
            contexts: ['advice', 'mentoring'],
            examples: [
              'Measure twice, cut once.',
              "Don't count your chickens before they hatch.",
            ],
          },
        ],
      };
      expect(validate(data)).toBe(true);
    });
  });
});
