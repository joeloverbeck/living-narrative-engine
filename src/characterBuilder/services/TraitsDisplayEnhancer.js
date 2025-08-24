/**
 * @file Service for formatting and presenting trait data in the user interface
 * @see TraitsGenerator.js
 * @see ../models/trait.js
 */

import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../models/trait.js').TraitData} TraitData
 * @typedef {import('../models/trait.js').LLMMetadata} LLMMetadata
 */

/**
 * Service for enhancing trait data display and export formatting
 *
 * This service handles trait organization, display formatting, and export preparation,
 * providing clean and professional presentation of character trait data.
 */
export class TraitsDisplayEnhancer {
  #logger;

  /**
   * Create a new TraitsDisplayEnhancer instance
   *
   * @param {object} dependencies - Service dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
  }

  /**
   * Enhance traits data for display presentation
   *
   * @param {TraitData} traitsData - Raw traits data from LLM
   * @param {object} options - Display options and preferences
   * @param {boolean} [options.includeMetadata] - Include generation metadata
   * @param {boolean} [options.expandStructuredData] - Expand structured fields
   * @returns {object} Enhanced traits formatted for UI display
   */
  enhanceForDisplay(traitsData, options = {}) {
    try {
      this.#validateTraitsData(traitsData);
    } catch (error) {
      this.#logger.error(`Invalid traits data provided: ${error.message}`);
      throw error;
    }

    const { includeMetadata = true, expandStructuredData = true } = options;

    this.#logger.debug('Enhancing traits data for display');

    // Build enhanced data structure with backward-compatible flat properties
    const enhancedData = {
      // Core properties
      id: traitsData.id,
      generatedAt: traitsData.generatedAt,

      // Pass through all trait properties directly for backward compatibility
      names: traitsData.names || [],
      physicalDescription: traitsData.physicalDescription || '',
      personality: traitsData.personality || [],
      strengths: traitsData.strengths || [],
      weaknesses: traitsData.weaknesses || [],
      likes: traitsData.likes || [],
      dislikes: traitsData.dislikes || [],
      fears: traitsData.fears || [],
      goals: traitsData.goals || {},
      notes: traitsData.notes || [],
      profile: traitsData.profile || '',
      secrets: traitsData.secrets || [],

      // Add organized display structure for UI components that need it
      categories: this.#organizeCategories(traitsData, expandStructuredData),
      summary: this.#generateSummary(traitsData),
    };

    // Add metadata if requested
    if (includeMetadata && traitsData.metadata) {
      enhancedData.metadata = this.#formatMetadata(traitsData.metadata);
    }

    this.#logger.debug('Traits data enhanced successfully');
    return enhancedData;
  }

