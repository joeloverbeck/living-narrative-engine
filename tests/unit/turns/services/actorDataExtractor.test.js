// tests/turns/services/actorDataExtractor.test.js
// --- FILE START ---

import { ActorDataExtractor } from '../../../../src/turns/services/actorDataExtractor.js';
import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  PERSONALITY_COMPONENT_ID,
  PROFILE_COMPONENT_ID,
  LIKES_COMPONENT_ID,
  DISLIKES_COMPONENT_ID,
  STRENGTHS_COMPONENT_ID,
  WEAKNESSES_COMPONENT_ID,
  SECRETS_COMPONENT_ID,
  FEARS_COMPONENT_ID,
  SPEECH_PATTERNS_COMPONENT_ID,
  APPARENT_AGE_COMPONENT_ID,
  MOTIVATIONS_COMPONENT_ID,
  INTERNAL_TENSIONS_COMPONENT_ID,
  DILEMMAS_COMPONENT_ID,
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

// Default values used by the service, useful for assertions
const DEFAULT_NAME = 'Unnamed Character';
const DEFAULT_DESCRIPTION = 'No description available.'; // Already ends with a period

/**
 * Creates default mood component data for tests.
 * @returns {object} Mood component data
 */
function createMoodComponent() {
  return {
    valence: 50,
    arousal: 30,
    agency_control: 40,
    threat: -20,
    engagement: 60,
    future_expectancy: 25,
    self_evaluation: 35,
  };
}

/**
 * Creates default sexual state component data for tests.
 * @returns {object} Sexual state component data
 */
function createSexualStateComponent() {
  return {
    sex_excitation: 20,
    sex_inhibition: 10,
    baseline_libido: 5,
  };
}

/**
 * Creates a mock emotionCalculatorService with default return values.
 * @returns {object} Mock emotion calculator service
 */
function createMockEmotionCalculatorService() {
  return {
    calculateSexualArousal: jest.fn().mockReturnValue(0.15),
    calculateEmotions: jest.fn().mockReturnValue(new Map([['calm', 0.5]])),
    calculateSexualStates: jest.fn().mockReturnValue(new Map()),
    formatEmotionsForPrompt: jest.fn().mockReturnValue('calm: moderate'),
    formatSexualStatesForPrompt: jest.fn().mockReturnValue(''),
  };
}

/**
 * Creates a minimal valid actor state with required emotional components.
 * @param {object} [overrides] - Additional component overrides
 * @returns {object} Actor state
 */
function createValidActorState(overrides = {}) {
  return {
    [NAME_COMPONENT_ID]: { text: 'Test Actor' },
    [MOOD_COMPONENT_ID]: createMoodComponent(),
    [SEXUAL_STATE_COMPONENT_ID]: createSexualStateComponent(),
    ...overrides,
  };
}

