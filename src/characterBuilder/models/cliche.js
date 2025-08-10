/**
 * @file Cliche model for storing common tropes and stereotypes
 * @see characterConcept.js
 * @see thematicDirection.js
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {object} ClicheCategories
 * @property {string[]} names - Common/overused character names
 * @property {string[]} physicalDescriptions - Clichéd physical traits
 * @property {string[]} personalityTraits - Overused personality traits
 * @property {string[]} skillsAbilities - Common skills/abilities
 * @property {string[]} typicalLikes - Predictable likes/interests
 * @property {string[]} typicalDislikes - Common dislikes
 * @property {string[]} commonFears - Overused fears
 * @property {string[]} genericGoals - Predictable goals/motivations
 * @property {string[]} backgroundElements - Clichéd backstory elements
 * @property {string[]} overusedSecrets - Common secrets/reveals
 * @property {string[]} speechPatterns - Overused catchphrases/patterns
 */

/**
 * @typedef {object} LLMMetadata
 * @property {string} model - LLM model used for generation
 * @property {number} temperature - Temperature setting used
 * @property {number} tokens - Token count for generation
 * @property {number} responseTime - Generation time in ms
 * @property {string} promptVersion - Version of prompt used
 */

/**
 * @typedef {object} Cliche
 * @property {string} id - Unique identifier (UUID)
 * @property {string} directionId - Reference to parent ThematicDirection
 * @property {string} conceptId - Reference to original CharacterConcept
 * @property {ClicheCategories} categories - Categorized clichés
 * @property {string[]} tropesAndStereotypes - Overall narrative patterns
 * @property {string} createdAt - ISO timestamp of creation
 * @property {LLMMetadata} llmMetadata - Generation metadata
 */

/**
 * Cliche model class with validation
 */
export class Cliche {
  /**
   * Create a new Cliche instance
   *
   * @param {object} data - Cliche data
   * @returns {Cliche} Validated cliche instance
   */
  constructor(data) {
    this.#validate(data);

    this.id = data.id || uuidv4();
    this.directionId = data.directionId;
    this.conceptId = data.conceptId;
    this.categories = this.#validateCategories(data.categories);
    this.tropesAndStereotypes = data.tropesAndStereotypes || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.llmMetadata = data.llmMetadata || {};

    // Freeze to prevent mutation
    Object.freeze(this);
    Object.freeze(this.categories);
    Object.freeze(this.tropesAndStereotypes);
    Object.freeze(this.llmMetadata);
  }

  /**
   * Validate required fields
   *
   * @param data
   * @private
   */
  #validate(data) {
    if (data === null || data === undefined) {
      throw new Error('Cliche data is required');
    }

    if (
      !data.directionId ||
      typeof data.directionId !== 'string' ||
      data.directionId.trim() === ''
    ) {
      throw new Error('Direction ID is required');
    }

    if (
      !data.conceptId ||
      typeof data.conceptId !== 'string' ||
      data.conceptId.trim() === ''
    ) {
      throw new Error('Concept ID is required');
    }

