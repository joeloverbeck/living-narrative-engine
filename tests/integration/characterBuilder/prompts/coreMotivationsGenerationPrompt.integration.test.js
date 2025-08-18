/**
 * @file Integration tests for core motivations generation prompt
 * @see src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildCoreMotivationsGenerationPrompt,
  validateCoreMotivationsGenerationResponse,
  createCoreMotivationsGenerationLlmConfig,
} from '../../../../src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js';
import { CoreMotivation } from '../../../../src/characterBuilder/models/coreMotivation.js';

describe('CoreMotivationsGenerationPrompt Integration Tests', () => {
  describe('Complete prompt generation flow', () => {
    it('should generate a valid prompt with realistic character data', () => {
      // Create realistic character concept
      const characterConcept =
        'A highly trained assassin awakens with no memory of their past, discovering their lethal skills only through muscle memory and instinct. They must navigate a world where their forgotten enemies still hunt them while questioning whether the person they were deserves to be remembered or forgotten forever.';

      // Create thematic direction
      const direction = {
        title: 'The Blank Slate Killer',
        description:
          'An exploration of identity when stripped of memory but not capability',
        coreTension:
          'The conflict between innate skill suggesting a dark past and the desire to forge a new, possibly better identity',
        uniqueTwist:
          'Their amnesia was self-induced to escape an unbearable truth',
        narrativePotential:
          'Questions the nature of identity, redemption without remembrance, and whether we are defined by our actions or our memories',
      };

      // Create cliches to avoid
      const cliches = {
        categories: {
          names: ['Shadow', 'Ghost', 'Raven', 'Zero'],
          physicalDescriptions: [
            'Mysterious scars',
            'Cold dead eyes',
            'Always wears black',
          ],
          personalityTraits: ['Emotionless', 'Coldly efficient', 'Lone wolf'],
          skillsAbilities: [
            'Perfect aim',
            'Never misses',
            'Knows every martial art',
          ],
          typicalLikes: ['Being alone', 'The shadows', 'Silence'],
          typicalDislikes: ['Crowds', 'Bright lights', 'Talking'],
          commonFears: ['Their past catching up', 'Becoming a monster again'],
          genericGoals: ['Uncover the truth', 'Revenge', 'Redemption'],
          backgroundElements: [
            'Government experiment',
            'Tragic backstory',
            'Family was killed',
          ],
          overusedSecrets: [
            'Killed their own family',
            'Was actually the villain all along',
          ],
          speechPatterns: [
            'Never speaks unless necessary',
            'Cryptic one-liners',
          ],
        },
        tropesAndStereotypes: [
          'Amnesiac Assassin',
          'Dark and Troubled Past',
          'The Stoic',
          'Professional Killer',
        ],
      };

      // Build the prompt
      const prompt = buildCoreMotivationsGenerationPrompt(
        characterConcept,
        direction,
        cliches
      );

      // Validate prompt structure
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(1000);

      // Check all sections are present
      expect(prompt).toContain('<role>');
      expect(prompt).toContain('<task_definition>');
      expect(prompt).toContain('<character_concept>');
      expect(prompt).toContain('<thematic_direction>');
      expect(prompt).toContain('<cliches_to_avoid>');
      expect(prompt).toContain('<instructions>');
      expect(prompt).toContain('<constraints>');
      expect(prompt).toContain('<response_format>');
      expect(prompt).toContain('<content_policy>');

      // Check content is included
      expect(prompt).toContain(characterConcept);
      expect(prompt).toContain(direction.title);
      expect(prompt).toContain(direction.description);
      expect(prompt).toContain(direction.coreTension);
      expect(prompt).toContain(direction.uniqueTwist);
      expect(prompt).toContain(direction.narrativePotential);

      // Check cliches are formatted
      expect(prompt).toContain('Shadow');
      expect(prompt).toContain('Mysterious scars');
      expect(prompt).toContain('Amnesiac Assassin');
    });
  });

  describe('Response validation and model creation', () => {
    it('should validate and create CoreMotivation models from valid response', () => {
      // Simulate an LLM response
      const llmResponse = {
        motivations: [
          {
            coreDesire:
              'To discover if they were a monster by choice or circumstance, needing to know if their forgotten self deserves condemnation or sympathy',
            internalContradiction:
              'They desperately want to remember their past but are terrified that remembering will destroy the good person they are trying to become',
            centralQuestion:
              'Is identity what we remember, what we do, or what we choose to become?',
          },
          {
            coreDesire:
              'To protect others from violence while being unable to escape their own capacity for it',
            internalContradiction:
              'Their greatest talent is killing, but their only peace comes from saving lives',
            centralQuestion:
              'Can hands trained only for death ever truly learn to heal?',
          },
          {
            coreDesire:
              'To build genuine human connections despite not knowing if they ever had the capacity for love',
            internalContradiction:
              'They crave intimacy but fear that getting close to anyone will trigger dormant programming or memories',
            centralQuestion:
              'Can someone learn to love for the first time, or is it only possible to remember how?',
          },
        ],
      };

      // Validate the response
      const isValid = validateCoreMotivationsGenerationResponse(llmResponse);
      expect(isValid).toBe(true);

      // Create CoreMotivation models from the response
      const directionId = 'test-direction-id';
      const conceptId = 'test-concept-id';

      llmResponse.motivations.forEach((rawMotivation) => {
        const motivation = CoreMotivation.fromLLMResponse({
          directionId,
          conceptId,
          rawMotivation,
          metadata: {
            model: 'test-model',
            temperature: 0.8,
            tokens: 500,
            responseTime: 1000,
            promptVersion: '1.0.0',
            clicheIds: ['cliche1', 'cliche2'],
            generationPrompt: 'test prompt',
          },
        });

        // Validate the created model
        expect(motivation).toBeInstanceOf(CoreMotivation);
        expect(motivation.directionId).toBe(directionId);
        expect(motivation.conceptId).toBe(conceptId);
        expect(motivation.coreDesire).toBe(rawMotivation.coreDesire);
        expect(motivation.internalContradiction).toBe(
          rawMotivation.internalContradiction
        );
        expect(motivation.centralQuestion).toBe(rawMotivation.centralQuestion);

        // Validate the motivation passes its own validation
        const validationResult = motivation.validate();
        expect(validationResult.valid).toBe(true);
        expect(validationResult.errors).toHaveLength(0);
      });
    });

    it('should reject invalid responses', () => {
      const invalidResponses = [
        // Too few motivations
        {
          motivations: [
            {
              coreDesire: 'desire',
              internalContradiction: 'contradiction',
              centralQuestion: 'question?',
            },
            {
              coreDesire: 'desire2',
              internalContradiction: 'contradiction2',
              centralQuestion: 'question2?',
            },
          ],
        },
        // Too many motivations
        {
          motivations: Array(6).fill({
            coreDesire: 'desire',
            internalContradiction: 'contradiction',
            centralQuestion: 'question?',
          }),
        },
        // Missing question mark
        {
          motivations: Array(3).fill({
            coreDesire: 'desire',
            internalContradiction: 'contradiction',
            centralQuestion: 'This is not a question',
          }),
        },
        // Missing fields
        {
          motivations: [
            {
              coreDesire: 'desire',
              internalContradiction: 'contradiction',
              // Missing centralQuestion
            },
            {
              coreDesire: 'desire2',
              internalContradiction: 'contradiction2',
              centralQuestion: 'question2?',
            },
            {
              coreDesire: 'desire3',
              internalContradiction: 'contradiction3',
              centralQuestion: 'question3?',
            },
          ],
        },
      ];

      invalidResponses.forEach((invalidResponse) => {
        expect(() => {
          validateCoreMotivationsGenerationResponse(invalidResponse);
        }).toThrow();
      });
    });
  });

  describe('LLM config creation', () => {
    it('should create valid LLM config for core motivations generation', () => {
      const baseLlmConfig = {
        configId: 'test-config',
        defaultParameters: {
          temperature: 0.7,
          max_tokens: 2000,
        },
      };
      const enhancedConfig =
        createCoreMotivationsGenerationLlmConfig(baseLlmConfig);

      // Check config structure
      expect(enhancedConfig).toBeDefined();
      expect(enhancedConfig.jsonOutputStrategy).toBeDefined();
      expect(enhancedConfig.jsonOutputStrategy.method).toBe(
        'openrouter_json_schema'
      );
      expect(enhancedConfig.jsonOutputStrategy.jsonSchema).toBeDefined();

      // Check parameters are merged correctly
      expect(enhancedConfig.defaultParameters.temperature).toBe(0.8);
      expect(enhancedConfig.defaultParameters.max_tokens).toBe(3000);

      // Verify schema structure
      const schema = enhancedConfig.jsonOutputStrategy.jsonSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties.motivations).toBeDefined();
      expect(schema.properties.motivations.type).toBe('array');
      expect(schema.properties.motivations.minItems).toBe(3);
      expect(schema.properties.motivations.maxItems).toBe(5);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle minimal valid input', () => {
      const minimalConcept = 'A character';
      const minimalDirection = {
        title: 'Title',
        description: 'Description',
        coreTension: 'Tension',
      };
      const minimalCliches = {};

      const prompt = buildCoreMotivationsGenerationPrompt(
        minimalConcept,
        minimalDirection,
        minimalCliches
      );

      expect(prompt).toBeDefined();
      expect(prompt).toContain(minimalConcept);
      expect(prompt).toContain('No specific clichés provided');
    });

    it('should handle very long inputs', () => {
      const longConcept = 'A character '.repeat(100);
      const longDirection = {
        title: 'Title '.repeat(50),
        description: 'Description '.repeat(100),
        coreTension: 'Tension '.repeat(75),
        uniqueTwist: 'Twist '.repeat(80),
        narrativePotential: 'Potential '.repeat(90),
      };
      const longCliches = {
        categories: {
          names: Array(10).fill('LongName'),
          physicalDescriptions: Array(10).fill('LongDescription'),
          personalityTraits: Array(10).fill('LongTrait'),
          skillsAbilities: Array(10).fill('LongSkill'),
          typicalLikes: Array(10).fill('LongLike'),
          typicalDislikes: Array(10).fill('LongDislike'),
          commonFears: Array(10).fill('LongFear'),
          genericGoals: Array(10).fill('LongGoal'),
          backgroundElements: Array(10).fill('LongBackground'),
          overusedSecrets: Array(10).fill('LongSecret'),
          speechPatterns: Array(10).fill('LongPattern'),
        },
        tropesAndStereotypes: Array(15).fill('LongTrope'),
      };

      const prompt = buildCoreMotivationsGenerationPrompt(
        longConcept,
        longDirection,
        longCliches
      );

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(5000);
    });

    it('should properly escape special characters in inputs', () => {
      const conceptWithSpecialChars =
        'A character with "quotes" and <tags> and & ampersands';
      const direction = {
        title: 'Title with "quotes"',
        description: 'Description with <brackets>',
        coreTension: 'Tension with & ampersand',
      };
      const clichesWithSpecialChars = {
        categories: {
          names: ['"Quoted Name"', '<Tagged Name>'],
          physicalDescriptions: ['& Ampersand description'],
        },
        tropesAndStereotypes: ['Trope with "quotes"'],
      };

      const prompt = buildCoreMotivationsGenerationPrompt(
        conceptWithSpecialChars,
        direction,
        clichesWithSpecialChars
      );

      expect(prompt).toBeDefined();
      expect(prompt).toContain(conceptWithSpecialChars);
      expect(prompt).toContain('"Quoted Name"');
    });
  });
});