  /**
   * Format traits for text export
   *
   * @param {TraitData} traitsData - Enhanced traits data
   * @param {object} metadata - Generation metadata
   * @param {string} [metadata.concept] - Character concept
   * @param {string} [metadata.direction] - Thematic direction
   * @param {object} [metadata.userInputs] - User-provided inputs
   * @returns {string} Formatted text for export
   */
  formatForExport(traitsData, metadata = {}) {
    try {
      this.#validateTraitsData(traitsData);
    } catch (error) {
      this.#logger.error(`Invalid traits data for export: ${error.message}`);
      throw error;
    }

    this.#logger.debug('Formatting traits for text export');

    const sections = [];

    // Header
    sections.push('CHARACTER TRAITS');
    sections.push('='.repeat(60));
    sections.push('');

    // Generation info
    sections.push(
      `Generated: ${this.#formatTimestamp(traitsData.generatedAt || new Date().toISOString())}`
    );
    if (metadata.concept) {
      sections.push(`Concept: ${metadata.concept}`);
    }
    if (metadata.direction) {
      sections.push(`Thematic Direction: ${metadata.direction}`);
    }
    sections.push('');

    // Names section
    sections.push('NAMES');
    sections.push('-'.repeat(30));
    if (traitsData.names && traitsData.names.length > 0) {
      traitsData.names.forEach((nameItem, index) => {
        sections.push(`• ${nameItem.name}: ${nameItem.justification}`);
      });
    } else {
      sections.push('• No names generated');
    }
    sections.push('');

    // Physical description
    sections.push('PHYSICAL DESCRIPTION');
    sections.push('-'.repeat(30));
    sections.push(
      traitsData.physicalDescription || 'No physical description provided'
    );
    sections.push('');

    // Personality
    sections.push('PERSONALITY');
    sections.push('-'.repeat(30));
    if (traitsData.personality && traitsData.personality.length > 0) {
      traitsData.personality.forEach((item) => {
        sections.push(`• ${item.trait}: ${item.explanation}`);
      });
    } else {
      sections.push('• No personality traits generated');
    }
    sections.push('');

    // Strengths
    sections.push('STRENGTHS');
    sections.push('-'.repeat(30));
    if (traitsData.strengths && traitsData.strengths.length > 0) {
      traitsData.strengths.forEach((strength) => {
        sections.push(`• ${strength}`);
      });
    } else {
      sections.push('• No strengths specified');
    }
    sections.push('');

    // Weaknesses
    sections.push('WEAKNESSES');
    sections.push('-'.repeat(30));
    if (traitsData.weaknesses && traitsData.weaknesses.length > 0) {
      traitsData.weaknesses.forEach((weakness) => {
        sections.push(`• ${weakness}`);
      });
    } else {
      sections.push('• No weaknesses specified');
    }
    sections.push('');

    // Likes
    sections.push('LIKES');
    sections.push('-'.repeat(30));
    if (traitsData.likes && traitsData.likes.length > 0) {
      traitsData.likes.forEach((like) => {
        sections.push(`• ${like}`);
      });
    } else {
      sections.push('• No likes specified');
    }
    sections.push('');

    // Dislikes
    sections.push('DISLIKES');
    sections.push('-'.repeat(30));
    if (traitsData.dislikes && traitsData.dislikes.length > 0) {
      traitsData.dislikes.forEach((dislike) => {
        sections.push(`• ${dislike}`);
      });
    } else {
      sections.push('• No dislikes specified');
    }
    sections.push('');

    // Fears
    sections.push('FEARS');
    sections.push('-'.repeat(30));
    if (traitsData.fears && traitsData.fears.length > 0) {
      traitsData.fears.forEach((fear) => {
        sections.push(`• ${fear}`);
      });
    } else {
      sections.push('• No fears specified');
    }
    sections.push('');

    // Goals
    sections.push('GOALS');
    sections.push('-'.repeat(30));
    if (traitsData.goals) {
      sections.push('Short-term:');
      if (traitsData.goals.shortTerm && traitsData.goals.shortTerm.length > 0) {
        traitsData.goals.shortTerm.forEach((goal) => {
          sections.push(`• ${goal}`);
        });
      } else {
        sections.push('• No short-term goals');
      }
      sections.push('');
      sections.push(
        `Long-term: ${traitsData.goals.longTerm || 'No long-term goal'}`
      );
    } else {
      sections.push('• No goals specified');
    }
    sections.push('');

    // Notes
    sections.push('ADDITIONAL NOTES');
    sections.push('-'.repeat(30));
    if (traitsData.notes && traitsData.notes.length > 0) {
      traitsData.notes.forEach((note) => {
        sections.push(`• ${note}`);
      });
    } else {
      sections.push('• No additional notes');
    }
    sections.push('');

    // Profile
    sections.push('CHARACTER PROFILE');
    sections.push('-'.repeat(30));
    sections.push(traitsData.profile || 'No profile summary provided');
    sections.push('');

    // Secrets
    sections.push('SECRETS');
    sections.push('-'.repeat(30));
    if (traitsData.secrets && traitsData.secrets.length > 0) {
      traitsData.secrets.forEach((secret) => {
        sections.push(`• ${secret}`);
      });
    } else {
      sections.push('• No secrets specified');
    }
    sections.push('');

    // User inputs if provided
    if (metadata.userInputs) {
      sections.push('USER INPUTS');
      sections.push('-'.repeat(30));
      if (metadata.userInputs.coreMotivation) {
        sections.push(`Core Motivation: ${metadata.userInputs.coreMotivation}`);
      }
      if (metadata.userInputs.internalContradiction) {
        sections.push(
          `Internal Contradiction: ${metadata.userInputs.internalContradiction}`
        );
      }
      if (metadata.userInputs.centralQuestion) {
        sections.push(
          `Central Question: ${metadata.userInputs.centralQuestion}`
        );
      }
      sections.push('');
    }

    // Generation metadata
    if (traitsData.metadata && Object.keys(traitsData.metadata).length > 0) {
      sections.push('GENERATION METADATA');
      sections.push('-'.repeat(30));
      sections.push(`Generated At: ${traitsData.generatedAt || 'Unknown'}`);
      if (traitsData.metadata.model) {
        sections.push(`LLM Model: ${traitsData.metadata.model}`);
      }
      if (traitsData.metadata.temperature !== undefined) {
        sections.push(`Temperature: ${traitsData.metadata.temperature}`);
      }
      if (traitsData.metadata.tokens) {
        sections.push(`Tokens Used: ${traitsData.metadata.tokens}`);
      }
      if (traitsData.metadata.promptVersion) {
        sections.push(`Prompt Version: ${traitsData.metadata.promptVersion}`);
      }
      sections.push('');
    }

    const exportText = sections.join('\n');
    this.#logger.debug('Traits formatted for export successfully');
    return exportText;
  }

