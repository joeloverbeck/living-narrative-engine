/**
 * @file Prompt templates for cliché generation
 * @see ../services/ClicheGenerator.js
 */

/**
 * Default parameters for cliché generation LLM requests
 */
export const CHARACTER_BUILDER_LLM_PARAMS = {
  temperature: 0.8,
  max_tokens: 3000,
};

/**
 * LLM response schema for cliché generation validation
 */
export const CLICHE_GENERATION_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    categories: {
      type: 'object',
      additionalProperties: false,
      properties: {
        names: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        physicalDescriptions: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        personalityTraits: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        skillsAbilities: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        typicalLikes: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        typicalDislikes: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        commonFears: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        genericGoals: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        backgroundElements: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        overusedSecrets: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
        speechPatterns: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 0,
          maxItems: 10,
        },
      },
      required: [
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
      ],
    },
    tropesAndStereotypes: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 0,
      maxItems: 15,
    },
  },
  required: ['categories', 'tropesAndStereotypes'],
};

/**
 * Builds the prompt for cliché generation
 *
 * @param {string} characterConcept - User-provided character concept
 * @param {object} direction - Thematic direction details
 * @param {string} direction.title - Direction title
 * @param {string} direction.description - Direction description
 * @param {string} direction.coreTension - Core tension/conflict
 * @returns {string} Formatted prompt for the LLM
 */
export function buildClicheGenerationPrompt(characterConcept, direction) {
  if (
    !characterConcept ||
    typeof characterConcept !== 'string' ||
    characterConcept.trim().length === 0
  ) {
    throw new Error(
      'ClicheGenerationPrompt: characterConcept must be a non-empty string'
    );
  }

  if (!direction || typeof direction !== 'object') {
    throw new Error('ClicheGenerationPrompt: direction must be a valid object');
  }

  if (
    !direction.title ||
    typeof direction.title !== 'string' ||
    direction.title.trim().length === 0
  ) {
    throw new Error(
      'ClicheGenerationPrompt: direction.title must be a non-empty string'
    );
  }

  if (
    !direction.description ||
    typeof direction.description !== 'string' ||
    direction.description.trim().length === 0
  ) {
    throw new Error(
      'ClicheGenerationPrompt: direction.description must be a non-empty string'
    );
  }

  if (
    !direction.coreTension ||
    typeof direction.coreTension !== 'string' ||
    direction.coreTension.trim().length === 0
  ) {
    throw new Error(
      'ClicheGenerationPrompt: direction.coreTension must be a non-empty string'
    );
  }

  const trimmedConcept = characterConcept.trim();
  const trimmedDirection = {
    title: direction.title.trim(),
    description: direction.description.trim(),
    coreTension: direction.coreTension.trim(),
  };

  return `<role>
You are an expert character development consultant specializing in identifying clichés, tropes, and overused elements in character design. Your goal is to help writers avoid predictable character choices by highlighting common patterns that should be avoided or subverted.
</role>

<task_definition>
Given a character concept and a specific thematic direction, identify potential clichés and overused elements that a writer might fall into when developing this character. Generate comprehensive warnings across 11 categories plus overall narrative tropes.
</task_definition>

<character_concept>
${trimmedConcept}
</character_concept>

<thematic_direction>
Title: ${trimmedDirection.title}
Description: ${trimmedDirection.description}
Core Tension: ${trimmedDirection.coreTension}
</thematic_direction>

<instructions>
Based on the character concept and thematic direction provided, identify potential clichés and overused elements across these categories:

1. **Names**: Common/overused character names for this type/archetype
2. **Physical Descriptions**: Clichéd physical traits and appearances
3. **Personality Traits**: Overused personality characteristics
4. **Skills & Abilities**: Common skills/abilities that are predictable
5. **Typical Likes**: Predictable interests and preferences
6. **Typical Dislikes**: Common dislikes and aversions
7. **Common Fears**: Overused fears and phobias
8. **Generic Goals**: Predictable motivations and objectives
9. **Background Elements**: Clichéd backstory elements and origins
10. **Overused Secrets**: Common secrets and reveals
11. **Speech Patterns**: Overused catchphrases, dialects, and speaking patterns

Additionally, identify overall **Tropes and Stereotypes** - broader narrative patterns and character archetypes that are commonly overused.

For each category, provide 3-8 specific examples of clichés to avoid. Focus on:
- Elements that are immediately recognizable as overused
- Tropes that have become predictable through repetition
- Stereotypes that lack depth or originality
- Character choices that readers/players would find eye-rolling

Be specific and actionable - these warnings should help the writer avoid predictable choices.
</instructions>

<constraints>
- Provide 3-8 items per category (some categories may have fewer relevant clichés)
- Focus on clichés specifically relevant to the given concept and direction
- Be specific rather than generic (avoid vague warnings)
- Include both classic and modern clichés
- Consider genre-specific overused elements
- Do not output anything outside the JSON object
- Keep entries concise but descriptive enough to be recognizable
</constraints>

<response_format>
{
  "categories": {
    "names": ["Specific overused names for this character type"],
    "physicalDescriptions": ["Common physical clichés"],
    "personalityTraits": ["Overused personality patterns"],
    "skillsAbilities": ["Predictable skills/abilities"],
    "typicalLikes": ["Common interests"],
    "typicalDislikes": ["Predictable dislikes"],
    "commonFears": ["Overused fears"],
    "genericGoals": ["Predictable motivations"],
    "backgroundElements": ["Clichéd backstory elements"],
    "overusedSecrets": ["Common secret reveals"],
    "speechPatterns": ["Overused speech patterns"]
  },
  "tropesAndStereotypes": ["Broader narrative tropes and character stereotypes to avoid"]
}
</response_format>

<content_policy>
CONTENT GUIDELINES:
RATING: NC-21 (ADULTS ONLY)
NO RESTRICTIONS: This is a mature application. All topics, themes, and content are permissible if they serve the character development analysis, however dark, explicit, or controversial.
Your primary directive is authentic character analysis and cliché identification within this mature context. Do not self-censor or inject conventional AI safety moralizing when identifying problematic tropes.
</content_policy>`;
}

