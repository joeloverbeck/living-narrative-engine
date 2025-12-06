/**
 * @file Unit tests for traits generation prompt
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildTraitsGenerationPrompt,
  validateTraitsGenerationResponse,
  formatClichesForPrompt,
  createTraitsGenerationLlmConfig,
  PROMPT_VERSION_INFO,
  TRAITS_GENERATION_LLM_PARAMS,
  TRAITS_RESPONSE_SCHEMA,
} from '../../../../src/characterBuilder/prompts/traitsGenerationPrompt.js';

describe('TraitsGenerationPrompt - Constants', () => {
  describe('PROMPT_VERSION_INFO', () => {
    it('should have correct version structure', () => {
      expect(PROMPT_VERSION_INFO).toEqual({
        version: '1.0.0',
        previousVersions: {},
        currentChanges: ['Initial implementation for traits generation'],
      });
    });
  });

  describe('TRAITS_GENERATION_LLM_PARAMS', () => {
    it('should have correct LLM parameters', () => {
      expect(TRAITS_GENERATION_LLM_PARAMS).toEqual({
        temperature: 0.8,
        max_tokens: 6000,
      });
    });
  });

  describe('TRAITS_RESPONSE_SCHEMA', () => {
    it('should have correct schema structure', () => {
      expect(TRAITS_RESPONSE_SCHEMA.type).toBe('object');
      expect(TRAITS_RESPONSE_SCHEMA.additionalProperties).toBe(false);
      expect(TRAITS_RESPONSE_SCHEMA.required).toEqual([
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
      ]);
      expect(TRAITS_RESPONSE_SCHEMA.properties.names).toBeDefined();
      expect(
        TRAITS_RESPONSE_SCHEMA.properties.physicalDescription
      ).toBeDefined();
      expect(TRAITS_RESPONSE_SCHEMA.properties.personality).toBeDefined();
    });
  });
});

describe('TraitsGenerationPrompt - formatClichesForPrompt', () => {
  it('should format empty cliches object', () => {
    const result = formatClichesForPrompt({});
    expect(result).toBe('No specific clichés provided.');
  });

  it('should format null cliches', () => {
    const result = formatClichesForPrompt(null);
    expect(result).toBe('No specific clichés provided.');
  });

  it('should format categories only', () => {
    const cliches = {
      categories: {
        names: ['John Smith', 'Jane Doe'],
        physicalDescriptions: ['Blonde hair', 'Blue eyes'],
      },
    };

    const result = formatClichesForPrompt(cliches);
    expect(result).toContain('Names:');
    expect(result).toContain('- John Smith');
    expect(result).toContain('- Jane Doe');
    expect(result).toContain('Physical Descriptions:');
    expect(result).toContain('- Blonde hair');
    expect(result).toContain('- Blue eyes');
  });

  it('should format tropesAndStereotypes only', () => {
    const cliches = {
      tropesAndStereotypes: ['Chosen One', 'Dark Lord', 'Wise Mentor'],
    };

    const result = formatClichesForPrompt(cliches);
    expect(result).toContain('Tropes and Stereotypes:');
    expect(result).toContain('- Chosen One');
    expect(result).toContain('- Dark Lord');
    expect(result).toContain('- Wise Mentor');
  });

  it('should format both categories and tropesAndStereotypes', () => {
    const cliches = {
      categories: {
        names: ['Generic Name'],
      },
      tropesAndStereotypes: ['Generic Trope'],
    };

    const result = formatClichesForPrompt(cliches);
    expect(result).toContain('Names:');
    expect(result).toContain('- Generic Name');
    expect(result).toContain('Tropes and Stereotypes:');
    expect(result).toContain('- Generic Trope');
  });

  it('should handle empty arrays in categories', () => {
    const cliches = {
      categories: {
        names: [],
        physicalDescriptions: ['Some description'],
      },
    };

    const result = formatClichesForPrompt(cliches);
    expect(result).not.toContain('Names:');
    expect(result).toContain('Physical Descriptions:');
  });
});

describe('TraitsGenerationPrompt - buildTraitsGenerationPrompt', () => {
  const validCharacterConcept = 'A mysterious detective with a dark past';
  const validDirection = {
    title: 'Noir Detective',
    description: 'A gritty urban detective story',
    coreTension: 'Justice vs Personal demons',
    uniqueTwist: 'Former criminal turned detective',
    narrativePotential: 'Redemption arc with moral complexity',
  };
  const validCoreMotivations = {
    coreMotivation: 'To atone for past crimes',
    internalContradiction: 'Uses illegal methods to enforce the law',
    centralQuestion: 'Can someone truly escape their past?',
  };
  const validCliches = {
    categories: {
      names: ['John Smith'],
      physicalDescriptions: ['Rugged appearance'],
    },
    tropesAndStereotypes: ['Lone Wolf Detective'],
  };

  it('should build complete prompt with all required sections', () => {
    const prompt = buildTraitsGenerationPrompt(
      validCharacterConcept,
      validDirection,
      validCoreMotivations,
      validCliches
    );

    expect(prompt).toContain('<role>');
    expect(prompt).toContain(
      'Expert character development analyst specializing in creating comprehensive character traits'
    );
    expect(prompt).toContain('<task_definition>');
    expect(prompt).toContain(
      'Generate detailed character traits based on core concept'
    );
    expect(prompt).toContain('<character_concept>');
    expect(prompt).toContain(validCharacterConcept);
    expect(prompt).toContain('<thematic_direction>');
    expect(prompt).toContain('Title: Noir Detective');
    expect(prompt).toContain('<core_motivations>');
    expect(prompt).toContain('Core Motivation: To atone for past crimes');
    expect(prompt).toContain('<cliches_to_avoid>');
    expect(prompt).toContain('Names:');
    expect(prompt).toContain('<instructions>');
    expect(prompt).toContain('12 categories');
    expect(prompt).toContain('<constraints>');
    expect(prompt).toContain('<response_format>');
    expect(prompt).toContain('<content_policy>');
    expect(prompt).toContain('NC-21 (ADULTS ONLY)');
  });

  it('should handle optional direction fields when present', () => {
    const prompt = buildTraitsGenerationPrompt(
      validCharacterConcept,
      validDirection,
      validCoreMotivations,
      validCliches
    );

    expect(prompt).toContain('Unique Twist: Former criminal turned detective');
    expect(prompt).toContain(
      'Narrative Potential: Redemption arc with moral complexity'
    );
  });

  it('should handle optional direction fields when absent', () => {
    const minimalDirection = {
      title: 'Noir Detective',
      description: 'A gritty urban detective story',
      coreTension: 'Justice vs Personal demons',
    };

    const prompt = buildTraitsGenerationPrompt(
      validCharacterConcept,
      minimalDirection,
      validCoreMotivations,
      validCliches
    );

    expect(prompt).not.toContain('Unique Twist:');
    expect(prompt).not.toContain('Narrative Potential:');
  });

  it('should throw error for empty characterConcept', () => {
    expect(() => {
      buildTraitsGenerationPrompt(
        '',
        validDirection,
        validCoreMotivations,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: characterConcept must be a non-empty string'
    );
  });

  it('should throw error for invalid direction', () => {
    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        null,
        validCoreMotivations,
        validCliches
      );
    }).toThrow('TraitsGenerationPrompt: direction must be a valid object');
  });

  it('should throw error for missing direction title', () => {
    const invalidDirection = { ...validDirection };
    delete invalidDirection.title;

    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        invalidDirection,
        validCoreMotivations,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: direction.title must be a non-empty string'
    );
  });

  it('should throw error for invalid coreMotivations', () => {
    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        validDirection,
        null,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: coreMotivations must be a valid object'
    );
  });

  it('should throw error for missing core motivation field', () => {
    const invalidMotivations = { ...validCoreMotivations };
    delete invalidMotivations.coreMotivation;

    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        validDirection,
        invalidMotivations,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: coreMotivations.coreMotivation must be a non-empty string'
    );
  });

  it('should handle null cliches gracefully', () => {
    const prompt = buildTraitsGenerationPrompt(
      validCharacterConcept,
      validDirection,
      validCoreMotivations,
      null
    );

    expect(prompt).toContain('<cliches_to_avoid>');
    expect(prompt).toContain('No specific clichés provided.');
  });

  it('should handle empty cliches object', () => {
    const prompt = buildTraitsGenerationPrompt(
      validCharacterConcept,
      validDirection,
      validCoreMotivations,
      {}
    );

    expect(prompt).toContain('<cliches_to_avoid>');
    expect(prompt).toContain('No specific clichés provided.');
  });

  it('should throw error for empty direction description', () => {
    const invalidDirection = { ...validDirection, description: '' };

    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        invalidDirection,
        validCoreMotivations,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: direction.description must be a non-empty string'
    );
  });

  it('should throw error for empty direction coreTension', () => {
    const invalidDirection = { ...validDirection, coreTension: '' };

    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        invalidDirection,
        validCoreMotivations,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: direction.coreTension must be a non-empty string'
    );
  });

  it('should throw error for empty direction uniqueTwist when provided', () => {
    const invalidDirection = { ...validDirection, uniqueTwist: '' };

    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        invalidDirection,
        validCoreMotivations,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: direction.uniqueTwist must be a non-empty string if provided'
    );
  });

  it('should throw error for empty direction narrativePotential when provided', () => {
    const invalidDirection = { ...validDirection, narrativePotential: '' };

    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        invalidDirection,
        validCoreMotivations,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: direction.narrativePotential must be a non-empty string if provided'
    );
  });

  it('should throw error for empty core motivation internalContradiction', () => {
    const invalidMotivations = {
      ...validCoreMotivations,
      internalContradiction: '',
    };

    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        validDirection,
        invalidMotivations,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: coreMotivations.internalContradiction must be a non-empty string'
    );
  });

  it('should throw error for empty core motivation centralQuestion', () => {
    const invalidMotivations = { ...validCoreMotivations, centralQuestion: '' };

    expect(() => {
      buildTraitsGenerationPrompt(
        validCharacterConcept,
        validDirection,
        invalidMotivations,
        validCliches
      );
    }).toThrow(
      'TraitsGenerationPrompt: coreMotivations.centralQuestion must be a non-empty string'
    );
  });

  it('should trim whitespace from inputs', () => {
    const conceptWithWhitespace = '  A mysterious detective  ';
    const directionWithWhitespace = {
      title: '  Noir Detective  ',
      description: '  A gritty story  ',
      coreTension: '  Justice vs demons  ',
    };

    const prompt = buildTraitsGenerationPrompt(
      conceptWithWhitespace,
      directionWithWhitespace,
      validCoreMotivations,
      validCliches
    );

    expect(prompt).toContain('A mysterious detective');
    expect(prompt).toContain('Title: Noir Detective');
    expect(prompt).toContain('Description: A gritty story');
    expect(prompt).toContain('Core Tension: Justice vs demons');
    // Check that the trimmed content is present, not that double spaces are absent
    // (since the prompt template itself may contain intentional formatting spaces)
  });
});

describe('TraitsGenerationPrompt - validateTraitsGenerationResponse', () => {
  const createValidResponse = () => ({
    names: [
      {
        name: 'Alexandra Noir',
        justification: 'Subverts typical detective names',
      },
      { name: 'Marcus Steel', justification: 'Reflects inner strength' },
      { name: 'Elena Cross', justification: 'Suggests moral crossroads' },
    ],
    physicalDescription:
      'Piercing gray eyes that seem to see through deception, weathered hands that tell stories of past violence, and a subtle scar above the left eyebrow that hints at dangerous encounters. Despite average height, carries themselves with quiet authority.',
    personality: [
      {
        trait: 'Analytical',
        explanation: 'Obsessively breaks down every detail of a case',
      },
      {
        trait: 'Guarded',
        explanation:
          'Keeps emotional distance to protect themselves and others',
      },
      {
        trait: 'Intuitive',
        explanation: 'Relies on gut feelings about people and situations',
      },
    ],
    strengths: ['Pattern recognition', 'Street knowledge'],
    weaknesses: ['Emotional walls', 'Past trauma triggers'],
    likes: ['Late night coffee', 'Rain on windows', 'Old jazz records'],
    dislikes: ['Bright lights', 'Crowded spaces', 'Small talk'],
    fears: ['Becoming the person they once were'],
    goals: {
      shortTerm: ['Solve the current case'],
      longTerm: 'Find peace with their past',
    },
    notes: [
      'Speaks three languages fluently',
      'Has photographic memory for faces',
    ],
    profile:
      "A former criminal who turned their life around after a tragic event, now works as a private detective specializing in cases others won't touch. Their past gives them unique insights into the criminal mind, but also haunts their every decision. Currently living a solitary life in the city, taking cases that offer a chance at redemption.",
    secrets: ['Was involved in a crime that resulted in an innocent death'],
  });

  it('should validate complete valid response', () => {
    const validResponse = createValidResponse();
    expect(() => validateTraitsGenerationResponse(validResponse)).not.toThrow();
    expect(validateTraitsGenerationResponse(validResponse)).toBe(true);
  });

  it('should throw error for non-object response', () => {
    expect(() => {
      validateTraitsGenerationResponse(null);
    }).toThrow('TraitsGenerationPrompt: Response must be an object');

    expect(() => {
      validateTraitsGenerationResponse('string');
    }).toThrow('TraitsGenerationPrompt: Response must be an object');
  });

  it('should validate names array', () => {
    const response = createValidResponse();
    delete response.names;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Response must contain names array');
  });

  it('should validate names array length', () => {
    const response = createValidResponse();
    response.names = [{ name: 'Test', justification: 'Test' }]; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Names array must contain 3-5 items');

    response.names = Array(6).fill({ name: 'Test', justification: 'Test' }); // Too many

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Names array must contain 3-5 items');
  });

  it('should validate name entries are objects', () => {
    const response = createValidResponse();
    response.names[0] = null;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Name at index 0 must be an object');
  });

  it('should validate name object structure', () => {
    const response = createValidResponse();
    response.names[0] = { name: 'Test' }; // Missing justification

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Name at index 0 must have a non-empty justification string'
    );
  });

  it('should validate physical description', () => {
    const response = createValidResponse();
    response.physicalDescription = 'Too short'; // Less than 100 chars

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: physicalDescription must be 100-700 characters'
    );

    response.physicalDescription = 'A'.repeat(701); // More than 700 chars

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: physicalDescription must be 100-700 characters'
    );
  });

  it('should require physical description string', () => {
    const response = createValidResponse();
    response.physicalDescription = null;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Response must contain physicalDescription string'
    );
  });

  it('should validate personality array', () => {
    const response = createValidResponse();
    response.personality = [{ trait: 'Test', explanation: 'Test' }]; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Personality array must contain 3-8 items'
    );
  });

  it('should require personality array', () => {
    const response = createValidResponse();
    response.personality = null;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Response must contain personality array'
    );
  });

  it('should validate personality object structure', () => {
    const response = createValidResponse();
    response.personality[0] = { trait: 'Test' }; // Missing explanation

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Personality at index 0 must have a non-empty explanation string'
    );
  });

  it('should validate personality trait string', () => {
    const response = createValidResponse();
    response.personality[0] = {
      trait: '   ',
      explanation: 'Has explanation',
    };

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Personality at index 0 must have a non-empty trait string'
    );
  });

  it('should require personality entries to be objects', () => {
    const response = createValidResponse();
    response.personality[0] = 'not-an-object';

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Personality at index 0 must be an object'
    );
  });

  it('should validate strengths array', () => {
    const response = createValidResponse();
    response.strengths = ['One']; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Strengths array must contain 2-6 items'
    );

    response.strengths = [
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
    ]; // Too many

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Strengths array must contain 2-6 items'
    );
  });

  it('should require strengths array', () => {
    const response = createValidResponse();
    response.strengths = null;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Response must contain strengths array');
  });

  it('should validate weaknesses array', () => {
    const response = createValidResponse();
    response.weaknesses = ['One']; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Weaknesses array must contain 2-6 items'
    );
  });

  it('should require weaknesses array', () => {
    const response = createValidResponse();
    response.weaknesses = undefined;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Response must contain weaknesses array'
    );
  });

  it('should validate likes array', () => {
    const response = createValidResponse();
    response.likes = ['One', 'Two']; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Likes array must contain 3-8 items');
  });

  it('should require likes array', () => {
    const response = createValidResponse();
    response.likes = null;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Response must contain likes array');
  });

  it('should validate dislikes array', () => {
    const response = createValidResponse();
    response.dislikes = ['One', 'Two']; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Dislikes array must contain 3-8 items');
  });

  it('should require dislikes array', () => {
    const response = createValidResponse();
    response.dislikes = undefined;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Response must contain dislikes array');
  });

  it('should validate fears array', () => {
    const response = createValidResponse();
    response.fears = []; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Fears array must contain 1-2 items');

    response.fears = ['One', 'Two', 'Three']; // Too many

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Fears array must contain 1-2 items');
  });

  it('should require fears array', () => {
    const response = createValidResponse();
    response.fears = null;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Response must contain fears array');
  });

  it('should validate goals object', () => {
    const response = createValidResponse();
    delete response.goals;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Response must contain goals object');
  });

  it('should require shortTerm goals array', () => {
    const response = createValidResponse();
    delete response.goals.shortTerm;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Goals must contain shortTerm array');
  });

  it('should validate goals shortTerm array', () => {
    const response = createValidResponse();
    response.goals.shortTerm = []; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Short-term goals array must contain 1-3 items'
    );

    response.goals.shortTerm = ['One', 'Two', 'Three', 'Four']; // Too many

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Short-term goals array must contain 1-3 items'
    );
  });

  it('should validate goals longTerm string', () => {
    const response = createValidResponse();
    delete response.goals.longTerm;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Goals must contain a non-empty longTerm string'
    );
  });

  it('should require notes array', () => {
    const response = createValidResponse();
    delete response.notes;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Response must contain notes array');
  });

  it('should validate notes array', () => {
    const response = createValidResponse();
    response.notes = ['One']; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Notes array must contain 2-6 items');

    response.notes = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven']; // Too many

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Notes array must contain 2-6 items');
  });

  it('should require profile string', () => {
    const response = createValidResponse();
    response.profile = null;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Response must contain profile string');
  });

  it('should validate profile string length', () => {
    const response = createValidResponse();
    response.profile = 'Too short'; // Less than 200 chars

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Profile must be at least 200 characters'
    );
  });

  it('should accept profiles longer than 1200 characters', () => {
    const response = createValidResponse();
    response.profile = 'A'.repeat(1500); // More than 1200 chars - should be valid now

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).not.toThrow();
  });

  it('should validate secrets array', () => {
    const response = createValidResponse();
    response.secrets = []; // Too few

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Secrets array must contain 1-2 items');

    response.secrets = ['One', 'Two', 'Three']; // Too many

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Secrets array must contain 1-2 items');
  });

  it('should require secrets array', () => {
    const response = createValidResponse();
    delete response.secrets;

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow('TraitsGenerationPrompt: Response must contain secrets array');
  });

  it('should validate empty strings in arrays', () => {
    const response = createValidResponse();
    response.strengths[0] = ''; // Empty string

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Strength at index 0 must be a non-empty string'
    );
  });

  it('should validate empty strings in various arrays', () => {
    const response = createValidResponse();
    response.weaknesses[0] = '';

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Weakness at index 0 must be a non-empty string'
    );

    response.weaknesses[0] = 'Valid'; // Fix it
    response.likes[0] = '';

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Like at index 0 must be a non-empty string'
    );

    response.likes[0] = 'Valid'; // Fix it
    response.dislikes[0] = '';

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Dislike at index 0 must be a non-empty string'
    );

    response.dislikes[0] = 'Valid'; // Fix it
    response.fears[0] = '';

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Fear at index 0 must be a non-empty string'
    );

    response.fears[0] = 'Valid'; // Fix it
    response.goals.shortTerm[0] = '';

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Short-term goal at index 0 must be a non-empty string'
    );

    response.goals.shortTerm[0] = 'Valid'; // Fix it
    response.notes[0] = '';

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Note at index 0 must be a non-empty string'
    );

    response.notes[0] = 'Valid'; // Fix it
    response.secrets[0] = '';

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Secret at index 0 must be a non-empty string'
    );
  });
});

describe('TraitsGenerationPrompt - createTraitsGenerationLlmConfig', () => {
  const baseLlmConfig = {
    model: 'test-model',
    defaultParameters: {
      temperature: 0.7,
      max_tokens: 2000,
    },
  };

  it('should create enhanced config with JSON schema', () => {
    const result = createTraitsGenerationLlmConfig(baseLlmConfig);

    expect(result.model).toBe('test-model');
    expect(result.jsonOutputStrategy).toEqual({
      method: 'openrouter_json_schema',
      jsonSchema: TRAITS_RESPONSE_SCHEMA,
    });
    expect(result.defaultParameters).toEqual({
      temperature: 0.8, // Should be overridden by TRAITS_GENERATION_LLM_PARAMS
      max_tokens: 6000, // Should be overridden by TRAITS_GENERATION_LLM_PARAMS
    });
  });

  it('should preserve other base config properties', () => {
    const baseConfigWithExtra = {
      ...baseLlmConfig,
      apiKey: 'test-key',
      baseUrl: 'test-url',
    };

    const result = createTraitsGenerationLlmConfig(baseConfigWithExtra);

    expect(result.apiKey).toBe('test-key');
    expect(result.baseUrl).toBe('test-url');
  });

  it('should throw error for invalid base config', () => {
    expect(() => {
      createTraitsGenerationLlmConfig(null);
    }).toThrow('TraitsGenerationPrompt: baseLlmConfig must be a valid object');

    expect(() => {
      createTraitsGenerationLlmConfig('string');
    }).toThrow('TraitsGenerationPrompt: baseLlmConfig must be a valid object');
  });

  it('should handle base config without defaultParameters', () => {
    const minimalConfig = { model: 'test-model' };
    const result = createTraitsGenerationLlmConfig(minimalConfig);

    expect(result.defaultParameters).toEqual(TRAITS_GENERATION_LLM_PARAMS);
  });
});

describe('TraitsGenerationPrompt - Edge Cases', () => {
  it('should handle whitespace-only strings in validation', () => {
    const response = {
      names: [
        { name: '  ', justification: 'Test' },
        { name: 'Valid Name', justification: 'Test' },
        { name: 'Another Name', justification: 'Test' },
      ],
      physicalDescription: 'A'.repeat(200),
      personality: [
        { trait: 'Test', explanation: 'Test' },
        { trait: 'Test2', explanation: 'Test2' },
        { trait: 'Test3', explanation: 'Test3' },
      ],
      strengths: ['Test', 'Test2'],
      weaknesses: ['Test', 'Test2'],
      likes: ['Test', 'Test2', 'Test3'],
      dislikes: ['Test', 'Test2', 'Test3'],
      fears: ['Test'],
      goals: {
        shortTerm: ['Test'],
        longTerm: 'Test',
      },
      notes: ['Test', 'Test2'],
      profile: 'A'.repeat(250),
      secrets: ['Test'],
    };

    expect(() => {
      validateTraitsGenerationResponse(response);
    }).toThrow(
      'TraitsGenerationPrompt: Name at index 0 must have a non-empty name string'
    );
  });

  it('should handle extremely long valid strings', () => {
    const validResponse = {
      names: [
        { name: 'A'.repeat(100), justification: 'B'.repeat(500) },
        { name: 'C'.repeat(100), justification: 'D'.repeat(500) },
        { name: 'E'.repeat(100), justification: 'F'.repeat(500) },
      ],
      physicalDescription: 'A'.repeat(400), // Valid length
      personality: [
        { trait: 'Trait1', explanation: 'E'.repeat(1000) },
        { trait: 'Trait2', explanation: 'F'.repeat(1000) },
        { trait: 'Trait3', explanation: 'G'.repeat(1000) },
      ],
      strengths: ['Strength1', 'Strength2'],
      weaknesses: ['Weakness1', 'Weakness2'],
      likes: ['Like1', 'Like2', 'Like3'],
      dislikes: ['Dislike1', 'Dislike2', 'Dislike3'],
      fears: ['Fear1'],
      goals: {
        shortTerm: ['Goal1'],
        longTerm: 'Long term goal',
      },
      notes: ['Note1', 'Note2'],
      profile: 'A'.repeat(600), // Valid length
      secrets: ['Secret1'],
    };

    expect(() => validateTraitsGenerationResponse(validResponse)).not.toThrow();
  });
});
