import { describe, it, expect } from '@jest/globals';
import {
  buildEnhancedClicheGenerationPrompt,
  createClicheGenerationLlmConfig,
  createEnhancedClicheGenerationLlmConfig,
  validateClicheGenerationResponse,
  validateClicheGenerationResponseEnhanced,
  DEFAULT_ENHANCEMENT_OPTIONS,
  CLICHE_GENERATION_RESPONSE_SCHEMA,
  PROMPT_VERSION_INFO,
} from '../../../../src/characterBuilder/prompts/clicheGenerationPrompt.js';

describe('clicheGenerationPrompt integration', () => {
  const baseConcept = 'A wandering bard haunted by unfinished stories.';
  const baseDirection = {
    title: 'Echo Collector',
    description: 'Gathers legends before they fade into myth.',
    coreTension: 'Preserving truth versus crafting better lies',
  };

  it('builds enhanced prompt with few-shot examples, genre context, and custom item ranges', () => {
    const prompt = buildEnhancedClicheGenerationPrompt(
      baseConcept,
      baseDirection,
      {
        includeFewShotExamples: true,
        genre: 'SciFi',
        minItemsPerCategory: 4,
        maxItemsPerCategory: 9,
      }
    );

    expect(prompt).toContain('<examples>');
    expect(prompt).toContain('Focus on sci-fi clichés');
    expect(prompt).toContain('Provide 4-9 items per category');
    expect(prompt).toContain(baseConcept);
    expect(prompt).toContain(baseDirection.title);
  });

  it('creates enhanced LLM configuration by merging defaults, schema, and enhancement flags', () => {
    const baseConfig = {
      model: 'gpt-integration-test',
      defaultParameters: {
        temperature: 0.4,
        top_p: 0.85,
      },
      transport: 'mocked-transport',
    };

    const enhanced = createEnhancedClicheGenerationLlmConfig(baseConfig, {
      includeFewShotExamples: true,
      genre: 'fantasy',
      minItemsPerCategory: 5,
    });

    expect(enhanced).not.toBe(baseConfig);
    expect(enhanced.jsonOutputStrategy).toEqual({
      method: 'openrouter_json_schema',
      jsonSchema: CLICHE_GENERATION_RESPONSE_SCHEMA,
    });
    expect(enhanced.defaultParameters.temperature).toBe(0.8);
    expect(enhanced.defaultParameters.max_tokens).toBe(3000);
    expect(enhanced.defaultParameters.top_p).toBe(0.85);
    expect(enhanced.enhancementOptions).toMatchObject({
      ...DEFAULT_ENHANCEMENT_OPTIONS,
      includeFewShotExamples: true,
      genre: 'fantasy',
      minItemsPerCategory: 5,
    });
    expect(enhanced.promptVersion).toBe(PROMPT_VERSION_INFO.version);
    expect(baseConfig).not.toHaveProperty('jsonOutputStrategy');
    expect(createClicheGenerationLlmConfig(baseConfig)).toMatchObject({
      jsonOutputStrategy: enhanced.jsonOutputStrategy,
      defaultParameters: enhanced.defaultParameters,
    });
  });

  describe('structural validation guardrails', () => {
    it('throws when response is not an object', () => {
      expect(() => validateClicheGenerationResponse(null)).toThrow(
        'ClicheGenerationPrompt: Response must be an object'
      );
    });

    it('throws when categories container is missing', () => {
      expect(() =>
        validateClicheGenerationResponse({ tropesAndStereotypes: [] })
      ).toThrow(
        'ClicheGenerationPrompt: Response must contain categories object'
      );
    });

    it('throws when tropes collection is not an array', () => {
      expect(() =>
        validateClicheGenerationResponse({
          categories: {},
          tropesAndStereotypes: 'nope',
        })
      ).toThrow(
        'ClicheGenerationPrompt: Response must contain tropesAndStereotypes array'
      );
    });

    it('throws when required category is missing', () => {
      expect(() =>
        validateClicheGenerationResponse({
          categories: {},
          tropesAndStereotypes: [],
        })
      ).toThrow("ClicheGenerationPrompt: Missing required category 'names'");
    });

    it('throws when category is not an array', () => {
      const categories = {
        names: 'not-an-array',
        physicalDescriptions: [],
        personalityTraits: [],
        skillsAbilities: [],
        typicalLikes: [],
        typicalDislikes: [],
        commonFears: [],
        genericGoals: [],
        backgroundElements: [],
        overusedSecrets: [],
        speechPatterns: [],
      };

      expect(() =>
        validateClicheGenerationResponse({
          categories,
          tropesAndStereotypes: [],
        })
      ).toThrow("ClicheGenerationPrompt: Category 'names' must be an array");
    });

    it('throws when category item is an empty string', () => {
      const categories = Object.fromEntries(
        [
          'names',
          'physicalDescriptions',
          'personalityTraits',
          'skillsAbilities',
          'typicalLikes',
          'typicalDislikes',
          'commonFears',
          'genericGoals',
          'backgroundElements',
          'overusedSecrets',
          'speechPatterns',
        ].map((key) => [key, ['']])
      );

      expect(() =>
        validateClicheGenerationResponse({
          categories,
          tropesAndStereotypes: [],
        })
      ).toThrow(
        "ClicheGenerationPrompt: Category 'names' item at index 0 must be a non-empty string"
      );
    });

    it('throws when category exceeds maximum size', () => {
      const categories = Object.fromEntries(
        [
          'names',
          'physicalDescriptions',
          'personalityTraits',
          'skillsAbilities',
          'typicalLikes',
          'typicalDislikes',
          'commonFears',
          'genericGoals',
          'backgroundElements',
          'overusedSecrets',
          'speechPatterns',
        ].map((key) => [
          key,
          Array.from({ length: 11 }, (_, idx) => `${key}-${idx}`),
        ])
      );

      expect(() =>
        validateClicheGenerationResponse({
          categories,
          tropesAndStereotypes: Array.from(
            { length: 10 },
            (_, idx) => `trope-${idx}`
          ),
        })
      ).toThrow(
        "ClicheGenerationPrompt: Category 'names' cannot have more than 10 items"
      );
    });

    it('throws when tropes collection exceeds maximum size', () => {
      const categories = Object.fromEntries(
        [
          'names',
          'physicalDescriptions',
          'personalityTraits',
          'skillsAbilities',
          'typicalLikes',
          'typicalDislikes',
          'commonFears',
          'genericGoals',
          'backgroundElements',
          'overusedSecrets',
          'speechPatterns',
        ].map((key) => [key, ['valid-entry']])
      );

      expect(() =>
        validateClicheGenerationResponse({
          categories,
          tropesAndStereotypes: Array.from(
            { length: 16 },
            (_, idx) => `trope-${idx}`
          ),
        })
      ).toThrow(
        'ClicheGenerationPrompt: tropesAndStereotypes cannot have more than 15 items'
      );
    });

    it('throws when tropes contain a blank value', () => {
      const categories = Object.fromEntries(
        [
          'names',
          'physicalDescriptions',
          'personalityTraits',
          'skillsAbilities',
          'typicalLikes',
          'typicalDislikes',
          'commonFears',
          'genericGoals',
          'backgroundElements',
          'overusedSecrets',
          'speechPatterns',
        ].map((key) => [key, ['valid-entry']])
      );

      expect(() =>
        validateClicheGenerationResponse({
          categories,
          tropesAndStereotypes: ['valid', ''],
        })
      ).toThrow(
        'ClicheGenerationPrompt: tropesAndStereotypes item at index 1 must be a non-empty string'
      );
    });
  });

  it('computes statistics, warnings, and recommendations for sparse responses', () => {
    const categories = {
      names: ['a'],
      physicalDescriptions: [],
      personalityTraits: ['b'],
      skillsAbilities: Array.from({ length: 9 }, (_, idx) => `s${idx}`),
      typicalLikes: ['c'],
      typicalDislikes: ['d'],
      commonFears: ['e'],
      genericGoals: ['f'],
      backgroundElements: ['g'],
      overusedSecrets: ['h'],
      speechPatterns: ['i'],
    };

    const response = {
      categories,
      tropesAndStereotypes: ['t1', 't2', 't3', 't4'],
    };

    const result = validateClicheGenerationResponseEnhanced(response);

    expect(result.valid).toBe(true);
    expect(result.statistics.totalItems).toBe(
      Object.values(categories).reduce((sum, arr) => sum + arr.length, 0) +
        response.tropesAndStereotypes.length
    );
    expect(result.statistics.categoryLengths.physicalDescriptions).toEqual({
      min: 0,
      max: 0,
      avg: 0,
    });
    expect(result.statistics.completenessScore).toBeLessThan(1);
    expect(result.statistics.averageItemsPerCategory).toBeLessThan(4);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Category "names" has only 1 items (recommended: 3+)',
        'Category "skillsAbilities" has 9 items (recommended: 3-8)',
        'Only 4 tropes provided (recommended: 5+)',
      ])
    );
    expect(
      result.warnings.filter((warning) =>
        warning.includes('items are quite short')
      ).length
    ).toBeGreaterThan(0);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        'Ensure all required categories are populated',
        'Consider generating more items per category for better coverage',
        'Review response quality - multiple issues detected',
      ])
    );
    expect(result.qualityMetrics.completeness).toBeLessThan(1);
    expect(result.qualityMetrics.overallScore).toBeGreaterThan(0);
  });
});
