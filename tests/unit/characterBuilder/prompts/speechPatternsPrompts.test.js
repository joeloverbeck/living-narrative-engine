import { describe, it, expect, jest } from '@jest/globals';
import {
  PROMPT_VERSION_INFO,
  SPEECH_PATTERNS_LLM_PARAMS,
  SPEECH_PATTERNS_RESPONSE_SCHEMA,
  createSpeechPatternsPrompt,
  validateSpeechPatternsGenerationResponse,
  buildSpeechPatternsGenerationPrompt,
} from '../../../../src/characterBuilder/prompts/speechPatternsPrompts.js';

describe('speechPatternsPrompts constants', () => {
  it('exposes the current prompt version information', () => {
    expect(PROMPT_VERSION_INFO).toEqual({
      version: '4.0.0',
      previousVersions: {
        '1.0.0': 'Initial implementation with unstructured format',
        '2.0.0': 'XML-like structure with pattern/example/circumstances fields',
        '3.0.0': 'Updated to type/contexts[]/examples[] structure',
      },
      currentChanges: expect.arrayContaining([
        'Replaced generic consultant role with voice architect role',
        'Added hard rules section with 6 strict requirements',
        'Added 4-step method with quality gates',
        'Added example length mix requirements',
        'Removed unused PromptVariations and createFocusedPrompt',
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
          maxItems: 8,
          items: expect.objectContaining({
            required: ['type', 'examples'],
          }),
        }),
      },
    });
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

    // Check for new prompt structure sections
    expect(prompt).toContain('<role>');
    expect(prompt).toContain(
      'senior character-voice architect for fiction and dialogue-heavy RPGs'
    );
    expect(prompt).toContain('<inputs>');
    expect(prompt).toContain('<character_definition>');
    expect(prompt).toContain('<target_settings>');
    expect(prompt).toContain('<pattern_group_count>4-8</pattern_group_count>');
    expect(prompt).toContain('<target_total_examples>20</target_total_examples>');
    expect(prompt).toContain('<example_length_mix>');
    expect(prompt).toContain('<hard_rules>');
    expect(prompt).toContain('### 1) NO RETCONS');
    expect(prompt).toContain('### 2) SPOKEN DIALOGUE ONLY');
    expect(prompt).toContain('### 3) DISTINCTIVENESS IS MANDATORY');
    expect(prompt).toContain('### 4) RANGE, NOT ONE NOTE');
    expect(prompt).toContain('### 5) AVOID LLM-SLOP');
    expect(prompt).toContain('### 6) KEEP STRUCTURE STRICT');
    expect(prompt).toContain('<method>');
    expect(prompt).toContain('### Step A — Extract Voice Fingerprint');
    expect(prompt).toContain('### Step B — Set Constraints');
    expect(prompt).toContain('### Step C — Build the Pattern Groups');
    expect(prompt).toContain('### Step D — Quality Gates');
    expect(prompt).toContain('GATE 1: 1–2 Line Recognizability');
    expect(prompt).toContain('GATE 2: Not-a-Gimmick');
    expect(prompt).toContain('GATE 3: Speakability');
    expect(prompt).toContain('GATE 4: Persona Grounding');
    expect(prompt).toContain('<output_requirements>');
    expect(prompt).toContain('<response_format>');
    expect(prompt).toContain('"name": "Lyra"');
    expect(prompt).toContain('"origin": "Nova Station"');
    expect(prompt).toContain('"type": "Pattern Category Name');
    expect(prompt).toContain('"contexts"');
    expect(prompt).toContain('"examples"');
    expect(prompt).toContain('<content_policy>');
  });

  it('honors a custom pattern count when provided', () => {
    const prompt = createSpeechPatternsPrompt(baseCharacter, {
      patternCount: 12,
    });

    expect(prompt).toContain('<target_total_examples>12</target_total_examples>');
    expect(prompt).toContain('Aim for ~12 total examples across all groups');
  });

  it('includes example length mix requirements', () => {
    const prompt = createSpeechPatternsPrompt(baseCharacter);

    expect(prompt).toContain('20–35% "barks" (<= 10 words)');
    expect(prompt).toContain('55–75% "standard lines" (<= 25 words)');
    expect(prompt).toContain('0–15% "long lines" (<= 60 words');
  });

  it('includes pattern group suggestions', () => {
    const prompt = createSpeechPatternsPrompt(baseCharacter);

    expect(prompt).toContain('Social Mask / Default Charm');
    expect(prompt).toContain('Deflection Under Praise');
    expect(prompt).toContain('Predatory People-Reading / Negotiation');
    expect(prompt).toContain('Boundary-Setting / Exit Lines');
    expect(prompt).toContain('Intimacy Pressure Response');
  });
});

