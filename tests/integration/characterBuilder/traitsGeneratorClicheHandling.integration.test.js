/**
 * @file Integration tests for traits generator cliché handling
 * @description Tests that clichés are properly passed through the entire generation pipeline
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TraitsGenerator } from '../../../src/characterBuilder/services/TraitsGenerator.js';
import { TraitsGeneratorController } from '../../../src/characterBuilder/controllers/TraitsGeneratorController.js';
import { buildTraitsGenerationPrompt } from '../../../src/characterBuilder/prompts/traitsGenerationPrompt.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('TraitsGenerator - Cliché Handling Integration', () => {
  describe('Prompt Building with Clichés', () => {
    it('should correctly format clichés object in the prompt', () => {
      const cliches = {
        categories: {
          names: ['Generic Name 1', 'Generic Name 2'],
          personalityTraits: ['Brooding', 'Mysterious'],
          backgroundElements: ['Orphaned', 'Tragic past']
        },
        tropesAndStereotypes: ['Hero Journey', 'Chosen One']
      };

      const prompt = buildTraitsGenerationPrompt(
        'Test character concept',
        {
          title: 'Test',
          description: 'Test desc',
          coreTension: 'Test tension'
        },
        {
          coreMotivation: 'Motivation',
          internalContradiction: 'Contradiction',
          centralQuestion: 'Question?'
        },
        cliches
      );

      // Check that clichés are properly formatted in the prompt
      expect(prompt).toContain('<cliches_to_avoid>');
      expect(prompt).toContain('Names:');
      expect(prompt).toContain('- Generic Name 1');
      expect(prompt).toContain('- Generic Name 2');
      expect(prompt).toContain('Personality Traits:');
      expect(prompt).toContain('- Brooding');
      expect(prompt).toContain('- Mysterious');
      expect(prompt).toContain('Background Elements:');
      expect(prompt).toContain('- Orphaned');
      expect(prompt).toContain('Tropes and Stereotypes:');
      expect(prompt).toContain('- Hero Journey');
      expect(prompt).toContain('- Chosen One');
    });

    it('should handle null clichés gracefully', () => {
      const prompt = buildTraitsGenerationPrompt(
        'Test character concept',
        {
          title: 'Test',
          description: 'Test desc',
          coreTension: 'Test tension'
        },
        {
          coreMotivation: 'Motivation',
          internalContradiction: 'Contradiction',
          centralQuestion: 'Question?'
        },
        null
      );

      // Check that prompt handles null clichés
      expect(prompt).toContain('<cliches_to_avoid>');
      expect(prompt).toContain('No specific clichés provided.');
      expect(prompt).not.toContain('Names:');
      expect(prompt).not.toContain('Personality Traits:');
    });

    it('should handle empty clichés object', () => {
      const prompt = buildTraitsGenerationPrompt(
        'Test character concept',
        {
          title: 'Test',
          description: 'Test desc',
          coreTension: 'Test tension'
        },
        {
          coreMotivation: 'Motivation',
          internalContradiction: 'Contradiction',
          centralQuestion: 'Question?'
        },
        {}
      );

      // Check that prompt handles empty clichés
      expect(prompt).toContain('<cliches_to_avoid>');
      expect(prompt).toContain('No specific clichés provided.');
    });

    it('should handle clichés with only categories', () => {
      const cliches = {
        categories: {
          names: ['John Doe'],
          skillsAbilities: ['Master of everything']
        }
      };

      const prompt = buildTraitsGenerationPrompt(
        'Test character',
        {
          title: 'Test Direction',
          description: 'Test description',
          coreTension: 'Test tension'
        },
        {
          coreMotivation: 'Test motivation',
          internalContradiction: 'Test contradiction',
          centralQuestion: 'Test question?'
        },
        cliches
      );

      expect(prompt).toContain('Names:');
      expect(prompt).toContain('- John Doe');
      expect(prompt).toContain('Skills & Abilities:');
      expect(prompt).toContain('- Master of everything');
      expect(prompt).not.toContain('Tropes and Stereotypes:');
    });

    it('should handle clichés with only tropesAndStereotypes', () => {
      const cliches = {
        tropesAndStereotypes: ['The Chosen One', 'Dark Past']
      };

      const prompt = buildTraitsGenerationPrompt(
        'Test character',
        {
          title: 'Test Direction',
          description: 'Test description',
          coreTension: 'Test tension'
        },
        {
          coreMotivation: 'Test motivation',
          internalContradiction: 'Test contradiction',
          centralQuestion: 'Test question?'
        },
        cliches
      );

      expect(prompt).not.toContain('Names:');
      expect(prompt).toContain('Tropes and Stereotypes:');
      expect(prompt).toContain('- The Chosen One');
      expect(prompt).toContain('- Dark Past');
    });
  });
});