    if (!data.categories) {
      throw new Error('Categories are required');
    }
  }

  /**
   * Validate and normalize categories
   *
   * @param categories
   * @private
   */
  #validateCategories(categories) {
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

    const validated = {};

    for (const category of requiredCategories) {
      if (!Array.isArray(categories[category])) {
        validated[category] = [];
      } else {
        // Filter out empty strings and ensure all are strings
        validated[category] = categories[category]
          .filter((item) => typeof item === 'string' && item.trim())
          .map((item) => item.trim());
      }
    }

    return validated;
  }

  /**
   * Create from raw data with validation
   *
   * @param {object} rawData - Raw data from storage or API
   * @returns {Cliche} Cliche instance
   */
  static fromRawData(rawData) {
    return new Cliche(rawData);
  }

  /**
   * Convert to plain object for storage
   *
   * @returns {object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      directionId: this.directionId,
      conceptId: this.conceptId,
      categories: { ...this.categories },
      tropesAndStereotypes: [...this.tropesAndStereotypes],
      createdAt: this.createdAt,
      llmMetadata: { ...this.llmMetadata },
    };
  }

  /**
   * Get total cliché count across all categories
   *
   * @returns {number} Total number of clichés
   */
  getTotalCount() {
    let count = this.tropesAndStereotypes.length;

    for (const category of Object.values(this.categories)) {
      count += category.length;
    }

    return count;
  }

  /**
   * Get category statistics
   *
   * @returns {object} Count per category
   */
  getCategoryStats() {
    const stats = {};

    for (const [name, items] of Object.entries(this.categories)) {
      stats[name] = items.length;
    }

    stats.tropesAndStereotypes = this.tropesAndStereotypes.length;
    stats.total = this.getTotalCount();

    return stats;
  }

  /**
   * Check if cliché data is empty
   *
   * @returns {boolean} True if no clichés present
   */
  isEmpty() {
    return this.getTotalCount() === 0;
  }

  /**
   * Get formatted display data
   *
   * @returns {object} Formatted for UI display
   */
  getDisplayData() {
    return {
      categories: this.#formatCategoriesForDisplay(),
      tropesAndStereotypes: this.tropesAndStereotypes,
      metadata: {
        createdAt: new Date(this.createdAt).toLocaleDateString(),
        totalCount: this.getTotalCount(),
        model: this.llmMetadata.model || 'Unknown',
      },
    };
  }

  /**
   * Format categories with human-readable names
   *
   * @private
   */
  #formatCategoriesForDisplay() {
    const displayNames = {
      names: 'Common Names',
      physicalDescriptions: 'Physical Descriptions',
      personalityTraits: 'Personality Traits',
      skillsAbilities: 'Skills & Abilities',
      typicalLikes: 'Typical Likes',
      typicalDislikes: 'Typical Dislikes',
      commonFears: 'Common Fears',
      genericGoals: 'Generic Goals',
      backgroundElements: 'Background Elements',
      overusedSecrets: 'Overused Secrets',
      speechPatterns: 'Speech Patterns',
    };

    const formatted = [];

    for (const [key, items] of Object.entries(this.categories)) {
      if (items.length > 0) {
        formatted.push({
          id: key,
          title: displayNames[key] || key,
          items: items,
          count: items.length,
        });
      }
    }

    return formatted;
  }
}

/**
 * Create Cliche instances from LLM response data
 *
 * @param {string} conceptId - Character concept ID
 * @param {object} categories - Categorized clichés from LLM
 * @param {string[]} tropesAndStereotypes - Overall tropes from LLM
 * @param {object} llmMetadata - LLM generation metadata
 * @param {string} [directionId] - Optional thematic direction ID
 * @returns {Cliche[]} Array with single created cliché instance
 */
export function createClichesFromLLMResponse(
  conceptId,
  categories,
  tropesAndStereotypes,
  llmMetadata = {},
  directionId = null
) {
  if (
    !conceptId ||
    typeof conceptId !== 'string' ||
    conceptId.trim().length === 0
  ) {
    throw new Error('conceptId must be a non-empty string');
  }

  if (!categories || typeof categories !== 'object') {
    throw new Error('categories must be a valid object');
  }

  if (!Array.isArray(tropesAndStereotypes)) {
    throw new Error('tropesAndStereotypes must be an array');
  }

  // Create a single Cliche instance with all the data
  const clicheData = {
    conceptId: conceptId.trim(),
    directionId: directionId || 'temp-direction-' + Date.now(), // Temporary ID if not provided
    categories,
    tropesAndStereotypes,
    llmMetadata,
  };

  const cliche = new Cliche(clicheData);

  // Return as array for consistency with function name
  return [cliche];
}

export default Cliche;