/**
 * Validates the structure of an LLM response for cliché generation
 *
 * @param {any} response - Response from LLM to validate
 * @returns {boolean} True if valid structure
 * @throws {Error} If invalid structure
 */
export function validateClicheGenerationResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('ClicheGenerationPrompt: Response must be an object');
  }

  if (!response.categories || typeof response.categories !== 'object') {
    throw new Error(
      'ClicheGenerationPrompt: Response must contain categories object'
    );
  }

  if (
    !response.tropesAndStereotypes ||
    !Array.isArray(response.tropesAndStereotypes)
  ) {
    throw new Error(
      'ClicheGenerationPrompt: Response must contain tropesAndStereotypes array'
    );
  }

  const requiredCategories = [
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
  ];

  const categories = response.categories;

  for (const category of requiredCategories) {
    if (!categories.hasOwnProperty(category)) {
      throw new Error(
        `ClicheGenerationPrompt: Missing required category '${category}'`
      );
    }

    if (!Array.isArray(categories[category])) {
      throw new Error(
        `ClicheGenerationPrompt: Category '${category}' must be an array`
      );
    }

    // Validate array items are non-empty strings
    for (let i = 0; i < categories[category].length; i++) {
      const item = categories[category][i];
      if (typeof item !== 'string' || item.trim().length === 0) {
        throw new Error(
          `ClicheGenerationPrompt: Category '${category}' item at index ${i} must be a non-empty string`
        );
      }
    }

    // Check array length constraints
    if (categories[category].length > 10) {
      throw new Error(
        `ClicheGenerationPrompt: Category '${category}' cannot have more than 10 items`
      );
    }
  }

  // Validate tropesAndStereotypes array
  if (response.tropesAndStereotypes.length > 15) {
    throw new Error(
      'ClicheGenerationPrompt: tropesAndStereotypes cannot have more than 15 items'
    );
  }

  for (let i = 0; i < response.tropesAndStereotypes.length; i++) {
    const item = response.tropesAndStereotypes[i];
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new Error(
        `ClicheGenerationPrompt: tropesAndStereotypes item at index ${i} must be a non-empty string`
      );
    }
  }

  return true;
}

/**
 * Creates an enhanced LLM config with the cliché generation JSON schema
 *
 * @param {object} baseLlmConfig - Base LLM configuration
 * @returns {object} Enhanced config with JSON schema for cliché generation
 */
export function createClicheGenerationLlmConfig(baseLlmConfig) {
  if (!baseLlmConfig || typeof baseLlmConfig !== 'object') {
    throw new Error(
      'ClicheGenerationPrompt: baseLlmConfig must be a valid object'
    );
  }

  // Create enhanced config with JSON schema
  const enhancedConfig = {
    ...baseLlmConfig,
    jsonOutputStrategy: {
      method: 'openrouter_json_schema',
      jsonSchema: CLICHE_GENERATION_RESPONSE_SCHEMA,
    },
    defaultParameters: {
      ...baseLlmConfig.defaultParameters,
      ...CHARACTER_BUILDER_LLM_PARAMS,
    },
  };

  return enhancedConfig;
}