  /**
   * Generate export filename based on traits content
   *
   * @param {TraitData} traitsData - Enhanced traits data
   * @param {object} [options] - Filename options
   * @param {string} [options.direction] - Thematic direction name
   * @returns {string} Suggested filename for export
   */
  generateExportFilename(traitsData, options = {}) {
    this.#logger.debug('Generating export filename');

    const parts = ['traits'];

    // Add direction slug if provided
    if (options.direction) {
      const directionSlug = this.#sanitizeForFilename(options.direction);
      if (directionSlug) {
        parts.push(directionSlug);
      }
    }

    // Add timestamp
    parts.push(this.#getTimestamp());

    const filename = parts.join('_') + '.txt';
    this.#logger.debug(`Generated filename: ${filename}`);
    return filename;
  }

  /**
   * Validate traits data structure
   *
   * @private
   * @param {TraitData} data - Data to validate
   * @throws {Error} If data is invalid
   */
  #validateTraitsData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Traits data must be a valid object');
    }

    // Check for at least some content
    const hasContent =
      (data.names && data.names.length > 0) ||
      data.physicalDescription ||
      (data.personality && data.personality.length > 0) ||
      data.profile;

    if (!hasContent) {
      throw new Error('Traits data must contain at least some content');
    }
  }

  /**
   * Organize trait categories for display
   *
   * @private
   * @param {TraitData} traitsData - Traits data
   * @param {boolean} expandStructured - Whether to expand structured data
   * @returns {Array} Organized categories
   */
  #organizeCategories(traitsData, expandStructured) {
    const categories = [];

    // Names (structured)
    if (traitsData.names && traitsData.names.length > 0) {
      categories.push({
        id: 'names',
        title: 'Character Names',
        type: 'structured',
        items: expandStructured
          ? traitsData.names.map((n) => ({
              primary: n.name,
              secondary: n.justification,
              type: 'name-justification',
            }))
          : traitsData.names,
        count: traitsData.names.length,
        priority: 1,
      });
    }

    // Physical Description (text)
    if (traitsData.physicalDescription) {
      categories.push({
        id: 'physical',
        title: 'Physical Description',
        type: 'text',
        content: traitsData.physicalDescription,
        priority: 2,
      });
    }

    // Personality (structured)
    if (traitsData.personality && traitsData.personality.length > 0) {
      categories.push({
        id: 'personality',
        title: 'Personality Traits',
        type: 'structured',
        items: expandStructured
          ? traitsData.personality.map((p) => ({
              primary: p.trait,
              secondary: p.explanation,
              type: 'trait-explanation',
            }))
          : traitsData.personality,
        count: traitsData.personality.length,
        priority: 3,
      });
    }

    // Strengths (list)
    if (traitsData.strengths && traitsData.strengths.length > 0) {
      categories.push({
        id: 'strengths',
        title: 'Strengths',
        type: 'list',
        items: traitsData.strengths,
        count: traitsData.strengths.length,
        priority: 4,
      });
    }

    // Weaknesses (list)
    if (traitsData.weaknesses && traitsData.weaknesses.length > 0) {
      categories.push({
        id: 'weaknesses',
        title: 'Weaknesses',
        type: 'list',
        items: traitsData.weaknesses,
        count: traitsData.weaknesses.length,
        priority: 5,
      });
    }

    // Likes (list)
    if (traitsData.likes && traitsData.likes.length > 0) {
      categories.push({
        id: 'likes',
        title: 'Likes',
        type: 'list',
        items: traitsData.likes,
        count: traitsData.likes.length,
        priority: 6,
      });
    }

    // Dislikes (list)
    if (traitsData.dislikes && traitsData.dislikes.length > 0) {
      categories.push({
        id: 'dislikes',
        title: 'Dislikes',
        type: 'list',
        items: traitsData.dislikes,
        count: traitsData.dislikes.length,
        priority: 7,
      });
    }

    // Fears (list)
    if (traitsData.fears && traitsData.fears.length > 0) {
      categories.push({
        id: 'fears',
        title: 'Fears',
        type: 'list',
        items: traitsData.fears,
        count: traitsData.fears.length,
        priority: 8,
      });
    }

    // Goals (structured)
    if (traitsData.goals) {
      categories.push({
        id: 'goals',
        title: 'Goals',
        type: 'structured',
        content: {
          shortTerm: traitsData.goals.shortTerm || [],
          longTerm: traitsData.goals.longTerm || '',
        },
        priority: 9,
      });
    }

    // Notes (list)
    if (traitsData.notes && traitsData.notes.length > 0) {
      categories.push({
        id: 'notes',
        title: 'Additional Notes',
        type: 'list',
        items: traitsData.notes,
        count: traitsData.notes.length,
        priority: 10,
      });
    }

    // Profile (text)
    if (traitsData.profile) {
      categories.push({
        id: 'profile',
        title: 'Character Profile',
        type: 'text',
        content: traitsData.profile,
        priority: 11,
      });
    }

    // Secrets (list)
    if (traitsData.secrets && traitsData.secrets.length > 0) {
      categories.push({
        id: 'secrets',
        title: 'Secrets',
        type: 'list',
        items: traitsData.secrets,
        count: traitsData.secrets.length,
        priority: 12,
      });
    }

    // Sort by priority for optimal display order
    categories.sort((a, b) => a.priority - b.priority);

    return categories;
  }

  /**
   * Generate a summary of the traits
   *
   * @private
   * @param {TraitData} traitsData - Traits data
   * @returns {object} Summary information
   */
  #generateSummary(traitsData) {
    const summary = {
      totalCategories: 0,
      namesCount: 0,
      personalityCount: 0,
      hasPhysicalDescription: false,
      hasProfile: false,
      completeness: 0,
    };

    // Count populated categories
    if (traitsData.names && traitsData.names.length > 0) {
      summary.totalCategories++;
      summary.namesCount = traitsData.names.length;
    }
    if (traitsData.physicalDescription) {
      summary.totalCategories++;
      summary.hasPhysicalDescription = true;
    }
    if (traitsData.personality && traitsData.personality.length > 0) {
      summary.totalCategories++;
      summary.personalityCount = traitsData.personality.length;
    }
    if (traitsData.strengths && traitsData.strengths.length > 0) {
      summary.totalCategories++;
    }
    if (traitsData.weaknesses && traitsData.weaknesses.length > 0) {
      summary.totalCategories++;
    }
    if (traitsData.likes && traitsData.likes.length > 0) {
      summary.totalCategories++;
    }
    if (traitsData.dislikes && traitsData.dislikes.length > 0) {
      summary.totalCategories++;
    }
    if (traitsData.fears && traitsData.fears.length > 0) {
      summary.totalCategories++;
    }
    if (
      traitsData.goals &&
      (traitsData.goals.shortTerm?.length > 0 || traitsData.goals.longTerm)
    ) {
      summary.totalCategories++;
    }
    if (traitsData.notes && traitsData.notes.length > 0) {
      summary.totalCategories++;
    }
    if (traitsData.profile) {
      summary.totalCategories++;
      summary.hasProfile = true;
    }
    if (traitsData.secrets && traitsData.secrets.length > 0) {
      summary.totalCategories++;
    }

    // Calculate completeness percentage (out of 12 possible categories)
    summary.completeness = Math.round((summary.totalCategories / 12) * 100);

    return summary;
  }

  /**
   * Format metadata for display
   *
   * @private
   * @param {LLMMetadata} metadata - LLM metadata
   * @returns {object} Formatted metadata
   */
  #formatMetadata(metadata) {
    const formatted = {};

    if (metadata.model) {
      formatted.model = metadata.model;
    }
    if (metadata.temperature !== undefined) {
      formatted.temperature = metadata.temperature;
    }
    if (metadata.tokens) {
      formatted.tokenCount = metadata.tokens;
    }
    if (metadata.responseTime) {
      formatted.generationTime = `${metadata.responseTime}ms`;
    }
    if (metadata.promptVersion) {
      formatted.promptVersion = metadata.promptVersion;
    }

    return formatted;
  }

  /**
   * Format timestamp for display
   *
   * @private
   * @param {string} isoString - ISO date string
   * @returns {string} Formatted date string
   */
  #formatTimestamp(isoString) {
    if (!isoString) {
      return 'Unknown date';
    }

    try {
      const date = new Date(isoString);

      if (isNaN(date.getTime())) {
        this.#logger.warn(`Invalid date string: ${isoString}`);
        return 'Invalid date';
      }

      // Format as "December 20, 2024 at 3:45 PM"
      const options = {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };

      const formatted = date.toLocaleString('en-US', options);
      return formatted.replace(',', ' at').replace(',', '');
    } catch (error) {
      this.#logger.error(`Error formatting timestamp: ${error.message}`);
      return 'Unknown date';
    }
  }

  /**
   * Sanitize text for use in filename
   *
   * @private
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  #sanitizeForFilename(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length
  }

  /**
   * Get timestamp for filename
   *
   * @private
   * @returns {string} Timestamp in YYYY-MM-DD_HHMMSS format
   */
  #getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
  }
}

export default TraitsDisplayEnhancer;
