# CLIGEN-003: ClicheGenerator Service Implementation

## Summary

Create a dedicated service for generating clichés via LLM integration. This service handles prompt construction, LLM communication, response parsing, and error recovery. It serves as the bridge between the character builder system and the LLM proxy server.

## Status

- **Type**: Implementation
- **Priority**: High
- **Complexity**: High
- **Estimated Time**: 6 hours
- **Dependencies**: CLIGEN-001 (Model), CLIGEN-002 (Service Extension)

## Objectives

### Primary Goals

1. **Create ClicheGenerator Service** - Dedicated service for cliché generation
2. **LLM Integration** - Connect to existing LLM proxy server
3. **Response Parsing** - Convert LLM responses to structured data
4. **Error Recovery** - Retry logic and fallback strategies
5. **Performance Tracking** - Monitor generation metrics
6. **Prompt Optimization** - Ensure high-quality responses

### Success Criteria

- [ ] Service generates comprehensive clichés (11 categories + tropes)
- [ ] LLM responses parsed correctly 95%+ of the time
- [ ] Retry logic handles transient failures
- [ ] Generation completes in < 10 seconds
- [ ] Response validation catches malformed data
- [ ] Metrics tracked for analysis
- [ ] 90% test coverage achieved

## Technical Specification

### 1. ClicheGenerator Service

#### File: `src/characterBuilder/services/ClicheGenerator.js`

```javascript
/**
 * @file Service for generating clichés via LLM
 * @see CharacterBuilderService.js
 */

import { validateDependency, assertPresent, assertNonBlankString } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * @typedef {object} ClicheGenerationResult
 * @property {object} categories - Categorized clichés
 * @property {string[]} tropesAndStereotypes - Overall tropes
 * @property {object} metadata - Generation metadata
 */

/**
 * Service for generating character clichés via LLM
 */
export class ClicheGenerator {
  #llmService;
  #logger;
  #maxRetries = 3;
  #retryDelay = 1000;
  #timeout = 30000; // 30 seconds
  #temperature = 0.7;
  #maxTokens = 2000;
  #promptVersion = '1.0.0';

  /**
   * @param {object} config - Service configuration
   * @param {ILLMService} config.llmService - LLM service for generation
   * @param {ILogger} config.logger - Logger instance
   */
  constructor({ llmService, logger }) {
    validateDependency(llmService, 'ILLMService');
    this.#logger = ensureValidLogger(logger);
    this.#llmService = llmService;
  }

  /**
   * Generate clichés for a character concept and thematic direction
   * @param {string} conceptText - Character concept description
   * @param {object} direction - Thematic direction details
   * @param {string} direction.title - Direction title
   * @param {string} direction.description - Direction description
   * @param {string} direction.coreTension - Core tension/conflict
   * @returns {Promise<ClicheGenerationResult>} Generated clichés
   */
  async generateCliches(conceptText, direction) {
    assertNonBlankString(conceptText, 'Concept text is required');
    assertPresent(direction, 'Direction is required');
    assertNonBlankString(direction.title, 'Direction title is required');

    const startTime = Date.now();

    try {
      // Build the prompt
      const prompt = this.#buildPrompt(conceptText, direction);
      
      // Generate with retry logic
      const response = await this.#generateWithRetry(prompt);
      
      // Parse and validate response
      const parsed = this.#parseResponse(response);
      
      // Validate completeness
      this.#validateResponse(parsed);
      
      // Add metadata
      const result = {
        ...parsed,
        metadata: {
          model: response.model || 'unknown',
          temperature: this.#temperature,
          tokens: response.usage?.total_tokens || 0,
          responseTime: Date.now() - startTime,
          promptVersion: this.#promptVersion,
          timestamp: new Date().toISOString()
        }
      };

      this.#logger.info(`Generated clichés for direction "${direction.title}" in ${result.metadata.responseTime}ms`);
      
      return result;

    } catch (error) {
      this.#logger.error(`Failed to generate clichés: ${error.message}`, error);
      throw new Error(`Cliché generation failed: ${error.message}`);
    }
  }

  /**
   * Build the generation prompt
   * @private
   */
  #buildPrompt(conceptText, direction) {
    return `<role>
You are a narrative design assistant specializing in identifying overused tropes, clichés, and stereotypes in character development. Your goal is to help writers avoid predictable and uninspired character elements.
</role>

<task>
Generate a comprehensive "what to avoid" list for the given character concept when developed in the specified thematic direction. Focus on genuinely overused elements that would make the character feel generic or predictable.
</task>

