/**
 * @file Integration tests for traits generation prompt
 * @see src/characterBuilder/prompts/traitsGenerationPrompt.js
 */

import { describe, expect, it } from '@jest/globals';
import traitSchema from '../../../../data/schemas/trait.schema.json' with { type: 'json' };
import {
  buildTraitsGenerationPrompt,
  createTraitsGenerationLlmConfig,
  PROMPT_VERSION_INFO,
  TRAITS_GENERATION_LLM_PARAMS,
  TRAITS_RESPONSE_SCHEMA,
  validateTraitsGenerationResponse,
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

    it('should merge schema-driven defaults into a provided LLM config', () => {
      const baseConfig = {
        transport: 'openrouter',
        defaultParameters: {
          temperature: 0.2,
          top_p: 0.85,
        },
      };

      const enhanced = createTraitsGenerationLlmConfig(baseConfig);

      expect(enhanced).toMatchObject({
        transport: 'openrouter',
        jsonOutputStrategy: {
          method: 'openrouter_json_schema',
          jsonSchema: TRAITS_RESPONSE_SCHEMA,
        },
        defaultParameters: {
          temperature: 0.8,
          top_p: 0.85,
          max_tokens: 6000,
        },
      });

      // Ensure we are not mutating the source config when composing integrations
      expect(baseConfig).toEqual({
        transport: 'openrouter',
        defaultParameters: {
          temperature: 0.2,
          top_p: 0.85,
        },
      });
    });

    it('should guard against invalid base configs', () => {
      expect(() => createTraitsGenerationLlmConfig(null)).toThrow(
        'TraitsGenerationPrompt: baseLlmConfig must be a valid object'
      );
    });
  });

  describe('response validation integration', () => {
    const buildValidResponse = () => ({
      names: [
        {
          name: 'Marell Vance',
          justification:
            'Uses a clipped cadence that hints at scholastic roots rather than noir clichés.',
        },
        {
          name: 'Ivo Kestrel',
          justification:
            'Feels like a field name acquired through work, not gritty angst.',
        },
        {
          name: 'Risa Calder',
          justification:
            'Pairs softness with angular syllables to dodge femme fatale expectations.',
        },
      ],
      physicalDescription:
        'Intentional posture softened by tremors, ink stained fingertips, bespoke brace etched with field equations, and a voice that rasps from years of cold storage briefings.',
      personality: [
        {
          trait: 'Pattern Stoic',
          explanation:
            'Holds stillness specifically so anomalous details reveal themselves.',
        },
        {
          trait: 'Ethical Contrarian',
          explanation:
            'Interrogates every consensus, forcing allies to articulate why their plan is moral.',
        },
        {
          trait: 'Reckless Archivist',
          explanation:
            'Will risk physical safety if it means preserving contested histories.',
        },
      ],
      strengths: [
        'Can cross-reference mythic and scientific frameworks in real time.',
        'Empathy training lets them diffuse cult indoctrination scripts.',
      ],
      weaknesses: [
        'Sleeps so little that perception sometimes fractures mid-mission.',
        'Collects dangerous artifacts despite promising to destroy them.',
      ],
      likes: [
        'Libraries that allow annotation in the margins.',
        'Street food vendors who improvise entire menus.',
        'Radio static that hides coded confessions.',
      ],
      dislikes: [
        'Corporate security slogans.',
        'Museum plaques that omit labor strikes.',
        'Uniforms that pretend neutrality equals safety.',
      ],
      fears: ['Being remembered only through curated propaganda.'],
      goals: {
        shortTerm: [
          'Secure the final witness testimony before it is weaponised.',
          'Map which conspirators profit from identity theft rituals.',
        ],
        longTerm:
          'Design an identity commons where no narrative can be stolen without consent.',
      },
      notes: [
        'Certified in diplomatic courier protocols used during interstellar ceasefires.',
        'Memorised the folklore of three underground cities to earn safe passage.',
      ],
      profile:
        'Raised inside a remote research cooperative, they learned early that stories could be extracted and sold the way minerals were. When the cooperative was raided for its memory-mapping tech, they fled with the prototypes and have been rebuilding the archive in transit ever since, trading favors with smugglers and ethicists alike.',
      secrets: [
        'Quietly leaked an ally’s biography to bait the true thief, and the ally still does not know.',
      ],
    });

    it('accepts a fully compliant LLM response payload', () => {
      const response = buildValidResponse();
      expect(validateTraitsGenerationResponse(response)).toBe(true);
    });

    const invalidResponseCases = [
      {
        label: 'is not an object',
        mutate: () => null,
        message: 'TraitsGenerationPrompt: Response must be an object',
      },
      {
        label: 'is missing the names array',
        mutate: (response) => {
          delete response.names;
          return response;
        },
        message: 'TraitsGenerationPrompt: Response must contain names array',
      },
      {
        label: 'provides too few names',
        mutate: (response) => {
          response.names = response.names.slice(0, 2);
          return response;
        },
        message:
          'TraitsGenerationPrompt: Names array is below minimum (got 2 items, minimum is 3)',
      },
      {
        label: 'uses a primitive for a name entry',
        mutate: (response) => {
          response.names[0] = 'Cipher';
          return response;
        },
        message: 'TraitsGenerationPrompt: Name at index 0 must be an object',
      },
      {
        label: 'includes a blank name string',
        mutate: (response) => {
          response.names[0] = { ...response.names[0], name: '   ' };
          return response;
        },
        message:
          'TraitsGenerationPrompt: Name at index 0 must have a non-empty name string',
      },
      {
        label: 'includes a blank justification string',
        mutate: (response) => {
          response.names[0] = { ...response.names[0], justification: '' };
          return response;
        },
        message:
          'TraitsGenerationPrompt: Name at index 0 must have a non-empty justification string',
      },
      {
        label: 'omits the physical description',
        mutate: (response) => {
          delete response.physicalDescription;
          return response;
        },
        message:
          'TraitsGenerationPrompt: Response must contain physicalDescription string',
      },
      {
        label: 'provides an undersized physical description',
        mutate: (response) => {
          response.physicalDescription = 'Too short';
          return response;
        },
        message:
          'TraitsGenerationPrompt: physicalDescription is below minimum (got 9 characters, minimum is 100)',
      },
      {
        label: 'is missing the personality array',
        mutate: (response) => {
          delete response.personality;
          return response;
        },
        message:
          'TraitsGenerationPrompt: Response must contain personality array',
      },
      {
        label: 'provides too few personality entries',
        mutate: (response) => {
          response.personality = response.personality.slice(0, 2);
          return response;
        },
        message:
          'TraitsGenerationPrompt: Personality array is below minimum (got 2 items, minimum is 3)',
      },
      {
        label: 'uses a primitive for a personality entry',
        mutate: (response) => {
          response.personality[0] = 'blunt';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Personality at index 0 must be an object',
      },
      {
        label: 'omits the personality trait string',
        mutate: (response) => {
          response.personality[0] = { ...response.personality[0], trait: ' ' };
          return response;
        },
        message:
          'TraitsGenerationPrompt: Personality at index 0 must have a non-empty trait string',
      },
      {
        label: 'omits the personality explanation string',
        mutate: (response) => {
          response.personality[0] = {
            ...response.personality[0],
            explanation: '',
          };
          return response;
        },
        message:
          'TraitsGenerationPrompt: Personality at index 0 must have a non-empty explanation string',
      },
      {
        label: 'is missing the strengths array',
        mutate: (response) => {
          delete response.strengths;
          return response;
        },
        message:
          'TraitsGenerationPrompt: Response must contain strengths array',
      },
      {
        label: 'provides too few strengths',
        mutate: (response) => {
          response.strengths = ['One'];
          return response;
        },
        message:
          'TraitsGenerationPrompt: Strengths array is below minimum (got 1 items, minimum is 2)',
      },
      {
        label: 'includes an empty strength entry',
        mutate: (response) => {
          response.strengths[0] = ' ';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Strength at index 0 must be a non-empty string',
      },
      {
        label: 'is missing the weaknesses array',
        mutate: (response) => {
          delete response.weaknesses;
          return response;
        },
        message:
          'TraitsGenerationPrompt: Response must contain weaknesses array',
      },
      {
        label: 'provides too few weaknesses',
        mutate: (response) => {
          response.weaknesses = ['Only one'];
          return response;
        },
        message:
          'TraitsGenerationPrompt: Weaknesses array is below minimum (got 1 items, minimum is 2)',
      },
      {
        label: 'includes an empty weakness entry',
        mutate: (response) => {
          response.weaknesses[0] = '';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Weakness at index 0 must be a non-empty string',
      },
      {
        label: 'is missing the likes array',
        mutate: (response) => {
          delete response.likes;
          return response;
        },
        message: 'TraitsGenerationPrompt: Response must contain likes array',
      },
      {
        label: 'provides too few likes',
        mutate: (response) => {
          response.likes = response.likes.slice(0, 2);
          return response;
        },
        message:
          'TraitsGenerationPrompt: Likes array is below minimum (got 2 items, minimum is 3)',
      },
      {
        label: 'includes an empty like entry',
        mutate: (response) => {
          response.likes[0] = '   ';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Like at index 0 must be a non-empty string',
      },
      {
        label: 'is missing the dislikes array',
        mutate: (response) => {
          delete response.dislikes;
          return response;
        },
        message: 'TraitsGenerationPrompt: Response must contain dislikes array',
      },
      {
        label: 'provides too few dislikes',
        mutate: (response) => {
          response.dislikes = response.dislikes.slice(0, 2);
          return response;
        },
        message:
          'TraitsGenerationPrompt: Dislikes array is below minimum (got 2 items, minimum is 3)',
      },
      {
        label: 'includes an empty dislike entry',
        mutate: (response) => {
          response.dislikes[0] = '';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Dislike at index 0 must be a non-empty string',
      },
      {
        label: 'is missing the fears array',
        mutate: (response) => {
          delete response.fears;
          return response;
        },
        message: 'TraitsGenerationPrompt: Response must contain fears array',
      },
      {
        label: 'provides an empty fears array',
        mutate: (response) => {
          response.fears = [];
          return response;
        },
        message:
          'TraitsGenerationPrompt: Fears array is below minimum (got 0 items, minimum is 1)',
      },
      {
        label: 'includes an empty fear entry',
        mutate: (response) => {
          response.fears[0] = '';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Fear at index 0 must be a non-empty string',
      },
      {
        label: 'is missing the goals object',
        mutate: (response) => {
          response.goals = null;
          return response;
        },
        message: 'TraitsGenerationPrompt: Response must contain goals object',
      },
      {
        label: 'is missing the short-term goals array',
        mutate: (response) => {
          response.goals.shortTerm = null;
          return response;
        },
        message: 'TraitsGenerationPrompt: Goals must contain shortTerm array',
      },
      {
        label: 'provides too many or too few short-term goals',
        mutate: (response) => {
          response.goals.shortTerm = [];
          return response;
        },
        message:
          'TraitsGenerationPrompt: Short-term goals array is below minimum (got 0 items, minimum is 1)',
      },
      {
        label: 'includes an empty short-term goal entry',
        mutate: (response) => {
          response.goals.shortTerm[0] = '';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Short-term goal at index 0 must be a non-empty string',
      },
      {
        label: 'omits the long-term goal string',
        mutate: (response) => {
          response.goals.longTerm = ' ';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Goals must contain a non-empty longTerm string',
      },
      {
        label: 'is missing the notes array',
        mutate: (response) => {
          delete response.notes;
          return response;
        },
        message: 'TraitsGenerationPrompt: Response must contain notes array',
      },
      {
        label: 'provides too few notes',
        mutate: (response) => {
          response.notes = ['Only'];
          return response;
        },
        message:
          'TraitsGenerationPrompt: Notes array is below minimum (got 1 items, minimum is 2)',
      },
      {
        label: 'includes an empty note entry',
        mutate: (response) => {
          response.notes[0] = '';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Note at index 0 must be a non-empty string',
      },
      {
        label: 'is missing the profile string',
        mutate: (response) => {
          delete response.profile;
          return response;
        },
        message: 'TraitsGenerationPrompt: Response must contain profile string',
      },
      {
        label: 'provides an undersized profile',
        mutate: (response) => {
          response.profile = 'Short bio';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Profile is below minimum (got 9 characters, minimum is 200)',
      },
      {
        label: 'is missing the secrets array',
        mutate: (response) => {
          delete response.secrets;
          return response;
        },
        message: 'TraitsGenerationPrompt: Response must contain secrets array',
      },
      {
        label: 'provides too many or too few secrets',
        mutate: (response) => {
          response.secrets = [];
          return response;
        },
        message:
          'TraitsGenerationPrompt: Secrets array is below minimum (got 0 items, minimum is 1)',
      },
      {
        label: 'includes an empty secret entry',
        mutate: (response) => {
          response.secrets[0] = '';
          return response;
        },
        message:
          'TraitsGenerationPrompt: Secret at index 0 must be a non-empty string',
      },
    ];

    it.each(invalidResponseCases)(
      'rejects responses when the payload $label',
      ({ mutate, message }) => {
        const candidate = mutate(buildValidResponse());
        expect(() => validateTraitsGenerationResponse(candidate)).toThrow(
          message
        );
      }
    );
  });
});
