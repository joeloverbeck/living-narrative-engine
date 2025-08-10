# CLIGEN-004: Enhance Prompt Template & LLM Integration

## Summary

Enhance the existing cliché generation system by adding missing features such as prompt versioning, few-shot examples configuration, genre-specific context, response statistics, and advanced validation. The core system is already implemented and functional - this ticket focuses on adding value-added features.

## Status

- **Type**: Enhancement
- **Priority**: Medium
- **Complexity**: Low-Medium
- **Estimated Time**: 2-3 hours
- **Dependencies**: None (Core system already implemented)

## Objectives

### Primary Goals

1. **Add Prompt Versioning** - Track and manage prompt template iterations
2. **Implement Few-Shot Examples** - Optional examples configuration for improved consistency
3. **Add Genre-Specific Context** - Context-aware prompts based on genre/setting
4. **Enhance Response Statistics** - Advanced metrics and quality analysis
5. **Improve Validation** - Enhanced validation with warnings and recommendations
6. **Add Configuration Options** - Flexible prompt behavior configuration

### Success Criteria

- [ ] Prompt versioning system implemented and functional
- [ ] Few-shot examples can be toggled on/off via configuration
- [ ] Genre-specific context enhances prompt relevance
- [ ] Response statistics provide detailed quality metrics
- [ ] Enhanced validation provides actionable warnings
- [ ] Configuration options allow flexible prompt behavior
- [ ] All enhancements maintain backward compatibility with existing system

## Technical Specification

### Current Implementation Status

**✅ Already Implemented:**
- Functional prompt template system (`src/characterBuilder/prompts/clicheGenerationPrompt.js`)
- Complete ClicheGenerator service (`src/characterBuilder/services/ClicheGenerator.js`)
- JSON schema validation and response processing
- Integration with ConfigurableLLMAdapter
- Comprehensive error handling and logging
- Full test coverage (24+ test files)

**🚧 Enhancement Areas (This Ticket):**
- Prompt versioning system
- Few-shot examples configuration
- Genre-specific context
- Enhanced response statistics
- Advanced validation with warnings

### 1. Prompt Versioning Enhancement

#### File: `src/characterBuilder/prompts/clicheGenerationPrompt.js` (enhancement)

```javascript
// Add to existing clicheGenerationPrompt.js

/**
 * Prompt version information and management
 */
export const PROMPT_VERSION_INFO = {
  version: '1.2.0',
  previousVersions: {
    '1.0.0': { date: '2024-01-01', description: 'Initial implementation' },
    '1.1.0': { date: '2024-02-01', description: 'Enhanced instructions and validation' }
  },
  currentChanges: [
    'Added few-shot examples support',
    'Genre-specific context integration',
    'Enhanced response statistics'
  ]
};

/**
 * Enhanced prompt building with optional features
 * @param {string} characterConcept - Character concept
 * @param {object} direction - Thematic direction
 * @param {object} options - Enhancement options
 * @param {boolean} options.includeFewShotExamples - Include example responses
 * @param {string} options.genre - Genre for context-specific prompts
 * @param {number} options.minItemsPerCategory - Minimum items per category
 * @param {number} options.maxItemsPerCategory - Maximum items per category
 * @returns {string} Enhanced prompt
 */
export function buildEnhancedClicheGenerationPrompt(characterConcept, direction, options = {}) {
  const basePrompt = buildClicheGenerationPrompt(characterConcept, direction);
  
  let enhancedPrompt = basePrompt;

  // Add few-shot examples if requested
  if (options.includeFewShotExamples) {
    const examples = getFewShotExamples();
    enhancedPrompt = enhancedPrompt.replace(
      '<instructions>',
      `${examples}\n\n<instructions>`
    );
  }
  
  // Add genre-specific context if provided
  if (options.genre) {
    const genreContext = getGenreSpecificContext(options.genre);
    enhancedPrompt = enhancedPrompt.replace(
      '</thematic_direction>',
      `\n${genreContext}\n</thematic_direction>`
    );
  }
  
  // Adjust item count constraints if specified
  if (options.minItemsPerCategory || options.maxItemsPerCategory) {
    const minItems = options.minItemsPerCategory || 3;
    const maxItems = options.maxItemsPerCategory || 8;
    enhancedPrompt = enhancedPrompt.replace(
      'Provide 3-8 items per category',
      `Provide ${minItems}-${maxItems} items per category`
    );
  }
  
  return enhancedPrompt;
  }

/**
 * Get few-shot examples for improved consistency
 * @returns {string} Example section
 */
function getFewShotExamples() {
  return `<examples>
