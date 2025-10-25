import { describe, it, expect, jest } from '@jest/globals';
import {
  PROMPT_VERSION_INFO,
  SPEECH_PATTERNS_LLM_PARAMS,
  SPEECH_PATTERNS_RESPONSE_SCHEMA,
  PromptVariations,
  createSpeechPatternsPrompt,
  createFocusedPrompt,
  validateSpeechPatternsGenerationResponse,
  buildSpeechPatternsGenerationPrompt,
} from '../../../../src/characterBuilder/prompts/speechPatternsPrompts.js';

describe('speechPatternsPrompts constants', () => {
  it('exposes the current prompt version information', () => {
    expect(PROMPT_VERSION_INFO).toEqual({
      version: '2.0.0',
      previousVersions: {
        '1.0.0': 'Initial implementation with unstructured format',
      },
      currentChanges: expect.arrayContaining([
        'Implemented XML-like organizational structure for architectural consistency',
        'Enhanced focused prompt integration with XML structure',
      ]),
    });
  });

  it('provides the default LLM parameter configuration', () => {
    expect(SPEECH_PATTERNS_LLM_PARAMS).toEqual({
      temperature: 0.8,
      max_tokens: 3000,
    });
  });

  it('defines the response schema used for validation', () => {
    expect(SPEECH_PATTERNS_RESPONSE_SCHEMA).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['characterName', 'speechPatterns'],
      properties: {
        characterName: expect.any(Object),
        speechPatterns: expect.objectContaining({
          type: 'array',
          minItems: 3,
          items: expect.objectContaining({
            required: ['pattern', 'example'],
          }),
        }),
      },
    });
  });

  it('lists all supported focused prompt variations', () => {
    expect(Object.keys(PromptVariations)).toEqual([
      'EMOTIONAL_FOCUS',
      'SOCIAL_FOCUS',
      'PSYCHOLOGICAL_FOCUS',
      'RELATIONSHIP_FOCUS',
    ]);
    expect(PromptVariations.EMOTIONAL_FOCUS.patternCount).toBe(25);
    expect(PromptVariations.SOCIAL_FOCUS.additionalInstructions).toContain(
      'Social Dynamics'
    );
  });
});

describe('createSpeechPatternsPrompt', () => {
  const baseCharacter = {
    name: 'Lyra',
    personality: ['curious', 'empathetic'],
    background: {
      origin: 'Nova Station',
      relationships: ['mentor: Dr. Ibarra'],
    },
  };

  it('renders the full prompt template with default pattern count', () => {
    const prompt = createSpeechPatternsPrompt(baseCharacter);

    expect(prompt).toContain('<role>');
    expect(prompt).toContain('<task_definition>');
    expect(prompt).toContain('approximately 20 unique and distinctive speech patterns');
    expect(prompt).toContain('targeting ~20');
    expect(prompt).toContain('Focus on psychological and emotional depth');
    expect(prompt).toContain('"name": "Lyra"');
    expect(prompt).toContain('"origin": "Nova Station"');
    expect(prompt).toContain('<content_policy>');
  });

  it('honors a custom pattern count when provided', () => {
    const prompt = createSpeechPatternsPrompt(baseCharacter, { patternCount: 12 });

    expect(prompt).toContain('approximately 12 unique and distinctive speech patterns');
    expect(prompt).toContain('targeting ~12');
  });
});

describe('createFocusedPrompt', () => {
  const character = {
    name: 'Rin',
    traits: ['resolute'],
  };

  it('applies the requested focus variation instructions', () => {
    const prompt = createFocusedPrompt(character, 'EMOTIONAL_FOCUS');

    expect(prompt).toContain('SPECIAL FOCUS: Emotional Expression');
    expect(prompt).toContain('targeting ~25');
  });

  it('falls back to psychological focus when the type is unknown', () => {
    const prompt = createFocusedPrompt(character, 'UNKNOWN_TYPE');

    expect(prompt).toContain('SPECIAL FOCUS: Psychological Complexity');
    expect(prompt).toContain('targeting ~20');
  });

  it('allows overriding the variation pattern count through options', () => {
    const prompt = createFocusedPrompt(character, 'RELATIONSHIP_FOCUS', {
      patternCount: 18,
    });

    expect(prompt).toContain('targeting ~18');
    expect(prompt).toContain('SPECIAL FOCUS: Relationship Dynamics');
  });
});

