/**
 * @file Service for processing prompt templates
 * @description Handles template loading and variable substitution
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { CHARACTER_PROMPT_TEMPLATE } from './templates/characterPromptTemplate.js';
import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * @class PromptTemplateService
 * @description Service that handles prompt template processing and variable substitution
 */
export class PromptTemplateService {
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('PromptTemplateService initialized');
  }

  /**
   * Process a template by replacing placeholders with values from data object
   *
   * @param {string} template - Template string with {placeholder} syntax
   * @param {Record<string, string>} data - Data object with values to substitute
   * @returns {string} Processed template with substituted values
   */
  processTemplate(template, data) {
    if (!template || typeof template !== 'string') {
      this.#logger.error(
        'PromptTemplateService.processTemplate: Invalid template provided'
      );
      return '';
    }

    if (!data || typeof data !== 'object') {
      this.#logger.error(
        'PromptTemplateService.processTemplate: Invalid data object provided'
      );
      return template;
    }

    let processedTemplate = template;
    const placeholderRegex = /{(\w+)}/g;
    const matches = template.match(placeholderRegex) || [];

    this.#logger.debug(
      `PromptTemplateService: Found ${matches.length} placeholders to process`
    );

    // Track missing placeholders for debugging
    const missingPlaceholders = [];

    // Replace each placeholder
    processedTemplate = template.replace(placeholderRegex, (match, key) => {
      if (key in data) {
        const value = data[key];
        // Handle null/undefined as empty string
        if (value === null || value === undefined) {
          this.#logger.debug(
            `PromptTemplateService: Placeholder '${key}' is null/undefined, using empty string`
          );
          return '';
        }
        // Ensure we return a string
        return String(value);
      } else {
        missingPlaceholders.push(key);
        // Keep the placeholder if no data provided
        return match;
      }
    });

    if (missingPlaceholders.length > 0) {
      this.#logger.warn(
        `PromptTemplateService: Missing data for placeholders: ${missingPlaceholders.join(', ')}`
      );
    }

    return processedTemplate;
  }

  /**
   * Get the character prompt template
   *
   * @returns {string} The character prompt template
   */
  getCharacterTemplate() {
    return CHARACTER_PROMPT_TEMPLATE;
  }

  /**
   * Process the character prompt template with provided data
   *
   * @param {Record<string, string>} promptData - Data to substitute in template
   * @returns {string} Processed prompt ready for LLM
   */
  processCharacterPrompt(promptData) {
    this.#logger.debug(
      'PromptTemplateService: Processing character prompt template'
    );
    const template = this.getCharacterTemplate();
    return this.processTemplate(template, promptData);
  }
}

export default PromptTemplateService;
