/**
 * @file Unit tests for core motivations generation prompt functions
 * @see src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildCoreMotivationsGenerationPrompt,
  validateCoreMotivationsGenerationResponse,
  createCoreMotivationsGenerationLlmConfig,
  CORE_MOTIVATIONS_RESPONSE_SCHEMA,
  CORE_MOTIVATIONS_LLM_PARAMS,
  PROMPT_VERSION_INFO,
  formatClichesForPrompt,
} from '../../../../src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js';

describe('coreMotivationsGenerationPrompt', () => {
  // Sample valid inputs
  const validCharacterConcept =
    'A former soldier turned pacifist healer struggling with their violent past';
  const validDirection = {
    title: 'The Burden of Redemption',
    description:
      'A character seeking to atone for past violence through healing',
    coreTension:
      'The conflict between violent instincts and peaceful aspirations',
    uniqueTwist: 'The violence they seek to escape saved countless lives',
    narrativePotential:
      'Explores themes of redemption, the nature of violence, and whether people can truly change',
  };
  const validCliches = {
    categories: {
      names: ['Grimm', 'Shadow', 'Raven'],
      physicalDescriptions: ['scarred face', 'haunted eyes', 'weathered hands'],
      personalityTraits: ['brooding', 'tormented', 'self-loathing'],
      skillsAbilities: ['combat expertise', 'tactical genius'],
      typicalLikes: ['solitude', 'peace', 'helping others'],
      typicalDislikes: ['violence', 'their past', 'weapons'],
      commonFears: ['becoming a monster again', 'losing control'],
      genericGoals: ['redemption', 'forgiveness', 'inner peace'],
      backgroundElements: ['war veteran', 'killed innocents', 'lost squad'],
      overusedSecrets: ['actually enjoyed killing', 'war crimes'],
      speechPatterns: ['terse responses', 'military jargon'],
    },
    tropesAndStereotypes: [
      'The Atoner',
      'Shell-Shocked Veteran',
      'Retired Badass',
      'Dark and Troubled Past',
    ],
  };

  // Sample valid LLM response
  const validLlmResponse = {
    motivations: [
      {
        coreDesire:
          'To save more lives than they took, believing each healed person balances their karmic debt',
        internalContradiction:
          'Their most effective healing techniques derive from intimate knowledge of how bodies break',
        centralQuestion:
          'Can healing ever truly erase the stain of killing, or does it merely paint over it?',
      },
      {
        coreDesire:
          'To prove that choice matters more than nature by rejecting their violent talents',
        internalContradiction:
          'They are naturally gifted at violence but struggle with the patience healing requires',
        centralQuestion:
          'If you are born a weapon, can you ever truly become a tool of peace?',
      },
      {
        coreDesire:
          'To find someone who can see them as more than their worst moments',
        internalContradiction:
          "They push away anyone who gets close, believing they don't deserve connection",
        centralQuestion:
          'Is redemption something you achieve alone, or something others must grant you?',
      },
    ],
  };

  describe('CORE_MOTIVATIONS_LLM_PARAMS', () => {
    it('should define correct LLM parameters', () => {
      expect(CORE_MOTIVATIONS_LLM_PARAMS).toEqual({
        temperature: 0.8,
        max_tokens: 3000,
      });
    });
  });

  describe('PROMPT_VERSION_INFO', () => {
    it('should have correct version information', () => {
      expect(PROMPT_VERSION_INFO).toHaveProperty('version');
      expect(PROMPT_VERSION_INFO).toHaveProperty('previousVersions');
      expect(PROMPT_VERSION_INFO).toHaveProperty('currentChanges');
      expect(PROMPT_VERSION_INFO.version).toBe('1.0.0');
      expect(Array.isArray(PROMPT_VERSION_INFO.currentChanges)).toBe(true);
    });
  });

  describe('CORE_MOTIVATIONS_RESPONSE_SCHEMA', () => {
    it('should have correct schema structure', () => {
      expect(CORE_MOTIVATIONS_RESPONSE_SCHEMA.type).toBe('object');
      expect(CORE_MOTIVATIONS_RESPONSE_SCHEMA.additionalProperties).toBe(false);
      expect(CORE_MOTIVATIONS_RESPONSE_SCHEMA.required).toContain(
        'motivations'
      );
    });

    it('should define motivations array with correct constraints', () => {
      const motivations =
        CORE_MOTIVATIONS_RESPONSE_SCHEMA.properties.motivations;
      expect(motivations.type).toBe('array');
      expect(motivations.minItems).toBe(3);
      expect(motivations.maxItems).toBe(5);
    });

    it('should define motivation item structure correctly', () => {
      const motivationItem =
        CORE_MOTIVATIONS_RESPONSE_SCHEMA.properties.motivations.items;
      expect(motivationItem.type).toBe('object');
      expect(motivationItem.additionalProperties).toBe(false);
      expect(motivationItem.required).toEqual([
        'coreDesire',
        'internalContradiction',
        'centralQuestion',
      ]);

      // Check each property
      expect(motivationItem.properties.coreDesire.type).toBe('string');
      expect(motivationItem.properties.coreDesire.minLength).toBe(1);
      expect(motivationItem.properties.internalContradiction.type).toBe(
        'string'
      );
      expect(motivationItem.properties.internalContradiction.minLength).toBe(1);
      expect(motivationItem.properties.centralQuestion.type).toBe('string');
      expect(motivationItem.properties.centralQuestion.minLength).toBe(1);
    });
  });

  describe('formatClichesForPrompt', () => {
    it('should return fallback message when cliches is null', () => {
      expect(formatClichesForPrompt(null)).toBe('No specific clichés provided.');
    });

    it('should return fallback message when cliches is not an object', () => {
      expect(formatClichesForPrompt('invalid')).toBe(
        'No specific clichés provided.'
      );
    });
  });

  describe('buildCoreMotivationsGenerationPrompt', () => {
    it('should build prompt with valid inputs', () => {
      const prompt = buildCoreMotivationsGenerationPrompt(
        validCharacterConcept,
        validDirection,
        validCliches
      );

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain(validCharacterConcept);
      expect(prompt).toContain(validDirection.title);
      expect(prompt).toContain(validDirection.description);
      expect(prompt).toContain(validDirection.coreTension);
    });

    it('should include all required sections in prompt', () => {
      const prompt = buildCoreMotivationsGenerationPrompt(
        validCharacterConcept,
        validDirection,
        validCliches
      );

      expect(prompt).toContain('<role>');
      expect(prompt).toContain('<task_definition>');
      expect(prompt).toContain('<character_concept>');
      expect(prompt).toContain('<thematic_direction>');
      expect(prompt).toContain('<cliches_to_avoid>');
      expect(prompt).toContain('<instructions>');
      expect(prompt).toContain('<constraints>');
      expect(prompt).toContain('<response_format>');
      expect(prompt).toContain('<content_policy>');
    });

    it('should include formatted cliches in prompt', () => {
      const prompt = buildCoreMotivationsGenerationPrompt(
        validCharacterConcept,
        validDirection,
        validCliches
      );

      // Check that cliches are formatted and included
      expect(prompt).toContain('Names:');
      expect(prompt).toContain('Grimm');
      expect(prompt).toContain('Physical Descriptions:');
      expect(prompt).toContain('scarred face');
      expect(prompt).toContain('Tropes and Stereotypes:');
      expect(prompt).toContain('The Atoner');
    });

    it('should trim whitespace from inputs', () => {
      const conceptWithSpaces = '  ' + validCharacterConcept + '  ';
      const directionWithSpaces = {
        title: '  ' + validDirection.title + '  ',
        description: '  ' + validDirection.description + '  ',
        coreTension: '  ' + validDirection.coreTension + '  ',
        uniqueTwist: '  ' + validDirection.uniqueTwist + '  ',
        narrativePotential: '  ' + validDirection.narrativePotential + '  ',
      };

      const prompt = buildCoreMotivationsGenerationPrompt(
        conceptWithSpaces,
        directionWithSpaces,
        validCliches
      );

      expect(prompt).toContain(validCharacterConcept);
      expect(prompt).toContain(validDirection.title);
      expect(prompt).toContain(validDirection.description);
      expect(prompt).toContain(validDirection.coreTension);
      expect(prompt).toContain(validDirection.uniqueTwist);
      expect(prompt).toContain(validDirection.narrativePotential);
    });

    it('should handle direction without optional fields', () => {
      const directionWithoutOptional = {
        title: 'The Burden of Redemption',
        description:
          'A character seeking to atone for past violence through healing',
        coreTension:
          'The conflict between violent instincts and peaceful aspirations',
      };

      const prompt = buildCoreMotivationsGenerationPrompt(
        validCharacterConcept,
        directionWithoutOptional,
        validCliches
      );

      expect(prompt).toContain(directionWithoutOptional.title);
      expect(prompt).toContain(directionWithoutOptional.description);
      expect(prompt).toContain(directionWithoutOptional.coreTension);
      expect(prompt).not.toContain('Unique Twist:');
      expect(prompt).not.toContain('Narrative Potential:');
    });

    it('should handle empty cliches object', () => {
      const emptyCliches = {};

      const prompt = buildCoreMotivationsGenerationPrompt(
        validCharacterConcept,
        validDirection,
        emptyCliches
      );

      expect(prompt).toContain('No specific clichés provided');
    });

    it('should handle cliches with empty categories', () => {
      const clichesWithEmptyCategories = {
        categories: {
          names: [],
          physicalDescriptions: [],
        },
        tropesAndStereotypes: [],
      };

      const prompt = buildCoreMotivationsGenerationPrompt(
        validCharacterConcept,
        validDirection,
        clichesWithEmptyCategories
      );

      expect(prompt).toContain('No specific clichés provided');
    });

    describe('input validation', () => {
      it('should throw error for empty characterConcept', () => {
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            '',
            validDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for whitespace-only characterConcept', () => {
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            '   ',
            validDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for non-string characterConcept', () => {
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            123,
            validDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for null characterConcept', () => {
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            null,
            validDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for non-object direction', () => {
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            null,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: direction must be a valid object'
        );
      });

      it('should throw error for empty direction.title', () => {
        const invalidDirection = { ...validDirection, title: '' };
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            invalidDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: direction.title must be a non-empty string'
        );
      });

      it('should throw error for missing direction.description', () => {
        const invalidDirection = { ...validDirection };
        delete invalidDirection.description;
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            invalidDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: direction.description must be a non-empty string'
        );
      });

      it('should throw error for empty direction.coreTension', () => {
        const invalidDirection = { ...validDirection, coreTension: '   ' };
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            invalidDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: direction.coreTension must be a non-empty string'
        );
      });

      it('should throw error for non-object cliches', () => {
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            validDirection,
            null
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: cliches must be a valid object'
        );
      });

      it('should throw error for invalid cliches type', () => {
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            validDirection,
            'invalid'
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: cliches must be a valid object'
        );
      });

      it('should throw error when direction.uniqueTwist is provided but not a string', () => {
        const invalidDirection = { ...validDirection, uniqueTwist: 42 };
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            invalidDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: direction.uniqueTwist must be a non-empty string if provided'
        );
      });

      it('should throw error when direction.uniqueTwist is an empty string', () => {
        const invalidDirection = { ...validDirection, uniqueTwist: '   ' };
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            invalidDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: direction.uniqueTwist must be a non-empty string if provided'
        );
      });

      it('should throw error when direction.narrativePotential is provided but not a string', () => {
        const invalidDirection = { ...validDirection, narrativePotential: 123 };
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            invalidDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: direction.narrativePotential must be a non-empty string if provided'
        );
      });

      it('should throw error when direction.narrativePotential is an empty string', () => {
        const invalidDirection = { ...validDirection, narrativePotential: '   ' };
        expect(() => {
          buildCoreMotivationsGenerationPrompt(
            validCharacterConcept,
            invalidDirection,
            validCliches
          );
        }).toThrow(
          'CoreMotivationsGenerationPrompt: direction.narrativePotential must be a non-empty string if provided'
        );
      });
    });
  });

  describe('validateCoreMotivationsGenerationResponse', () => {
    it('should return true for valid response', () => {
      const result =
        validateCoreMotivationsGenerationResponse(validLlmResponse);
      expect(result).toBe(true);
    });

    it('should validate response with exactly 3 motivations', () => {
      const responseWith3 = {
        motivations: validLlmResponse.motivations.slice(0, 3),
      };

      const result = validateCoreMotivationsGenerationResponse(responseWith3);
      expect(result).toBe(true);
    });

    it('should validate response with exactly 5 motivations', () => {
      const responseWith5 = {
        motivations: [
          ...validLlmResponse.motivations,
          {
            coreDesire: 'Additional desire 1',
            internalContradiction: 'Additional contradiction 1',
            centralQuestion: 'Additional question 1?',
          },
          {
            coreDesire: 'Additional desire 2',
            internalContradiction: 'Additional contradiction 2',
            centralQuestion: 'Additional question 2?',
          },
        ],
      };

      const result = validateCoreMotivationsGenerationResponse(responseWith5);
      expect(result).toBe(true);
    });

    describe('validation errors', () => {
      it('should throw error for null response', () => {
        expect(() => {
          validateCoreMotivationsGenerationResponse(null);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Response must be an object'
        );
      });

      it('should throw error for non-object response', () => {
        expect(() => {
          validateCoreMotivationsGenerationResponse('invalid');
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Response must be an object'
        );
      });

      it('should throw error for missing motivations', () => {
        const invalidResponse = {};
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Response must contain motivations array'
        );
      });

      it('should throw error for non-array motivations', () => {
        const invalidResponse = { motivations: 'invalid' };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Response must contain motivations array'
        );
      });

      it('should throw error for too few motivations', () => {
        const invalidResponse = {
          motivations: validLlmResponse.motivations.slice(0, 2),
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Response must contain at least 3 motivations'
        );
      });

      it('should throw error for too many motivations', () => {
        const invalidResponse = {
          motivations: [
            ...validLlmResponse.motivations,
            ...validLlmResponse.motivations,
          ], // 6 motivations
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Response cannot contain more than 5 motivations'
        );
      });

      it('should throw error for non-object motivation item', () => {
        const invalidResponse = {
          motivations: ['invalid', 'string', 'items'],
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Motivation at index 0 must be an object'
        );
      });

      it('should throw error for missing coreDesire', () => {
        const invalidResponse = {
          motivations: [
            {
              internalContradiction: 'contradiction',
              centralQuestion: 'question?',
            },
            ...validLlmResponse.motivations.slice(1),
          ],
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Motivation at index 0 must have a non-empty coreDesire string'
        );
      });

      it('should throw error for empty coreDesire', () => {
        const invalidResponse = {
          motivations: [
            {
              coreDesire: '',
              internalContradiction: 'contradiction',
              centralQuestion: 'question?',
            },
            ...validLlmResponse.motivations.slice(1),
          ],
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Motivation at index 0 must have a non-empty coreDesire string'
        );
      });

      it('should throw error for missing internalContradiction', () => {
        const invalidResponse = {
          motivations: [
            {
              coreDesire: 'desire',
              centralQuestion: 'question?',
            },
            ...validLlmResponse.motivations.slice(1),
          ],
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Motivation at index 0 must have a non-empty internalContradiction string'
        );
      });

      it('should throw error for empty internalContradiction', () => {
        const invalidResponse = {
          motivations: [
            {
              coreDesire: 'desire',
              internalContradiction: '   ',
              centralQuestion: 'question?',
            },
            ...validLlmResponse.motivations.slice(1),
          ],
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Motivation at index 0 must have a non-empty internalContradiction string'
        );
      });

      it('should throw error for missing centralQuestion', () => {
        const invalidResponse = {
          motivations: [
            {
              coreDesire: 'desire',
              internalContradiction: 'contradiction',
            },
            ...validLlmResponse.motivations.slice(1),
          ],
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Motivation at index 0 must have a non-empty centralQuestion string'
        );
      });

      it('should throw error for centralQuestion without question mark', () => {
        const invalidResponse = {
          motivations: [
            {
              coreDesire: 'desire',
              internalContradiction: 'contradiction',
              centralQuestion: 'This is not a question',
            },
            ...validLlmResponse.motivations.slice(1),
          ],
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Motivation at index 0 centralQuestion must contain a question mark'
        );
      });

      it('should validate all motivations in the array', () => {
        const invalidResponse = {
          motivations: [
            validLlmResponse.motivations[0],
            validLlmResponse.motivations[1],
            {
              coreDesire: 'desire',
              internalContradiction: 'contradiction',
              centralQuestion: 'missing question mark',
            },
          ],
        };
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow(
          'CoreMotivationsGenerationPrompt: Motivation at index 2 centralQuestion must contain a question mark'
        );
      });
    });
  });

  describe('createCoreMotivationsGenerationLlmConfig', () => {
    const baseLlmConfig = {
      configId: 'test-config',
      defaultParameters: {
        temperature: 0.5,
        max_tokens: 1000,
      },
    };

    it('should create enhanced config with JSON schema', () => {
      const enhancedConfig =
        createCoreMotivationsGenerationLlmConfig(baseLlmConfig);

      expect(enhancedConfig).toEqual({
        ...baseLlmConfig,
        jsonOutputStrategy: {
          method: 'openrouter_json_schema',
          jsonSchema: CORE_MOTIVATIONS_RESPONSE_SCHEMA,
        },
        defaultParameters: {
          ...baseLlmConfig.defaultParameters,
          ...CORE_MOTIVATIONS_LLM_PARAMS,
        },
      });
    });

    it('should override base parameters with core motivations params', () => {
      const enhancedConfig =
        createCoreMotivationsGenerationLlmConfig(baseLlmConfig);

      expect(enhancedConfig.defaultParameters.temperature).toBe(0.8); // CORE_MOTIVATIONS_LLM_PARAMS value
      expect(enhancedConfig.defaultParameters.max_tokens).toBe(3000); // CORE_MOTIVATIONS_LLM_PARAMS value
    });

    it('should throw error for null baseLlmConfig', () => {
      expect(() => {
        createCoreMotivationsGenerationLlmConfig(null);
      }).toThrow(
        'CoreMotivationsGenerationPrompt: baseLlmConfig must be a valid object'
      );
    });

    it('should throw error for non-object baseLlmConfig', () => {
      expect(() => {
        createCoreMotivationsGenerationLlmConfig('invalid');
      }).toThrow(
        'CoreMotivationsGenerationPrompt: baseLlmConfig must be a valid object'
      );
    });

    it('should throw error for undefined baseLlmConfig', () => {
      expect(() => {
        createCoreMotivationsGenerationLlmConfig(undefined);
      }).toThrow(
        'CoreMotivationsGenerationPrompt: baseLlmConfig must be a valid object'
      );
    });
  });
});
