/**
 * @file Translates numerical chance percentages to qualitative labels for LLM prompts.
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} ChanceLevel
 * @property {number} min - Minimum percentage (inclusive).
 * @property {number} max - Maximum percentage (inclusive).
 * @property {string} label - Qualitative label.
 */

class ChanceTextTranslator {
  /** @type {ILogger} */
  #logger;

  /** @type {ChanceLevel[]} */
  static CHANCE_LEVELS = [
    { min: 95, max: 100, label: 'certain' },
    { min: 85, max: 94, label: 'excellent chance' },
    { min: 75, max: 84, label: 'very good chance' },
    { min: 65, max: 74, label: 'good chance' },
    { min: 55, max: 64, label: 'decent chance' },
    { min: 45, max: 54, label: 'fair chance' },
    { min: 35, max: 44, label: 'uncertain chance' },
    { min: 25, max: 34, label: 'poor chance' },
    { min: 15, max: 24, label: 'unlikely' },
    { min: 5, max: 14, label: 'very unlikely' },
    { min: 1, max: 4, label: 'desperate' },
    { min: 0, max: 0, label: 'impossible' },
  ];

  static CHANCE_PATTERN = /\((\d+)%\s+chance\)/gi;

  /**
   * Creates a new ChanceTextTranslator.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logger instance.
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn'],
    });
    this.#logger = logger;
    this.#logger.debug('ChanceTextTranslator: Initialized');
  }

  /**
   * Translate all chance percentage patterns in text to qualitative labels.
   *
   * @param {string} text - Text that may contain chance percentages.
   * @returns {string} Translated text for LLM prompts.
   */
  translateForLlm(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text.replace(
      ChanceTextTranslator.CHANCE_PATTERN,
      (match, percentStr) => {
        const percentage = parseInt(percentStr, 10);
        const label = this.getQualitativeLabel(percentage);
        return `(${label})`;
      }
    );
  }

  /**
   * Convert a numeric percentage to its qualitative label.
   *
   * @param {number} percentage - Percentage from 0-100.
   * @returns {string} Qualitative label.
   */
  getQualitativeLabel(percentage) {
    if (typeof percentage !== 'number' || Number.isNaN(percentage)) {
      this.#logger.warn(
        'ChanceTextTranslator: Invalid percentage, defaulting to fair chance',
        { percentage }
      );
      return 'fair chance';
    }

    const clamped = Math.max(0, Math.min(100, Math.round(percentage)));

    for (const level of ChanceTextTranslator.CHANCE_LEVELS) {
      if (clamped >= level.min && clamped <= level.max) {
        return level.label;
      }
    }

    this.#logger.warn(
      'ChanceTextTranslator: No matching level found, defaulting to fair chance',
      { percentage: clamped }
    );
    return 'fair chance';
  }
}

export { ChanceTextTranslator };
export default ChanceTextTranslator;
