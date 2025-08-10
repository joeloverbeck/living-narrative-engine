# CLIGEN-004: Prompt Template & LLM Integration

## Summary

Design and implement the comprehensive prompt template for cliché generation, including response format validation, prompt versioning, and integration with the existing LLM proxy server. This ticket ensures high-quality, consistent cliché generation through optimized prompts.

## Status

- **Type**: Implementation
- **Priority**: High
- **Complexity**: Medium
- **Estimated Time**: 4 hours
- **Dependencies**: CLIGEN-003 (ClicheGenerator Service)

## Objectives

### Primary Goals

1. **Design Prompt Template** - Create effective prompt for cliché generation
2. **Response Schema** - Define and validate response format
3. **Prompt Versioning** - Track and manage prompt iterations
4. **LLM Configuration** - Optimize settings for quality responses
5. **Example Management** - Include few-shot examples for consistency
6. **Fallback Strategies** - Handle edge cases and poor responses

### Success Criteria

- [ ] Prompt generates relevant clichés 95%+ of the time
- [ ] Response format consistently valid JSON
- [ ] All 11 categories populated with 3+ items
- [ ] Tropes list contains 5+ relevant items
- [ ] Prompt version tracking implemented
- [ ] Few-shot examples improve quality
- [ ] Edge cases handled gracefully

## Technical Specification

### 1. Prompt Template System

#### File: `src/characterBuilder/prompts/clichePromptTemplate.js`

```javascript
/**
 * @file Prompt template for cliché generation
 * @see ClicheGenerator.js
 */

/**
 * Versioned prompt template system
 */
export class ClichePromptTemplate {
  static VERSION = '1.1.0';
  static MIN_ITEMS_PER_CATEGORY = 3;
  static MAX_ITEMS_PER_CATEGORY = 7;

  /**
   * Get the current prompt template
   * @param {object} context - Generation context
   * @returns {string} Formatted prompt
   */
  static getPrompt(context) {
    const { conceptText, direction, options = {} } = context;

    return this.#buildPrompt(conceptText, direction, options);
  }

  /**
   * Build the complete prompt
   * @private
   */
  static #buildPrompt(conceptText, direction, options) {
    const systemContext = this.#getSystemContext();
    const task = this.#getTaskDescription();
    const examples = options.includeFewShot ? this.#getFewShotExamples() : '';
    const instructions = this.#getInstructions(options);
    const responseFormat = this.#getResponseFormat();

    return `${systemContext}

${task}

<character_concept>
${conceptText}
</character_concept>

<thematic_direction>
Title: ${direction.title}
Description: ${direction.description || 'Not provided'}
Core Tension: ${direction.coreTension || 'Not specified'}
${direction.themes ? `Themes: ${direction.themes.join(', ')}` : ''}
${direction.genre ? `Genre: ${direction.genre}` : ''}
</thematic_direction>

${examples}

${instructions}

${responseFormat}`;
  }

  /**
   * Get system context
   * @private
   */
  static #getSystemContext() {
    return `<role>
You are a narrative design expert specializing in identifying overused tropes, clichés, and stereotypes in character development. You have extensive knowledge of literature, film, television, and gaming narratives across all genres. Your goal is to help writers avoid predictable and uninspired character elements by identifying what has been done to death.
</role>

<expertise>
- Deep understanding of narrative tropes across media
- Knowledge of genre-specific clichés
- Awareness of cultural stereotypes to avoid
- Understanding of what makes characters feel generic
- Ability to identify subtle and obvious clichés
</expertise>`;
  }

  /**
   * Get task description
   * @private
   */
  static #getTaskDescription() {
    return `<task>
Analyze the provided character concept and thematic direction to generate a comprehensive list of clichés, stereotypes, and overused tropes that writers should avoid. Focus on elements that would make this character feel generic, predictable, or uninspired within the given thematic context.

