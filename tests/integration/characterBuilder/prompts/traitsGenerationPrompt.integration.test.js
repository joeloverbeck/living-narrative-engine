/**
 * @file Integration tests for traits generation prompt
 * @see src/characterBuilder/prompts/traitsGenerationPrompt.js
 */

import { describe, expect, it } from '@jest/globals';
import traitSchema from '../../../../data/schemas/trait.schema.json' with { type: 'json' };
import {
  buildTraitsGenerationPrompt,
  PROMPT_VERSION_INFO,
  TRAITS_GENERATION_LLM_PARAMS,
  TRAITS_RESPONSE_SCHEMA,
} from '../../../../src/characterBuilder/prompts/traitsGenerationPrompt.js';

describe('traitsGenerationPrompt integration', () => {
  describe('prompt assembly end-to-end', () => {
    const createValidDirection = () => ({
      title: ' The Memory Thief ',
      description:
        ' A psychological thriller exploring what remains when identity is rewritten by an outside force. ',
      coreTension:
        ' The conflict between a stolen life and the desperation to build a new authentic self before the past resurfaces. ',
      uniqueTwist:
        ' Their memories were siphoned and monetised as immersive entertainment experiences sold on the dark market. ',
      narrativePotential:
        ' Raises questions about the commodification of memory, consent, and whether a person is more than their remembered past. ',
    });

    const createValidCoreMotivations = () => ({
      coreMotivation:
        ' To rebuild an identity that cannot be weaponised by others while keeping loved ones safe from the memory thieves. ',
      internalContradiction:
        ' They must investigate their erased past, even though every recovered detail risks pulling them back under corporate control. ',
      centralQuestion:
        ' Can a person authored by strangers ever become the protagonist of their own story again? ',
    });

    it('should render a complete prompt using production schema assets', () => {
      const characterConcept =
        '  A forensic linguist discovers their personal diaries were replaced with carefully forged memories, triggering a fight to recover their voice.  ';

      const direction = createValidDirection();
      const coreMotivations = createValidCoreMotivations();
      const cliches = {
        categories: {
          names: ['Whisper', 'Cipher'],
          physicalDescriptions: ['Gaunt silhouette', 'Eyes like cold knives'],
          personalityTraits: ['Emotionless prodigy'],
          skillsAbilities: ['Photographic memory', 'Master hacker'],
          typicalLikes: ['Silence'],
          typicalDislikes: ['Crowded cities'],
          commonFears: ['Becoming the villain'],
          genericGoals: ['Revenge'],
          backgroundElements: ['Secret government experiment'],
          overusedSecrets: ['Is actually the bad guy'],
          speechPatterns: ['Speaks in riddles'],
        },
        tropesAndStereotypes: ['The Amnesiac Agent', 'Dark Past'],
      };

      const prompt = buildTraitsGenerationPrompt(
        characterConcept,
        direction,
        coreMotivations,
        cliches
      );

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(1500);

      // Trimmed values should be inserted without surrounding whitespace
      expect(prompt).toContain(
        'A forensic linguist discovers their personal diaries'
      );
      expect(prompt).toContain('Title: The Memory Thief');
      expect(prompt).toContain(
        'Description: A psychological thriller exploring'
      );
      expect(prompt).toContain(
        'Core Tension: The conflict between a stolen life'
      );
      expect(prompt).toContain('Unique Twist: Their memories were siphoned');
      expect(prompt).toContain(
        'Narrative Potential: Raises questions about the commodification of memory'
      );
      expect(prompt).toContain(
        'Core Motivation: To rebuild an identity that cannot be weaponised by others'
      );
      expect(prompt).toContain(
        'Internal Contradiction: They must investigate their erased past'
      );
      expect(prompt).toContain(
        'Central Question: Can a person authored by strangers'
      );

      // Cliché formatting should create headings with bullet lists
      expect(prompt).toContain('Names:\n- Whisper\n- Cipher');
      expect(prompt).toContain(
        'Physical Descriptions:\n- Gaunt silhouette\n- Eyes like cold knives'
      );
      expect(prompt).toContain(
        'Tropes and Stereotypes:\n- The Amnesiac Agent\n- Dark Past'
      );

      // Prompt structural markers
      expect(prompt).toContain('<role>');
      expect(prompt).toContain('<task_definition>');
      expect(prompt).toContain('<character_concept>');
      expect(prompt).toContain('<thematic_direction>');
      expect(prompt).toContain('<core_motivations>');
      expect(prompt).toContain('<cliches_to_avoid>');
      expect(prompt).toContain('<instructions>');
      expect(prompt).toContain('<constraints>');
      expect(prompt).toContain('<response_format>');
      expect(prompt).toContain('<content_policy>');
    });

    it('should gracefully omit optional direction fields and default cliché messaging', () => {
      const characterConcept =
        'A former cult deprogrammer is forced to go undercover again when the movement resurfaces in their hometown.';
      const direction = {
        title: 'Echoes of Faith',
        description:
          'A story about rebuilding belief systems without becoming a zealot again.',
        coreTension:
          'Balancing the need to infiltrate with the fear of being reindoctrinated.',
      };
      const coreMotivations = {
        coreMotivation:
          'Protect loved ones from manipulative leaders without losing their humanity.',
        internalContradiction:
          'They know the indoctrination techniques intimately and fear how easily they could fall for them again.',
        centralQuestion:
          'Can someone destroy a belief system without destroying themselves?',
      };

      const prompt = buildTraitsGenerationPrompt(
        characterConcept,
        direction,
        coreMotivations,
        null
      );

      expect(prompt).not.toContain('Unique Twist:');
      expect(prompt).not.toContain('Narrative Potential:');
      expect(prompt).toContain('No specific clichés provided.');
    });
  });

  describe('input validation', () => {
    const baseDirection = {
      title: 'Fractured Reflections',
      description:
        'A tale of identity splintered across conflicting timelines.',
      coreTension: 'Reconciling who you were with who you are becoming.',
    };

    const baseMotivations = {
      coreMotivation: 'Find a version of themselves that feels authentic.',
      internalContradiction:
        'Every step towards authenticity risks erasing relationships.',
      centralQuestion:
        'Is the truest self the one remembered or the one chosen?',
    };

    const validConcept =
      'A cartographer who maps realities finds their own life missing from every chart.';

    const cases = [
      {
        label: 'requires a non-empty character concept',
        concept: '   ',
        direction: baseDirection,
        motivations: baseMotivations,
        message:
          'TraitsGenerationPrompt: characterConcept must be a non-empty string',
      },
      {
        label: 'requires a direction object',
        concept: validConcept,
        direction: null,
        motivations: baseMotivations,
        message: 'TraitsGenerationPrompt: direction must be a valid object',
      },
      {
        label: 'requires a direction title',
        concept: validConcept,
        direction: { ...baseDirection, title: '  ' },
        motivations: baseMotivations,
        message:
          'TraitsGenerationPrompt: direction.title must be a non-empty string',
      },
      {
        label: 'requires a direction description',
        concept: validConcept,
        direction: { ...baseDirection, description: ' ' },
        motivations: baseMotivations,
        message:
          'TraitsGenerationPrompt: direction.description must be a non-empty string',
      },
      {
        label: 'requires a direction core tension',
        concept: validConcept,
        direction: { ...baseDirection, coreTension: '' },
        motivations: baseMotivations,
        message:
          'TraitsGenerationPrompt: direction.coreTension must be a non-empty string',
      },
      {
        label: 'rejects blank unique twist strings',
        concept: validConcept,
        direction: { ...baseDirection, uniqueTwist: '   ' },
        motivations: baseMotivations,
        message:
          'TraitsGenerationPrompt: direction.uniqueTwist must be a non-empty string if provided',
      },
      {
        label: 'rejects blank narrative potential strings',
        concept: validConcept,
        direction: { ...baseDirection, narrativePotential: '  ' },
        motivations: baseMotivations,
        message:
          'TraitsGenerationPrompt: direction.narrativePotential must be a non-empty string if provided',
      },
      {
        label: 'requires a core motivations object',
        concept: validConcept,
        direction: baseDirection,
        motivations: null,
        message:
          'TraitsGenerationPrompt: coreMotivations must be a valid object',
      },
      {
        label: 'requires a core motivation string',
        concept: validConcept,
        direction: baseDirection,
        motivations: { ...baseMotivations, coreMotivation: '' },
        message:
          'TraitsGenerationPrompt: coreMotivations.coreMotivation must be a non-empty string',
      },
      {
        label: 'requires an internal contradiction',
        concept: validConcept,
        direction: baseDirection,
        motivations: { ...baseMotivations, internalContradiction: '' },
        message:
          'TraitsGenerationPrompt: coreMotivations.internalContradiction must be a non-empty string',
      },
      {
        label: 'requires a central question',
        concept: validConcept,
        direction: baseDirection,
        motivations: { ...baseMotivations, centralQuestion: '' },
        message:
          'TraitsGenerationPrompt: coreMotivations.centralQuestion must be a non-empty string',
      },
    ];

    it.each(cases)(
      'enforces validation when it $label',
      ({ concept, direction, motivations, message }) => {
        expect(() =>
          buildTraitsGenerationPrompt(concept, direction, motivations, {})
        ).toThrow(message);
      }
    );
  });

  describe('schema and config exports', () => {
    it('should expose the LLM request defaults expected by orchestration', () => {
      expect(TRAITS_GENERATION_LLM_PARAMS).toEqual({
        temperature: 0.8,
        max_tokens: 6000,
      });
    });

    it('should describe the prompt version history', () => {
      expect(PROMPT_VERSION_INFO).toMatchObject({
        version: '1.0.0',
        previousVersions: {},
      });
      expect(Array.isArray(PROMPT_VERSION_INFO.currentChanges)).toBe(true);
      expect(PROMPT_VERSION_INFO.currentChanges).toContain(
        'Initial implementation for traits generation'
      );
    });

    it('should align the response schema with the core trait schema', () => {
      const expectedKeys = [
        'names',
        'physicalDescription',
        'personality',
        'strengths',
        'weaknesses',
        'likes',
        'dislikes',
        'fears',
        'goals',
        'notes',
        'profile',
        'secrets',
      ];

      expect(TRAITS_RESPONSE_SCHEMA.type).toBe('object');
      expect(TRAITS_RESPONSE_SCHEMA.additionalProperties).toBe(false);
      expect(Object.keys(TRAITS_RESPONSE_SCHEMA.properties)).toEqual(
        expectedKeys
      );
      expect(TRAITS_RESPONSE_SCHEMA.required).toEqual(expectedKeys);

      expectedKeys.forEach((key) => {
        expect(TRAITS_RESPONSE_SCHEMA.properties[key]).toEqual(
          traitSchema.properties[key]
        );
      });
    });
  });
});
