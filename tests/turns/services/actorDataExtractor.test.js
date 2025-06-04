// tests/turns/services/actorDataExtractor.test.js
// --- FILE START ---

import { ActorDataExtractor } from '../../../src/turns/services/ActorDataExtractor.js';
import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  PERSONALITY_COMPONENT_ID,
  PROFILE_COMPONENT_ID,
  LIKES_COMPONENT_ID,
  DISLIKES_COMPONENT_ID,
  SECRETS_COMPONENT_ID,
  SPEECH_PATTERNS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

// Default values used by the service, useful for assertions
const DEFAULT_NAME = 'Unnamed Character';
const DEFAULT_DESCRIPTION = 'No description available.'; // Already ends with a period

describe('ActorDataExtractor', () => {
  /** @type {ActorDataExtractor} */
  let extractor;

  beforeEach(() => {
    extractor = new ActorDataExtractor();
  });

  describe('extractPromptData', () => {
    test('should return default name and description when actorState is empty', () => {
      const actorState = {};
      const result = extractor.extractPromptData(actorState);
      expect(result.name).toBe(DEFAULT_NAME);
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
      expect(result.personality).toBeUndefined();
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should return default name if name component is missing', () => {
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: 'A character.' },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.name).toBe(DEFAULT_NAME);
    });

    test('should return default name if name component text is null or empty string', () => {
      let actorState = { [NAME_COMPONENT_ID]: { text: null } };
      let result = extractor.extractPromptData(actorState);
      expect(result.name).toBe(DEFAULT_NAME);

      actorState = { [NAME_COMPONENT_ID]: { text: '' } };
      result = extractor.extractPromptData(actorState);
      expect(result.name).toBe(DEFAULT_NAME);

      actorState = { [NAME_COMPONENT_ID]: { text: '   ' } };
      result = extractor.extractPromptData(actorState);
      expect(result.name).toBe(DEFAULT_NAME);
    });

    test('should extract and trim name correctly', () => {
      const actorState = {
        [NAME_COMPONENT_ID]: { text: '  Test Name  ' },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.name).toBe('Test Name');
    });

    test('should return default description if description component is missing', () => {
      const actorState = {
        [NAME_COMPONENT_ID]: { text: 'Test Character' },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
    });

    test('should return default description if description component text is null or empty string', () => {
      let actorState = { [DESCRIPTION_COMPONENT_ID]: { text: null } };
      let result = extractor.extractPromptData(actorState);
      expect(result.description).toBe(DEFAULT_DESCRIPTION);

      actorState = { [DESCRIPTION_COMPONENT_ID]: { text: '' } };
      result = extractor.extractPromptData(actorState);
      expect(result.description).toBe(DEFAULT_DESCRIPTION);

      actorState = { [DESCRIPTION_COMPONENT_ID]: { text: '   ' } };
      result = extractor.extractPromptData(actorState);
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
    });

    test('should extract, trim, and punctuate description correctly', () => {
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: '  A detailed description ' },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.description).toBe('A detailed description.');
    });

    test('should not add extra punctuation if description already ends with a period', () => {
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: 'Already punctuated.' },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.description).toBe('Already punctuated.');
    });

    test('should not add extra punctuation if description already ends with an exclamation mark', () => {
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: 'Exciting!' },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.description).toBe('Exciting!');
    });

    test('should not add extra punctuation if description already ends with a question mark', () => {
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: 'Really?' },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.description).toBe('Really?');
    });

    test('should handle description that becomes empty after trim, defaulting to default description', () => {
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: '   ' }, // Only spaces
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
    });

    test('should extract all optional text attributes if present and valid', () => {
      const actorState = {
        [NAME_COMPONENT_ID]: { text: 'Full Char' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'Desc.' },
        [PERSONALITY_COMPONENT_ID]: { text: '  Bright ' },
        [PROFILE_COMPONENT_ID]: { text: 'A mysterious individual.' },
        [LIKES_COMPONENT_ID]: { text: '  Apples, Pears  ' },
        [DISLIKES_COMPONENT_ID]: { text: 'Rain' },
        [SECRETS_COMPONENT_ID]: { text: 'Is secretly a cat.' },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.personality).toBe('Bright');
      expect(result.profile).toBe('A mysterious individual.');
      expect(result.likes).toBe('Apples, Pears');
      expect(result.dislikes).toBe('Rain');
      expect(result.secrets).toBe('Is secretly a cat.');
    });

    const optionalAttributesTestCases = [
      { field: 'personality', componentId: PERSONALITY_COMPONENT_ID },
      { field: 'profile', componentId: PROFILE_COMPONENT_ID },
      { field: 'likes', componentId: LIKES_COMPONENT_ID },
      { field: 'dislikes', componentId: DISLIKES_COMPONENT_ID },
      { field: 'secrets', componentId: SECRETS_COMPONENT_ID },
    ];

    optionalAttributesTestCases.forEach(({ field, componentId }) => {
      test(`should leave ${field} undefined if component is missing`, () => {
        const actorState = {};
        const result = extractor.extractPromptData(actorState);
        expect(result[field]).toBeUndefined();
      });

      test(`should leave ${field} undefined if component text is null`, () => {
        const actorState = { [componentId]: { text: null } };
        const result = extractor.extractPromptData(actorState);
        expect(result[field]).toBeUndefined();
      });

      test(`should leave ${field} undefined if component text is empty string`, () => {
        const actorState = { [componentId]: { text: '' } };
        const result = extractor.extractPromptData(actorState);
        expect(result[field]).toBeUndefined();
      });

      test(`should leave ${field} undefined if component text is only whitespace`, () => {
        const actorState = { [componentId]: { text: '   ' } };
        const result = extractor.extractPromptData(actorState);
        expect(result[field]).toBeUndefined();
      });

      test(`should leave ${field} undefined if component data is not a string (e.g. number)`, () => {
        const actorState = { [componentId]: { text: 123 } };
        const result = extractor.extractPromptData(actorState);
        expect(result[field]).toBeUndefined();
      });

      test(`should extract and trim ${field} correctly`, () => {
        const actorState = { [componentId]: { text: `  Test ${field}  ` } };
        const result = extractor.extractPromptData(actorState);
        expect(result[field]).toBe(`Test ${field}`);
      });
    });

    test('should correctly handle speech patterns: all valid', () => {
      const actorState = {
        [SPEECH_PATTERNS_COMPONENT_ID]: {
          patterns: ['  Pattern 1  ', 'Pattern 2', ' Another Pattern! '],
        },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toEqual([
        'Pattern 1',
        'Pattern 2',
        'Another Pattern!',
      ]);
    });

    test('should correctly handle speech patterns: some empty or whitespace', () => {
      const actorState = {
        [SPEECH_PATTERNS_COMPONENT_ID]: {
          patterns: ['Valid', '  ', '', '  Pattern 3  ', null, undefined, 123],
        },
      };
      const result = extractor.extractPromptData(actorState);
      // Note: The implementation maps non-strings to empty strings before filtering.
      // So null, undefined, 123 become '' and are filtered out.
      expect(result.speechPatterns).toEqual(['Valid', 'Pattern 3']);
    });

    test('should leave speechPatterns undefined if component is missing', () => {
      const actorState = {};
      const result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should leave speechPatterns undefined if patterns array is missing', () => {
      const actorState = { [SPEECH_PATTERNS_COMPONENT_ID]: {} }; // no 'patterns' array
      const result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should leave speechPatterns undefined if patterns array is null', () => {
      const actorState = { [SPEECH_PATTERNS_COMPONENT_ID]: { patterns: null } };
      const result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should leave speechPatterns undefined if patterns array is empty', () => {
      const actorState = {
        [SPEECH_PATTERNS_COMPONENT_ID]: { patterns: [] },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toBeUndefined();
      // If the DTO/requirements change to expect an empty array:
      // expect(result.speechPatterns).toEqual([]);
    });

    test('should leave speechPatterns undefined if patterns array contains only empty or whitespace strings', () => {
      const actorState = {
        [SPEECH_PATTERNS_COMPONENT_ID]: { patterns: ['', '   ', '      '] },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toBeUndefined();
      // If the DTO/requirements change to expect an empty array:
      // expect(result.speechPatterns).toEqual([]);
    });

    test('should leave speechPatterns undefined if patterns array contains non-string elements that trim to empty', () => {
      const actorState = {
        [SPEECH_PATTERNS_COMPONENT_ID]: {
          patterns: [null, undefined, 123, true, {}],
        },
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should handle a mix of valid and invalid data gracefully', () => {
      const actorState = {
        [NAME_COMPONENT_ID]: { text: '  Mixed Test  ' },
        // Description missing -> default
        [PERSONALITY_COMPONENT_ID]: { text: '' }, // -> undefined
        [PROFILE_COMPONENT_ID]: { text: '  A solid profile.  ' },
        [LIKES_COMPONENT_ID]: null, // -> undefined
        [DISLIKES_COMPONENT_ID]: { text: '   Only Spaces   ' }, // Should be 'Only Spaces'
        [SECRETS_COMPONENT_ID]: { text: 'Secret revealed!' },
        [SPEECH_PATTERNS_COMPONENT_ID]: {
          patterns: ['Speak up!', '  ', '  Louder!  '],
        },
      };
      const result = extractor.extractPromptData(actorState);

      expect(result.name).toBe('Mixed Test');
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
      expect(result.personality).toBeUndefined();
      expect(result.profile).toBe('A solid profile.');
      expect(result.likes).toBeUndefined();
      // CORRECTED EXPECTATION:
      expect(result.dislikes).toBe('Only Spaces');
      expect(result.secrets).toBe('Secret revealed!');
      expect(result.speechPatterns).toEqual(['Speak up!', 'Louder!']);
    });

    test('should correctly handle name and description component data not being an object', () => {
      let actorState = {
        [NAME_COMPONENT_ID]: 'Just a string name', // not {text: ...}
        [DESCRIPTION_COMPONENT_ID]: 'Just a string desc', // not {text: ...}
      };
      let result = extractor.extractPromptData(actorState);
      // Current implementation relies on .text property. If component is not object, .text is undefined.
      expect(result.name).toBe(DEFAULT_NAME);
      expect(result.description).toBe(DEFAULT_DESCRIPTION); // Will default and then ensure punctuation

      actorState = {
        [NAME_COMPONENT_ID]: null,
        [DESCRIPTION_COMPONENT_ID]: null,
      };
      result = extractor.extractPromptData(actorState);
      expect(result.name).toBe(DEFAULT_NAME);
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
    });

    test('should handle optional text attributes component data not being an object or not having text prop', () => {
      const actorState = {
        [PERSONALITY_COMPONENT_ID]: 'Just a string personality', // not {text: ...}
        [PROFILE_COMPONENT_ID]: null, // component itself is null
        [LIKES_COMPONENT_ID]: { notText: 'no text prop' }, // component exists but no 'text'
      };
      const result = extractor.extractPromptData(actorState);
      expect(result.personality).toBeUndefined();
      expect(result.profile).toBeUndefined();
      expect(result.likes).toBeUndefined();
    });

    test('should handle speech patterns component data not being an object or not having patterns prop', () => {
      let actorState = {
        [SPEECH_PATTERNS_COMPONENT_ID]: 'Just a string patterns', // not {patterns: ...}
      };
      let result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toBeUndefined();

      actorState = {
        [SPEECH_PATTERNS_COMPONENT_ID]: null,
      };
      result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toBeUndefined();

      actorState = {
        [SPEECH_PATTERNS_COMPONENT_ID]: { notPatterns: ['array', 'here'] },
      };
      result = extractor.extractPromptData(actorState);
      expect(result.speechPatterns).toBeUndefined();
    });
  });
});

// --- FILE END ---
