/**
 * @file Traits rewriter display enhancement service
 * @description Formats rewritten traits for display and export
 * @see SpeechPatternsDisplayEnhancer.js
 * @see TraitsDisplayEnhancer.js
 */

import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import {
  TraitsRewriterError,
  TRAITS_REWRITER_ERROR_CODES,
} from '../errors/TraitsRewriterError.js';

/**
 * Label conversion map for trait keys
 *
 * @constant {object}
 */
const TRAIT_LABELS = {
  'core:personality': 'Personality',
  'core:likes': 'Likes',
  'core:dislikes': 'Dislikes',
  'core:fears': 'Fears',
  'core:goals': 'Goals',
  'core:notes': 'Notes',
  'core:profile': 'Profile',
  'core:secrets': 'Secrets',
  'core:strengths': 'Strengths',
  'core:weaknesses': 'Weaknesses',
  'core:internal_tensions': 'Internal Tensions',
  'core:motivations': 'Motivations',
  'core:dilemmas': 'Dilemmas',
};

/**
 * Service for enhancing rewritten traits display and export functionality
 * Handles formatting, HTML escaping, and file generation
 */
export class TraitsRewriterDisplayEnhancer {
  /** @private @type {ILogger} */
  #logger;

  /**
   * Create a new TraitsRewriterDisplayEnhancer instance
   *
   * @param {object} dependencies - Service dependencies
   */
  constructor(dependencies) {
    this.#validateDependencies(dependencies);
    this.#logger = ensureValidLogger(dependencies.logger);
    this.#logger.info(
      'TraitsRewriterDisplayEnhancer: Initialized successfully'
    );
  }

  /**
   * Enhance rewritten traits for display
   *
   * @param {object} traits - Raw traits from LLM
   * @param {object} options - Display options
   * @returns {object} Enhanced traits for display
   */
  enhanceForDisplay(traits, options = {}) {
    assertPresent(traits, 'Rewritten traits data');

    try {
      this.#logger.debug('Enhancing traits for display', {
        traitCount: Object.keys(traits).length,
        characterName: options.characterName,
      });

      const sections = this.createDisplaySections(traits);

      const displayData = {
        sections,
        characterName: options.characterName || 'Character',
        totalSections: sections.length,
        generatedAt: options.timestamp || new Date().toISOString(),
        displayOptions: options,
        enhanced: true,
      };

      this.#logger.debug('Traits enhanced successfully', {
        totalSections: displayData.totalSections,
      });

      return displayData;
    } catch (error) {
      this.#logger.error('Failed to enhance traits for display', error);
      throw TraitsRewriterError.forExportFailure(
        'Display enhancement failed',
        {
          characterName: options.characterName,
          traitCount: Object.keys(traits || {}).length,
        },
        error
      );
    }
  }

  /**
   * Create display sections from enhanced traits
   *
   * @param {object} traits - Enhanced trait data
   * @returns {Array<object>} Display sections
   */
  createDisplaySections(traits) {
    assertPresent(traits, 'Traits for display sections');

    try {
      const sections = [];
      let index = 0;

      // Process traits in a specific order if they exist
      const orderedKeys = [
        'core:personality',
        'core:profile',
        'core:motivations',
        'core:goals',
        'core:internal_tensions',
        'core:dilemmas',
        'core:strengths',
        'core:weaknesses',
        'core:likes',
        'core:dislikes',
        'core:fears',
        'core:secrets',
        'core:notes',
      ];

      // Process ordered keys first
      for (const key of orderedKeys) {
        if (traits[key]) {
          sections.push(this.#createTraitSection(key, traits[key], index++));
        }
      }

      // Process any remaining keys not in the ordered list
      for (const [key, value] of Object.entries(traits)) {
        if (!orderedKeys.includes(key)) {
          sections.push(this.#createTraitSection(key, value, index++));
        }
      }

      return sections;
    } catch (error) {
      this.#logger.error('Failed to create display sections', error);
      throw TraitsRewriterError.forSanitizationFailure(
        'Section creation failed',
        { traitCount: Object.keys(traits || {}).length },
        error
      );
    }
  }

  /**
   * Format traits for file export
   *
   * @param {object} traits - Traits data to format
   * @param {string} format - Export format ('json' or 'text')
   * @param {object} options - Export options
   * @returns {string} Formatted content for export
   */
  formatForExport(traits, format = 'text', options = {}) {
    assertPresent(traits, 'Traits data for export');
    assertNonBlankString(
      format,
      'Export format',
      'formatForExport',
      this.#logger
    );

    const supportedFormats = ['text', 'json'];
    if (!supportedFormats.includes(format.toLowerCase())) {
      throw TraitsRewriterError.forInvalidFormat(format, supportedFormats, {
        characterName: options.characterName,
      });
    }

    try {
      this.#logger.debug('Formatting traits for export', {
        format,
        characterName: options.characterName,
        traitCount: Object.keys(traits).length,
      });

      if (format.toLowerCase() === 'json') {
        return this.#formatAsJson(traits, options);
      } else {
        return this.#formatAsText(traits, options);
      }
    } catch (error) {
      this.#logger.error(`Failed to format traits for ${format} export`, error);
      throw TraitsRewriterError.forExportFailure(
        `Failed to format for ${format}`,
        {
          format,
          characterName: options.characterName,
        },
        error
      );
    }
  }

  /**
   * Generate export filename based on character and timestamp
   *
   * @param {string} characterName - Character name for filename
   * @param {string} format - File format
   * @returns {string} Generated filename
   */
  generateExportFilename(characterName = 'character', format = 'txt') {
    assertNonBlankString(
      characterName,
      'Character name',
      'generateExportFilename',
      this.#logger
    );

    // Sanitize character name for filesystem safety
    const safeName = characterName
      .replace(/[<>:"/\\|?*!]/g, '') // Remove invalid chars including exclamation marks
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .substring(0, 50) // Limit length
      .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens

    // Create ISO timestamp without milliseconds
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .split('T')
      .join('_')
      .slice(0, -5); // Remove milliseconds and 'Z'

    const extension = format === 'json' ? 'json' : 'txt';
    return `${safeName || 'character'}-traits-rewriter-${timestamp}.${extension}`;
  }

  /**
   * Create HTML representation of rewritten traits
   *
   * @param {object} traits - Traits to display
   * @returns {string} HTML string
   */
  createHtmlDisplay(traits) {
    assertPresent(traits, 'Traits for HTML display');

    try {
      const sections = this.createDisplaySections(traits);

      let html = '<div class="traits-rewriter-display">\n';

      for (const section of sections) {
        html += `  <div class="${section.cssClass}">\n`;
        html += `    <h3 class="${section.titleClass}">${section.label}</h3>\n`;
        html += `    <div class="${section.contentClass}">${section.content}</div>\n`;
        html += `  </div>\n`;
      }

      html += '</div>';

      return html;
    } catch (error) {
      this.#logger.error('Failed to create HTML display', error);
      throw TraitsRewriterError.forSanitizationFailure(
        'HTML generation failed',
        { traitCount: Object.keys(traits || {}).length },
        error
      );
    }
  }

  /**
   * Compare original and rewritten traits
   *
   * @param {object} original - Original traits
   * @param {object} rewritten - Rewritten traits
   * @returns {object} Comparison result
   */
  compareTraits(original, rewritten) {
    assertPresent(original, 'Original traits');
    assertPresent(rewritten, 'Rewritten traits');

    try {
      const changes = [];
      const allKeys = new Set([
        ...Object.keys(original),
        ...Object.keys(rewritten),
      ]);

      for (const key of allKeys) {
        if (!original[key] && rewritten[key]) {
          changes.push({
            key,
            type: 'added',
            newValue: rewritten[key],
          });
        } else if (original[key] && !rewritten[key]) {
          changes.push({
            key,
            type: 'removed',
            oldValue: original[key],
          });
        } else if (original[key] !== rewritten[key]) {
          changes.push({
            key,
            type: 'modified',
            oldValue: original[key],
            newValue: rewritten[key],
          });
        }
      }

      return {
        hasChanges: changes.length > 0,
        changeCount: changes.length,
        changes,
        comparison:
          changes.length > 0
            ? `Found ${changes.length} changes`
            : 'No changes detected',
      };
    } catch (error) {
      this.#logger.error('Failed to compare traits', error);
      throw TraitsRewriterError.forValidationFailure(
        'comparison',
        'Trait comparison failed',
        { error: error.message }
      );
    }
  }

  /**
   * Get service information
   *
   * @returns {object} Service metadata
   */
  getServiceInfo() {
    return {
      name: 'TraitsRewriterDisplayEnhancer',
      version: '1.0.0',
      status: 'active',
      implementationTask: 'TRAREW-007',
    };
  }

  // ================== Private Helper Methods ==================

  /**
   * Escape HTML content to prevent XSS
   *
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  #escapeHtmlContent(text) {
    if (text === null || text === undefined) {
      return '';
    }

    const stringValue =
      typeof text === 'string' ? text : String(text);

    return stringValue
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/=/g, '&#x3D;'); // Also escape equals sign for attribute safety
  }

  /**
   * Sanitize content for safe display
   *
   * @private
   * @param {string} content - Content to sanitize
   * @returns {string} Sanitized content
   */
  #sanitizeForDisplay(content) {
    if (content === null || content === undefined) {
      return this.#escapeHtmlContent(content);
    }

    const normalizedContent =
      typeof content === 'string' ? content : String(content);

    if (!normalizedContent) {
      return this.#escapeHtmlContent(normalizedContent);
    }

    // HTML escape
    let sanitized = this.#escapeHtmlContent(normalizedContent);

    // Trim whitespace
    sanitized = sanitized.trim();

    // Validate length
    if (sanitized.length > 5000) {
      sanitized = sanitized.substring(0, 5000) + '...';
      this.#logger.warn('Content truncated due to length limit', {
        originalLength: normalizedContent.length,
      });
    }

    return sanitized;
  }

  /**
   * Format trait key into human-readable label
   *
   * @private
   * @param {string} traitKey - Trait key to format
   * @returns {string} Formatted label
   */
  #formatTraitLabel(traitKey) {
    // Check if we have a predefined label
    if (TRAIT_LABELS[traitKey]) {
      return TRAIT_LABELS[traitKey];
    }

    // Otherwise, format the key
    return traitKey
      .replace('core:', '') // Remove namespace
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim()
      .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter
  }

  /**
   * Create a single trait section for display
   *
   * @private
   * @param {string} traitKey - Trait key
   * @param {string|Array} traitValue - Trait value (string or array of strings)
   * @param {number} index - Section index
   * @returns {object} Trait section object
   */
  #createTraitSection(traitKey, traitValue, index) {
    let sanitizedContent;
    
    // Handle array values (for goals and notes)
    if (Array.isArray(traitValue)) {
      // Create bulleted list for array items
      const items = traitValue.map(item => this.#sanitizeForDisplay(item));
      sanitizedContent = items.join('\n• ');
      if (items.length > 0) {
        sanitizedContent = '• ' + sanitizedContent;
      }
    } else {
      sanitizedContent = this.#sanitizeForDisplay(traitValue);
    }
    
    const label = this.#formatTraitLabel(traitKey);

    return {
      key: traitKey,
      label,
      content: sanitizedContent,
      cssClass: 'trait-section',
      titleClass: 'trait-section-title',
      contentClass: 'trait-content',
      index,
      isArray: Array.isArray(traitValue),
    };
  }

  /**
   * Format traits as JSON
   *
   * @private
   * @param {object} traits - Traits to format
   * @param {object} options - Export options
   * @returns {string} JSON formatted string
   */
  #formatAsJson(traits, options) {
    const exportData = {
      characterName: options.characterName || 'Character',
      rewrittenTraits: traits,
      exportedAt: new Date().toISOString(),
      exportFormat: 'json',
      traitCount: Object.keys(traits).length,
    };

    if (options.includeMetadata) {
      exportData.metadata = options.metadata || {};
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Format traits as text
   *
   * @private
   * @param {object} traits - Traits to format
   * @param {object} options - Export options
   * @returns {string} Text formatted string
   */
  #formatAsText(traits, options) {
    const characterName = options.characterName || 'Character';
    const timestamp = new Date().toISOString();

    let text = `Character: ${characterName}\n`;
    text += `Generated: ${timestamp}\n`;
    text += `Rewritten Traits\n`;
    text += `================\n\n`;

    // Process traits in order
    const sections = this.createDisplaySections(traits);

    for (const section of sections) {
      text += `${section.label}:\n`;
      // Don't escape HTML for text export, use original value
      const traitValue = traits[section.key];
      if (Array.isArray(traitValue)) {
        // Format array items as bulleted list
        traitValue.forEach(item => {
          text += `• ${item}\n`;
        });
        text += '\n';
      } else {
        text += `${traitValue}\n\n`;
      }
    }

    text += `\n--- End of Rewritten Traits ---\n`;
    text += `Total Traits: ${sections.length}\n`;
    text += `Exported: ${timestamp}\n`;

    return text;
  }

  /**
   * Validate dependencies
   *
   * @private
   * @param {object} dependencies - Dependencies to validate
   */
  #validateDependencies(dependencies) {
    validateDependency(dependencies.logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
  }
}

export default TraitsRewriterDisplayEnhancer;
