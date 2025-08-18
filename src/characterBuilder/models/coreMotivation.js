/**
 * @file CoreMotivation model
 * @description Represents a core motivation block for a character
 * @see characterConcept.js
 * @see thematicDirection.js
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {object} LLMMetadata
 * @property {string} model - LLM model used for generation
 * @property {number} temperature - Temperature setting used
 * @property {number} tokens - Token count for generation
 * @property {number} responseTime - Generation time in ms
 * @property {string} promptVersion - Version of prompt used
 * @property {string[]} clicheIds - IDs of clichés used to generate this motivation
 * @property {string} generationPrompt - The prompt used for generation (for debugging)
 */

/**
 * @typedef {object} CoreMotivationData
 * @property {string} [id] - Unique identifier (auto-generated if not provided)
 * @property {string} directionId - Reference to thematic direction
 * @property {string} conceptId - Reference to character concept
 * @property {string} coreDesire - What deeply drives the character
 * @property {string} internalContradiction - Internal contradiction or external conflict
 * @property {string} centralQuestion - Philosophical/narrative question
 * @property {string} [createdAt] - ISO timestamp (auto-generated if not provided)
 * @property {LLMMetadata} [metadata] - LLM generation metadata
 */

/**
 * Represents a core motivation with internal contradiction and central question
 */
export class CoreMotivation {
  /**
   * Create a new CoreMotivation instance
   *
   * @param {CoreMotivationData} data - Core motivation data
   * @returns {CoreMotivation} Validated core motivation instance
   */
  constructor(data = {}) {
    this.#validate(data);

    // Set properties
    this.id = data.id || uuidv4();
    this.directionId = data.directionId;
    this.conceptId = data.conceptId;
    this.coreDesire = data.coreDesire.trim();
    this.internalContradiction = data.internalContradiction.trim();
    this.centralQuestion = data.centralQuestion.trim();
    this.createdAt = data.createdAt || new Date().toISOString();

    // Optional metadata
    this.metadata = data.metadata || {};

    // Freeze to prevent mutation
    Object.freeze(this);
    Object.freeze(this.metadata);
  }

  /**
   * Validate required fields
   *
   * @param {CoreMotivationData} data - Data to validate
   * @private
   */
  #validate(data) {
    if (data === null || data === undefined) {
      throw new Error('CoreMotivation data is required');
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

    if (
      !data.coreDesire ||
      typeof data.coreDesire !== 'string' ||
      data.coreDesire.trim() === ''
    ) {
      throw new Error('Core desire is required');
    }

    if (
      !data.internalContradiction ||
      typeof data.internalContradiction !== 'string' ||
      data.internalContradiction.trim() === ''
    ) {
      throw new Error('Internal contradiction is required');
    }

    if (
      !data.centralQuestion ||
      typeof data.centralQuestion !== 'string' ||
      data.centralQuestion.trim() === ''
    ) {
      throw new Error('Central question is required');
    }
  }

  /**
   * Create a CoreMotivation from raw LLM response data
   *
   * @param {object} params - Parameters for creation
   * @param {string} params.directionId - Reference to thematic direction
   * @param {string} params.conceptId - Reference to character concept
   * @param {object} params.rawMotivation - Raw motivation from LLM
   * @param {LLMMetadata} [params.metadata] - Generation metadata
   * @returns {CoreMotivation} CoreMotivation instance
   */
  static fromLLMResponse({
    directionId,
    conceptId,
    rawMotivation,
    metadata = {},
  }) {
    return new CoreMotivation({
      directionId,
      conceptId,
      coreDesire:
        rawMotivation.coreDesire ||
        rawMotivation.coreMotivation ||
        rawMotivation.motivation,
      internalContradiction:
        rawMotivation.internalContradiction ||
        rawMotivation.contradiction ||
        rawMotivation.conflict,
      centralQuestion: rawMotivation.centralQuestion || rawMotivation.question,
      metadata,
    });
  }

  /**
   * Create CoreMotivation from stored data
   *
   * @param {object} data - Data from database
   * @returns {CoreMotivation} CoreMotivation instance
   */
  static fromRawData(data) {
    return new CoreMotivation(data);
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
      coreDesire: this.coreDesire,
      internalContradiction: this.internalContradiction,
      centralQuestion: this.centralQuestion,
      createdAt: this.createdAt,
      metadata: { ...this.metadata },
    };
  }

  /**
   * Validate motivation content meets quality standards
   *
   * @returns {object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Check minimum lengths
    if (this.coreDesire.length < 10) {
      errors.push('Core desire is too short (min 10 characters)');
    }
    if (this.internalContradiction.length < 10) {
      errors.push('Internal contradiction is too short (min 10 characters)');
    }
    if (this.centralQuestion.length < 10) {
      errors.push('Central question is too short (min 10 characters)');
    }

    // Check maximum lengths
    if (this.coreDesire.length > 500) {
      warnings.push(
        'Core desire is very long (max recommended 500 characters)'
      );
    }
    if (this.internalContradiction.length > 500) {
      warnings.push(
        'Internal contradiction is very long (max recommended 500 characters)'
      );
    }
    if (this.centralQuestion.length > 500) {
      warnings.push(
        'Central question is very long (max recommended 500 characters)'
      );
    }

    // Check for question mark in central question
    if (!this.centralQuestion.includes('?')) {
      warnings.push('Central question should end with a question mark');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Format motivation for display
   *
   * @returns {string} Formatted string representation
   */
  toString() {
    return (
      `Core Desire: ${this.coreDesire}\n` +
      `Internal Contradiction: ${this.internalContradiction}\n` +
      `Central Question: ${this.centralQuestion}`
    );
  }

  /**
   * Get a summary of the motivation
   *
   * @param {number} maxLength - Maximum length for each field
   * @returns {object} Summary with truncated fields
   */
  getSummary(maxLength = 100) {
    const truncate = (str) => {
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength - 3) + '...';
    };

    return {
      coreDesire: truncate(this.coreDesire),
      internalContradiction: truncate(this.internalContradiction),
      centralQuestion: truncate(this.centralQuestion),
    };
  }

  /**
   * Clone the motivation
   *
   * @returns {CoreMotivation} New CoreMotivation instance
   */
  clone() {
    return new CoreMotivation(this.toJSON());
  }

  /**
   * Check if motivation matches search terms
   *
   * @param {string} searchTerm - Term to search for
   * @returns {boolean} True if any field contains the search term
   */
  matchesSearch(searchTerm) {
    const term = searchTerm.toLowerCase();
    return (
      this.coreDesire.toLowerCase().includes(term) ||
      this.internalContradiction.toLowerCase().includes(term) ||
      this.centralQuestion.toLowerCase().includes(term)
    );
  }
}

export default CoreMotivation;