<example>
<input>
Character Concept: "A young farm boy discovers he has magical powers"
Thematic Direction: "The Chosen One - Destined to save the world"
</input>
<output>
{
  "categories": {
    "names": ["Luke", "Arthur", "Eragon", "Will", "Rand"],
    "physicalDescriptions": ["Unremarkable until powers manifest", "Secretly handsome under the dirt", "Eyes that change color with power"],
    "personalityTraits": ["Reluctant at first", "Pure of heart", "Naive but naturally talented"],
    "skillsAbilities": ["Instantly masters complex magic", "Natural sword fighter", "Prophetic dreams"],
    "typicalLikes": ["Simple farm life", "Justice and fairness", "Their childhood sweetheart"],
    "typicalDislikes": ["Destiny/responsibility", "Politics and court intrigue", "Being treated as special"],
    "commonFears": ["Becoming like the villain", "Losing control of powers", "Friends dying for them"],
    "genericGoals": ["Save the world", "Avenge mentor's death", "Master their powers"],
    "backgroundElements": ["Parents killed when young", "Raised by aunt/uncle", "Secret royal bloodline"],
    "overusedSecrets": ["Actually the villain's son", "Royal heir in hiding", "Last of an ancient bloodline"],
    "speechPatterns": ["Questions everything", "'I never asked for this'", "References farm wisdom"]
  },
  "tropesAndStereotypes": ["The Reluctant Hero", "Farm Boy to Hero", "The Chosen One Prophecy", "Hidden Royal Heritage"]
}
</output>
</example>
</examples>`;
  }

/**
 * Get genre-specific context additions
 * @param {string} genre - Genre identifier
 * @returns {string} Genre context
 */
function getGenreSpecificContext(genre) {
  const genreContexts = {
    fantasy: '<genre_context>\nFocus on fantasy-specific clichés: chosen ones, ancient prophecies, wise wizards, dark lords, medieval stereotypes, magical bloodlines, and quest-based character arcs.\n</genre_context>',
    
    scifi: '<genre_context>\nFocus on sci-fi clichés: lone space cowboys, AI gaining consciousness, time paradoxes, alien invasion tropes, dystopian societies, and technology-dependent solutions.\n</genre_context>',
    
    romance: '<genre_context>\nFocus on romance clichés: love triangles, enemies to lovers, billionaire love interests, miscommunication plots, and idealized relationship dynamics.\n</genre_context>',
    
    mystery: '<genre_context>\nFocus on mystery clichés: alcoholic detectives, red herrings, locked room mysteries, surprise twin reveals, and investigative procedural patterns.\n</genre_context>',
    
    horror: '<genre_context>\nFocus on horror clichés: investigating strange noises, splitting up, ancient curses, possessed children, and survival horror tropes.\n</genre_context>',
    
    contemporary: '<genre_context>\nFocus on contemporary fiction clichés: manic pixie dream girls, coming of age tropes, suburban ennui, and modern relationship dynamics.\n</genre_context>'
  };
  
  return genreContexts[genre?.toLowerCase()] || '';
  }

/**
 * Enhanced response validation with statistics and warnings
 * @param {object} response - LLM response to validate
 * @returns {object} Validation result with enhanced metrics
 */
export function validateClicheGenerationResponseEnhanced(response) {
  // Use existing validation as base
  const isValid = validateClicheGenerationResponse(response);
  
  if (!isValid) {
    throw new Error('Basic validation failed');
  }
  
  const stats = calculateResponseStatistics(response);
  const warnings = generateResponseWarnings(response, stats);
  const qualityMetrics = assessResponseQuality(response, stats);
  
  return {
    valid: true,
    statistics: stats,
    warnings,
    qualityMetrics,
    recommendations: generateImprovementRecommendations(stats, warnings)
  };
}

/**
 * Calculate detailed response statistics
 * @param {object} response - Validated response
 * @returns {object} Statistical analysis
 */
function calculateResponseStatistics(response) {
  let totalItems = 0;
  const categoryCounts = {};
  const categoryLengths = {};
  
  if (response.categories) {
    for (const [category, items] of Object.entries(response.categories)) {
      if (Array.isArray(items)) {
        categoryCounts[category] = items.length;
        categoryLengths[category] = {
          min: Math.min(...items.map(item => item.length)),
          max: Math.max(...items.map(item => item.length)),
          avg: items.reduce((sum, item) => sum + item.length, 0) / items.length
        };
        totalItems += items.length;
      }
    }
  }
  
  const tropesCount = Array.isArray(response.tropesAndStereotypes) 
    ? response.tropesAndStereotypes.length : 0;
  
  return {
    totalItems: totalItems + tropesCount,
    categoryCounts,
    categoryLengths,
    tropesCount,
    averageItemsPerCategory: totalItems / Object.keys(categoryCounts).length,
    completenessScore: Object.keys(categoryCounts).length / 11 // 11 required categories
  };
}

/**
 * Generate warnings for response quality issues
 * @param {object} response - Response to analyze
 * @param {object} stats - Calculated statistics
 * @returns {string[]} Array of warning messages
 */
function generateResponseWarnings(response, stats) {
  const warnings = [];
  
  // Check for sparse categories
  for (const [category, count] of Object.entries(stats.categoryCounts)) {
    if (count < 3) {
      warnings.push(`Category "${category}" has only ${count} items (recommended: 3+)`);
    }
    if (count > 8) {
      warnings.push(`Category "${category}" has ${count} items (recommended: 3-8)`);
    }
  }
  
  // Check tropes count
  if (stats.tropesCount < 5) {
    warnings.push(`Only ${stats.tropesCount} tropes provided (recommended: 5+)`);
  }
  
  // Check for very short items that might be low quality
  for (const [category, lengths] of Object.entries(stats.categoryLengths)) {
    if (lengths.avg < 10) {
      warnings.push(`Category "${category}" items are quite short (avg: ${lengths.avg.toFixed(1)} chars)`);
    }
  }
  
  return warnings;
}

/**
 * Assess overall response quality
 * @param {object} response - Response to assess
 * @param {object} stats - Calculated statistics
 * @returns {object} Quality metrics
 */
function assessResponseQuality(response, stats) {
  return {
    completeness: stats.completenessScore,
    itemDensity: stats.averageItemsPerCategory,
    contentRichness: Object.values(stats.categoryLengths)
      .reduce((sum, lengths) => sum + lengths.avg, 0) / Object.keys(stats.categoryLengths).length,
    overallScore: (
      stats.completenessScore * 0.4 + 
      Math.min(stats.averageItemsPerCategory / 5, 1) * 0.3 +
      Math.min(stats.tropesCount / 7, 1) * 0.3
    )
  };
}

/**
 * Generate improvement recommendations
 * @param {object} stats - Response statistics
 * @param {string[]} warnings - Generated warnings
 * @returns {string[]} Improvement recommendations
 */
function generateImprovementRecommendations(stats, warnings) {
  const recommendations = [];
  
  if (stats.completenessScore < 1) {
    recommendations.push('Ensure all required categories are populated');
  }
  
  if (stats.averageItemsPerCategory < 4) {
    recommendations.push('Consider generating more items per category for better coverage');
  }
  
  if (warnings.length > 3) {
    recommendations.push('Review response quality - multiple issues detected');
  }
  
  return recommendations;
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

### 2. Configuration Enhancement

#### File: `src/characterBuilder/prompts/clicheGenerationPrompt.js` (enhancement)

```javascript
// Add to existing file