<character_concept>
${conceptText}
</character_concept>

<thematic_direction>
Title: ${direction.title}
Description: ${direction.description || 'Not provided'}
Core Tension: ${direction.coreTension || 'Not specified'}
</thematic_direction>

<instructions>
Identify the most clichéd and overused elements that writers should avoid when developing this character in this direction. For each category, provide 3-5 specific examples that are genuinely problematic tropes or stereotypes.

Categories to address:
1. Names - Common/overused character names for this archetype
2. Physical Descriptions - Clichéd appearance traits
3. Personality Traits - Overused personality characteristics
4. Skills/Abilities - Predictable capabilities
5. Typical Likes - Common interests/preferences
6. Typical Dislikes - Predictable aversions
7. Common Fears - Overused fears/phobias
8. Generic Goals - Predictable motivations
9. Background Elements - Clichéd backstory components
10. Overused Secrets - Common "twist" reveals
11. Speech Patterns - Overused catchphrases/verbal tics
12. Tropes and Stereotypes - Overall narrative patterns to avoid

Important:
- Be specific and concrete in your examples
- Focus on truly overused elements, not just common traits
- Consider the specific context of the character concept and thematic direction
- Avoid being overly general - provide actionable "what not to do" guidance
</instructions>

<response_format>
Return your response as a valid JSON object with this exact structure:
{
  "categories": {
    "names": ["example1", "example2", "example3"],
    "physicalDescriptions": ["example1", "example2", "example3"],
    "personalityTraits": ["example1", "example2", "example3"],
    "skillsAbilities": ["example1", "example2", "example3"],
    "typicalLikes": ["example1", "example2", "example3"],
    "typicalDislikes": ["example1", "example2", "example3"],
    "commonFears": ["example1", "example2", "example3"],
    "genericGoals": ["example1", "example2", "example3"],
    "backgroundElements": ["example1", "example2", "example3"],
    "overusedSecrets": ["example1", "example2", "example3"],
    "speechPatterns": ["example1", "example2", "example3"]
  },
  "tropesAndStereotypes": ["trope1", "trope2", "trope3", "trope4", "trope5"]
}