Consider:
1. The specific genre and setting implied by the concept
2. The thematic direction's influence on character development
3. Common pitfalls for this type of character
4. Both obvious and subtle clichés
5. Cultural stereotypes that should be avoided
</task>`;
  }

  /**
   * Get few-shot examples
   * @private
   */
  static #getFewShotExamples() {
    return `<examples>
<example>
<input>
Concept: "A young farm boy discovers he has magical powers"
Direction: "The Chosen One - Destined to save the world"
</input>
<output>
{
  "categories": {
    "names": ["Luke", "Arthur", "Eragon", "Will", "Rand"],
    "physicalDescriptions": ["Unremarkable until powers manifest", "Secretly handsome under the dirt", "Eyes that change color with power", "Mysterious birthmark/scar", "Unusually tall or strong for their age"],
    "personalityTraits": ["Reluctant at first", "Pure of heart", "Naive but naturally talented", "Quick to anger when friends threatened", "Humble despite great power"],
    "skillsAbilities": ["Instantly masters complex magic", "Natural sword fighter", "Can talk to animals", "Prophetic dreams", "Immune to dark magic"],
    "typicalLikes": ["Simple farm life (at first)", "Justice and fairness", "Protecting the innocent", "Their childhood sweetheart", "Their wise mentor"],
    "typicalDislikes": ["Destiny/responsibility", "Politics and court intrigue", "Being treated as special", "Dark magic", "The empire/evil kingdom"],
    "commonFears": ["Becoming like the villain", "Losing control of powers", "Friends dying for them", "Not living up to expectations", "The burden of destiny"],
    "genericGoals": ["Save the world", "Avenge mentor's death", "Master their powers", "Defeat the dark lord", "Restore balance"],
    "backgroundElements": ["Parents killed when young", "Raised by aunt/uncle", "Secret royal bloodline", "Mentor dies in Act 2", "Prophecy foretold birth"],
    "overusedSecrets": ["Actually the villain's son", "Royal heir in hiding", "Last of an ancient bloodline", "Mentor was parent's friend", "Power comes with terrible cost"],
    "speechPatterns": ["Questions everything", "Makes naive observations", "'I never asked for this'", "Inspirational speeches before battle", "References farm wisdom"]
  },
  "tropesAndStereotypes": [
    "The Reluctant Hero",
    "Farm Boy to Hero",
    "The Chosen One Prophecy",
    "Hidden Royal Heritage",
    "Mentor's Sacrificial Death"
  ]
}
</output>
</example>
</examples>`;
  }

  /**
   * Get detailed instructions
   * @private
   */
  static #getInstructions(options) {
    const minItems = options.minItems || this.MIN_ITEMS_PER_CATEGORY;
    const maxItems = options.maxItems || this.MAX_ITEMS_PER_CATEGORY;

    return `<instructions>
Generate a comprehensive list of clichés and overused elements for each category below. Your response must:

1. Be specific and concrete - avoid vague generalizations
2. Consider the unique context of the character concept and thematic direction
3. Include ${minItems}-${maxItems} items per category
4. Focus on truly overused elements that appear frequently in similar narratives
5. Provide actionable "what not to do" guidance
6. Consider both obvious and subtle clichés
7. Be genre-aware and culturally sensitive

Categories to complete:
- names: Common/overused character names for this archetype
- physicalDescriptions: Clichéd appearance traits and physical characteristics
- personalityTraits: Overused personality characteristics and behavioral patterns
- skillsAbilities: Predictable capabilities and talents
- typicalLikes: Common interests, hobbies, and preferences
- typicalDislikes: Predictable aversions and pet peeves
- commonFears: Overused fears, phobias, and anxieties
- genericGoals: Predictable motivations and objectives
- backgroundElements: Clichéd backstory components and history
- overusedSecrets: Common "twist" reveals and hidden truths
- speechPatterns: Overused catchphrases, verbal tics, and dialogue patterns