describe('validateSpeechPatternsGenerationResponse', () => {
  it('confirms valid responses and logs debug information', () => {
    const logger = { debug: jest.fn(), warn: jest.fn() };
    const response = {
      characterName: 'Lyra',
      speechPatterns: [
        { pattern: 'Measured cadence', example: "It's wonderful to see you", circumstances: 'around allies' },
        { pattern: 'Sharp sarcasm', example: 'Oh, brilliant plan.', circumstances: undefined },
        { pattern: 'Rapid tangents', example: 'And then we could—no, wait—', circumstances: '' },
      ],
    };

    const result = validateSpeechPatternsGenerationResponse(response, logger);

    expect(result).toEqual({ isValid: true, errors: [] });
    expect(logger.debug).toHaveBeenCalledWith('Speech patterns response validation passed', {
      patternCount: 3,
      characterName: 'Lyra',
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('captures validation failures and emits structured warnings', () => {
    const logger = { debug: jest.fn(), warn: jest.fn() };
    const response = {
      characterName: '',
      speechPatterns: [
        { pattern: 'shrt', example: 'hi', circumstances: 42 },
      ],
    };

    const result = validateSpeechPatternsGenerationResponse(response, logger);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'At least 3 speech patterns are required',
        "Pattern 1: 'pattern' must be at least 5 characters long",
        "Pattern 1: 'example' must be at least 3 characters long",
        "Pattern 1: 'circumstances' must be a string if provided",
        'characterName is required and must be a string',
      ])
    );
    expect(logger.warn).toHaveBeenCalledWith('Speech patterns response validation failed', {
      errors: expect.arrayContaining([
        expect.stringContaining('Pattern 1'),
      ]),
    });
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('fails fast when the response payload is missing or invalid', () => {
    const result = validateSpeechPatternsGenerationResponse(null);

    expect(result).toEqual({
      isValid: false,
      errors: ['Response must be a valid object'],
    });
  });

  it('fails fast when the speechPatterns array is missing', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Echo',
    });

    expect(result).toEqual({
      isValid: false,
      errors: ['speechPatterns array is required'],
    });
  });

  it('flags missing pattern descriptions on individual entries', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Echo',
      speechPatterns: [
        { example: 'Says things twice.' },
        { pattern: 'Echoing cadence', example: 'Echo echo' },
        { pattern: 'Rhythmic delivery', example: 'Tap tap tap' },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Pattern 1: 'pattern' field is required and must be a string",
      ])
    );
  });

  it('flags missing example dialogue on individual entries', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Echo',
      speechPatterns: [
        { pattern: 'Repeating phrases', example: null },
        { pattern: 'Echoing cadence', example: 'Echo echo' },
        { pattern: 'Rhythmic delivery', example: 'Tap tap tap' },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Pattern 1: 'example' field is required and must be a string",
      ])
    );
  });

  it('returns a catch-all error when response access throws', () => {
    const explosivePattern = {};
    Object.defineProperty(explosivePattern, 'pattern', {
      get() {
        throw new Error('boom');
      },
    });
    const response = {
      characterName: 'Nova',
      speechPatterns: [explosivePattern],
    };

    const result = validateSpeechPatternsGenerationResponse(response);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Validation error: boom',
        'At least 3 speech patterns are required',
      ])
    );
  });
});

describe('buildSpeechPatternsGenerationPrompt', () => {
  const character = { name: 'Ilya', archetype: 'strategist' };

  it('requires character data input', () => {
    expect(() => buildSpeechPatternsGenerationPrompt(null)).toThrow(
      'Character data is required and must be an object'
    );
  });

  it('delegates to focused prompt generation when a focus type is provided', () => {
    const prompt = buildSpeechPatternsGenerationPrompt(character, {
      focusType: 'SOCIAL_FOCUS',
    });

    expect(prompt).toContain('SPECIAL FOCUS: Social Dynamics');
    expect(prompt).toContain('targeting ~22');
  });

  it('builds a standard prompt when no focus is supplied', () => {
    const prompt = buildSpeechPatternsGenerationPrompt(character);

    expect(prompt).toContain('approximately 20 unique and distinctive speech patterns');
    expect(prompt).toContain('targeting ~20');
  });
});