describe('ActorDataExtractor', () => {
  /** @type {ActorDataExtractor} */
  let extractor;
  let mockAnatomyDescriptionService;
  let mockEntityFinder;
  let mockEmotionCalculatorService;

  beforeEach(() => {
    mockAnatomyDescriptionService = {
      getOrGenerateBodyDescription: jest.fn(),
    };
    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };
    mockEmotionCalculatorService = createMockEmotionCalculatorService();
    extractor = new ActorDataExtractor({
      anatomyDescriptionService: mockAnatomyDescriptionService,
      entityFinder: mockEntityFinder,
      emotionCalculatorService: mockEmotionCalculatorService,
    });
  });

  describe('extractPromptData', () => {
    test('should return default name and description when actorState has only required emotional components', () => {
      const actorState = createValidActorState({
        [NAME_COMPONENT_ID]: undefined,
        [DESCRIPTION_COMPONENT_ID]: undefined,
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.name).toBe(DEFAULT_NAME);
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
      expect(result.personality).toBeUndefined();
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should return default name if name component is missing', () => {
      const actorState = createValidActorState({
        [DESCRIPTION_COMPONENT_ID]: { text: 'A character.' },
        [NAME_COMPONENT_ID]: undefined,
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.name).toBe(DEFAULT_NAME);
    });

    test('should return default name if name component text is null or empty string', () => {
      let actorState = createValidActorState({
        [NAME_COMPONENT_ID]: { text: null },
      });
      let result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.name).toBe(DEFAULT_NAME);

      actorState = createValidActorState({ [NAME_COMPONENT_ID]: { text: '' } });
      result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.name).toBe(DEFAULT_NAME);

      actorState = createValidActorState({
        [NAME_COMPONENT_ID]: { text: '   ' },
      });
      result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.name).toBe(DEFAULT_NAME);
    });

    test('should extract and trim name correctly', () => {
      const actorState = createValidActorState({
        [NAME_COMPONENT_ID]: { text: '  Test Name  ' },
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.name).toBe('Test Name');
    });

    test('should return default description if description component is missing', () => {
      const actorState = createValidActorState({
        [NAME_COMPONENT_ID]: { text: 'Test Character' },
        [DESCRIPTION_COMPONENT_ID]: undefined,
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
    });

    test('should return default description if description component text is null or empty string', () => {
      let actorState = createValidActorState({
        [DESCRIPTION_COMPONENT_ID]: { text: null },
      });
      let result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.description).toBe(DEFAULT_DESCRIPTION);

      actorState = createValidActorState({
        [DESCRIPTION_COMPONENT_ID]: { text: '' },
      });
      result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.description).toBe(DEFAULT_DESCRIPTION);

      actorState = createValidActorState({
        [DESCRIPTION_COMPONENT_ID]: { text: '   ' },
      });
      result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
    });

    test('should extract, trim, and punctuate description correctly', () => {
      const actorState = createValidActorState({
        [DESCRIPTION_COMPONENT_ID]: { text: '  A detailed description ' },
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.description).toBe('A detailed description.');
    });

    test('should not add extra punctuation if description already ends with a period', () => {
      const actorState = createValidActorState({
        [DESCRIPTION_COMPONENT_ID]: { text: 'Already punctuated.' },
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.description).toBe('Already punctuated.');
    });

    test('should not add extra punctuation if description already ends with an exclamation mark', () => {
      const actorState = createValidActorState({
        [DESCRIPTION_COMPONENT_ID]: { text: 'Exciting!' },
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.description).toBe('Exciting!');
    });

    test('should not add extra punctuation if description already ends with a question mark', () => {
      const actorState = createValidActorState({
        [DESCRIPTION_COMPONENT_ID]: { text: 'Really?' },
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.description).toBe('Really?');
    });

    test('should handle description that becomes empty after trim, defaulting to default description', () => {
      const actorState = createValidActorState({
        [DESCRIPTION_COMPONENT_ID]: { text: '   ' }, // Only spaces
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
    });

    test('should extract all optional text attributes if present and valid', () => {
      const actorState = createValidActorState({
        [NAME_COMPONENT_ID]: { text: 'Full Char' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'Desc.' },
        [PERSONALITY_COMPONENT_ID]: { text: '  Bright ' },
        [PROFILE_COMPONENT_ID]: { text: 'A mysterious individual.' },
        [LIKES_COMPONENT_ID]: { text: '  Apples, Pears  ' },
        [DISLIKES_COMPONENT_ID]: { text: 'Rain' },
        [STRENGTHS_COMPONENT_ID]: { text: '  Leadership, Problem-solving  ' },
        [WEAKNESSES_COMPONENT_ID]: { text: 'Impatience' },
        [SECRETS_COMPONENT_ID]: { text: 'Is secretly a cat.' },
      });
      const result = extractor.extractPromptData(actorState, 'actor-1');
      expect(result.personality).toBe('Bright');
      expect(result.profile).toBe('A mysterious individual.');
      expect(result.likes).toBe('Apples, Pears');
      expect(result.dislikes).toBe('Rain');
      expect(result.strengths).toBe('Leadership, Problem-solving');
      expect(result.weaknesses).toBe('Impatience');
      expect(result.secrets).toBe('Is secretly a cat.');
    });

    const optionalAttributesTestCases = [
      { field: 'personality', componentId: PERSONALITY_COMPONENT_ID },
      { field: 'profile', componentId: PROFILE_COMPONENT_ID },
      { field: 'likes', componentId: LIKES_COMPONENT_ID },
      { field: 'dislikes', componentId: DISLIKES_COMPONENT_ID },
      { field: 'strengths', componentId: STRENGTHS_COMPONENT_ID },
      { field: 'weaknesses', componentId: WEAKNESSES_COMPONENT_ID },
      { field: 'secrets', componentId: SECRETS_COMPONENT_ID },
    ];

    optionalAttributesTestCases.forEach(({ field, componentId }) => {
      test(`should leave ${field} undefined if component is missing`, () => {
        // createValidActorState doesn't include this optional component by default
        const actorState = createValidActorState();
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result[field]).toBeUndefined();
      });

      test(`should leave ${field} undefined if component text is null`, () => {
        const actorState = createValidActorState({
          [componentId]: { text: null },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result[field]).toBeUndefined();
      });

      test(`should leave ${field} undefined if component text is empty string`, () => {
        const actorState = createValidActorState({
          [componentId]: { text: '' },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result[field]).toBeUndefined();
      });

      test(`should leave ${field} undefined if component text is only whitespace`, () => {
        const actorState = createValidActorState({
          [componentId]: { text: '   ' },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result[field]).toBeUndefined();
      });

      test(`should leave ${field} undefined if component data is not a string (e.g. number)`, () => {
        const actorState = createValidActorState({
          [componentId]: { text: 123 },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result[field]).toBeUndefined();
      });

      test(`should extract and trim ${field} correctly`, () => {
        const actorState = createValidActorState({
          [componentId]: { text: `  Test ${field}  ` },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result[field]).toBe(`Test ${field}`);
      });
    });

    test('should correctly handle speech patterns: all valid', () => {
      const actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: {
          patterns: ['  Pattern 1  ', 'Pattern 2', ' Another Pattern! '],
        },
      });
      const result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toEqual([
        'Pattern 1',
        'Pattern 2',
        'Another Pattern!',
      ]);
    });

    test('should correctly handle speech patterns: some empty or whitespace', () => {
      const actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: {
          patterns: ['Valid', '  ', '', '  Pattern 3  ', null, undefined, 123],
        },
      });
      const result = extractor.extractPromptData(actorState, 'actor-test');
      // Note: The implementation maps non-strings to empty strings before filtering.
      // So null, undefined, 123 become '' and are filtered out.
      expect(result.speechPatterns).toEqual(['Valid', 'Pattern 3']);
    });

    test('should leave speechPatterns undefined if component is missing', () => {
      const actorState = createValidActorState();
      const result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should leave speechPatterns undefined if patterns array is missing', () => {
      const actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: {},
      }); // no 'patterns' array
      const result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should leave speechPatterns undefined if patterns array is null', () => {
      const actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: { patterns: null },
      });
      const result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should leave speechPatterns undefined if patterns array is empty', () => {
      const actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: { patterns: [] },
      });
      const result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toBeUndefined();
      // If the DTO/requirements change to expect an empty array:
      // expect(result.speechPatterns).toEqual([]);
    });

    test('should leave speechPatterns undefined if patterns array contains only empty or whitespace strings', () => {
      const actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: { patterns: ['', '   ', '      '] },
      });
      const result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toBeUndefined();
      // If the DTO/requirements change to expect an empty array:
      // expect(result.speechPatterns).toEqual([]);
    });

    test('should leave speechPatterns undefined if patterns array contains non-string elements that trim to empty', () => {
      const actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: {
          patterns: [null, undefined, 123, true, {}],
        },
      });
      const result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toBeUndefined();
    });

    test('should handle a mix of valid and invalid data gracefully', () => {
      const actorState = createValidActorState({
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
      });
      const result = extractor.extractPromptData(actorState, 'actor-test');

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
      let actorState = createValidActorState({
        [NAME_COMPONENT_ID]: 'Just a string name', // not {text: ...}
        [DESCRIPTION_COMPONENT_ID]: 'Just a string desc', // not {text: ...}
      });
      let result = extractor.extractPromptData(actorState, 'actor-test');
      // Current implementation relies on .text property. If component is not object, .text is undefined.
      expect(result.name).toBe(DEFAULT_NAME);
      expect(result.description).toBe(DEFAULT_DESCRIPTION); // Will default and then ensure punctuation

      actorState = createValidActorState({
        [NAME_COMPONENT_ID]: null,
        [DESCRIPTION_COMPONENT_ID]: null,
      });
      result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.name).toBe(DEFAULT_NAME);
      expect(result.description).toBe(DEFAULT_DESCRIPTION);
    });

    test('should handle optional text attributes component data not being an object or not having text prop', () => {
      const actorState = createValidActorState({
        [PERSONALITY_COMPONENT_ID]: 'Just a string personality', // not {text: ...}
        [PROFILE_COMPONENT_ID]: null, // component itself is null
        [LIKES_COMPONENT_ID]: { notText: 'no text prop' }, // component exists but no 'text'
      });
      const result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.personality).toBeUndefined();
      expect(result.profile).toBeUndefined();
      expect(result.likes).toBeUndefined();
    });

    test('should handle speech patterns component data not being an object or not having patterns prop', () => {
      let actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: 'Just a string patterns', // not {patterns: ...}
      });
      let result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toBeUndefined();

      actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: null,
      });
      result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toBeUndefined();

      actorState = createValidActorState({
        [SPEECH_PATTERNS_COMPONENT_ID]: { notPatterns: ['array', 'here'] },
      });
      result = extractor.extractPromptData(actorState, 'actor-test');
      expect(result.speechPatterns).toBeUndefined();
    });

    describe('psychological components extraction', () => {
      test('should extract all three psychological components when present', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [MOTIVATIONS_COMPONENT_ID]: {
            text: 'I seek power because I fear being powerless again.',
          },
          [INTERNAL_TENSIONS_COMPONENT_ID]: {
            text: 'I want revenge but also want to forgive.',
          },
          [DILEMMAS_COMPONENT_ID]: {
            text: 'Can I achieve justice without becoming a monster?',
          },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');

        expect(result.motivations).toBe(
          'I seek power because I fear being powerless again.'
        );
        expect(result.internalTensions).toBe(
          'I want revenge but also want to forgive.'
        );
        expect(result.coreDilemmas).toBe(
          'Can I achieve justice without becoming a monster?'
        );
      });

      test('should return undefined for psychological components when absent', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [DESCRIPTION_COMPONENT_ID]: { text: 'A simple character' },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');

        expect(result.motivations).toBeUndefined();
        expect(result.internalTensions).toBeUndefined();
        expect(result.coreDilemmas).toBeUndefined();
      });

      test('should handle mixed presence of psychological components', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [MOTIVATIONS_COMPONENT_ID]: {
            text: 'To protect those I love.',
          },
          // internal tensions missing
          [DILEMMAS_COMPONENT_ID]: {
            text: 'How far is too far when protecting family?',
          },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');

        expect(result.motivations).toBe('To protect those I love.');
        expect(result.internalTensions).toBeUndefined();
        expect(result.coreDilemmas).toBe(
          'How far is too far when protecting family?'
        );
      });

      test('should return undefined for empty text in psychological components', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [MOTIVATIONS_COMPONENT_ID]: { text: '' },
          [INTERNAL_TENSIONS_COMPONENT_ID]: { text: '   ' }, // whitespace only
          [DILEMMAS_COMPONENT_ID]: { text: null },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');

        expect(result.motivations).toBeUndefined();
        expect(result.internalTensions).toBeUndefined();
        expect(result.coreDilemmas).toBeUndefined();
      });

      test('should trim whitespace from psychological component text', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [MOTIVATIONS_COMPONENT_ID]: {
            text: '  To find my purpose  ',
          },
          [INTERNAL_TENSIONS_COMPONENT_ID]: {
            text: '\n\tDesire for freedom vs need for security\t\n',
          },
          [DILEMMAS_COMPONENT_ID]: {
            text: '  Can I trust again?  ',
          },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');

        expect(result.motivations).toBe('To find my purpose');
        expect(result.internalTensions).toBe(
          'Desire for freedom vs need for security'
        );
        expect(result.coreDilemmas).toBe('Can I trust again?');
      });

      test('should handle psychological components with invalid data types', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [MOTIVATIONS_COMPONENT_ID]: 'Just a string', // not {text: ...}
          [INTERNAL_TENSIONS_COMPONENT_ID]: null,
          [DILEMMAS_COMPONENT_ID]: { notText: 'wrong property' },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');

        expect(result.motivations).toBeUndefined();
        expect(result.internalTensions).toBeUndefined();
        expect(result.coreDilemmas).toBeUndefined();
      });

      test('should extract psychological components alongside other optional attributes', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Complex Character' },
          [PERSONALITY_COMPONENT_ID]: { text: 'Brooding and intense' },
          [FEARS_COMPONENT_ID]: { text: 'Being alone' },
          [MOTIVATIONS_COMPONENT_ID]: { text: 'To find belonging' },
          [INTERNAL_TENSIONS_COMPONENT_ID]: {
            text: 'Push people away vs need connection',
          },
          [DILEMMAS_COMPONENT_ID]: { text: 'Is vulnerability weakness?' },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');

        expect(result.personality).toBe('Brooding and intense');
        expect(result.fears).toBe('Being alone');
        expect(result.motivations).toBe('To find belonging');
        expect(result.internalTensions).toBe(
          'Push people away vs need connection'
        );
        expect(result.coreDilemmas).toBe('Is vulnerability weakness?');
      });
    });

    describe('apparent age extraction', () => {
      test('should extract apparent age when all fields are present', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Elena Rodriguez' },
          [DESCRIPTION_COMPONENT_ID]: { text: 'A woman with sharp features' },
          [APPARENT_AGE_COMPONENT_ID]: {
            minAge: 30,
            maxAge: 35,
            bestGuess: 33,
          },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result.apparentAge).toEqual({
          minAge: 30,
          maxAge: 35,
          bestGuess: 33,
        });
      });

      test('should extract apparent age without bestGuess', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [APPARENT_AGE_COMPONENT_ID]: {
            minAge: 25,
            maxAge: 30,
          },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result.apparentAge).toEqual({
          minAge: 25,
          maxAge: 30,
        });
      });

      test('should not include apparent age if component is missing', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [DESCRIPTION_COMPONENT_ID]: { text: 'A test description' },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result.apparentAge).toBeUndefined();
      });

      test('should not include apparent age if minAge is missing', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [APPARENT_AGE_COMPONENT_ID]: {
            maxAge: 30,
            bestGuess: 28,
          },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result.apparentAge).toBeUndefined();
      });

      test('should not include apparent age if maxAge is missing', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [APPARENT_AGE_COMPONENT_ID]: {
            minAge: 25,
            bestGuess: 28,
          },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result.apparentAge).toBeUndefined();
      });

      test('should include apparent age even if bestGuess is 0', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Baby Character' },
          [APPARENT_AGE_COMPONENT_ID]: {
            minAge: 0,
            maxAge: 1,
            bestGuess: 0,
          },
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result.apparentAge).toEqual({
          minAge: 0,
          maxAge: 1,
          bestGuess: 0,
        });
      });

      test('should not include apparent age if data is null', () => {
        const actorState = createValidActorState({
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [APPARENT_AGE_COMPONENT_ID]: null,
        });
        const result = extractor.extractPromptData(actorState, 'actor-test');
        expect(result.apparentAge).toBeUndefined();
      });
    });

    test('throws TypeError when actorState is null', () => {
      expect(() => extractor.extractPromptData(null)).toThrow(
        new TypeError('actorState must be an object')
      );
    });

    test('throws TypeError when actorState is a primitive', () => {
      expect(() => extractor.extractPromptData(42)).toThrow(
        new TypeError('actorState must be an object')
      );
    });

    describe('health state extraction', () => {
      let mockInjuryAggregationService;
      let mockInjuryNarrativeFormatterService;
      let extractorWithHealth;

      beforeEach(() => {
        mockInjuryAggregationService = {
          aggregateInjuries: jest.fn(),
        };
        mockInjuryNarrativeFormatterService = {
          formatFirstPerson: jest.fn(),
        };
        extractorWithHealth = new ActorDataExtractor({
          anatomyDescriptionService: mockAnatomyDescriptionService,
          entityFinder: mockEntityFinder,
          injuryAggregationService: mockInjuryAggregationService,
          injuryNarrativeFormatterService: mockInjuryNarrativeFormatterService,
          emotionCalculatorService: createMockEmotionCalculatorService(),
        });
      });

      test('should return null healthState when injuryAggregationService not provided', () => {
        const extractorWithoutHealth = new ActorDataExtractor({
          anatomyDescriptionService: mockAnatomyDescriptionService,
          entityFinder: mockEntityFinder,
          emotionCalculatorService: createMockEmotionCalculatorService(),
        });
        const actorState = createValidActorState();
        const result = extractorWithoutHealth.extractPromptData(
          actorState,
          'actor-1'
        );
        expect(result.healthState).toBeNull();
      });

      test('should return null healthState when actorId not provided', () => {
        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(actorState);
        expect(result.healthState).toBeNull();
        expect(
          mockInjuryAggregationService.aggregateInjuries
        ).not.toHaveBeenCalled();
      });

      test('should return null healthState for healthy characters (100% health, no injuries)', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          overallHealthPercentage: 100,
          injuredParts: [],
          isDying: false,
          isDead: false,
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
        });

        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(
          actorState,
          'actor-1'
        );

        expect(result.healthState).toBeNull();
        expect(
          mockInjuryAggregationService.aggregateInjuries
        ).toHaveBeenCalledWith('actor-1');
      });

      test('should return null healthState when aggregation service returns null', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue(null);

        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(
          actorState,
          'actor-1'
        );

        expect(result.healthState).toBeNull();
      });

      test('should return ActorHealthStateDTO for injured characters', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          overallHealthPercentage: 75,
          injuredParts: [
            {
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
              healthPercentage: 50,
              isBleeding: true,
              bleedingSeverity: 'moderate',
              isBurning: false,
              isPoisoned: false,
              isFractured: false,
            },
          ],
          isDying: false,
          isDead: false,
          bleedingParts: [{ partType: 'arm' }],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dyingTurnsRemaining: null,
        });
        mockInjuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
          'My left arm is wounded and bleeding.'
        );

        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(
          actorState,
          'actor-1'
        );

        expect(result.healthState).toEqual({
          overallHealthPercentage: 75,
          overallStatus: 'wounded',
          injuries: [
            {
              partName: 'left arm',
              partType: 'arm',
              state: 'wounded',
              healthPercent: 50,
              effects: ['bleeding_moderate'],
            },
          ],
          activeEffects: ['bleeding'],
          isDying: false,
          turnsUntilDeath: null,
          firstPersonNarrative: 'My left arm is wounded and bleeding.',
        });
      });

      test('should include firstPersonNarrative when formatter available', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          overallHealthPercentage: 60,
          injuredParts: [
            {
              partType: 'leg',
              orientation: null,
              state: 'injured',
              healthPercentage: 40,
              isBleeding: false,
              isBurning: false,
              isPoisoned: true,
              isFractured: false,
            },
          ],
          isDying: false,
          isDead: false,
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [{ partType: 'leg' }],
          fracturedParts: [],
        });
        mockInjuryNarrativeFormatterService.formatFirstPerson.mockReturnValue(
          'My leg feels numb from the poison.'
        );

        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(
          actorState,
          'actor-1'
        );

        expect(result.healthState.firstPersonNarrative).toBe(
          'My leg feels numb from the poison.'
        );
        expect(
          mockInjuryNarrativeFormatterService.formatFirstPerson
        ).toHaveBeenCalled();
      });

      test('should correctly map overallStatus based on health percentage', () => {
        // Thresholds: 100+ healthy, 80+ scratched, 60+ wounded, 40+ injured, <40 critical
        const testCases = [
          { percentage: 100, expected: 'healthy' },
          { percentage: 85, expected: 'scratched' },
          { percentage: 80, expected: 'scratched' },
          { percentage: 79, expected: 'wounded' },
          { percentage: 75, expected: 'wounded' },
          { percentage: 65, expected: 'wounded' },
          { percentage: 60, expected: 'wounded' },
          { percentage: 59, expected: 'injured' },
          { percentage: 50, expected: 'injured' },
          { percentage: 40, expected: 'injured' },
          { percentage: 39, expected: 'critical' },
          { percentage: 35, expected: 'critical' },
          { percentage: 10, expected: 'critical' },
        ];

        testCases.forEach(({ percentage, expected }) => {
          mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
            overallHealthPercentage: percentage,
            injuredParts: [
              {
                partType: 'chest',
                orientation: null,
                state: 'wounded',
                healthPercentage: percentage,
                isBleeding: false,
                isBurning: false,
                isPoisoned: false,
                isFractured: false,
              },
            ],
            isDying: false,
            isDead: false,
            bleedingParts: [],
            burningParts: [],
            poisonedParts: [],
            fracturedParts: [],
          });

          const actorState = createValidActorState();
          const result = extractorWithHealth.extractPromptData(
            actorState,
            `actor-${percentage}`
          );

          expect(result.healthState.overallStatus).toBe(expected);
        });
      });

      test('should return dying status when isDying is true', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          overallHealthPercentage: 5,
          injuredParts: [
            {
              partType: 'torso',
              orientation: null,
              state: 'critical',
              healthPercentage: 5,
              isBleeding: true,
              bleedingSeverity: 'severe',
              isBurning: false,
              isPoisoned: false,
              isFractured: false,
            },
          ],
          isDying: true,
          isDead: false,
          dyingTurnsRemaining: 3,
          bleedingParts: [{ partType: 'torso' }],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
        });

        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(
          actorState,
          'actor-dying'
        );

        expect(result.healthState.overallStatus).toBe('dying');
        expect(result.healthState.isDying).toBe(true);
        expect(result.healthState.turnsUntilDeath).toBe(3);
      });

      test('should return dead status when isDead is true', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          overallHealthPercentage: 0,
          injuredParts: [
            {
              partType: 'head',
              orientation: null,
              state: 'destroyed',
              healthPercentage: 0,
              isBleeding: false,
              isBurning: false,
              isPoisoned: false,
              isFractured: false,
            },
          ],
          isDying: false,
          isDead: true,
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
        });

        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(
          actorState,
          'actor-dead'
        );

        expect(result.healthState.overallStatus).toBe('dead');
      });

      test('should collect part effects correctly (bleeding, burning, poisoned, fractured)', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          overallHealthPercentage: 30,
          injuredParts: [
            {
              partType: 'arm',
              orientation: 'right',
              state: 'critical',
              healthPercentage: 20,
              isBleeding: true,
              bleedingSeverity: 'severe',
              isBurning: true,
              isPoisoned: true,
              isFractured: true,
            },
          ],
          isDying: false,
          isDead: false,
          bleedingParts: [{ partType: 'arm' }],
          burningParts: [{ partType: 'arm' }],
          poisonedParts: [{ partType: 'arm' }],
          fracturedParts: [{ partType: 'arm' }],
        });

        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(
          actorState,
          'actor-1'
        );

        expect(result.healthState.injuries[0].effects).toEqual([
          'bleeding_severe',
          'burning',
          'poisoned',
          'fractured',
        ]);
        expect(result.healthState.activeEffects).toEqual([
          'bleeding',
          'burning',
          'poisoned',
          'fractured',
        ]);
      });

      test('should handle aggregation service errors gracefully', () => {
        mockInjuryAggregationService.aggregateInjuries.mockImplementation(
          () => {
            throw new Error('Service unavailable');
          }
        );

        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(
          actorState,
          'actor-1'
        );

        expect(result.healthState).toBeNull();
      });

      test('should format part names with orientation correctly', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          overallHealthPercentage: 50,
          injuredParts: [
            {
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
              healthPercentage: 50,
              isBleeding: false,
              isBurning: false,
              isPoisoned: false,
              isFractured: false,
            },
            {
              partType: 'leg',
              orientation: 'right',
              state: 'scratched',
              healthPercentage: 80,
              isBleeding: false,
              isBurning: false,
              isPoisoned: false,
              isFractured: false,
            },
            {
              partType: 'torso',
              orientation: null,
              state: 'injured',
              healthPercentage: 40,
              isBleeding: false,
              isBurning: false,
              isPoisoned: false,
              isFractured: false,
            },
          ],
          isDying: false,
          isDead: false,
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
        });

        const actorState = createValidActorState();
        const result = extractorWithHealth.extractPromptData(
          actorState,
          'actor-1'
        );

        expect(result.healthState.injuries[0].partName).toBe('left arm');
        expect(result.healthState.injuries[1].partName).toBe('right leg');
        expect(result.healthState.injuries[2].partName).toBe('torso');
      });

      test('should not include firstPersonNarrative when formatter not available', () => {
        const extractorWithoutFormatter = new ActorDataExtractor({
          anatomyDescriptionService: mockAnatomyDescriptionService,
          entityFinder: mockEntityFinder,
          injuryAggregationService: mockInjuryAggregationService,
          emotionCalculatorService: createMockEmotionCalculatorService(),
        });

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          overallHealthPercentage: 70,
          injuredParts: [
            {
              partType: 'hand',
              orientation: 'left',
              state: 'scratched',
              healthPercentage: 85,
              isBleeding: false,
              isBurning: false,
              isPoisoned: false,
              isFractured: false,
            },
          ],
          isDying: false,
          isDead: false,
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
        });

        const actorState = createValidActorState();
        const result = extractorWithoutFormatter.extractPromptData(
          actorState,
          'actor-1'
        );

        expect(result.healthState.firstPersonNarrative).toBeNull();
      });

      test('should not call formatter when no injured parts', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          overallHealthPercentage: 95,
          injuredParts: [],
          isDying: true,
          isDead: false,
          dyingTurnsRemaining: 5,
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
        });

        const actorState = createValidActorState();
        extractorWithHealth.extractPromptData(actorState, 'actor-1');

        expect(
          mockInjuryNarrativeFormatterService.formatFirstPerson
        ).not.toHaveBeenCalled();
      });
    });
  });
});

// --- FILE END ---