Additionally, provide 5-10 overall narrative tropes and stereotypes that encompass the character as a whole.

Quality Guidelines:
- Each item should be a specific example, not a category
- Items should be relevant to the concept and direction
- Avoid repetition across categories
- Consider intersectional stereotypes to avoid
- Think about what would make readers/viewers roll their eyes
</instructions>`;
  }

  /**
   * Get response format specification
   * @private
   */
  static #getResponseFormat() {
    return `<response_format>
You must respond with valid JSON matching this exact structure:

{
  "categories": {
    "names": ["string", "string", "string", ...],
    "physicalDescriptions": ["string", "string", "string", ...],
    "personalityTraits": ["string", "string", "string", ...],
    "skillsAbilities": ["string", "string", "string", ...],
    "typicalLikes": ["string", "string", "string", ...],
    "typicalDislikes": ["string", "string", "string", ...],
    "commonFears": ["string", "string", "string", ...],
    "genericGoals": ["string", "string", "string", ...],
    "backgroundElements": ["string", "string", "string", ...],
    "overusedSecrets": ["string", "string", "string", ...],
    "speechPatterns": ["string", "string", "string", ...]
  },
  "tropesAndStereotypes": ["string", "string", "string", "string", "string", ...]
}

Requirements:
- Each category array must contain 3-7 items
- tropesAndStereotypes must contain 5-10 items
- All strings must be non-empty and specific
- Use proper JSON syntax (double quotes, no trailing commas)
- No markdown formatting or code blocks
- Response must be valid, parseable JSON
</response_format>`;
  }

  /**
   * Get prompt for specific genre
   * @param {string} genre - Genre context
   * @returns {string} Genre-specific additions
   */
  static getGenreContext(genre) {
    const genreContexts = {
      fantasy: `Consider fantasy-specific clichés like chosen ones, prophecies, wise wizards, dark lords, and medieval stereotypes.`,

      scifi: `Consider sci-fi clichés like lone space cowboys, AI gaining consciousness, time paradoxes, and alien invasion tropes.`,

      romance: `Consider romance clichés like love triangles, enemies to lovers, billionaire love interests, and miscommunication plots.`,

      mystery: `Consider mystery clichés like alcoholic detectives, red herrings, locked room mysteries, and surprise twin reveals.`,

      horror: `Consider horror clichés like investigating strange noises, splitting up, ancient curses, and possessed children.`,

      contemporary: `Consider contemporary fiction clichés like manic pixie dream girls, coming of age tropes, and suburban ennui.`,
    };

    return genreContexts[genre?.toLowerCase()] || '';
  }

  /**
   * Validate a response against the expected format
   * @param {object} response - Response to validate
   * @returns {object} Validation result
   */
  static validateResponse(response) {
    const errors = [];
    const warnings = [];

    // Check top-level structure
    if (!response.categories || typeof response.categories !== 'object') {
      errors.push('Missing or invalid categories object');
      return { valid: false, errors, warnings };
    }

    if (!Array.isArray(response.tropesAndStereotypes)) {
      errors.push('Missing or invalid tropesAndStereotypes array');
    }

    // Check each category
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

    for (const category of requiredCategories) {
      const items = response.categories[category];

      if (!Array.isArray(items)) {
        errors.push(`Category "${category}" is not an array`);
      } else {
        if (items.length < this.MIN_ITEMS_PER_CATEGORY) {
          warnings.push(
            `Category "${category}" has only ${items.length} items (minimum ${this.MIN_ITEMS_PER_CATEGORY})`
          );
        }

        if (items.length > this.MAX_ITEMS_PER_CATEGORY) {
          warnings.push(
            `Category "${category}" has ${items.length} items (maximum ${this.MAX_ITEMS_PER_CATEGORY})`
          );
        }

        // Check item quality
        const emptyItems = items.filter(
          (item) => !item || typeof item !== 'string' || item.trim() === ''
        );
        if (emptyItems.length > 0) {
          errors.push(
            `Category "${category}" contains ${emptyItems.length} empty items`
          );
        }

        // Check for duplicate items
        const uniqueItems = new Set(items);
        if (uniqueItems.size < items.length) {
          warnings.push(`Category "${category}" contains duplicate items`);
        }
      }
    }

    // Check tropes
    if (Array.isArray(response.tropesAndStereotypes)) {
      if (response.tropesAndStereotypes.length < 5) {
        warnings.push(
          `Only ${response.tropesAndStereotypes.length} tropes provided (minimum 5)`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: this.#getResponseStats(response),
    };
  }

  /**
   * Get response statistics
   * @private
   */
  static #getResponseStats(response) {
    let totalItems = 0;
    const categoryCounts = {};

    if (response.categories) {
      for (const [category, items] of Object.entries(response.categories)) {
        if (Array.isArray(items)) {
          categoryCounts[category] = items.length;
          totalItems += items.length;
        }
      }
    }

    if (Array.isArray(response.tropesAndStereotypes)) {
      categoryCounts.tropesAndStereotypes =
        response.tropesAndStereotypes.length;
      totalItems += response.tropesAndStereotypes.length;
    }

    return {
      totalItems,
      categoryCounts,
      averageItemsPerCategory: totalItems / Object.keys(categoryCounts).length,
    };
  }
}

export default ClichePromptTemplate;
```