/**
 * Configuration options for enhanced prompt generation
 */
export const DEFAULT_ENHANCEMENT_OPTIONS = {
  includeFewShotExamples: false,
  genre: null,
  minItemsPerCategory: 3,
  maxItemsPerCategory: 8,
  enableAdvancedValidation: true,
  includeQualityMetrics: true
};

/**
 * Create enhanced LLM config with additional options
 * @param {object} baseLlmConfig - Base LLM configuration
 * @param {object} enhancementOptions - Enhancement options
 * @returns {object} Enhanced config
 */
export function createEnhancedClicheGenerationLlmConfig(baseLlmConfig, enhancementOptions = {}) {
  const options = { ...DEFAULT_ENHANCEMENT_OPTIONS, ...enhancementOptions };
  const baseConfig = createClicheGenerationLlmConfig(baseLlmConfig);
  
  return {
    ...baseConfig,
    enhancementOptions: options,
    promptVersion: PROMPT_VERSION_INFO.version
  };
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

- [ ] **Versioning System**: PROMPT_VERSION_INFO tracking implemented and functional
- [ ] **Few-Shot Examples**: Optional examples can be enabled/disabled via configuration
- [ ] **Genre Context**: Genre-specific context enhances prompt relevance for 6+ genres
- [ ] **Enhanced Validation**: Advanced validation provides statistics, warnings, and quality metrics
- [ ] **Configuration Options**: Flexible enhancement options with sensible defaults
- [ ] **Backward Compatibility**: All enhancements maintain compatibility with existing implementation
- [ ] **Test Coverage**: Enhanced features covered by comprehensive unit tests
- [ ] **Performance**: Enhancements do not significantly impact generation performance

## Definition of Done

- [ ] **Enhancement functions added** to existing `clicheGenerationPrompt.js`
- [ ] **Service methods enhanced** in existing `ClicheGenerator.js` class
- [ ] **Unit tests extended** for all new functionality (maintain 90%+ coverage)
- [ ] **Integration tested** with existing character builder service
- [ ] **Quality validated** - enhanced prompts generate better responses
- [ ] **Documentation updated** for new configuration options
- [ ] **No breaking changes** - all existing functionality preserved

---

**Note**: This workflow has been corrected to reflect the current state of the codebase. The core cliché generation system is already fully implemented and functional. This ticket focuses on valuable enhancements to the existing working system.