describe('validateSpeechPatternsGenerationResponse', () => {
  it('confirms valid responses and logs debug information', () => {
    const logger = { debug: jest.fn(), warn: jest.fn() };
    const response = {
      characterName: 'Lyra',
      speechPatterns: [
        {
          type: 'Measured cadence',
          examples: ["It's wonderful to see you", 'How delightful'],
          contexts: ['around allies'],
        },
        {
          type: 'Sharp sarcasm',
          examples: ['Oh, brilliant plan.', 'What could go wrong?'],
          contexts: undefined,
        },
        {
          type: 'Rapid tangents',
          examples: ['And then we could—no, wait—', 'But what if—'],
          contexts: [],
        },
      ],
    };

    const result = validateSpeechPatternsGenerationResponse(response, logger);

    expect(result).toEqual({ isValid: true, errors: [] });
    expect(logger.debug).toHaveBeenCalledWith(
      'Speech patterns response validation passed',
      {
        patternCount: 3,
        characterName: 'Lyra',
      }
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('captures validation failures and emits structured warnings', () => {
    const logger = { debug: jest.fn(), warn: jest.fn() };
    const response = {
      characterName: '',
      speechPatterns: [{ type: 'shrt', examples: ['hi'], contexts: 42 }],
    };

    const result = validateSpeechPatternsGenerationResponse(response, logger);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'At least 3 speech patterns are required',
        "Pattern 1: 'type' must be at least 5 characters long",
        "Pattern 1: 'examples' must have at least 2 items",
        "Pattern 1: 'contexts' must be an array if provided",
        'characterName is required and must be a string',
      ])
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Speech patterns response validation failed',
      {
        errors: expect.arrayContaining([expect.stringContaining('Pattern 1')]),
      }
    );
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

  it('flags missing type field on individual entries', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Echo',
      speechPatterns: [
        { examples: ['Says things twice.', 'Repeats often'] },
        { type: 'Echoing cadence', examples: ['Echo echo', 'Echo'] },
        { type: 'Rhythmic delivery', examples: ['Tap tap tap', 'Tap'] },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Pattern 1: 'type' field is required and must be a string",
      ])
    );
  });

  it('flags missing examples array on individual entries', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Echo',
      speechPatterns: [
        { type: 'Repeating phrases', examples: null },
        { type: 'Echoing cadence', examples: ['Echo echo', 'Echo'] },
        { type: 'Rhythmic delivery', examples: ['Tap tap tap', 'Tap'] },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Pattern 1: 'examples' field is required and must be an array",
      ])
    );
  });

  it('returns a catch-all error when response access throws', () => {
    const explosivePattern = {};
    Object.defineProperty(explosivePattern, 'type', {
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

  it('validates that contexts must contain string items', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Test',
      speechPatterns: [
        {
          type: 'Pattern A',
          examples: ['ex1', 'ex2'],
          contexts: ['valid', 123, 'also valid'],
        },
        { type: 'Pattern B', examples: ['ex1', 'ex2'] },
        { type: 'Pattern C', examples: ['ex1', 'ex2'] },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(['Pattern 1, context 2: must be a string'])
    );
  });

  it('validates that contexts strings are not empty', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Test',
      speechPatterns: [
        {
          type: 'Pattern A',
          examples: ['ex1', 'ex2'],
          contexts: ['valid', '', 'also valid'],
        },
        { type: 'Pattern B', examples: ['ex1', 'ex2'] },
        { type: 'Pattern C', examples: ['ex1', 'ex2'] },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Pattern 1, context 2: must be at least 1 character long',
      ])
    );
  });

  it('validates that examples must contain string items', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Test',
      speechPatterns: [
        { type: 'Pattern A', examples: ['valid', 456, 'also valid'] },
        { type: 'Pattern B', examples: ['ex1', 'ex2'] },
        { type: 'Pattern C', examples: ['ex1', 'ex2'] },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(['Pattern 1, example 2: must be a string'])
    );
  });

  it('validates that examples are at least 3 characters long', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Test',
      speechPatterns: [
        { type: 'Pattern A', examples: ['valid example', 'hi'] },
        { type: 'Pattern B', examples: ['ex1', 'ex2'] },
        { type: 'Pattern C', examples: ['ex1', 'ex2'] },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Pattern 1, example 2: must be at least 3 characters long',
      ])
    );
  });

  it('validates that examples array has at most 5 items', () => {
    const result = validateSpeechPatternsGenerationResponse({
      characterName: 'Test',
      speechPatterns: [
        {
          type: 'Pattern A',
          examples: ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6'],
        },
        { type: 'Pattern B', examples: ['ex1', 'ex2'] },
        { type: 'Pattern C', examples: ['ex1', 'ex2'] },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Pattern 1: 'examples' must have at most 5 items",
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

  it('builds a standard prompt with new v4 structure', () => {
    const prompt = buildSpeechPatternsGenerationPrompt(character);

    expect(prompt).toContain('<role>');
    expect(prompt).toContain('senior character-voice architect');
    expect(prompt).toContain('<hard_rules>');
    expect(prompt).toContain('<method>');
    expect(prompt).toContain('<output_requirements>');
    expect(prompt).toContain('<pattern_group_count>4-8</pattern_group_count>');
    expect(prompt).toContain('<target_total_examples>20</target_total_examples>');
  });

  it('passes options through to the underlying prompt function', () => {
    const prompt = buildSpeechPatternsGenerationPrompt(character, {
      patternCount: 15,
    });

    expect(prompt).toContain('<target_total_examples>15</target_total_examples>');
    expect(prompt).toContain('Aim for ~15 total examples across all groups');
  });
});