Ensure all arrays contain at least 3 items and the JSON is properly formatted.
</response_format>`;
  }

  /**
   * Generate with retry logic
   * @private
   */
  async #generateWithRetry(prompt) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.#maxRetries; attempt++) {
      try {
        this.#logger.debug(`Generation attempt ${attempt}/${this.#maxRetries}`);
        
        const response = await this.#callLLM(prompt);
        
        if (response && response.content) {
          return response;
        }
        
        throw new Error('Empty response from LLM');
        
      } catch (error) {
        lastError = error;
        this.#logger.warn(`Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.#maxRetries) {
          // Exponential backoff
          const delay = this.#retryDelay * Math.pow(2, attempt - 1);
          await this.#delay(delay);
        }
      }
    }
    
    throw new Error(`Failed after ${this.#maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Call the LLM service
   * @private
   */
  async #callLLM(prompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.#timeout);

    try {
      const response = await this.#llmService.generateCompletion({
        prompt,
        temperature: this.#temperature,
        maxTokens: this.#maxTokens,
        model: 'gpt-4', // Or configured model
        signal: controller.signal,
        systemPrompt: 'You are a helpful assistant that always responds with valid JSON.',
        responseFormat: { type: 'json_object' }
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Generation timeout after ${this.#timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Parse LLM response
   * @private
   */
  #parseResponse(response) {
    try {
      // Extract JSON from response
      let content = response.content || response.text || '';
      
      // Clean up response (remove markdown code blocks if present)
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Parse JSON
      const parsed = JSON.parse(content);
      
      // Validate structure
      if (!parsed.categories || typeof parsed.categories !== 'object') {
        throw new Error('Invalid response structure: missing categories');
      }
      
      // Normalize the response
      return this.#normalizeResponse(parsed);
      
    } catch (error) {
      this.#logger.error('Failed to parse LLM response:', error);
      
      // Attempt recovery with fallback parsing
      return this.#attemptFallbackParsing(response);
    }
  }

  /**
   * Normalize parsed response
   * @private
   */
  #normalizeResponse(parsed) {
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
      'speechPatterns'
    ];

    const normalized = {
      categories: {},
      tropesAndStereotypes: []
    };

    // Normalize categories
    for (const category of requiredCategories) {
      const items = parsed.categories[category];
      
      if (Array.isArray(items)) {
        // Filter and clean items
        normalized.categories[category] = items
          .filter(item => typeof item === 'string' && item.trim())
          .map(item => item.trim())
          .slice(0, 10); // Limit to 10 items per category
      } else {
        // Provide empty array if missing
        normalized.categories[category] = [];
        this.#logger.warn(`Missing or invalid category: ${category}`);
      }
    }

    // Normalize tropes
    if (Array.isArray(parsed.tropesAndStereotypes)) {
      normalized.tropesAndStereotypes = parsed.tropesAndStereotypes
        .filter(item => typeof item === 'string' && item.trim())
        .map(item => item.trim())
        .slice(0, 15); // Limit to 15 tropes
    } else {
      normalized.tropesAndStereotypes = [];
    }

    return normalized;
  }

  /**
   * Attempt fallback parsing for malformed responses
   * @private
   */
  #attemptFallbackParsing(response) {
    this.#logger.warn('Attempting fallback parsing');

    const fallback = {
      categories: {},
      tropesAndStereotypes: []
    };

    // Initialize with empty arrays
    const categories = [
      'names', 'physicalDescriptions', 'personalityTraits',
      'skillsAbilities', 'typicalLikes', 'typicalDislikes',
      'commonFears', 'genericGoals', 'backgroundElements',
      'overusedSecrets', 'speechPatterns'
    ];

    for (const category of categories) {
      fallback.categories[category] = [];
    }

    // Try to extract any useful content
    const content = response.content || response.text || '';
    
    // Look for bullet points or numbered lists
    const lines = content.split('\n');
    const items = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-*•]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/)) {
        const item = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
        items.push(item);
      }
    }

    // Distribute items across categories (basic fallback)
    if (items.length > 0) {
      const itemsPerCategory = Math.max(1, Math.floor(items.length / categories.length));
      let itemIndex = 0;

      for (const category of categories) {
        fallback.categories[category] = items
          .slice(itemIndex, itemIndex + itemsPerCategory)
          .slice(0, 5);
        itemIndex += itemsPerCategory;
      }
    }

    return fallback;
  }

  /**
   * Validate response completeness
   * @private
   */
  #validateResponse(parsed) {
    const issues = [];
    
    // Check categories
    for (const [category, items] of Object.entries(parsed.categories)) {
      if (!Array.isArray(items)) {
        issues.push(`Category "${category}" is not an array`);
      } else if (items.length === 0) {
        issues.push(`Category "${category}" is empty`);
      } else if (items.length < 2) {
        this.#logger.warn(`Category "${category}" has only ${items.length} item(s)`);
      }
    }

    // Check tropes
    if (!Array.isArray(parsed.tropesAndStereotypes)) {
      issues.push('Tropes and stereotypes is not an array');
    } else if (parsed.tropesAndStereotypes.length === 0) {
      issues.push('No tropes and stereotypes provided');
    }

    // Throw if critical issues
    if (issues.length > 0) {
      const totalItems = Object.values(parsed.categories)
        .reduce((sum, items) => sum + items.length, 0);
      
      if (totalItems < 10) {
        throw new Error(`Insufficient cliché data generated: ${issues.join(', ')}`);
      }
      
      // Log warnings but don't fail if we have enough data
      this.#logger.warn(`Response validation warnings: ${issues.join(', ')}`);
    }
  }

  /**
   * Delay helper for retry logic
   * @private
   */
  #delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   * @param {object} config - Configuration updates
   */
  updateConfiguration(config) {
    if (config.temperature !== undefined) {
      this.#temperature = Math.max(0, Math.min(2, config.temperature));
    }
    if (config.maxTokens !== undefined) {
      this.#maxTokens = Math.max(100, Math.min(4000, config.maxTokens));
    }
    if (config.maxRetries !== undefined) {
      this.#maxRetries = Math.max(1, Math.min(5, config.maxRetries));
    }
    if (config.timeout !== undefined) {
      this.#timeout = Math.max(5000, Math.min(60000, config.timeout));
    }

    this.#logger.info('Configuration updated:', config);
  }

  /**
   * Get current configuration
   * @returns {object} Current configuration
   */
  getConfiguration() {
    return {
      temperature: this.#temperature,
      maxTokens: this.#maxTokens,
      maxRetries: this.#maxRetries,
      timeout: this.#timeout,
      retryDelay: this.#retryDelay,
      promptVersion: this.#promptVersion
    };
  }
}

export default ClicheGenerator;