### 2. LLM Service Integration

#### File: `src/characterBuilder/services/llm/LLMServiceAdapter.js`

```javascript
/**
 * Adapter for LLM proxy server integration
 */

export class LLMServiceAdapter {
  #baseUrl;
  #apiKey;
  #timeout;
  #defaultModel;

  constructor(config) {
    this.#baseUrl = config.baseUrl || 'http://localhost:3001/api';
    this.#apiKey = config.apiKey;
    this.#timeout = config.timeout || 30000;
    this.#defaultModel = config.defaultModel || 'gpt-4';
  }

  /**
   * Generate completion from LLM
   * @param {object} params - Generation parameters
   * @returns {Promise<object>} LLM response
   */
  async generateCompletion(params) {
    const {
      prompt,
      temperature = 0.7,
      maxTokens = 2000,
      model = this.#defaultModel,
      signal,
      systemPrompt,
      responseFormat,
    } = params;

    const requestBody = {
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt || 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: responseFormat,
    };

    const response = await fetch(`${this.#baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM request failed: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
      finishReason: data.choices[0].finish_reason,
    };
  }

  /**
   * Stream completion from LLM
   * @param {object} params - Generation parameters
   * @returns {AsyncGenerator} Response stream
   */
  async *streamCompletion(params) {
    const {
      prompt,
      temperature = 0.7,
      maxTokens = 2000,
      model = this.#defaultModel,
      signal,
    } = params;

    const requestBody = {
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    const response = await fetch(`${this.#baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            yield parsed;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}
```

### 3. Prompt Version Management

#### File: `src/characterBuilder/prompts/promptVersionManager.js`

```javascript
/**
 * Manage prompt template versions
 */

export class PromptVersionManager {
  static VERSIONS = {
    '1.0.0': {
      releaseDate: '2024-01-01',
      changes: ['Initial version'],
      template: 'ClichePromptTemplate_v1_0_0',
    },
    '1.1.0': {
      releaseDate: '2024-02-01',
      changes: [
        'Added few-shot examples',
        'Improved instruction clarity',
        'Added genre-specific context',
      ],
      template: 'ClichePromptTemplate',
    },
  };

  static CURRENT_VERSION = '1.1.0';

  /**
   * Get prompt template for version
   * @param {string} version - Version to retrieve
   * @returns {object} Template class
   */
  static getTemplate(version = this.CURRENT_VERSION) {
    const versionInfo = this.VERSIONS[version];

    if (!versionInfo) {
      throw new Error(`Unknown prompt version: ${version}`);
    }

    // Dynamic import based on version
    switch (versionInfo.template) {
      case 'ClichePromptTemplate':
        return import('./clichePromptTemplate.js').then((m) => m.default);
      case 'ClichePromptTemplate_v1_0_0':
        return import('./legacy/clichePromptTemplate_v1_0_0.js').then(
          (m) => m.default
        );
      default:
        throw new Error(`Template not found: ${versionInfo.template}`);
    }
  }

  /**
   * Get version history
   * @returns {object} Version information
   */
  static getVersionHistory() {
    return this.VERSIONS;
  }

  /**
   * Compare versions
   * @param {string} v1 - First version
   * @param {string} v2 - Second version
   * @returns {number} -1, 0, or 1
   */
  static compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }

    return 0;
  }
}
```

## Implementation Tasks

### Phase 1: Prompt Template (1.5 hours)

1. **Create base template**
   - [ ] System context
   - [ ] Task description
   - [ ] Response format

2. **Add examples**
   - [ ] Few-shot examples
   - [ ] Edge cases
   - [ ] Genre variations

3. **Implement validation**
   - [ ] Response validator
   - [ ] Statistics calculator

### Phase 2: LLM Integration (1 hour)

1. **Create adapter**
   - [ ] Request formatting
   - [ ] Response handling
   - [ ] Error management

2. **Add streaming support**
   - [ ] Stream parser
   - [ ] Chunk handling

### Phase 3: Version Management (1 hour)

1. **Version system**
   - [ ] Version registry
   - [ ] Template loading
   - [ ] Migration support

2. **A/B testing support**
   - [ ] Version selection
   - [ ] Metrics tracking

### Phase 4: Testing & Optimization (30 minutes)

1. **Test prompts**
   - [ ] Various concepts
   - [ ] Different directions
   - [ ] Edge cases

2. **Optimize quality**
   - [ ] Temperature tuning
   - [ ] Token optimization

## Testing Requirements

### Unit Tests

```javascript
describe('ClichePromptTemplate', () => {
  describe('Prompt Generation', () => {
    it('should generate complete prompt', () => {
      const prompt = ClichePromptTemplate.getPrompt({
        conceptText: 'A warrior',
        direction: { title: 'The Leader' },
      });

      expect(prompt).toContain('<character_concept>');
      expect(prompt).toContain('<thematic_direction>');
      expect(prompt).toContain('<response_format>');
    });

    it('should include few-shot examples when requested', () => {
      const prompt = ClichePromptTemplate.getPrompt({
        conceptText: 'A warrior',
        direction: { title: 'The Leader' },
        options: { includeFewShot: true },
      });

      expect(prompt).toContain('<examples>');
    });
  });

  describe('Response Validation', () => {
    it('should validate correct response', () => {
      const response = {
        categories: {
          names: ['John', 'Jane', 'Jack'],
          // ... other categories
        },
        tropesAndStereotypes: ['Trope 1', 'Trope 2'],
      };

      const result = ClichePromptTemplate.validateResponse(response);
      expect(result.valid).toBe(true);
    });

    it('should detect missing categories', () => {
      const response = {
        categories: {
          names: ['John'],
          // Missing other categories
        },
      };

      const result = ClichePromptTemplate.validateResponse(response);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Category "physicalDescriptions" is not an array'
      );
    });
  });
});
```

## Acceptance Criteria

- [ ] Prompt template generates quality clichés
- [ ] Response validation catches errors
- [ ] Version management working
- [ ] LLM integration successful
- [ ] Few-shot examples improve quality
- [ ] All tests passing
- [ ] Documentation complete

## Definition of Done

- [ ] Code implemented per specification
- [ ] Unit tests passing (90% coverage)
- [ ] Integration tested with LLM
- [ ] Prompt quality validated
- [ ] Code reviewed and approved
- [ ] Documentation updated
